pub mod bitcoin;
pub mod evm;
pub mod pricing;
pub mod solana;

use futures::future::join_all;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::adapters::evm::tokens::*;
use crate::core::vault::repository::get_db_path;

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

#[derive(PartialEq)]
pub enum ChainKind {
    Evm,
    Solana,
    Bitcoin,
}

pub struct ChainConfig {
    pub key: &'static str,
    pub rpcs: &'static [&'static str],
    pub symbol: &'static str,
    pub kind: ChainKind,
    pub tokens: &'static [TokenDef],
}

pub const CHAINS: &[ChainConfig] = &[
    ChainConfig {
        key: "btc",
        rpcs: &["https://mempool.space/api", "https://blockstream.info/api"],
        symbol: "BTC",
        kind: ChainKind::Bitcoin,
        tokens: &[],
    },
    ChainConfig {
        key: "eth",
        rpcs: &[
            "https://ethereum.publicnode.com",
            "https://eth.drpc.org",
            "https://cloudflare-eth.com",
            "https://rpc.ankr.com/eth",
            "https://1rpc.io/eth",
        ],
        symbol: "ETH",
        kind: ChainKind::Evm,
        tokens: ETH_TOKENS,
    },
    ChainConfig {
        key: "bsc",
        rpcs: &[
            "https://bsc-dataseed.binance.org",
            "https://bsc-dataseed1.defibit.io",
            "https://bsc.publicnode.com",
            "https://rpc.ankr.com/bsc",
            "https://1rpc.io/bnb",
        ],
        symbol: "BNB",
        kind: ChainKind::Evm,
        tokens: BSC_TOKENS,
    },
    ChainConfig {
        key: "base",
        rpcs: &[
            "https://mainnet.base.org",
            "https://base.publicnode.com",
            "https://base.drpc.org",
            "https://rpc.ankr.com/base",
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

pub async fn execute_scan_balances(
    app: tauri::AppHandle,
    wallet_id: Option<i64>,
    wallet_ids: Option<Vec<i64>>,
) -> Result<ScanSummary, String> {
    let path = get_db_path(&app)?;
    if !path.exists() {
        return Err(format!("database not found: {}", path.display()));
    }

    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
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

    type WalletAddressTuple = (i64, Option<String>, Option<String>, Option<String>);

    let wallets: Vec<WalletAddressTuple> = if let Some(id) = wallet_id {
        conn.query_row(
            "SELECT id, address, sol_address, btc_address FROM wallets WHERE id = ?1 AND (address IS NOT NULL OR sol_address IS NOT NULL OR btc_address IS NOT NULL)",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map(|row| vec![row])
        .map_err(|e| e.to_string())?
    } else if let Some(ids) = wallet_ids {
        if ids.is_empty() {
            return Ok(ScanSummary {
                scanned: 0,
                funded: 0,
                errors: 0,
            });
        }
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, address, sol_address, btc_address FROM wallets WHERE id IN ({placeholders}) AND (address IS NOT NULL OR sol_address IS NOT NULL OR btc_address IS NOT NULL) ORDER BY id"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn
            .prepare("SELECT id, address, sol_address, btc_address FROM wallets WHERE address IS NOT NULL OR sol_address IS NOT NULL OR btc_address IS NOT NULL ORDER BY id")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    drop(conn);

    if wallets.is_empty() {
        return Ok(ScanSummary {
            scanned: 0,
            funded: 0,
            errors: 0,
        });
    }

    let client = crate::adapters::evm::client::shared_client();
    let semaphore = Arc::new(Semaphore::new(16));
    let mut tasks = Vec::new();

    for (w_id, evm_addr, sol_addr, btc_addr) in wallets {
        for chain in CHAINS {
            let permit = semaphore.clone();
            let c_client = client.clone();
            let c_evm = evm_addr.clone();
            let c_sol = sol_addr.clone();
            let c_btc = btc_addr.clone();

            tasks.push(async move {
                let _permit = permit.acquire().await.ok();
                if chain.kind == ChainKind::Solana {
                    if let Some(ref addr) = c_sol {
                        solana::scan_solana_for_wallet(&c_client, addr, chain.rpcs, w_id).await
                    } else {
                        Err("No solana address".to_string())
                    }
                } else if chain.kind == ChainKind::Bitcoin {
                    if let Some(ref addr) = c_btc {
                        bitcoin::scan_bitcoin_for_wallet(&c_client, addr, chain.rpcs, w_id).await
                    } else {
                        Err("No bitcoin address".to_string())
                    }
                } else if let Some(ref addr) = c_evm {
                    evm::scan_evm_for_wallet(
                        &c_client,
                        addr,
                        chain.key,
                        chain.symbol,
                        chain.rpcs,
                        chain.tokens,
                        w_id,
                    )
                    .await
                } else {
                    Err("No evm address".to_string())
                }
            });
        }
    }

    let results = join_all(tasks).await;

    let mut write_conn = Connection::open(&path).map_err(|e| e.to_string())?;
    let _ = write_conn.execute_batch("PRAGMA synchronous = NORMAL; PRAGMA journal_mode = WAL;");
    let tx = write_conn.transaction().map_err(|e| e.to_string())?;

    let mut scanned_count = 0u32;
    let mut funded_count = 0u32;
    let mut error_count = 0u32;

    {
        let mut update_stmt = tx
            .prepare(
                "INSERT INTO balances (wallet_id, chain, balance, updated_at)
                 VALUES (?1, ?2, ?3, datetime('now'))
                 ON CONFLICT(wallet_id, chain) DO UPDATE SET
                     balance = excluded.balance,
                     updated_at = excluded.updated_at;",
            )
            .map_err(|e| e.to_string())?;

        let mut insert_tok_stmt = tx
            .prepare(
                "INSERT INTO token_balances (wallet_id, chain, token_symbol, token_name, balance, raw_balance, contract_address, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
                 ON CONFLICT(wallet_id, chain, token_symbol, contract_address) DO UPDATE SET
                     balance = excluded.balance,
                     raw_balance = excluded.raw_balance,
                     token_name = excluded.token_name,
                     updated_at = excluded.updated_at;",
            )
            .map_err(|e| e.to_string())?;

        for res in results {
            match res {
                Ok(w_res) => {
                    scanned_count += 1;
                    if w_res.has_funds {
                        funded_count += 1;
                    }
                    let _ = update_stmt.execute(params![
                        w_res.wallet_id,
                        w_res.chain_key,
                        w_res.native_balance
                    ]);

                    for tok in w_res.tokens {
                        let _ = insert_tok_stmt.execute(params![
                            tok.wallet_id,
                            tok.chain,
                            tok.symbol,
                            tok.name,
                            tok.balance,
                            tok.raw_balance,
                            tok.contract_address,
                        ]);
                    }
                }
                Err(_) => {
                    error_count += 1;
                }
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ScanSummary {
        scanned: scanned_count,
        funded: funded_count,
        errors: error_count,
    })
}
