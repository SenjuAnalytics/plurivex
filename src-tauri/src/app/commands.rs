use crate::adapters::evm::client::*;
use crate::adapters::solana::client::*;
use crate::core::scanner::{execute_scan_balances, ScanSummary, CHAINS, ChainKind};
use crate::core::wallets::import::{scan_directory_native as core_scan_dir, NativeScanResult};

#[tauri::command]
pub async fn rpc_get_balance(address: String, rpc: String) -> Result<String, String> {
    crate::adapters::evm::client::rpc_get_balance(&address, &rpc).await
}

#[tauri::command]
pub async fn rpc_get_sol_balance(address: String, rpc: String) -> Result<String, String> {
    crate::adapters::solana::client::rpc_get_sol_balance(&address, &rpc).await
}

#[tauri::command]
pub async fn scan_balances(
    app: tauri::AppHandle,
    wallet_id: Option<i64>,
    wallet_ids: Option<Vec<i64>>,
) -> Result<ScanSummary, String> {
    execute_scan_balances(app, wallet_id, wallet_ids).await
}

#[tauri::command]
pub async fn get_chain_fee_data(chain_key: String) -> Result<ChainFeeResponse, String> {
    let chain = CHAINS.iter().find(|c| c.key == chain_key).ok_or_else(|| "Chain not found".to_string())?;

    if chain.kind == ChainKind::Solana {
        return Ok(ChainFeeResponse {
            gas_price_gwei: 0.0,
            priority_fee_gwei: 0.0,
            estimated_fee_eth: "0.00000500 SOL".to_string(),
            chain_id: 101,
            symbol: "SOL".to_string(),
        });
    }

    crate::adapters::evm::client::get_chain_fee_data(chain.key, chain.rpcs, chain.symbol).await
}

#[tauri::command]
pub async fn get_account_nonce_and_balance(chain_key: String, address: String) -> Result<AccountInfoResponse, String> {
    let chain = CHAINS.iter().find(|c| c.key == chain_key).ok_or_else(|| "Chain not found".to_string())?;

    if chain.kind == ChainKind::Solana {
        for rpc in chain.rpcs {
            if let Ok(lamports_str) = crate::adapters::solana::client::rpc_get_sol_balance(&address, rpc).await {
                let lamports: u64 = lamports_str.parse().unwrap_or(0);
                let sol_amt = (lamports as f64) / 1e9;
                let formatted = format!("{:.6} SOL", sol_amt);
                return Ok(AccountInfoResponse {
                    balance_hex: format!("{:#x}", lamports),
                    balance_eth: sol_amt,
                    balance_formatted: formatted,
                    nonce: 0,
                });
            }
        }
        return Err("Failed to query Solana balance from all RPC nodes".to_string());
    }

    crate::adapters::evm::client::get_account_nonce_and_balance(chain.key, chain.rpcs, chain.symbol, &address).await
}

#[tauri::command]
pub async fn broadcast_raw_tx(chain_key: String, raw_tx: String) -> Result<String, String> {
    let chain = CHAINS.iter().find(|c| c.key == chain_key).ok_or_else(|| "Chain not found".to_string())?;
    crate::adapters::evm::client::broadcast_raw_tx(chain.key, chain.rpcs, &raw_tx).await
}

#[tauri::command]
pub async fn get_solana_recent_blockhash() -> Result<String, String> {
    let chain = CHAINS.iter().find(|c| c.key == "sol").ok_or_else(|| "Solana chain not found".to_string())?;
    crate::adapters::solana::client::get_solana_recent_blockhash(chain.rpcs).await
}

#[tauri::command]
pub async fn broadcast_solana_tx(raw_tx_base64: String) -> Result<String, String> {
    let chain = CHAINS.iter().find(|c| c.key == "sol").ok_or_else(|| "Solana chain not found".to_string())?;
    crate::adapters::solana::client::broadcast_solana_tx(chain.rpcs, &raw_tx_base64).await
}

#[tauri::command]
pub async fn get_solana_account_details(address: String) -> Result<SolanaAccountDetails, String> {
    let chain = CHAINS.iter().find(|c| c.key == "sol").ok_or_else(|| "Solana chain not found".to_string())?;
    crate::adapters::solana::client::get_solana_account_details(chain.rpcs, &address).await
}

#[tauri::command]
pub async fn scan_directory_native(path: String) -> Result<NativeScanResult, String> {
    core_scan_dir(path).await
}

#[tauri::command]
pub fn window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_toggle_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn schedule_clipboard_clear(timeout_secs: u64) -> Result<(), String> {
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(timeout_secs)).await;
        #[cfg(target_os = "windows")]
        {
            use std::ffi::c_void;
            #[link(name = "user32")]
            extern "system" {
                fn OpenClipboard(hWndNewOwner: *mut c_void) -> i32;
                fn EmptyClipboard() -> i32;
                fn CloseClipboard() -> i32;
            }
            // Retry up to 10 times with 100ms interval in case clipboard is momentarily locked
            for _ in 0..10 {
                unsafe {
                    if OpenClipboard(std::ptr::null_mut()) != 0 {
                        EmptyClipboard();
                        CloseClipboard();
                        break;
                    }
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn vault_encrypt(plaintext: String, password: String) -> Result<String, String> {
    crate::core::security::crypto::encrypt_vault(&plaintext, &password)
}

#[tauri::command]
pub async fn vault_decrypt(blob: String, password: String) -> Result<String, String> {
    crate::core::security::crypto::decrypt_vault(&blob, &password)
}

#[tauri::command]
pub async fn vault_create_token(password: String) -> Result<String, String> {
    crate::core::security::crypto::create_verification_token(&password)
}

#[tauri::command]
pub async fn vault_verify_token(token: String, password: String) -> Result<bool, String> {
    Ok(crate::core::security::crypto::verify_password(&token, &password))
}

#[tauri::command]
pub async fn vault_derive_credentials(
    secret: String,
    wallet_type: String,
) -> Result<crate::core::wallets::derivation::DualCredentials, String> {
    crate::core::wallets::derivation::derive_dual_credentials_native(&secret, &wallet_type)
}

#[tauri::command]
pub async fn vault_validate_mnemonic(phrase: String) -> Result<bool, String> {
    Ok(crate::core::wallets::derivation::is_valid_mnemonic_phrase(&phrase))
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_windows_empty_clipboard() {
        use std::ffi::c_void;
        #[link(name = "user32")]
        extern "system" {
            fn OpenClipboard(hWndNewOwner: *mut c_void) -> i32;
            fn EmptyClipboard() -> i32;
            fn CloseClipboard() -> i32;
        }
        unsafe {
            let opened = OpenClipboard(std::ptr::null_mut());
            println!("OpenClipboard returned: {}", opened);
            assert_ne!(opened, 0, "OpenClipboard failed");
            let emptied = EmptyClipboard();
            println!("EmptyClipboard returned: {}", emptied);
            assert_ne!(emptied, 0, "EmptyClipboard failed");
            CloseClipboard();
        }
    }
}
