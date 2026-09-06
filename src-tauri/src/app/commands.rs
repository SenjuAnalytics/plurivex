use crate::adapters::evm::client::*;
use crate::adapters::solana::client::*;
use crate::core::scanner::{execute_scan_balances, ChainKind, ScanSummary, CHAINS};
use crate::core::wallets::import::{scan_directory_native as core_scan_dir, NativeScanResult};
use std::sync::atomic::{AtomicBool, Ordering};

pub static AIR_GAPPED_MODE: AtomicBool = AtomicBool::new(true);

#[tauri::command]
pub fn set_air_gapped_mode(enabled: bool) -> Result<bool, String> {
    AIR_GAPPED_MODE.store(enabled, Ordering::SeqCst);
    Ok(enabled)
}

#[tauri::command]
pub fn get_air_gapped_mode() -> Result<bool, String> {
    Ok(AIR_GAPPED_MODE.load(Ordering::SeqCst))
}

#[tauri::command]
pub async fn rpc_get_balance(address: String, rpc: String) -> Result<String, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    crate::adapters::evm::client::rpc_get_balance(&address, &rpc).await
}

#[tauri::command]
pub async fn rpc_get_sol_balance(address: String, rpc: String) -> Result<String, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    crate::adapters::solana::client::rpc_get_sol_balance(&address, &rpc).await
}

#[tauri::command]
pub async fn scan_balances(
    app: tauri::AppHandle,
    wallet_id: Option<i64>,
    wallet_ids: Option<Vec<i64>>,
) -> Result<ScanSummary, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    execute_scan_balances(app, wallet_id, wallet_ids).await
}

#[tauri::command]
pub async fn get_chain_fee_data(chain_key: String) -> Result<ChainFeeResponse, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    let chain = CHAINS
        .iter()
        .find(|c| c.key == chain_key)
        .ok_or_else(|| "Chain not found".to_string())?;

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
pub async fn get_account_nonce_and_balance(
    chain_key: String,
    address: String,
) -> Result<AccountInfoResponse, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    let chain = CHAINS
        .iter()
        .find(|c| c.key == chain_key)
        .ok_or_else(|| "Chain not found".to_string())?;

    if chain.kind == ChainKind::Solana {
        for rpc in chain.rpcs {
            if let Ok(lamports_str) =
                crate::adapters::solana::client::rpc_get_sol_balance(&address, rpc).await
            {
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

    crate::adapters::evm::client::get_account_nonce_and_balance(
        chain.key,
        chain.rpcs,
        chain.symbol,
        &address,
    )
    .await
}

#[tauri::command]
pub async fn broadcast_raw_tx(chain_key: String, raw_tx: String) -> Result<String, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    let chain = CHAINS
        .iter()
        .find(|c| c.key == chain_key)
        .ok_or_else(|| "Chain not found".to_string())?;
    crate::adapters::evm::client::broadcast_raw_tx(chain.key, chain.rpcs, &raw_tx).await
}

#[tauri::command]
pub async fn get_solana_recent_blockhash() -> Result<String, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    let chain = CHAINS
        .iter()
        .find(|c| c.key == "sol")
        .ok_or_else(|| "Solana chain not found".to_string())?;
    crate::adapters::solana::client::get_solana_recent_blockhash(chain.rpcs).await
}

#[tauri::command]
pub async fn broadcast_solana_tx(raw_tx_base64: String) -> Result<String, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    let chain = CHAINS
        .iter()
        .find(|c| c.key == "sol")
        .ok_or_else(|| "Solana chain not found".to_string())?;
    crate::adapters::solana::client::broadcast_solana_tx(chain.rpcs, &raw_tx_base64).await
}

#[tauri::command]
pub async fn get_solana_account_details(address: String) -> Result<SolanaAccountDetails, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }
    let chain = CHAINS
        .iter()
        .find(|c| c.key == "sol")
        .ok_or_else(|| "Solana chain not found".to_string())?;
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
pub async fn vault_encrypt_batch(
    plaintexts: Vec<String>,
    password: String,
) -> Result<Vec<String>, String> {
    crate::core::security::crypto::encrypt_vault_batch(&plaintexts, &password)
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
    Ok(crate::core::security::crypto::verify_password(
        &token, &password,
    ))
}

#[tauri::command]
pub async fn vault_derive_credentials(
    secret: String,
    wallet_type: String,
) -> Result<crate::core::wallets::derivation::DualCredentials, String> {
    crate::core::wallets::derivation::derive_dual_credentials_native(&secret, &wallet_type)
}

#[tauri::command]
pub async fn vault_derive_credentials_batch(
    secrets: Vec<String>,
    wallet_type: String,
) -> Result<Vec<Option<crate::core::wallets::derivation::DualCredentials>>, String> {
    Ok(
        crate::core::wallets::derivation::derive_dual_credentials_batch_native(
            &secrets,
            &wallet_type,
        ),
    )
}

#[tauri::command]
pub async fn vault_validate_mnemonic(phrase: String) -> Result<bool, String> {
    Ok(crate::core::wallets::derivation::is_valid_mnemonic_phrase(
        &phrase,
    ))
}

#[tauri::command]
pub async fn vault_repair_mnemonic(
    phrase: String,
    target_address: Option<String>,
    missing_position: Option<usize>,
) -> Result<crate::core::wallets::repair::MnemonicRepairResult, String> {
    Ok(crate::core::wallets::repair::analyze_and_repair_mnemonic(
        &phrase,
        target_address.as_deref(),
        missing_position,
    ))
}

#[tauri::command]
pub async fn vault_extract_credentials(text: String) -> Result<Vec<String>, String> {
    Ok(crate::core::wallets::extractor::extract_credentials_native(
        &text,
    ))
}

#[tauri::command]
pub async fn start_recovery_session(
    phrase: String,
    target_address: Option<String>,
    search_type: String,
) -> Result<crate::core::wallets::recovery_session::RecoverySessionStatusResponse, String> {
    crate::core::wallets::recovery_session::start_in_memory_session(
        phrase,
        target_address,
        search_type,
    )
}

#[tauri::command]
pub async fn pause_recovery_session(session_id: String) -> Result<bool, String> {
    crate::core::wallets::recovery_session::request_pause_session(&session_id)
}

#[tauri::command]
pub async fn resume_recovery_session(session_id: String) -> Result<bool, String> {
    crate::core::wallets::recovery_session::request_resume_session(&session_id)
}

#[tauri::command]
pub async fn cancel_recovery_session(session_id: String) -> Result<bool, String> {
    crate::core::wallets::recovery_session::request_cancel_session(&session_id)
}

#[tauri::command]
pub async fn clear_recovery_session(session_id: Option<String>) -> Result<bool, String> {
    crate::core::wallets::recovery_session::clear_recovery_session(
        session_id.as_deref().unwrap_or(""),
    )
}

#[tauri::command]
pub async fn get_recovery_session_status(
    session_id: String,
) -> Result<crate::core::wallets::recovery_session::RecoverySessionStatusResponse, String> {
    crate::core::wallets::recovery_session::get_live_session_status(&session_id)
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OnTheFlyBalanceResult {
    pub phrase: String,
    pub btc_address: Option<String>,
    pub btc_balance: Option<String>,
    pub evm_address: Option<String>,
    pub evm_balances: std::collections::HashMap<String, String>,
    pub sol_address: Option<String>,
    pub sol_balance: Option<String>,
    pub has_funds: bool,
    pub total_usd_estimate: f64,
}

#[tauri::command]
pub async fn get_token_prices(
    ids: Option<Vec<String>>,
) -> Result<crate::core::scanner::pricing::PriceReport, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Price feeds blocked.".to_string());
    }
    crate::adapters::pricing::coingecko::get_cached_or_fetch_prices(ids).await
}

#[tauri::command]
pub async fn scan_phrase_on_the_fly(phrase: String) -> Result<OnTheFlyBalanceResult, String> {
    if AIR_GAPPED_MODE.load(Ordering::SeqCst) {
        return Err("Air-Gapped Safe Mode is ACTIVE: Outbound network blocked.".to_string());
    }

    let creds = crate::core::wallets::derivation::derive_public_addresses_only_native(&phrase)?;
    let client = crate::adapters::evm::client::shared_client();

    // Fetch dynamic live/cached prices with fallback
    let price_report = crate::adapters::pricing::coingecko::get_cached_or_fetch_prices(None)
        .await
        .unwrap_or_else(|_| crate::core::scanner::pricing::PriceReport::baseline_fallback());
    let btc_price = price_report.get_usd_price_or_baseline("btc");
    let eth_price = price_report.get_usd_price_or_baseline("eth");
    let bnb_price = price_report.get_usd_price_or_baseline("bnb");
    let sol_price = price_report.get_usd_price_or_baseline("sol");

    let mut has_funds = false;
    let mut total_usd = 0.0;

    // 1. Scan Bitcoin if address present
    let mut btc_balance_str: Option<String> = None;
    if let Some(ref btc_addr) = creds.btc_address {
        let btc_rpcs = &["https://mempool.space/api", "https://blockstream.info/api"];
        if let Ok(res) =
            crate::core::scanner::bitcoin::scan_bitcoin_for_wallet(&client, btc_addr, btc_rpcs, 0)
                .await
        {
            if res.has_funds {
                has_funds = true;
                let parsed_btc =
                    crate::core::scanner::bitcoin::parse_btc_display_amount(&res.native_balance);
                total_usd += (parsed_btc * btc_price).max(0.01);
            }
            btc_balance_str = Some(res.native_balance);
        }
    }

    // 2. Scan EVM across top chains (eth, bsc, base, arb)
    let mut evm_map = std::collections::HashMap::new();
    if let Some(ref evm_addr) = creds.evm_address {
        for chain in CHAINS.iter().filter(|c| c.kind == ChainKind::Evm) {
            for rpc in chain.rpcs.iter().take(2) {
                if let Ok(hex_bal) =
                    crate::adapters::evm::client::rpc_get_balance(evm_addr, rpc).await
                {
                    let (amt, display) = crate::adapters::evm::client::format_balance_display(
                        &hex_bal,
                        chain.symbol,
                    );
                    if amt > 0.0 {
                        has_funds = true;
                        let price = match chain.symbol {
                            "ETH" => eth_price,
                            "BNB" => bnb_price,
                            _ => 1.0,
                        };
                        total_usd += amt * price;
                    }
                    evm_map.insert(chain.key.to_string(), display);
                    break;
                }
            }
        }
    }

    // 3. Scan Solana
    let mut sol_balance_str: Option<String> = None;
    if let Some(ref sol_addr) = creds.sol_address {
        let sol_chain = CHAINS.iter().find(|c| c.key == "sol");
        if let Some(chain) = sol_chain {
            for rpc in chain.rpcs.iter().take(2) {
                if let Ok(lamports_str) =
                    crate::adapters::solana::client::rpc_get_sol_balance(sol_addr, rpc).await
                {
                    let lamports: u64 = lamports_str.parse().unwrap_or(0);
                    let (amt, display) =
                        crate::adapters::solana::client::format_sol_display(lamports);
                    if amt > 0.0 {
                        has_funds = true;
                        total_usd += amt * sol_price;
                    }
                    sol_balance_str = Some(display);
                    break;
                }
            }
        }
    }

    Ok(OnTheFlyBalanceResult {
        phrase,
        btc_address: creds.btc_address,
        btc_balance: btc_balance_str,
        evm_address: creds.evm_address,
        evm_balances: evm_map,
        sol_address: creds.sol_address,
        sol_balance: sol_balance_str,
        has_funds,
        total_usd_estimate: (total_usd * 100.0).round() / 100.0,
    })
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvmTransferPayload {
    pub chain_id: u64,
    pub to_address: String,
    pub value_wei_hex: String,
    pub gas_price_wei_hex: String,
    pub gas_limit: u64,
    pub nonce: u64,
}

#[tauri::command]
pub fn sign_evm_transfer(
    mut secret: String,
    wallet_type: String,
    tx: EvmTransferPayload,
) -> Result<String, String> {
    let params = crate::core::wallets::signing::EvmTransferParams {
        chain_id: tx.chain_id,
        to_address: &tx.to_address,
        value_wei_hex: &tx.value_wei_hex,
        gas_price_wei_hex: &tx.gas_price_wei_hex,
        gas_limit: tx.gas_limit,
        nonce: tx.nonce,
    };
    let res = crate::core::wallets::signing::sign_evm_transfer_with_secret(
        &secret,
        &wallet_type,
        &params,
    );
    // Auto-wipe secret string parameter from RAM immediately
    crate::core::security::memory::secure_zero_string(&mut secret);
    res
}

#[tauri::command]
pub fn get_evm_address(mut secret: String, wallet_type: String) -> Result<String, String> {
    let res = crate::core::wallets::signing::derive_evm_address_from_secret(&secret, &wallet_type);
    // Auto-wipe secret string parameter from RAM immediately
    crate::core::security::memory::secure_zero_string(&mut secret);
    res
}

#[cfg(test)]
mod tests {
    #[test]
    #[cfg(target_os = "windows")]
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
