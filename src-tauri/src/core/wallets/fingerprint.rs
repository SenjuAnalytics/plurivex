use base64::Engine;
use sha2::{Digest, Sha256};

pub fn canonical_key(text: &str) -> String {
    let t = text.trim();
    let hex = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")).unwrap_or(t);
    if hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()) && !t.contains(char::is_whitespace) {
        return format!("pk:{}", hex.to_ascii_lowercase());
    }
    let words: Vec<&str> = t.split_whitespace().collect();
    if [12, 15, 18, 21, 24].contains(&words.len()) {
        return format!("seed:{}", words.iter().map(|w| w.to_ascii_lowercase()).collect::<Vec<_>>().join(" "));
    }
    if let Ok(bytes) = bs58::decode(t).into_vec() {
        if bytes.len() == 32 || bytes.len() == 64 {
            return format!("sol:{}", t);
        }
    }
    format!("seed:{}", words.iter().map(|w| w.to_ascii_lowercase()).collect::<Vec<_>>().join(" "))
}

/// Computes SHA-256 fingerprint matching frontend `walletFingerprint`
pub fn calculate_fingerprint(data: &str) -> String {
    let canonical = canonical_key(data);
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    base64::engine::general_purpose::STANDARD.encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_fingerprint_uniqueness() {
        let p1 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let p2 = "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong";
        let f1 = calculate_fingerprint(p1);
        let f2 = calculate_fingerprint(p2);

        assert_ne!(f1, f2, "Different phrases must not collide");
        assert_eq!(f1, calculate_fingerprint(&format!("  {}  ", p1)), "Whitespace normalization must match");
    }

    #[test]
    fn test_canonical_key_hex_pk() {
        let pk = "0x4f3edf983ac636a65a842ce7c78d3270fad800125aa24e83cb4b08b204ad9ee8";
        let canonical = canonical_key(pk);
        assert_eq!(
            canonical,
            "pk:4f3edf983ac636a65a842ce7c78d3270fad800125aa24e83cb4b08b204ad9ee8"
        );
    }
}
