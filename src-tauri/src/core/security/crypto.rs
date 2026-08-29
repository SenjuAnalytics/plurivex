use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;

const MAGIC_PLX1: &[u8; 4] = b"PLX1";
const SALT_LEN: usize = 16;
const IV_LEN: usize = 12;

/// Derive 256-bit key using modern Argon2id
pub fn derive_argon2id_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    let params = Params::new(19456, 2, 1, Some(32))
        .map_err(|e| format!("Argon2 params error: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Argon2 derivation error: {}", e))?;
    Ok(key)
}

/// Derive 256-bit key using legacy PBKDF2 (120,000 iterations SHA-256) for backward compatibility
pub fn derive_pbkdf2_key(password: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 120_000, &mut key);
    key
}

/// Encrypt plaintext using Argon2id + AES-256-GCM (Format V2: PLX1)
pub fn encrypt_vault(plaintext: &str, password: &str) -> Result<String, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut iv = [0u8; IV_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut iv);

    let key = derive_argon2id_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&iv);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut packed = Vec::with_capacity(4 + SALT_LEN + IV_LEN + ciphertext.len());
    packed.extend_from_slice(MAGIC_PLX1);
    packed.extend_from_slice(&salt);
    packed.extend_from_slice(&iv);
    packed.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(packed))
}

/// Decrypt ciphertext blob supporting both modern Argon2id (PLX1) and legacy PBKDF2
pub fn decrypt_vault(blob: &str, password: &str) -> Result<String, String> {
    let packed = BASE64
        .decode(blob.trim())
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if packed.starts_with(MAGIC_PLX1) {
        // Modern Argon2id format
        if packed.len() < 4 + SALT_LEN + IV_LEN {
            return Err("Argon2id blob too short".to_string());
        }
        let salt = &packed[4..4 + SALT_LEN];
        let iv = &packed[4 + SALT_LEN..4 + SALT_LEN + IV_LEN];
        let ciphertext = &packed[4 + SALT_LEN + IV_LEN..];

        let key = derive_argon2id_key(password, salt)?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let nonce = Nonce::from_slice(iv);
        let decrypted = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed (Invalid password)".to_string())?;
        String::from_utf8(decrypted).map_err(|e| format!("UTF-8 decoding error: {}", e))
    } else {
        // Legacy PBKDF2 format
        if packed.len() < SALT_LEN + IV_LEN {
            return Err("Legacy blob too short".to_string());
        }
        let salt = &packed[0..SALT_LEN];
        let iv = &packed[SALT_LEN..SALT_LEN + IV_LEN];
        let ciphertext = &packed[SALT_LEN + IV_LEN..];

        let key = derive_pbkdf2_key(password, salt);
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let nonce = Nonce::from_slice(iv);
        let decrypted = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed (Invalid password)".to_string())?;
        String::from_utf8(decrypted).map_err(|e| format!("UTF-8 decoding error: {}", e))
    }
}

/// Create verification token for password authentication
pub fn create_verification_token(password: &str) -> Result<String, String> {
    encrypt_vault("__vault_ok__", password)
}

/// Verify password against verification token
pub fn verify_password(token: &str, password: &str) -> bool {
    match decrypt_vault(token, password) {
        Ok(val) => val == "__vault_ok__",
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2id_encryption_and_decryption() {
        let password = "SuperSecurePassword123!";
        let secret = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

        let encrypted = encrypt_vault(secret, password).expect("Encryption failed");
        assert!(encrypted.len() > 32);

        let decrypted = decrypt_vault(&encrypted, password).expect("Decryption failed");
        assert_eq!(decrypted, secret);

        // Wrong password must fail
        assert!(decrypt_vault(&encrypted, "WrongPassword!").is_err());
    }

    #[test]
    fn test_password_verification() {
        let password = "MyMasterPassword456$";
        let token = create_verification_token(password).expect("Failed to create token");

        assert!(verify_password(&token, password));
        assert!(!verify_password(&token, "WrongPassword"));
    }

    #[test]
    fn test_legacy_pbkdf2_backward_compatibility() {
        // Manually simulate a legacy PBKDF2 encrypted payload matching the old JS WebCrypto format
        let password = "legacyPassword999";
        let secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let default_salt = b"wallet_inspect_s"; // 16 bytes
        let mut iv = [0u8; 12];
        iv.copy_from_slice(b"123456789012");

        let key = derive_pbkdf2_key(password, default_salt);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let nonce = Nonce::from_slice(&iv);
        let ciphertext = cipher.encrypt(nonce, secret.as_bytes()).unwrap();

        let mut legacy_packed = Vec::new();
        legacy_packed.extend_from_slice(default_salt);
        legacy_packed.extend_from_slice(&iv);
        legacy_packed.extend_from_slice(&ciphertext);
        let legacy_b64 = BASE64.encode(legacy_packed);

        // Rust decrypt_vault must automatically detect legacy format and decrypt seamlessly!
        let decrypted = decrypt_vault(&legacy_b64, password).expect("Legacy PBKDF2 decryption failed");
        assert_eq!(decrypted, secret);
    }
}
