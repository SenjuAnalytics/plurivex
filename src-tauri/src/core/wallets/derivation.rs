use bip32::{DerivationPath, XPrv};
use bip39::Mnemonic;
use ed25519_dalek::SigningKey as EdSigningKey;
use hmac::{Hmac, Mac};
use k256::ecdsa::SigningKey;
use serde::{Deserialize, Serialize};
use sha2::Sha512;
use sha3::{Digest, Keccak256};

type HmacSha512 = Hmac<Sha512>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DualCredentials {
    pub evm_address: Option<String>,
    pub sol_address: Option<String>,
    pub evm_private_key: Option<String>,
    pub sol_private_key: Option<String>,
}

/// Derive standard SLIP-0010 Ed25519 master and child keys (Phantom/Solflare standard)
pub fn slip10_derive_ed25519(seed: &[u8], path: &[u32]) -> [u8; 32] {
    let mut mac = HmacSha512::new_from_slice(b"ed25519 seed").expect("HMAC init");
    mac.update(seed);
    let result = mac.finalize().into_bytes();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result[0..32]);
    let mut chain_code = [0u8; 32];
    chain_code.copy_from_slice(&result[32..64]);

    for &index in path {
        let mut mac = HmacSha512::new_from_slice(&chain_code).expect("HMAC step");
        mac.update(&[0x00]);
        mac.update(&key);
        mac.update(&index.to_be_bytes());
        let result = mac.finalize().into_bytes();
        key.copy_from_slice(&result[0..32]);
        chain_code.copy_from_slice(&result[32..64]);
    }
    key
}

/// Convert uncompressed public key (65 bytes starting with 0x04) to checksummed EVM address
pub fn evm_address_from_public_key(pubkey_bytes: &[u8]) -> String {
    let raw_pub = if pubkey_bytes.len() == 65 && pubkey_bytes[0] == 0x04 {
        &pubkey_bytes[1..]
    } else {
        pubkey_bytes
    };

    let hash = Keccak256::digest(raw_pub);
    let addr_bytes = &hash[12..32];
    let hex_addr = hex::encode(addr_bytes);

    // EIP-55 checksum encoding
    let hash_eip55 = Keccak256::digest(hex_addr.as_bytes());
    let mut checksummed = String::with_capacity(42);
    checksummed.push_str("0x");

    for (i, c) in hex_addr.chars().enumerate() {
        let hash_byte = hash_eip55[i / 2];
        let hash_nibble = if i % 2 == 0 {
            hash_byte >> 4
        } else {
            hash_byte & 0x0f
        };

        if hash_nibble >= 8 {
            checksummed.push(c.to_ascii_uppercase());
        } else {
            checksummed.push(c.to_ascii_lowercase());
        }
    }

    checksummed
}

/// Derive EVM address directly from a 32-byte private key
pub fn evm_address_from_private_key(pk_bytes: &[u8; 32]) -> Result<(String, String), String> {
    let signing_key = SigningKey::from_bytes(pk_bytes.into())
        .map_err(|e| format!("Invalid secp256k1 key: {}", e))?;
    let verifying_key = signing_key.verifying_key();
    let uncompressed = verifying_key.to_encoded_point(false);
    let address = evm_address_from_public_key(uncompressed.as_bytes());
    let private_key_hex = format!("0x{}", hex::encode(pk_bytes));
    Ok((address, private_key_hex))
}

/// Derive Solana address and Base58 secret key from 32-byte seed
pub fn solana_credentials_from_seed(seed_32: &[u8; 32]) -> (String, String) {
    let signing_key = EdSigningKey::from_bytes(seed_32);
    let verifying_key = signing_key.verifying_key();
    let sol_address = bs58::encode(verifying_key.as_bytes()).into_string();

    // 64-byte keypair (32 bytes secret + 32 bytes public) standard in Solana web3
    let mut keypair_bytes = [0u8; 64];
    keypair_bytes[0..32].copy_from_slice(seed_32);
    keypair_bytes[32..64].copy_from_slice(verifying_key.as_bytes());
    let sol_private_key = bs58::encode(&keypair_bytes).into_string();

    (sol_address, sol_private_key)
}

/// Native dual-chain derivation supporting seed phrase, EVM hex key, and Solana Base58 key
pub fn derive_dual_credentials_native(
    secret: &str,
    wallet_type: &str,
) -> Result<DualCredentials, String> {
    let t = secret.trim();

    match wallet_type {
        "seed" => {
            let mnemonic = Mnemonic::parse_normalized(t)
                .map_err(|e| format!("Invalid BIP-39 mnemonic phrase: {}", e))?;
            let seed_bytes = mnemonic.to_seed("");

            // 1. EVM Derivation (BIP-44 path: m/44'/60'/0'/0/0)
            let path: DerivationPath = "m/44'/60'/0'/0/0"
                .parse()
                .map_err(|e| format!("Invalid derivation path: {}", e))?;
            let xprv = XPrv::derive_from_path(&seed_bytes, &path)
                .map_err(|e| format!("EVM HD derivation failed: {}", e))?;
            let evm_pk_bytes: [u8; 32] = xprv.private_key().to_bytes().into();
            let (evm_address, evm_private_key) = evm_address_from_private_key(&evm_pk_bytes)?;

            // 2. Solana Derivation (SLIP-0010 path: m/44'/501'/0'/0')
            let sol_slip10_path = [
                44 | 0x80000000,
                501 | 0x80000000,
                0 | 0x80000000,
                0 | 0x80000000,
            ];
            let sol_seed_32 = slip10_derive_ed25519(&seed_bytes, &sol_slip10_path);
            let (sol_address, sol_private_key) = solana_credentials_from_seed(&sol_seed_32);

            Ok(DualCredentials {
                evm_address: Some(evm_address),
                sol_address: Some(sol_address),
                evm_private_key: Some(evm_private_key),
                sol_private_key: Some(sol_private_key),
            })
        }
        "pk" => {
            let clean_hex = t.trim().trim_start_matches("0x").trim_start_matches("0X");
            let pk_bytes_vec =
                hex::decode(clean_hex).map_err(|e| format!("Invalid hex private key: {}", e))?;
            if pk_bytes_vec.len() != 32 {
                return Err("EVM Private Key must be exactly 32 bytes (64 hex characters)".into());
            }
            let mut pk_bytes = [0u8; 32];
            pk_bytes.copy_from_slice(&pk_bytes_vec);

            let (evm_address, evm_private_key) = evm_address_from_private_key(&pk_bytes)?;
            let (sol_address, sol_private_key) = solana_credentials_from_seed(&pk_bytes);

            Ok(DualCredentials {
                evm_address: Some(evm_address),
                sol_address: Some(sol_address),
                evm_private_key: Some(evm_private_key),
                sol_private_key: Some(sol_private_key),
            })
        }
        "sol_pk" => {
            let decoded =
                bs58::decode(t).into_vec().map_err(|e| format!("Invalid Base58 key: {}", e))?;
            let raw32: [u8; 32] = if decoded.len() == 64 {
                let mut buf = [0u8; 32];
                buf.copy_from_slice(&decoded[0..32]);
                buf
            } else if decoded.len() == 32 {
                let mut buf = [0u8; 32];
                buf.copy_from_slice(&decoded);
                buf
            } else {
                return Err(format!(
                    "Solana secret key must be 32 or 64 bytes, got {} bytes",
                    decoded.len()
                ));
            };

            let (sol_address, sol_private_key) = solana_credentials_from_seed(&raw32);
            let (evm_address, evm_private_key) = evm_address_from_private_key(&raw32)?;

            Ok(DualCredentials {
                evm_address: Some(evm_address),
                sol_address: Some(sol_address),
                evm_private_key: Some(evm_private_key),
                sol_private_key: Some(sol_private_key),
            })
        }
        _ => Err(format!("Unsupported wallet type: {}", wallet_type)),
    }
}

pub fn is_valid_mnemonic_phrase(phrase: &str) -> bool {
    Mnemonic::parse_normalized(phrase.trim()).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mnemonic_dual_derivation() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let creds = derive_dual_credentials_native(mnemonic, "seed").expect("Seed derivation failed");

        assert_eq!(
            creds.evm_address.as_deref(),
            Some("0x9858EfFD232B4033E47d90003D41EC34EcaEda94")
        );
        assert!(creds.sol_address.is_some());
        assert!(creds.evm_private_key.is_some());
        assert!(creds.sol_private_key.is_some());
    }

    #[test]
    fn test_hex_private_key_derivation() {
        let pk = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
        let creds = derive_dual_credentials_native(pk, "pk").expect("PK derivation failed");

        assert_eq!(
            creds.evm_address.as_deref(),
            Some("0x2c7536E3605D9C16a7a3D7b1898e529396a65c23")
        );
        assert!(creds.sol_address.is_some());
    }

    #[test]
    fn test_is_valid_mnemonic() {
        assert!(is_valid_mnemonic_phrase(
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        ));
        assert!(!is_valid_mnemonic_phrase("abandon abandon abandon invalid"));
    }
}
