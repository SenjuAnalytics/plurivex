use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use futures::future::join_all;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::Manager;
use tokio::sync::Semaphore;

#[derive(Clone, Debug)]
pub struct TokenDef {
    pub symbol: &'static str,
    pub name: &'static str,
    pub contract: &'static str,
    pub decimals: u8,
}

#[derive(PartialEq)]
enum ChainKind {
    Evm,
    Solana,
}

struct ChainConfig {
    key: &'static str,
    rpcs: &'static [&'static str],
    symbol: &'static str,
    kind: ChainKind,
    tokens: &'static [TokenDef],
}

const ETH_TOKENS: &[TokenDef] = &[
    TokenDef { symbol: "USDT", name: "Tether USD", contract: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
    TokenDef { symbol: "USDC", name: "USD Coin", contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
    TokenDef { symbol: "DAI", name: "Dai Stablecoin", contract: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18 },
    TokenDef { symbol: "WBTC", name: "Wrapped BTC", contract: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", decimals: 8 },
    TokenDef { symbol: "LINK", name: "Chainlink", contract: "0x514910771af9ca656af840dff83e8264ecf986ca", decimals: 18 },
    TokenDef { symbol: "UNI", name: "Uniswap", contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", decimals: 18 },
    TokenDef { symbol: "SHIB", name: "Shiba Inu", contract: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", decimals: 18 },
    TokenDef { symbol: "PEPE", name: "Pepe", contract: "0x6982508145454ce325ddbe47a25d4ec3d2311933", decimals: 18 },
];

const BSC_TOKENS: &[TokenDef] = &[
    TokenDef { symbol: "USDT", name: "Tether USD (BEP20)", contract: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
    TokenDef { symbol: "USDC", name: "USD Coin (BEP20)", contract: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
    TokenDef { symbol: "BUSD", name: "Binance USD", contract: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: 18 },
    TokenDef { symbol: "CAKE", name: "PancakeSwap Token", contract: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", decimals: 18 },
    TokenDef { symbol: "DAI", name: "Dai Token", contract: "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", decimals: 18 },
];

const BASE_TOKENS: &[TokenDef] = &[
    TokenDef { symbol: "USDC", name: "USD Coin", contract: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
    TokenDef { symbol: "USDbC", name: "USD Base Coin", contract: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", decimals: 6 },
    TokenDef { symbol: "DAI", name: "Dai Stablecoin", contract: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", decimals: 18 },
    TokenDef { symbol: "AERO", name: "Aerodrome", contract: "0x940181a94a35a4569e4529a3cdfb74e48fd98762", decimals: 18 },
];

const ARB_TOKENS: &[TokenDef] = &[
    TokenDef { symbol: "USDT", name: "Tether USD", contract: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6 },
    TokenDef { symbol: "USDC", name: "USD Coin", contract: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
    TokenDef { symbol: "USDC.e", name: "Bridged USDC", contract: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", decimals: 6 },
    TokenDef { symbol: "ARB", name: "Arbitrum", contract: "0x912ce59144191c1204e64559fe8253a0e49e6548", decimals: 18 },
    TokenDef { symbol: "DAI", name: "Dai Stablecoin", contract: "0xda10009cbd5d07dd0cecc66161566275181f5641", decimals: 18 },
];

const CHAINS: &[ChainConfig] = &[
    ChainConfig {
        key: "eth",
        rpcs: &[
            "https://eth.llamarpc.com",
            "https://rpc.mevblocker.io",
            "https://ethereum.publicnode.com",
            "https://1rpc.io/eth",
            "https://rpc.payload.de",
        ],
        symbol: "ETH",
        kind: ChainKind::Evm,
        tokens: ETH_TOKENS,
    },
    ChainConfig {
        key: "bsc",
        rpcs: &[
            "https://binance.llamarpc.com",
            "https://bsc.publicnode.com",
            "https://bsc-dataseed.binance.org",
            "https://bsc-dataseed1.defibit.io",
            "https://1rpc.io/bnb",
        ],
        symbol: "BNB",
        kind: ChainKind::Evm,
        tokens: BSC_TOKENS,
    },
    ChainConfig {
        key: "base",
        rpcs: &[
            "https://base.llamarpc.com",
            "https://mainnet.base.org",
            "https://base.publicnode.com",
            "https://1rpc.io/base",
        ],
        symbol: "ETH",
        kind: ChainKind::Evm,
        tokens: BASE_TOKENS,
    },
    ChainConfig {
        key: "arb",
        rpcs: &[
            "https://arbitrum.llamarpc.com",
            "https://arb1.arbitrum.io/rpc",
            "https://arbitrum.publicnode.com",
            "https://1rpc.io/arb",
        ],
        symbol: "ETH",
        kind: ChainKind::Evm,
        tokens: ARB_TOKENS,
    },
    ChainConfig {
        key: "sol",
        rpcs: &[
            "https://api.mainnet-beta.solana.com",
            "https://solana-rpc.publicnode.com",
        ],
        symbol: "SOL",
        kind: ChainKind::Solana,
        tokens: &[],
    },
];

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveredToken {
    pub wallet_id: i64,
    pub chain: String,
    pub symbol: String,
    pub name: String,
    pub balance: String,
    pub raw_balance: String,
    pub contract_address: String,
}

#[derive(Debug, Clone)]
pub struct WalletChainResult {
    pub wallet_id: i64,
    pub chain_key: String,
    pub native_balance: String,
    pub has_funds: bool,
    pub tokens: Vec<DiscoveredToken>,
}

#[derive(Debug, Serialize)]
pub struct ScanSummary {
    pub scanned: u32,
    pub funded: u32,
    pub errors: u32,
}

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        .map(|dir| dir.join("wallet_inspector.db"))
}

fn format_balance_display(wei_hex: &str, symbol: &str) -> (f64, String) {
    let clean = wei_hex.trim_start_matches("0x");
    let wei = u128::from_str_radix(clean, 16).unwrap_or(0);
    let amount = wei as f64 / 1e18;
    if amount == 0.0 {
        return (0.0, format!("0 {symbol}"));
    }
    let s = if amount < 0.00001 {
        format!("{amount:.18} {symbol}")
    } else if amount < 1.0 {
        format!("{amount:.6} {symbol}")
    } else {
        format!("{amount:.5} {symbol}")
    };
    (amount, s)
}

fn format_sol_display(lamports: u64) -> (f64, String) {
    let amount = lamports as f64 / 1e9;
    if amount == 0.0 {
        return (0.0, "0 SOL".to_string());
    }
    let s = if amount < 0.00001 {
        format!("{amount:.9} SOL")
    } else if amount < 1.0 {
        format!("{amount:.6} SOL")
    } else {
        format!("{amount:.5} SOL")
    };
    (amount, s)
}

fn format_token_amount(hex_val: &str, decimals: u8, symbol: &str) -> Option<(f64, String)> {
    let clean = hex_val.trim_start_matches("0x").trim();
    if clean.is_empty() || clean.chars().all(|c| c == '0') {
        return None;
    }
    let val = u128::from_str_radix(clean, 16).unwrap_or(0);
    if val == 0 {
        return None;
    }
    let divisor = 10_f64.powi(decimals as i32);
    let amount = (val as f64) / divisor;
    if amount <= 0.0 {
        return None;
    }
    let formatted = if amount < 0.0001 {
        format!("{amount:.8} {symbol}")
    } else if amount < 1.0 {
        format!("{amount:.6} {symbol}")
    } else if amount < 1000.0 {
        format!("{amount:.4} {symbol}")
    } else {
        format!("{amount:.2} {symbol}")
    };
    Some((amount, formatted))
}

fn solana_token_meta(mint: &str) -> (&'static str, &'static str) {
    match mint {
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" => ("USDC", "USD Coin"),
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" => ("USDT", "Tether USD"),
        "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" => ("BONK", "Bonk"),
        "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" => ("JUP", "Jupiter"),
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" => ("RAY", "Raydium"),
        "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" => ("WIF", "dogwifhat"),
        "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So" => ("mSOL", "Marinade Staked SOL"),
        "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1" => ("bSOL", "BlazeStake Staked SOL"),
        "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn" => ("JitoSOL", "Jito Staked SOL"),
        _ => ("", "SPL Token"),
    }
}

fn shared_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(9))
        .pool_max_idle_per_host(10)
        .build()
        .unwrap_or_default()
}

async fn fetch_evm_chain_batch(
    client: &reqwest::Client,
    address: &str,
    chain: &ChainConfig,
    wallet_id: i64,
) -> Result<WalletChainResult, String> {
    let clean_addr = address.trim().trim_start_matches("0x").to_lowercase();
    let padded_addr = format!("{:0>64}", clean_addr);
    let call_data = format!("0x70a08231{padded_addr}");

    let mut batch_body = Vec::with_capacity(1 + chain.tokens.len());

    batch_body.push(serde_json::json!({
        "jsonrpc": "2.0",
        "id": 0,
        "method": "eth_getBalance",
        "params": [address, "latest"]
    }));

    for (idx, tok) in chain.tokens.iter().enumerate() {
        batch_body.push(serde_json::json!({
            "jsonrpc": "2.0",
            "id": idx + 1,
            "method": "eth_call",
            "params": [{
                "to": tok.contract,
                "data": call_data
            }, "latest"]
        }));
    }

    for rpc in chain.rpcs {
        let resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&batch_body)
            .send()
            .await;

        if let Ok(response) = resp {
            if response.status().is_success() {
                if let Ok(items) = response.json::<serde_json::Value>().await {
                    if let Some(arr) = items.as_array() {
                        let mut native_balance = format!("0 {}", chain.symbol);
                        let mut has_funds = false;
                        let mut tokens_found = Vec::new();

                        for val in arr {
                            let id = val.get("id").and_then(|i| i.as_u64()).unwrap_or(999) as usize;
                            let result_str = val.get("result").and_then(|r| r.as_str());

                            if id == 0 {
                                if let Some(wei_hex) = result_str {
                                    let (amt, formatted) = format_balance_display(wei_hex, chain.symbol);
                                    native_balance = formatted;
                                    if amt > 0.0 {
                                        has_funds = true;
                                    }
                                }
                            } else if id <= chain.tokens.len() {
                                let tok = &chain.tokens[id - 1];
                                if let Some(hex_bal) = result_str {
                                    if let Some((amt, formatted)) = format_token_amount(hex_bal, tok.decimals, tok.symbol) {
                                        if amt > 0.0 {
                                            has_funds = true;
                                            tokens_found.push(DiscoveredToken {
                                                wallet_id,
                                                chain: chain.key.to_string(),
                                                symbol: tok.symbol.to_string(),
                                                name: tok.name.to_string(),
                                                balance: formatted,
                                                raw_balance: hex_bal.to_string(),
                                                contract_address: tok.contract.to_string(),
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        return Ok(WalletChainResult {
                            wallet_id,
                            chain_key: chain.key.to_string(),
                            native_balance,
                            has_funds,
                            tokens: tokens_found,
                        });
                    }
                }
            }
        }

        // Fallback: single call eth_getBalance
        let single_resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_getBalance",
                "params": [address, "latest"]
            }))
            .send()
            .await;

        if let Ok(response) = single_resp {
            if response.status().is_success() {
                if let Ok(data) = response.json::<serde_json::Value>().await {
                    if let Some(wei_hex) = data.get("result").and_then(|r| r.as_str()) {
                        let (amt, native_balance) = format_balance_display(wei_hex, chain.symbol);
                        return Ok(WalletChainResult {
                            wallet_id,
                            chain_key: chain.key.to_string(),
                            native_balance,
                            has_funds: amt > 0.0,
                            tokens: Vec::new(),
                        });
                    }
                }
            }
        }
    }

    Err(format!("All RPCs failed for chain {}", chain.key))
}

async fn fetch_solana_chain(
    client: &reqwest::Client,
    address: &str,
    chain: &ChainConfig,
    wallet_id: i64,
) -> Result<WalletChainResult, String> {
    for rpc in chain.rpcs {
        let sol_res = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getBalance",
                "params": [address, {"commitment": "confirmed"}]
            }))
            .send()
            .await;

        let Ok(response) = sol_res else {
            continue;
        };

        if !response.status().is_success() {
            continue;
        }

        let Ok(data) = response.json::<serde_json::Value>().await else {
            continue;
        };

        let lamports = data
            .get("result")
            .and_then(|r| r.get("value"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let (sol_amt, native_balance) = format_sol_display(lamports);
        let mut has_funds = sol_amt > 0.0;
        let mut tokens_found = Vec::new();

        let spl_res = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "getTokenAccountsByOwner",
                "params": [
                    address,
                    {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
                    {"encoding": "jsonParsed"}
                ]
            }))
            .send()
            .await;

        if let Ok(spl_response) = spl_res {
            if spl_response.status().is_success() {
                if let Ok(spl_data) = spl_response.json::<serde_json::Value>().await {
                    if let Some(accounts) = spl_data.get("result").and_then(|r| r.get("value")).and_then(|v| v.as_array()) {
                        for acc in accounts {
                            let info = acc.get("account").and_then(|a| a.get("data")).and_then(|d| d.get("parsed")).and_then(|p| p.get("info"));
                            let Some(info) = info else { continue; };
                            let mint = info.get("mint").and_then(|m| m.as_str()).unwrap_or("");
                            let token_amount = info.get("tokenAmount");
                            let ui_amount = token_amount.and_then(|t| t.get("uiAmount")).and_then(|u| u.as_f64()).unwrap_or(0.0);
                            let amount_raw = token_amount.and_then(|t| t.get("amount")).and_then(|a| a.as_str()).unwrap_or("0");

                            if ui_amount > 0.0 && !mint.is_empty() {
                                has_funds = true;
                                let (known_sym, known_name) = solana_token_meta(mint);
                                let symbol = if !known_sym.is_empty() {
                                    known_sym.to_string()
                                } else {
                                    let start = &mint[..mint.len().min(4)];
                                    let end = if mint.len() > 4 { &mint[mint.len() - 4..] } else { "" };
                                    format!("{start}..{end}")
                                };

                                let formatted = if ui_amount < 0.0001 {
                                    format!("{ui_amount:.8} {symbol}")
                                } else if ui_amount < 1.0 {
                                    format!("{ui_amount:.6} {symbol}")
                                } else if ui_amount < 1000.0 {
                                    format!("{ui_amount:.4} {symbol}")
                                } else {
                                    format!("{ui_amount:.2} {symbol}")
                                };

                                tokens_found.push(DiscoveredToken {
                                    wallet_id,
                                    chain: "sol".to_string(),
                                    symbol,
                                    name: known_name.to_string(),
                                    balance: formatted,
                                    raw_balance: amount_raw.to_string(),
                                    contract_address: mint.to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }

        return Ok(WalletChainResult {
            wallet_id,
            chain_key: "sol".to_string(),
            native_balance,
            has_funds,
            tokens: tokens_found,
        });
    }

    Err("All Solana RPCs failed".into())
}

#[tauri::command]
pub async fn rpc_get_balance(address: String, rpc: String) -> Result<String, String> {
    let client = shared_client();
    let resp = client
        .post(&rpc)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getBalance",
            "params": [address, "latest"]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    data.get("result")
        .and_then(|r| r.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "empty RPC result".to_string())
}

#[tauri::command]
pub async fn rpc_get_sol_balance(address: String, rpc: String) -> Result<String, String> {
    let client = shared_client();
    let resp = client
        .post(&rpc)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [address, {"commitment": "confirmed"}]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let lamports = data
        .get("result")
        .and_then(|r| r.get("value"))
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "empty RPC result".to_string())?;
    Ok(lamports.to_string())
}

#[tauri::command]
pub async fn scan_balances(
    app: tauri::AppHandle,
    wallet_id: Option<i64>,
    wallet_ids: Option<Vec<i64>>,
) -> Result<ScanSummary, String> {
    let path = db_path(&app)?;
    if !path.exists() {
        return Err(format!("database not found: {}", path.display()));
    }

    let mut conn = Connection::open(&path).map_err(|e| e.to_string())?;
    let _ = conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");

    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS token_balances (
            wallet_id INTEGER NOT NULL,
            chain TEXT NOT NULL,
            token_symbol TEXT NOT NULL,
            token_name TEXT,
            balance TEXT NOT NULL,
            raw_balance TEXT,
            contract_address TEXT,
            updated_at TEXT,
            PRIMARY KEY (wallet_id, chain, token_symbol, contract_address),
            FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
        );",
        [],
    );

    let wallets: Vec<(i64, Option<String>, Option<String>)> = if let Some(id) = wallet_id {
        conn.query_row(
            "SELECT id, address, sol_address FROM wallets WHERE id = ?1 AND (address IS NOT NULL OR sol_address IS NOT NULL)",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map(|row| vec![row])
        .map_err(|e| e.to_string())?
    } else if let Some(ids) = wallet_ids {
        if ids.is_empty() {
            return Ok(ScanSummary { scanned: 0, funded: 0, errors: 0 });
        }
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, address, sol_address FROM wallets WHERE id IN ({placeholders}) AND (address IS NOT NULL OR sol_address IS NOT NULL) ORDER BY id"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn
            .prepare("SELECT id, address, sol_address FROM wallets WHERE address IS NOT NULL OR sol_address IS NOT NULL ORDER BY id")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if wallets.is_empty() {
        return Ok(ScanSummary { scanned: 0, funded: 0, errors: 0 });
    }

    let client = shared_client();
    let semaphore = Arc::new(Semaphore::new(8));

    let mut tasks = Vec::new();

    for (id, address, sol_address) in &wallets {
        let wid = *id;
        for chain in CHAINS {
            let target = match chain.kind {
                ChainKind::Evm => address.as_deref().filter(|a| a.starts_with("0x")),
                ChainKind::Solana => sol_address.as_deref(),
            };

            let Some(scan_address) = target else {
                continue;
            };

            let addr_str = scan_address.to_string();
            let c_client = client.clone();
            let c_sem = semaphore.clone();

            tasks.push(async move {
                let _permit = c_sem.acquire().await.ok();
                match chain.kind {
                    ChainKind::Evm => {
                        fetch_evm_chain_batch(&c_client, &addr_str, chain, wid).await
                    }
                    ChainKind::Solana => {
                        fetch_solana_chain(&c_client, &addr_str, chain, wid).await
                    }
                }
            });
        }
    }

    let all_results = join_all(tasks).await;
    let now = chrono_lite_now();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut funded_wallets = std::collections::HashSet::new();
    let mut total_errors = 0;

    for res in all_results {
        match res {
            Ok(result) => {
                if result.has_funds {
                    funded_wallets.insert(result.wallet_id);
                }

                tx.execute(
                    "INSERT OR REPLACE INTO balances (wallet_id, chain, balance, updated_at) VALUES (?1, ?2, ?3, ?4)",
                    params![result.wallet_id, result.chain_key, result.native_balance, &now],
                ).map_err(|e| format!("save balance error: {e}"))?;

                tx.execute(
                    "DELETE FROM token_balances WHERE wallet_id = ?1 AND chain = ?2",
                    params![result.wallet_id, result.chain_key],
                ).map_err(|e| format!("delete token error: {e}"))?;

                for tok in result.tokens {
                    tx.execute(
                        "INSERT OR REPLACE INTO token_balances (wallet_id, chain, token_symbol, token_name, balance, raw_balance, contract_address, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        params![
                            tok.wallet_id,
                            tok.chain,
                            tok.symbol,
                            tok.name,
                            tok.balance,
                            tok.raw_balance,
                            tok.contract_address,
                            &now,
                        ],
                    ).map_err(|e| format!("save token error: {e}"))?;
                }
            }
            Err(_) => {
                total_errors += 1;
            }
        }
    }

    tx.commit().map_err(|e| format!("commit error: {e}"))?;

    Ok(ScanSummary {
        scanned: wallets.len() as u32,
        funded: funded_wallets.len() as u32,
        errors: total_errors,
    })
}

fn chrono_lite_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    secs.to_string()
}

#[derive(Serialize)]
pub struct ChainFeeResponse {
    pub gas_price_gwei: f64,
    pub priority_fee_gwei: f64,
    pub estimated_fee_eth: String,
    pub chain_id: u64,
    pub symbol: String,
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

    let client = shared_client();

    let chain_id = match chain.key {
        "eth" => 1,
        "bsc" => 56,
        "base" => 8453,
        "arb" => 42161,
        _ => 1,
    };

    let priority_fee_gwei = match chain.key {
        "eth" => 0.05,
        "bsc" => 1.0,
        "base" => 0.005,
        "arb" => 0.01,
        _ => 0.05,
    };

    for rpc in chain.rpcs {
        let resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_gasPrice",
                "params": []
            }))
            .send()
            .await;

        if let Ok(res) = resp {
            if res.status().is_success() {
                if let Ok(data) = res.json::<serde_json::Value>().await {
                    if let Some(hex_price) = data.get("result").and_then(|r| r.as_str()) {
                        let clean = hex_price.trim_start_matches("0x");
                        let wei = u128::from_str_radix(clean, 16).unwrap_or(1_500_000_000);
                        let gwei = (wei as f64) / 1_000_000_000.0;
                        let fee_wei = (wei as f64) * 21000.0;
                        let fee_eth = fee_wei / 1e18;
                        let estimated_fee_eth = format!("{:.8} {}", fee_eth, chain.symbol);

                        return Ok(ChainFeeResponse {
                            gas_price_gwei: (gwei * 100.0).round() / 100.0,
                            priority_fee_gwei,
                            estimated_fee_eth,
                            chain_id,
                            symbol: chain.symbol.to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(ChainFeeResponse {
        gas_price_gwei: 1.5,
        priority_fee_gwei,
        estimated_fee_eth: format!("0.00003150 {}", chain.symbol),
        chain_id,
        symbol: chain.symbol.to_string(),
    })
}

#[derive(Serialize)]
pub struct AccountInfoResponse {
    pub balance_hex: String,
    pub balance_eth: f64,
    pub balance_formatted: String,
    pub nonce: u64,
}

#[tauri::command]
pub async fn get_account_nonce_and_balance(chain_key: String, address: String) -> Result<AccountInfoResponse, String> {
    let chain = CHAINS.iter().find(|c| c.key == chain_key).ok_or_else(|| "Chain not found".to_string())?;
    let client = shared_client();

    if chain.kind == ChainKind::Solana {
        for rpc in chain.rpcs {
            let resp = client
                .post(*rpc)
                .header("Content-Type", "application/json")
                .header("User-Agent", "WalletInspector/1.0")
                .json(&serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getBalance",
                    "params": [address, {"commitment": "confirmed"}]
                }))
                .send()
                .await;

            if let Ok(res) = resp {
                if res.status().is_success() {
                    if let Ok(data) = res.json::<serde_json::Value>().await {
                        if let Some(lamports) = data.pointer("/result/value").and_then(|v| v.as_u64()) {
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
                }
            }
        }
        return Err("Failed to query Solana balance from all RPC nodes".to_string());
    }

    let batch = serde_json::json!([
        {
            "jsonrpc": "2.0",
            "id": 0,
            "method": "eth_getBalance",
            "params": [address, "latest"]
        },
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getTransactionCount",
            "params": [address, "latest"]
        }
    ]);

    for rpc in chain.rpcs {
        let resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&batch)
            .send()
            .await;

        if let Ok(res) = resp {
            if res.status().is_success() {
                if let Ok(data) = res.json::<serde_json::Value>().await {
                    if let Some(arr) = data.as_array() {
                        let mut balance_hex = "0x0".to_string();
                        let mut nonce = 0u64;

                        for item in arr {
                            let id = item.get("id").and_then(|i| i.as_u64()).unwrap_or(99);
                            let res_str = item.get("result").and_then(|r| r.as_str()).unwrap_or("0x0");
                            if id == 0 {
                                balance_hex = res_str.to_string();
                            } else if id == 1 {
                                let clean_nonce = res_str.trim_start_matches("0x");
                                nonce = u64::from_str_radix(clean_nonce, 16).unwrap_or(0);
                            }
                        }

                        let (bal_eth, formatted) = format_balance_display(&balance_hex, chain.symbol);

                        return Ok(AccountInfoResponse {
                            balance_hex,
                            balance_eth: bal_eth,
                            balance_formatted: formatted,
                            nonce,
                        });
                    }
                }
            }
        }
    }

    Err(format!("Failed to query wallet data from all RPC nodes for chain {chain_key}"))
}

#[tauri::command]
pub async fn broadcast_raw_tx(chain_key: String, raw_tx: String) -> Result<String, String> {
    let chain = CHAINS.iter().find(|c| c.key == chain_key).ok_or_else(|| "Chain not found".to_string())?;
    let client = shared_client();

    for rpc in chain.rpcs {
        let resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_sendRawTransaction",
                "params": [raw_tx]
            }))
            .send()
            .await;

        if let Ok(res) = resp {
            if res.status().is_success() {
                if let Ok(data) = res.json::<serde_json::Value>().await {
                    if let Some(hash) = data.get("result").and_then(|h| h.as_str()) {
                        return Ok(hash.to_string());
                    }
                    if let Some(err) = data.get("error") {
                        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("RPC Error");
                        return Err(msg.to_string());
                    }
                }
            }
        }
    }

    Err(format!("All RPC nodes failed to broadcast transaction for chain {chain_key}"))
}

#[tauri::command]
pub async fn get_solana_recent_blockhash() -> Result<String, String> {
    let chain = CHAINS.iter().find(|c| c.key == "sol").ok_or_else(|| "Solana chain not found".to_string())?;
    let client = shared_client();

    for rpc in chain.rpcs {
        let resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getLatestBlockhash",
                "params": [{"commitment": "confirmed"}]
            }))
            .send()
            .await;

        if let Ok(res) = resp {
            if res.status().is_success() {
                if let Ok(data) = res.json::<serde_json::Value>().await {
                    if let Some(bh) = data.pointer("/result/value/blockhash").and_then(|b| b.as_str()) {
                        return Ok(bh.to_string());
                    }
                }
            }
        }
    }

    Err("Failed to fetch Solana recent blockhash from RPC nodes".to_string())
}

#[tauri::command]
pub async fn broadcast_solana_tx(raw_tx_base64: String) -> Result<String, String> {
    let chain = CHAINS.iter().find(|c| c.key == "sol").ok_or_else(|| "Solana chain not found".to_string())?;
    let client = shared_client();
    let mut last_err = "All Solana RPC nodes failed to broadcast transaction".to_string();

    for rpc in chain.rpcs {
        let resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "sendTransaction",
                "params": [
                    raw_tx_base64,
                    {
                        "encoding": "base64",
                        "skipPreflight": false,
                        "preflightCommitment": "confirmed"
                    }
                ]
            }))
            .send()
            .await;

        if let Ok(res) = resp {
            if res.status().is_success() {
                if let Ok(data) = res.json::<serde_json::Value>().await {
                    if let Some(sig) = data.get("result").and_then(|r| r.as_str()) {
                        return Ok(sig.to_string());
                    }
                    if let Some(err) = data.get("error") {
                        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("Solana RPC Error");
                        last_err = msg.to_string();
                        if msg.contains("simulation failed") {
                            return Err(msg.to_string());
                        }
                        continue;
                    }
                }
            }
        }
    }

    Err(last_err)
}

#[derive(Debug, Clone, Serialize)]
pub struct SolanaAccountDetails {
    pub exists: bool,
    pub owner: String,
    pub owner_label: String,
    pub is_system_program: bool,
    pub account_type: String,
    pub authority: Option<String>,
    pub token_mint: Option<String>,
    pub lamports: u64,
    pub sol_balance: f64,
    pub executable: bool,
    pub space: u64,
}

#[tauri::command]
pub async fn get_solana_account_details(address: String) -> Result<SolanaAccountDetails, String> {
    let chain = CHAINS.iter().find(|c| c.key == "sol").ok_or_else(|| "Solana chain not found".to_string())?;
    let client = shared_client();
    let mut last_err = "Failed to query Solana account details from RPC nodes".to_string();

    for rpc in chain.rpcs {
        let resp = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "Mozilla/5.0")
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [
                    address,
                    {"encoding": "jsonParsed", "commitment": "confirmed"}
                ]
            }))
            .send()
            .await;

        if let Ok(res) = resp {
            if res.status().is_success() {
                if let Ok(data) = res.json::<serde_json::Value>().await {
                    if let Some(err) = data.get("error") {
                        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("Solana RPC Error");
                        last_err = msg.to_string();
                        continue;
                    }

                    if let Some(result_obj) = data.get("result") {
                        let val = result_obj.get("value");
                        if val.is_none() || val == Some(&serde_json::Value::Null) {
                            return Ok(SolanaAccountDetails {
                                exists: false,
                                owner: "11111111111111111111111111111111".to_string(),
                                owner_label: "System Program (New / Unallocated)".to_string(),
                                is_system_program: true,
                                account_type: "unallocated".to_string(),
                                authority: None,
                                token_mint: None,
                                lamports: 0,
                                sol_balance: 0.0,
                                executable: false,
                                space: 0,
                            });
                        }

                        if let Some(val_obj) = val {
                            let owner = val_obj.get("owner").and_then(|o| o.as_str()).unwrap_or("11111111111111111111111111111111").to_string();
                            let lamports = val_obj.get("lamports").and_then(|l| l.as_u64()).unwrap_or(0);
                            let executable = val_obj.get("executable").and_then(|e| e.as_bool()).unwrap_or(false);
                            let space = val_obj.get("space").and_then(|s| s.as_u64()).unwrap_or(0);

                            let parsed_data = val_obj.pointer("/data/parsed");
                            let program_name = val_obj.pointer("/data/program").and_then(|p| p.as_str()).unwrap_or("");

                            let account_type;
                            let mut authority = None;
                            let mut token_mint = None;
                            let owner_label;

                            if owner == "11111111111111111111111111111111" {
                                if program_name == "nonce" || (parsed_data.map_or(false, |p| p.get("type").and_then(|t| t.as_str()) == Some("initialized")) && space == 80) {
                                    account_type = "nonce_account".to_string();
                                    authority = parsed_data.and_then(|p| p.pointer("/info/authority")).and_then(|a| a.as_str()).map(|s| s.to_string());
                                    owner_label = "System Program (Durable Nonce Account)".to_string();
                                } else {
                                    account_type = "standard_eoa".to_string();
                                    owner_label = "System Program (Standard EOA Wallet)".to_string();
                                }
                            } else if owner == "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" || owner == "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" {
                                account_type = "token_account".to_string();
                                authority = parsed_data.and_then(|p| p.pointer("/info/owner")).and_then(|o| o.as_str()).map(|s| s.to_string());
                                token_mint = parsed_data.and_then(|p| p.pointer("/info/mint")).and_then(|m| m.as_str()).map(|s| s.to_string());
                                let is_2022 = owner == "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
                                owner_label = if is_2022 { "Token-2022 Program (Token Account ATA)".to_string() } else { "SPL Token Program (Token Account ATA)".to_string() };
                            } else if owner == "Stake11111111111111111111111111111111111111" {
                                account_type = "stake_account".to_string();
                                owner_label = "Stake Program (Staking Account)".to_string();
                            } else {
                                account_type = "custom_program".to_string();
                                owner_label = format!("Custom Program ({})", if owner.len() > 8 { format!("{}…{}", &owner[..4], &owner[owner.len()-4..]) } else { owner.clone() });
                            }

                            let is_sys = account_type == "standard_eoa" || account_type == "unallocated";

                            return Ok(SolanaAccountDetails {
                                exists: true,
                                owner,
                                owner_label,
                                is_system_program: is_sys,
                                account_type,
                                authority,
                                token_mint,
                                lamports,
                                sol_balance: (lamports as f64) / 1e9,
                                executable,
                                space,
                            });
                        }
                    }
                }
            }
        }
    }

    Err(last_err)
}

#[derive(Serialize)]
pub struct NativeFileContent {
    pub path: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct NativeScanResult {
    pub folder_name: String,
    pub total_files_visited: usize,
    pub text_files_read: usize,
    pub skipped_count: usize,
    pub files: Vec<NativeFileContent>,
}

#[inline(always)]
fn is_b58_char(b: u8) -> bool {
    matches!(b, b'1'..=b'9' | b'A'..=b'H' | b'J'..=b'N' | b'P'..=b'Z' | b'a'..=b'k' | b'm'..=b'z')
}

fn has_wallet_candidate(content: &str) -> bool {
    let bytes = content.as_bytes();
    if bytes.len() < 32 {
        return false;
    }

    // Keyword detection (UTF-8 safe line iteration)
    let has_keyword = content.lines().take(250).any(|line| {
        let sample_lower = line.to_lowercase();
        sample_lower.contains("private_key")
            || sample_lower.contains("privatekey")
            || sample_lower.contains("secret_key")
            || sample_lower.contains("secretkey")
            || sample_lower.contains("seed_phrase")
            || sample_lower.contains("seedphrase")
            || sample_lower.contains("mnemonic")
            || sample_lower.contains("bip39")
            || sample_lower.contains("wallet_key")
    });
    if has_keyword {
        return true;
    }

    // 1. Check for 64-hex private key (32 bytes):
    let mut consecutive_hex = 0;
    for &b in bytes {
        if b.is_ascii_hexdigit() {
            consecutive_hex += 1;
            if consecutive_hex == 64 {
                return true;
            }
        } else {
            consecutive_hex = 0;
        }
    }

    // 2. Check for Solana Base58 private key (between 44 and 88 base58 chars):
    let mut consecutive_b58 = 0;
    for &b in bytes {
        if is_b58_char(b) {
            consecutive_b58 += 1;
            if consecutive_b58 >= 44 && consecutive_b58 <= 88 {
                return true;
            }
        } else {
            consecutive_b58 = 0;
        }
    }

    // 3. Check for Seed Phrase (at least 12 alphabetic words in a line or phrase):
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.len() >= 40 && trimmed.len() <= 600 {
            let mut alpha_words = 0;
            for token in trimmed.split(|c: char| !c.is_ascii_alphabetic()) {
                if token.len() >= 3 && token.len() <= 10 {
                    alpha_words += 1;
                }
            }
            if alpha_words >= 12 && alpha_words <= 28 {
                return true;
            }
        }
    }

    false
}

#[tauri::command]
pub async fn scan_directory_native(path: String) -> Result<NativeScanResult, String> {
    tokio::task::spawn_blocking(move || {
        let root = std::path::PathBuf::from(&path);
        if !root.exists() || !root.is_dir() {
            return Err("Selected folder does not exist or is not a directory".to_string());
        }

        let folder_name = root
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("folder")
            .to_string();

        // Only skip virtual OS protected loop points (Recycle Bin / System Volume Information)
        let system_ignored_dirs: std::collections::HashSet<&'static str> = [
            "$recycle.bin",
            "system volume information",
        ]
        .into_iter()
        .collect();

        // Skip definitive compiled binaries, machine code, and non-text media
        let ignored_binary_exts: std::collections::HashSet<&'static str> = [
            "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "svg", "mp4", "mp3",
            "wav", "avi", "mov", "mkv", "flac", "ogg", "zip", "rar", "7z", "tar", "gz",
            "bz2", "xz", "iso", "exe", "dll", "sys", "so", "dylib", "bin", "msi", "deb",
            "rpm", "apk", "dmg", "ttf", "woff", "woff2", "eot", "otf", "o", "obj", "lib",
            "a", "rlib", "rmeta", "pdb", "class", "pyc", "sqlite3", "db", "pack", "idx",
            "pak", "node", "wasm",
        ]
        .into_iter()
        .collect();

        const MAX_CANDIDATES: usize = 5000;
        const MAX_FILE_SIZE: u64 = 512 * 1024; // 512 KB per file
        const MAX_SEARCH_DEPTH: usize = 35;

        let mut queue: std::collections::VecDeque<(std::path::PathBuf, usize)> = std::collections::VecDeque::new();
        queue.push_back((root, 0));

        let mut files: Vec<NativeFileContent> = Vec::new();
        let mut total_files_visited: usize = 0;
        let mut skipped_count: usize = 0;

        while let Some((current_dir, depth)) = queue.pop_front() {
            if files.len() >= MAX_CANDIDATES {
                break;
            }

            if depth > MAX_SEARCH_DEPTH {
                continue;
            }

            let entries = match std::fs::read_dir(&current_dir) {
                Ok(e) => e,
                Err(_) => continue, // ignore permission denied
            };

            for entry in entries.flatten() {
                if files.len() >= MAX_CANDIDATES {
                    break;
                }

                let p = entry.path();
                let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

                if is_dir {
                    if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                        let lower = name.to_lowercase();
                        if !system_ignored_dirs.contains(lower.as_str()) {
                            queue.push_back((p, depth + 1));
                        } else {
                            skipped_count += 1;
                        }
                    }
                } else {
                    total_files_visited += 1;
                    let extension = p
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|s| s.to_lowercase());

                    // If file is a known non-text binary/media, skip immediately (10ns check)
                    if let Some(ref ext) = extension {
                        if ignored_binary_exts.contains(ext.as_str()) {
                            skipped_count += 1;
                            continue;
                        }
                    }

                    let meta = entry.metadata().ok();
                    let size = meta.map(|m| m.len()).unwrap_or(0);

                    // Check file size (up to 512KB for text/scripts/configs)
                    if size > 0 && size <= MAX_FILE_SIZE {
                        if let Ok(content) = std::fs::read_to_string(&p) {
                            let trimmed = content.trim();
                            if !trimmed.is_empty() && !trimmed.contains('\0') {
                                // Fast in-memory check: does this file contain any potential wallet key or seed phrase?
                                if has_wallet_candidate(trimmed) {
                                    files.push(NativeFileContent {
                                        path: p.to_string_lossy().to_string(),
                                        content,
                                    });
                                } else {
                                    // Drop non-wallet file from RAM immediately!
                                    skipped_count += 1;
                                }
                            } else {
                                skipped_count += 1;
                            }
                        } else {
                            skipped_count += 1;
                        }
                    } else {
                        skipped_count += 1;
                    }
                }
            }
        }

        let text_files_read = files.len();

        Ok(NativeScanResult {
            folder_name,
            total_files_visited,
            text_files_read,
            skipped_count,
            files,
        })
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}