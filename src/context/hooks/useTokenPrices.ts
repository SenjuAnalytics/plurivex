import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface PriceQuote {
  usd?: number;
  idr?: number;
}

export interface PriceReport {
  prices: Record<string, PriceQuote>;
  fetched_at_unix: number;
  stale: boolean;
}

export type DisplayCurrency = "USD" | "IDR";

export function useTokenPrices() {
  const [priceReport, setPriceReport] = useState<PriceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");

  const refreshPrices = useCallback(async () => {
    try {
      setLoading(true);
      const report = await invoke<PriceReport>("get_token_prices", {});
      setPriceReport(report);
    } catch (err) {
      console.warn("Failed to fetch token prices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPrices();
    const interval = setInterval(refreshPrices, 60000);
    return () => clearInterval(interval);
  }, [refreshPrices]);

  const toggleCurrency = useCallback(() => {
    setCurrency((prev) => (prev === "USD" ? "IDR" : "USD"));
  }, []);

  const normalizeKey = (key: string): string => {
    const lower = key.toLowerCase();
    switch (lower) {
      case "btc":
      case "bitcoin":
        return "bitcoin";
      case "eth":
      case "ethereum":
      case "weth":
      case "base":
      case "arb":
        return "ethereum";
      case "bnb":
      case "bsc":
      case "binancecoin":
        return "binancecoin";
      case "sol":
      case "solana":
        return "solana";
      default:
        return lower;
    }
  };

  const getUsd = useCallback(
    (key: string): number => {
      if (!priceReport?.prices) {
        // Safe baseline fallbacks if offline
        const k = key.toLowerCase();
        if (k === "btc" || k === "bitcoin") return 65000;
        if (k === "eth" || k === "ethereum" || k === "weth" || k === "base" || k === "arb") return 2600;
        if (k === "bnb" || k === "bsc" || k === "binancecoin") return 580;
        if (k === "sol" || k === "solana") return 140;
        return 1.0;
      }
      const id = normalizeKey(key);
      return priceReport.prices[id]?.usd ?? (key.toLowerCase() === "btc" ? 65000 : 1.0);
    },
    [priceReport]
  );

  const getIdr = useCallback(
    (key: string): number => {
      if (!priceReport?.prices) {
        return getUsd(key) * 16000;
      }
      const id = normalizeKey(key);
      return priceReport.prices[id]?.idr ?? (getUsd(key) * 16000);
    },
    [priceReport, getUsd]
  );

  const formatValuation = useCallback(
    (usdAmount: number): { primary: string; secondary: string } => {
      const btcUsd = getUsd("btc") || 65000;
      const btcIdr = getIdr("btc") || 1040000000;
      const idrPerUsd = btcIdr / btcUsd || 16000;

      const idrAmount = usdAmount * idrPerUsd;

      const usdFormatted =
        usdAmount < 0.01
          ? "< $0.01"
          : `$${usdAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;

      const idrFormatted =
        idrAmount < 1000
          ? `< Rp ${Math.round(idrAmount)}`
          : `Rp ${Math.round(idrAmount).toLocaleString("id-ID")}`;

      if (currency === "IDR") {
        return {
          primary: idrFormatted,
          secondary: `${usdFormatted} USD`,
        };
      } else {
        return {
          primary: `${usdFormatted} USD`,
          secondary: idrFormatted,
        };
      }
    },
    [currency, getUsd, getIdr]
  );

  return {
    priceReport,
    loading,
    refreshPrices,
    currency,
    setCurrency,
    toggleCurrency,
    getUsd,
    getIdr,
    formatValuation,
  };
}
