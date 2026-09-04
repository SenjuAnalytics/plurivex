use crate::adapters::solana::client::*;
use crate::adapters::solana::tokens::*;
use crate::core::scanner::DiscoveredToken;
use crate::core::scanner::WalletChainResult;

pub async fn scan_solana_for_wallet(
    client: &reqwest::Client,
    address: &str,
    rpcs: &[&str],
    wallet_id: i64,
) -> Result<WalletChainResult, String> {
    let mut last_err = "All Solana RPCs failed".to_string();

    for rpc in rpcs {
        let native_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [address, {"commitment": "confirmed"}]
        });

        let post_native = client
            .post(*rpc)
            .header("Content-Type", "application/json")
            .header("User-Agent", "WalletInspector/1.0")
            .json(&native_payload)
            .send()
            .await;

        if let Ok(res1) = post_native {
            if res1.status().is_success() {
                if let Ok(data1) = res1.json::<serde_json::Value>().await {
                    let lamports = data1
                        .pointer("/result/value")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    let (sol_amt, display_str) = format_sol_display(lamports);
                    let mut has_funds = sol_amt > 0.0;
                    let mut tokens = Vec::new();

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
                                if let Some(accounts) = spl_data
                                    .get("result")
                                    .and_then(|r| r.get("value"))
                                    .and_then(|v| v.as_array())
                                {
                                    for acc in accounts {
                                        let info = acc
                                            .get("account")
                                            .and_then(|a| a.get("data"))
                                            .and_then(|d| d.get("parsed"))
                                            .and_then(|p| p.get("info"));
                                        let Some(info) = info else {
                                            continue;
                                        };
                                        let mint =
                                            info.get("mint").and_then(|m| m.as_str()).unwrap_or("");
                                        let token_amount = info.get("tokenAmount");
                                        let ui_amount = token_amount
                                            .and_then(|t| t.get("uiAmount"))
                                            .and_then(|u| u.as_f64())
                                            .unwrap_or(0.0);
                                        let amount_raw = token_amount
                                            .and_then(|t| t.get("amount"))
                                            .and_then(|a| a.as_str())
                                            .unwrap_or("0");

                                        if ui_amount > 0.0 && !mint.is_empty() {
                                            has_funds = true;
                                            let (known_sym, known_name) = solana_token_meta(mint);
                                            let symbol = if !known_sym.is_empty() {
                                                known_sym.to_string()
                                            } else {
                                                let start = &mint[..mint.len().min(4)];
                                                let end = if mint.len() > 4 {
                                                    &mint[mint.len() - 4..]
                                                } else {
                                                    ""
                                                };
                                                format!("{start}..{end}")
                                            };

                                            let formatted: String = if ui_amount < 0.0001 {
                                                format!("{:.8} {}", ui_amount, symbol)
                                            } else if ui_amount < 1.0 {
                                                format!("{:.6} {}", ui_amount, symbol)
                                            } else if ui_amount < 1000.0 {
                                                format!("{:.4} {}", ui_amount, symbol)
                                            } else {
                                                format!("{:.2} {}", ui_amount, symbol)
                                            };

                                            tokens.push(DiscoveredToken {
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
                        native_balance: display_str,
                        has_funds,
                        tokens,
                    });
                }
            }
        }

        last_err = format!("RPC {rpc} failed on Solana check");
    }

    Err(last_err)
}
