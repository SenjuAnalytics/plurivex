use crate::core::scanner::WalletChainResult;

pub fn format_btc_display(satoshis: u64) -> (f64, String) {
    let btc = (satoshis as f64) / 100_000_000.0;
    if satoshis == 0 {
        (0.0, "0 BTC".to_string())
    } else if btc < 0.000001 {
        let s = format!("{:.8}", btc);
        let trimmed = s.trim_end_matches('0').trim_end_matches('.');
        (btc, format!("< 0.000001 BTC ({})", trimmed))
    } else {
        let s = format!("{:.8}", btc);
        let trimmed = s.trim_end_matches('0').trim_end_matches('.');
        (btc, format!("{} BTC", trimmed))
    }
}

pub async fn scan_bitcoin_for_wallet(
    client: &reqwest::Client,
    address: &str,
    rpcs: &[&str],
    wallet_id: i64,
) -> Result<WalletChainResult, String> {
    let mut last_err = "All Bitcoin endpoints failed".to_string();

    for rpc in rpcs {
        let url = format!("{}/address/{}", rpc.trim_end_matches('/'), address);
        let req = client
            .get(&url)
            .header("User-Agent", "WalletInspector/1.0")
            .timeout(std::time::Duration::from_secs(12))
            .send()
            .await;

        match req {
            Ok(res) => {
                if res.status().is_success() {
                    if let Ok(data) = res.json::<serde_json::Value>().await {
                        let funded = data
                            .pointer("/chain_stats/funded_txo_sum")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0)
                            + data
                                .pointer("/mempool_stats/funded_txo_sum")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0);

                        let spent = data
                            .pointer("/chain_stats/spent_txo_sum")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0)
                            + data
                                .pointer("/mempool_stats/spent_txo_sum")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0);

                        let satoshis = funded.saturating_sub(spent);
                        let (btc_amt, display_str) = format_btc_display(satoshis);
                        let has_funds = btc_amt > 0.0;

                        return Ok(WalletChainResult {
                            wallet_id,
                            chain_key: "btc".to_string(),
                            native_balance: display_str,
                            has_funds,
                            tokens: Vec::new(),
                        });
                    }
                } else {
                    last_err = format!("HTTP error {} from {}", res.status(), rpc);
                }
            }
            Err(e) => {
                last_err = format!("Connection error to {}: {}", rpc, e);
            }
        }
    }

    Err(last_err)
}
