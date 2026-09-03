use super::types::TargetAddressMatch;

/// Check if test phrase matches target address across Bitcoin, EVM, and Solana
pub fn check_target_match(
    target: &str,
    test_phrase: &str,
    position_index: usize,
    word: &str,
) -> Option<TargetAddressMatch> {
    if let Ok(creds) =
        crate::core::wallets::derivation::derive_dual_credentials_native(test_phrase, "seed")
    {
        let is_evm = target.starts_with("0x") || target.len() == 42;
        let is_btc =
            target.starts_with("bc1") || target.starts_with('1') || target.starts_with('3');

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
        } else if let Some(ref addr) = creds.sol_address {
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
    None
}
