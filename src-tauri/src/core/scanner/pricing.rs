use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// PriceQuote holds valuation in major fiat/stable currencies
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PriceQuote {
    pub usd: Option<f64>,
    pub idr: Option<f64>,
}

/// PriceReport holds the aggregated price snapshot and cache freshness metadata
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PriceReport {
    pub prices: HashMap<String, PriceQuote>,
    pub fetched_at_unix: u64,
    pub stale: bool,
}

impl PriceReport {
    /// Return the USD price for a standard symbol or CoinGecko ID
    pub fn get_usd_price(&self, key: &str) -> Option<f64> {
        let lookup_key = Self::normalize_asset_id(key);
        self.prices.get(&lookup_key).and_then(|q| q.usd)
    }

    /// Return the IDR price for a standard symbol or CoinGecko ID
    pub fn get_idr_price(&self, key: &str) -> Option<f64> {
        let lookup_key = Self::normalize_asset_id(key);
        self.prices.get(&lookup_key).and_then(|q| q.idr)
    }

    /// Normalizes common symbols to standard CoinGecko IDs
    pub fn normalize_asset_id(key: &str) -> String {
        let lower = key.to_lowercase();
        match lower.as_str() {
            "btc" | "bitcoin" => "bitcoin".to_string(),
            "eth" | "ethereum" => "ethereum".to_string(),
            "bnb" | "binancecoin" => "binancecoin".to_string(),
            "sol" | "solana" => "solana".to_string(),
            _ => lower,
        }
    }

    /// Generates baseline fallback prices if network is unreachable
    pub fn baseline_fallback() -> Self {
        let mut prices = HashMap::new();
        prices.insert(
            "bitcoin".to_string(),
            PriceQuote {
                usd: Some(65000.0),
                idr: Some(1_050_000_000.0),
            },
        );
        prices.insert(
            "ethereum".to_string(),
            PriceQuote {
                usd: Some(2600.0),
                idr: Some(42_000_000.0),
            },
        );
        prices.insert(
            "binancecoin".to_string(),
            PriceQuote {
                usd: Some(580.0),
                idr: Some(9_300_000.0),
            },
        );
        prices.insert(
            "solana".to_string(),
            PriceQuote {
                usd: Some(140.0),
                idr: Some(2_250_000.0),
            },
        );

        let now_unix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Self {
            prices,
            fetched_at_unix: now_unix,
            stale: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_report_lookup() {
        let report = PriceReport::baseline_fallback();
        assert!(report.stale);
        assert_eq!(report.get_usd_price("btc"), Some(65000.0));
        assert_eq!(report.get_usd_price("ETH"), Some(2600.0));
        assert_eq!(report.get_usd_price("BNB"), Some(580.0));
        assert_eq!(report.get_usd_price("SOL"), Some(140.0));
        assert!(report.get_idr_price("BTC").unwrap() > 1_000_000_000.0);
    }
}
