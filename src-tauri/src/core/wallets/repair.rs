use bip39::{Language, Mnemonic};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordAnalysis {
    pub index: usize,
    pub raw_word: String,
    pub is_valid_bip39: bool,
    pub is_placeholder: bool,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetAddressMatch {
    pub position_index: usize,
    pub word: String,
    pub phrase: String,
    pub matched_address: String,
    pub chain_family: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionCandidateGroup {
    pub position_index: usize,
    pub candidate_count: usize,
    pub sample_words: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlotCandidateWord {
    pub word: String,
    pub position_index: usize,
    pub full_phrase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MnemonicRepairResult {
    pub total_words: usize,
    pub is_length_valid: bool,
    pub has_invalid_words: bool,
    pub is_checksum_valid: bool,
    pub is_single_word_missing: bool,
    pub missing_word_index: Option<usize>,
    pub candidate_valid_words: Vec<String>,
    pub words: Vec<WordAnalysis>,
    pub auto_repaired_phrases: Vec<String>,
    pub target_match: Option<TargetAddressMatch>,
    pub position_candidates: Vec<PositionCandidateGroup>,
    pub all_slot_candidates: Vec<SlotCandidateWord>,
}

/// Compute Levenshtein distance between two lowercase strings
pub fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let m = a_chars.len();
    let n = b_chars.len();

    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }

    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 0..=m {
        dp[i][0] = i;
    }
    for j in 0..=n {
        dp[0][j] = j;
    }

    for i in 1..=m {
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1) // deletion
                .min(dp[i][j - 1] + 1)   // insertion
                .min(dp[i - 1][j - 1] + cost); // substitution
        }
    }

    dp[m][n]
}

/// Check if test phrase matches target address across Bitcoin, EVM, and Solana
pub fn check_target_match(
    target: &str,
    test_phrase: &str,
    position_index: usize,
    word: &str,
) -> Option<TargetAddressMatch> {
    if let Ok(creds) = crate::core::wallets::derivation::derive_dual_credentials_native(test_phrase, "seed") {
        let is_evm = target.starts_with("0x") || target.len() == 42;
        let is_btc = target.starts_with("bc1") || target.starts_with('1') || target.starts_with('3');

        if is_btc {
            if let Some(ref addr) = creds.btc_address {
                if addr.eq_ignore_ascii_case(target) {
                    return Some(TargetAddressMatch {
                        position_index,
                        word: word.to_string(),
                        phrase: test_phrase.to_string(),
                        matched_address: addr.clone(),
                        chain_family: "bitcoin".to_string(),
                    });
                }
            }
            if let Some(ref addr) = creds.btc_legacy_address {
                if addr == target {
                    return Some(TargetAddressMatch {
                        position_index,
                        word: word.to_string(),
                        phrase: test_phrase.to_string(),
                        matched_address: addr.clone(),
                        chain_family: "bitcoin".to_string(),
                    });
                }
            }
        } else if is_evm {
            if let Some(ref addr) = creds.evm_address {
                if addr.eq_ignore_ascii_case(target) {
                    return Some(TargetAddressMatch {
                        position_index,
                        word: word.to_string(),
                        phrase: test_phrase.to_string(),
                        matched_address: addr.clone(),
                        chain_family: "evm".to_string(),
                    });
                }
            }
        } else {
            if let Some(ref addr) = creds.sol_address {
                if addr == target {
                    return Some(TargetAddressMatch {
                        position_index,
                        word: word.to_string(),
                        phrase: test_phrase.to_string(),
                        matched_address: addr.clone(),
                        chain_family: "solana".to_string(),
                    });
                }
            }
        }
    }
    None
}

/// Check if a token is an intentional placeholder indicating a missing/unknown word
pub fn is_placeholder_token(token: &str) -> bool {
    let s = token.trim().to_lowercase();
    matches!(
        s.as_str(),
        "?" | "*" | "_" | "x" | "missing" | "unknown" | "blank" | "none" | "null" | "???"
    )
}

/// Find closest BIP-39 words for a given input word
pub fn suggest_bip39_words(raw_word: &str, max_suggestions: usize) -> Vec<String> {
    let normalized = raw_word.trim().to_lowercase();
    if normalized.is_empty() || is_placeholder_token(&normalized) {
        return Vec::new();
    }

    let word_list = Language::English.word_list();

    // If exact match exists, return it immediately
    if word_list.contains(&normalized.as_str()) {
        return vec![normalized];
    }

    // Collect words with their distances
    let mut candidates: Vec<(usize, &str)> = word_list
        .iter()
        .map(|&w| (levenshtein_distance(&normalized, w), w))
        .filter(|(dist, _)| *dist <= 2) // only close typos (distance 1 or 2)
        .collect();

    // Sort by smallest distance first, then alphabetically
    candidates.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(b.1)));

    candidates
        .into_iter()
        .take(max_suggestions)
        .map(|(_, w)| w.to_string())
        .collect()
}

/// Inspect and attempt heuristic repair on a mnemonic phrase, with auto-solve for missing words & target address matching
pub fn analyze_and_repair_mnemonic(
    phrase: &str,
    target_address: Option<&str>,
    target_position: Option<usize>,
) -> MnemonicRepairResult {
    let mut raw_tokens: Vec<&str> = phrase
        .split_whitespace()
        .collect();

    let initial_count = raw_tokens.len();
    let word_list = Language::English.word_list();

    let mut is_single_word_missing = false;
    let mut missing_word_index = None;

    // Detect if user pasted 11 words (for 12-word seed) or 23 words (for 24-word seed)
    if initial_count == 11 || initial_count == 23 {
        is_single_word_missing = true;
        let pos = match target_position {
            Some(p) if p <= initial_count => p,
            _ => initial_count,
        };
        missing_word_index = Some(pos);
        raw_tokens.insert(pos, "?"); // Insert placeholder at requested position (default end)
    }

    let total_words = raw_tokens.len();
    let is_length_valid = matches!(total_words, 12 | 15 | 18 | 21 | 24);

    let mut words = Vec::with_capacity(total_words);
    let mut invalid_indices = Vec::new();
    let mut placeholder_indices = Vec::new();

    for (index, &token) in raw_tokens.iter().enumerate() {
        let clean = token.to_lowercase();
        let is_placeholder = is_placeholder_token(&clean);
        let is_valid = !is_placeholder && word_list.contains(&clean.as_str());

        let suggestions = if is_valid {
            Vec::new()
        } else if is_placeholder {
            placeholder_indices.push(index);
            Vec::new()
        } else {
            invalid_indices.push(index);
            suggest_bip39_words(&clean, 5)
        };

        words.push(WordAnalysis {
            index,
            raw_word: clean,
            is_valid_bip39: is_valid,
            is_placeholder,
            suggestions,
        });
    }

    // If there is exactly one placeholder inside a valid-length phrase
    if is_length_valid && placeholder_indices.len() == 1 && invalid_indices.is_empty() {
        is_single_word_missing = true;
        missing_word_index = Some(placeholder_indices[0]);
    }

    let has_invalid_words = !invalid_indices.is_empty() || !placeholder_indices.is_empty();

    // Check if the current phrase passes BIP-39 validation directly
    let is_checksum_valid = if !has_invalid_words && is_length_valid {
        let clean_phrase = raw_tokens
            .iter()
            .map(|t| t.to_lowercase())
            .collect::<Vec<String>>()
            .join(" ");
        Mnemonic::parse_normalized(&clean_phrase).is_ok()
    } else {
        false
    };

    let mut candidate_valid_words = Vec::new();
    let mut auto_repaired_phrases = Vec::new();
    let mut target_match = None;
    let mut position_candidates = Vec::new();
    let mut all_slot_candidates = Vec::new();

    let clean_target = target_address.map(|s| s.trim()).filter(|s| !s.is_empty());

    // Compute candidate counts across all positions if 11 words were entered
    if initial_count == 11 && invalid_indices.is_empty() {
        let original_11: Vec<String> = phrase.split_whitespace().map(|s| s.to_lowercase()).collect();
        for pos in 0..=11 {
            let mut valid_count = 0;
            let mut sample_words = Vec::new();

            for &w in word_list.iter() {
                let mut test_words = original_11.clone();
                test_words.insert(pos, w.to_string());
                let test_phrase = test_words.join(" ");

                if Mnemonic::parse_normalized(&test_phrase).is_ok() {
                    valid_count += 1;
                    if sample_words.len() < 5 {
                        sample_words.push(w.to_string());
                    }

                    all_slot_candidates.push(SlotCandidateWord {
                        word: w.to_string(),
                        position_index: pos,
                        full_phrase: test_phrase.clone(),
                    });

                    // If no specific slot was chosen, include all positions in candidate_valid_words and auto_repaired_phrases
                    if target_position.is_none() {
                        candidate_valid_words.push(w.to_string());
                        auto_repaired_phrases.push(test_phrase.clone());
                    }

                    // Target address matcher check
                    if target_match.is_none() {
                        if let Some(target) = clean_target {
                            target_match = check_target_match(target, &test_phrase, pos, w);
                        }
                    }
                }
            }

            position_candidates.push(PositionCandidateGroup {
                position_index: pos,
                candidate_count: valid_count,
                sample_words,
            });
        }
    }

    // Case 1: Exactly 1 word is missing at target_idx (when a specific position is selected)
    if is_single_word_missing && missing_word_index.is_some() && (target_position.is_some() || initial_count != 11) {
        let target_idx = missing_word_index.unwrap();
        if invalid_indices.is_empty() {
            // Test all 2,048 words for this specific missing slot
            for &w in word_list.iter() {
                let mut test_words: Vec<String> = words.iter().map(|w| w.raw_word.clone()).collect();
                test_words[target_idx] = w.to_string();
                let test_phrase = test_words.join(" ");

                if Mnemonic::parse_normalized(&test_phrase).is_ok() {
                    candidate_valid_words.push(w.to_string());
                    auto_repaired_phrases.push(test_phrase.clone());

                    // If target address is specified and target_match not yet found
                    if target_match.is_none() {
                        if let Some(target) = clean_target {
                            target_match = check_target_match(target, &test_phrase, target_idx, w);
                        }
                    }
                }
            }

            // Put the candidate words directly into suggestions for that missing word
            if target_idx < words.len() {
                words[target_idx].suggestions = candidate_valid_words.iter().cloned().collect();
            }
        }
    }
    // Case 2: Exactly 1 word has typos with candidate suggestions -> test permutations
    else if is_length_valid && invalid_indices.len() == 1 && placeholder_indices.is_empty() {
        let typo_idx = invalid_indices[0];
        let candidates = words[typo_idx].suggestions.clone();

        for cand in &candidates {
            let mut test_words: Vec<String> = words.iter().map(|w| w.raw_word.clone()).collect();
            test_words[typo_idx] = cand.clone();
            let test_phrase = test_words.join(" ");

            if Mnemonic::parse_normalized(&test_phrase).is_ok() {
                candidate_valid_words.push(cand.clone());
                auto_repaired_phrases.push(test_phrase.clone());

                if target_match.is_none() {
                    if let Some(target) = clean_target {
                        target_match = check_target_match(target, &test_phrase, typo_idx, cand);
                    }
                }
            }
        }
    }
    // Case 3: All words are valid BIP-39 words, but the checksum is invalid (last word or a wrong word)
    else if is_length_valid && !has_invalid_words && !is_checksum_valid {
        let last_idx = total_words - 1;
        for &w in word_list.iter() {
            let mut test_words: Vec<String> = words.iter().map(|w| w.raw_word.clone()).collect();
            test_words[last_idx] = w.to_string();
            let test_phrase = test_words.join(" ");

            if Mnemonic::parse_normalized(&test_phrase).is_ok() {
                candidate_valid_words.push(w.to_string());
                auto_repaired_phrases.push(test_phrase.clone());

                if target_match.is_none() {
                    if let Some(target) = clean_target {
                        target_match = check_target_match(target, &test_phrase, last_idx, w);
                    }
                }
            }
        }
    }

    MnemonicRepairResult {
        total_words,
        is_length_valid,
        has_invalid_words,
        is_checksum_valid,
        is_single_word_missing,
        missing_word_index: if target_position.is_none() && initial_count == 11 { None } else { missing_word_index },
        candidate_valid_words,
        words,
        auto_repaired_phrases,
        target_match,
        position_candidates,
        all_slot_candidates,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_levenshtein() {
        assert_eq!(levenshtein_distance("aple", "apple"), 1);
        assert_eq!(levenshtein_distance("wether", "weather"), 1);
        assert_eq!(levenshtein_distance("abandon", "abandon"), 0);
        assert_eq!(levenshtein_distance("", "abc"), 3);
    }

    #[test]
    fn test_suggest_typo() {
        let suggestions = suggest_bip39_words("aple", 3);
        assert!(suggestions.contains(&"apple".to_string()));
    }

    #[test]
    fn test_repair_known_mnemonic() {
        // Valid 12-word phrase
        let valid_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let res_valid = analyze_and_repair_mnemonic(valid_phrase, None, None);
        assert!(res_valid.is_length_valid);
        assert!(!res_valid.has_invalid_words);
        assert!(res_valid.is_checksum_valid);

        // Phrase with 1 typo at the end: 'abou' instead of 'about'
        let typo_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abou";
        let res_typo = analyze_and_repair_mnemonic(typo_phrase, None, None);
        assert!(res_typo.has_invalid_words);
        assert!(!res_typo.is_checksum_valid);
        assert_eq!(res_typo.words[11].suggestions[0], "about");
        assert!(res_typo.auto_repaired_phrases.contains(&valid_phrase.to_string()));
    }

    #[test]
    fn test_solve_11_words_auto_discovery() {
        // User passes only 11 words with no slot chosen (All Positions Combined by default):
        let eleven_words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
        let res = analyze_and_repair_mnemonic(eleven_words, None, None);
        assert!(res.is_single_word_missing);
        assert_eq!(res.missing_word_index, None); // None means all slots combined!
        assert!(res.candidate_valid_words.contains(&"about".to_string()));
        assert!(res.auto_repaired_phrases.iter().any(|p| p.ends_with("about")));
        assert_eq!(res.position_candidates.len(), 12);
        assert!(res.all_slot_candidates.len() >= 128);

        // When specific slot is chosen (e.g. Slot 12 / index 11):
        let res_slot12 = analyze_and_repair_mnemonic(eleven_words, None, Some(11));
        assert_eq!(res_slot12.missing_word_index, Some(11));
        assert_eq!(res_slot12.candidate_valid_words.len(), 128);
    }

    #[test]
    fn test_target_address_matcher_evm() {
        let full_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let creds = crate::core::wallets::derivation::derive_dual_credentials_native(full_phrase, "seed").unwrap();
        let target_evm = creds.evm_address.unwrap();

        // 11 words passed with target EVM address:
        let eleven = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
        let res = analyze_and_repair_mnemonic(eleven, Some(&target_evm), None);

        assert!(res.target_match.is_some());
        let m = res.target_match.unwrap();
        assert_eq!(m.position_index, 11);
        assert_eq!(m.word, "about");
        assert_eq!(m.chain_family, "evm");
    }

    #[test]
    fn test_target_address_matcher_first_word_missing() {
        // Full phrase: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        let full_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let creds = crate::core::wallets::derivation::derive_dual_credentials_native(full_phrase, "seed").unwrap();
        let target_evm = creds.evm_address.unwrap();

        // Missing the FIRST word (Word #1):
        // 11 words starting from word 2:
        let eleven_first_missing = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let res = analyze_and_repair_mnemonic(eleven_first_missing, Some(&target_evm), None);

        assert!(res.target_match.is_some());
        let m = res.target_match.unwrap();
        assert_eq!(m.position_index, 0); // Position 0 (Slot #1) automatically discovered!
        assert_eq!(m.word, "abandon");
    }

    #[test]
    fn test_target_address_matcher_bitcoin() {
        let full_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let creds = crate::core::wallets::derivation::derive_dual_credentials_native(full_phrase, "seed").unwrap();
        let target_btc = creds.btc_address.unwrap();

        let eleven = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
        let res = analyze_and_repair_mnemonic(eleven, Some(&target_btc), None);

        assert!(res.target_match.is_some());
        let m = res.target_match.unwrap();
        assert_eq!(m.position_index, 11);
        assert_eq!(m.word, "about");
        assert_eq!(m.chain_family, "bitcoin");
        assert_eq!(m.matched_address, target_btc);
    }
}
