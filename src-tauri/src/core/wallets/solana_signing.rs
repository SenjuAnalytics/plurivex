//! Native Solana Legacy Wire Transaction Serializer & Signer
//! Self-contained, deterministically matching @solana/web3.js with Zeroizing private key buffers.

use base64::Engine;
use ed25519_dalek::{Signer, SigningKey as EdSigningKey};
use zeroize::Zeroizing;

/// System Program ID: 11111111111111111111111111111111 (32 zeroes)
pub const SYSTEM_PROGRAM_ID: [u8; 32] = [0u8; 32];

/// Sysvar RecentBlockhashes ID: SysvarRecentB1ockHashes11111111111111111111
pub const SYSVAR_RECENT_BLOCKHASHES_ID: [u8; 32] = [
    0x06, 0xa7, 0xd5, 0x17, 0x19, 0x2c, 0x56, 0x8e, 0xe0, 0x8a, 0x84, 0x5f, 0x73, 0xd2, 0x97,
    0x88, 0xcf, 0x03, 0x5c, 0x31, 0x45, 0xb2, 0x1a, 0xb3, 0x44, 0xd8, 0x06, 0x2e, 0xa9, 0x40,
    0x00, 0x00,
];

/// Sysvar Rent ID: SysvarRent111111111111111111111111111111111
pub const SYSVAR_RENT_ID: [u8; 32] = [
    0x06, 0xa7, 0xd5, 0x17, 0x19, 0x2c, 0x5c, 0x51, 0x21, 0x8c, 0xc9, 0x4c, 0x3d, 0x4a, 0xf1,
    0x7f, 0x58, 0xda, 0xee, 0x08, 0x9b, 0xa1, 0xfd, 0x44, 0xe3, 0xdb, 0xd9, 0x8a, 0x00, 0x00,
    0x00, 0x00,
];

/// Encode a u16 length as a Solana compact-u16 (shortvec) varint.
pub fn encode_compact_u16(mut val: u16, out: &mut Vec<u8>) {
    loop {
        let mut elem = (val & 0x7f) as u8;
        val >>= 7;
        if val == 0 {
            out.push(elem);
            break;
        } else {
            elem |= 0x80;
            out.push(elem);
        }
    }
}

/// Compiled instruction inside a Solana message.
#[derive(Debug, Clone)]
pub struct SolanaCompiledInstruction {
    pub program_id_index: u8,
    pub accounts: Vec<u8>,
    pub data: Vec<u8>,
}

/// Solana Legacy Message structure.
#[derive(Debug, Clone)]
pub struct SolanaMessage {
    pub num_required_signatures: u8,
    pub num_readonly_signed_accounts: u8,
    pub num_readonly_unsigned_accounts: u8,
    pub account_keys: Vec<[u8; 32]>,
    pub recent_blockhash: [u8; 32],
    pub instructions: Vec<SolanaCompiledInstruction>,
}

impl SolanaMessage {
    /// Serialize the message into the canonical wire byte format.
    pub fn serialize(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(256);
        // Header (3 bytes)
        out.push(self.num_required_signatures);
        out.push(self.num_readonly_signed_accounts);
        out.push(self.num_readonly_unsigned_accounts);

        // Account keys
        encode_compact_u16(self.account_keys.len() as u16, &mut out);
        for key in &self.account_keys {
            out.extend_from_slice(key);
        }

        // Recent blockhash (32 bytes)
        out.extend_from_slice(&self.recent_blockhash);

        // Instructions
        encode_compact_u16(self.instructions.len() as u16, &mut out);
        for ix in &self.instructions {
            out.push(ix.program_id_index);
            encode_compact_u16(ix.accounts.len() as u16, &mut out);
            out.extend_from_slice(&ix.accounts);
            encode_compact_u16(ix.data.len() as u16, &mut out);
            out.extend_from_slice(&ix.data);
        }

        out
    }
}

/// Parameters for creating and signing a Solana transfer transaction.
#[derive(Debug, Clone)]
pub struct SolanaTransferParams<'a> {
    pub recipient: &'a str,
    pub lamports: u64,
    pub recent_blockhash: &'a str,
    pub is_nonce_account: bool,
}

/// Result of signing a Solana transaction.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SolanaSignResult {
    pub raw_tx_base64: String,
    pub from_address: String,
}

/// Decode a 32-byte public key or blockhash from Base58 string.
pub fn parse_pubkey_32_bytes(s: &str) -> Result<[u8; 32], String> {
    let decoded = bs58::decode(s.trim())
        .into_vec()
        .map_err(|e| format!("Invalid Base58 string '{}': {}", s, e))?;
    if decoded.len() != 32 {
        return Err(format!(
            "Expected 32-byte Base58 key, got {} bytes for '{}'",
            decoded.len(),
            s
        ));
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&decoded);
    Ok(out)
}

/// Extract a 32-byte ed25519 seed from secret (seed phrase, pk hex, or sol_pk Base58).
/// Wrapped in Zeroizing for guaranteed memory wipe.
pub fn extract_solana_seed(secret: &str, wallet_type: &str) -> Result<Zeroizing<[u8; 32]>, String> {
    let t = secret.trim();
    match wallet_type {
        "seed" => {
            let mnemonic = bip39::Mnemonic::parse_normalized(t)
                .map_err(|e| format!("Invalid BIP-39 mnemonic phrase: {}", e))?;
            let seed_bytes = Zeroizing::new(mnemonic.to_seed(""));
            let sol_slip10_path = [44 | 0x80000000, 501 | 0x80000000, 0x80000000, 0x80000000];
            let sol_seed_32 = Zeroizing::new(crate::core::wallets::derivation::slip10_derive_ed25519(
                &*seed_bytes,
                &sol_slip10_path,
            ));
            Ok(sol_seed_32)
        }
        "sol_pk" => {
            let decoded = Zeroizing::new(
                bs58::decode(t)
                    .into_vec()
                    .map_err(|e| format!("Invalid Base58 Solana key: {}", e))?,
            );
            if decoded.len() != 32 && decoded.len() != 64 {
                return Err(format!(
                    "Solana secret key must be 32 or 64 bytes, got {}",
                    decoded.len()
                ));
            }
            let mut raw32 = Zeroizing::new([0u8; 32]);
            raw32.copy_from_slice(&decoded[0..32]);
            Ok(raw32)
        }
        "pk" => {
            let clean = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")).unwrap_or(t);
            if clean.len() != 64 {
                return Err(format!(
                    "Solana hex private key must be 64 characters (32 bytes), got {}",
                    clean.len()
                ));
            }
            let mut raw = Zeroizing::new([0u8; 32]);
            hex::decode_to_slice(clean, &mut *raw)
                .map_err(|e| format!("Invalid hex private key: {}", e))?;
            Ok(raw)
        }
        other => Err(format!(
            "Unsupported wallet type '{}' for Solana signing (expected 'seed', 'sol_pk', or 'pk')",
            other
        )),
    }
}

/// Derive the Base58 Solana public address from secret without leaking private key strings.
pub fn derive_solana_address_from_secret(
    secret: &str,
    wallet_type: &str,
) -> Result<String, String> {
    let seed = extract_solana_seed(secret, wallet_type)?;
    let signing_key = EdSigningKey::from_bytes(&seed);
    let verifying_key = signing_key.verifying_key();
    Ok(bs58::encode(verifying_key.as_bytes()).into_string())
}

/// Sign a Solana transfer natively in Rust with deterministic wire format.
/// Returns SolanaSignResult containing base64 raw transaction and sender address.
pub fn sign_solana_transfer_with_secret(
    secret: &str,
    wallet_type: &str,
    params: &SolanaTransferParams<'_>,
) -> Result<SolanaSignResult, String> {
    let seed_32 = extract_solana_seed(secret, wallet_type)?;
    let signing_key = EdSigningKey::from_bytes(&seed_32);
    let verifying_key = signing_key.verifying_key();
    let from_pubkey = verifying_key.to_bytes();
    let from_address = bs58::encode(&from_pubkey).into_string();

    let to_pubkey = parse_pubkey_32_bytes(params.recipient)?;
    if to_pubkey == from_pubkey {
        return Err("Recipient address is identical to sender address".to_string());
    }
    if to_pubkey == SYSTEM_PROGRAM_ID {
        return Err("Recipient cannot be the System Program address".to_string());
    }

    let blockhash = parse_pubkey_32_bytes(params.recent_blockhash)?;

    let message = if params.is_nonce_account {
        // Durable Nonce Withdraw:
        // Accounts: [nonce_pubkey, to_pubkey, system_program, sysvar_recent_blockhashes, sysvar_rent]
        // Header: 1 signature, 0 readonly signed, 3 readonly unsigned (system, blockhashes, rent)
        let account_keys = vec![
            from_pubkey,
            to_pubkey,
            SYSTEM_PROGRAM_ID,
            SYSVAR_RECENT_BLOCKHASHES_ID,
            SYSVAR_RENT_ID,
        ];

        // Instruction: Program idx 2 (System), accounts [0, 1, 3, 4, 0], data [5, 0, 0, 0, lamports LE]
        let mut data = Vec::with_capacity(12);
        data.extend_from_slice(&5u32.to_le_bytes()); // NonceWithdraw instruction = 5
        data.extend_from_slice(&params.lamports.to_le_bytes());

        let instruction = SolanaCompiledInstruction {
            program_id_index: 2,
            accounts: vec![0, 1, 3, 4, 0],
            data,
        };

        SolanaMessage {
            num_required_signatures: 1,
            num_readonly_signed_accounts: 0,
            num_readonly_unsigned_accounts: 3,
            account_keys,
            recent_blockhash: blockhash,
            instructions: vec![instruction],
        }
    } else {
        // Standard Transfer:
        // Accounts: [from_pubkey, to_pubkey, system_program]
        // Header: 1 signature, 0 readonly signed, 1 readonly unsigned (system)
        let account_keys = vec![from_pubkey, to_pubkey, SYSTEM_PROGRAM_ID];

        // Instruction: Program idx 2 (System), accounts [0, 1], data [2, 0, 0, 0, lamports LE]
        let mut data = Vec::with_capacity(12);
        data.extend_from_slice(&2u32.to_le_bytes()); // Transfer instruction = 2
        data.extend_from_slice(&params.lamports.to_le_bytes());

        let instruction = SolanaCompiledInstruction {
            program_id_index: 2,
            accounts: vec![0, 1],
            data,
        };

        SolanaMessage {
            num_required_signatures: 1,
            num_readonly_signed_accounts: 0,
            num_readonly_unsigned_accounts: 1,
            account_keys,
            recent_blockhash: blockhash,
            instructions: vec![instruction],
        }
    };

    let message_bytes = message.serialize();
    let signature = signing_key.sign(&message_bytes);

    let mut wire_tx = Vec::with_capacity(1 + 64 + message_bytes.len());
    encode_compact_u16(1, &mut wire_tx); // 1 signature
    wire_tx.extend_from_slice(&signature.to_bytes());
    wire_tx.extend_from_slice(&message_bytes);

    let raw_tx_base64 = base64::engine::general_purpose::STANDARD.encode(&wire_tx);

    Ok(SolanaSignResult {
        raw_tx_base64,
        from_address,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compact_u16_encoding() {
        let mut buf = Vec::new();
        encode_compact_u16(0, &mut buf);
        assert_eq!(buf, vec![0]);

        buf.clear();
        encode_compact_u16(1, &mut buf);
        assert_eq!(buf, vec![1]);

        buf.clear();
        encode_compact_u16(3, &mut buf);
        assert_eq!(buf, vec![3]);

        buf.clear();
        encode_compact_u16(12, &mut buf);
        assert_eq!(buf, vec![12]);

        buf.clear();
        encode_compact_u16(128, &mut buf);
        assert_eq!(buf, vec![128, 1]);

        buf.clear();
        encode_compact_u16(1000, &mut buf);
        assert_eq!(buf, vec![232, 7]);
    }

    #[test]
    fn test_canonical_solana_transfer_vector_matching_web3js() {
        // Known seed [1u8; 32]
        // Keypair: AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9
        // Recipient: 4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T
        // Blockhash: 8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR (32 bytes of 0x02)
        // Lamports: 1000000000 (1 SOL)
        let seed = [1u8; 32];
        let hex_pk = hex::encode(seed);

        let params = SolanaTransferParams {
            recipient: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T",
            lamports: 1_000_000_000,
            recent_blockhash: "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
            is_nonce_account: false,
        };

        let result = sign_solana_transfer_with_secret(&hex_pk, "pk", &params)
            .expect("Signing standard transfer");

        assert_eq!(
            result.from_address,
            "AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9"
        );

        let expected_base64 = "AZCtKu+O//V8xt+Vb7fpHU4QpnBxbeJe0ULl9qpqYk+4tWWZbrBGpigBV+Hw7j3FCNe5xNrsl97Uidkp8BqpOg4BAAEDiojj3XQJ8ZX9UtstPLpdcspnCb8dlBIb83SIAbQPb1wyHPpa3RheiJOl/YgBPsTX4SLe1GNUyt/1DZVjledbYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBAgIAAQwCAAAAAMqaOwAAAAA=";
        assert_eq!(result.raw_tx_base64, expected_base64);
    }

    #[test]
    fn test_canonical_solana_nonce_withdraw_vector_matching_web3js() {
        let seed = [1u8; 32];
        let hex_pk = hex::encode(seed);

        let params = SolanaTransferParams {
            recipient: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T",
            lamports: 1_000_000_000,
            recent_blockhash: "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
            is_nonce_account: true,
        };

        let result = sign_solana_transfer_with_secret(&hex_pk, "pk", &params)
            .expect("Signing nonce withdraw");

        assert_eq!(
            result.from_address,
            "AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9"
        );

        let expected_base64 = "Ad5yTwERY2+ubVO4CeYJcYrGp94PAiNs9tcM1A0Qww9+G0JQpP7z94pDxtSU7k64WVAaGDXaGq7eWLRjLehA5gUBAAMFiojj3XQJ8ZX9UtstPLpdcspnCb8dlBIb83SIAbQPb1wyHPpa3RheiJOl/YgBPsTX4SLe1GNUyt/1DZVjledbYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABqfVFxksVo7gioRfc9KXiM8DXDFFshqzRNgGLqlAAAAGp9UXGSxcUSGMyUw9SvF/WNruCJuh/UTj29mKAAAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAQIFAAEDBAAMBQAAAADKmjsAAAAA";
        assert_eq!(result.raw_tx_base64, expected_base64);
    }

    #[test]
    fn test_solana_signing_from_mnemonic_and_address_derivation() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let addr = derive_solana_address_from_secret(mnemonic, "seed").expect("Derive address");
        // Canonical Solana address for abandon ... about (SLIP-0010 m/44'/501'/0'/0')
        assert_eq!(addr, "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");

        let params = SolanaTransferParams {
            recipient: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T",
            lamports: 50_000,
            recent_blockhash: "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
            is_nonce_account: false,
        };

        let result = sign_solana_transfer_with_secret(mnemonic, "seed", &params)
            .expect("Signing from seed");
        assert_eq!(result.from_address, addr);
        assert!(!result.raw_tx_base64.is_empty());
    }

    #[test]
    fn test_solana_signing_validation_rejects_same_recipient_and_system() {
        let seed = [1u8; 32];
        let hex_pk = hex::encode(seed);

        // 1. Same sender and recipient
        let params_same = SolanaTransferParams {
            recipient: "AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9",
            lamports: 1000,
            recent_blockhash: "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
            is_nonce_account: false,
        };
        assert!(sign_solana_transfer_with_secret(&hex_pk, "pk", &params_same).is_err());

        // 2. System program as recipient
        let params_sys = SolanaTransferParams {
            recipient: "11111111111111111111111111111111",
            lamports: 1000,
            recent_blockhash: "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
            is_nonce_account: false,
        };
        assert!(sign_solana_transfer_with_secret(&hex_pk, "pk", &params_sys).is_err());
    }
}
