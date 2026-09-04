import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface PriceQuote {
  usd?: number;
  idr?: number;
  eur?: number;
  gbp?: number;
  jpy?: number;
  cny?: number;
  cad?: number;
  aud?: number;
  chf?: number;
  sgd?: number;
  inr?: number;
  krw?: number;
  brl?: number;
  [key: string]: number | undefined;
}

export interface PriceReport {
  prices: Record<string, PriceQuote>;
  fetched_at_unix: number;
  stale: boolean;
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  label: string;
  locale: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", label: "USD - US Dollar ($)", locale: "en-US", decimals: 2 },
  { code: "EUR", symbol: "€", label: "EUR - Euro (€)", locale: "de-DE", decimals: 2 },
  { code: "GBP", symbol: "£", label: "GBP - British Pound (£)", locale: "en-GB", decimals: 2 },
  { code: "JPY", symbol: "¥", label: "JPY - Japanese Yen (¥)", locale: "ja-JP", decimals: 0 },
  { code: "IDR", symbol: "Rp", label: "IDR - Rupiah (Rp)", locale: "id-ID", decimals: 0 },
  { code: "CAD", symbol: "CA$", label: "CAD - Canadian Dollar ($)", locale: "en-CA", decimals: 2 },
  { code: "AUD", symbol: "AU$", label: "AUD - Australian Dollar ($)", locale: "en-AU", decimals: 2 },
  { code: "CHF", symbol: "CHF", label: "CHF - Swiss Franc (Fr)", locale: "de-CH", decimals: 2 },
  { code: "SGD", symbol: "SG$", label: "SGD - Singapore Dollar ($)", locale: "en-SG", decimals: 2 },
  { code: "CNY", symbol: "¥", label: "CNY - Chinese Yuan (¥)", locale: "zh-CN", decimals: 2 },
  { code: "INR", symbol: "₹", label: "INR - Indian Rupee (₹)", locale: "en-IN", decimals: 2 },
  { code: "KRW", symbol: "₩", label: "KRW - Korean Won (₩)", locale: "ko-KR", decimals: 0 },
  { code: "BRL", symbol: "R$", label: "BRL - Brazilian Real (R$)", locale: "pt-BR", decimals: 2 },
];

const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150.0,
  IDR: 16150.0,
  CAD: 1.37,
  AUD: 1.51,
  CHF: 0.89,
  SGD: 1.32,
  CNY: 7.23,
  INR: 83.5,
  KRW: 1380.0,
  BRL: 5.45,
};

const STORAGE_KEY = "plurivex_selected_currency";

export function useTokenPrices() {
  const [priceReport, setPriceReport] = useState<PriceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrencyState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_CURRENCIES.some((c) => c.code === saved.toUpperCase())) {
        return saved.toUpperCase();
      }
    } catch {
      // ignore
    }
    return "USD";
  });

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

  const setCurrency = useCallback((newCurr: string) => {
    const code = newCurr.toUpperCase();
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  const toggleCurrency = useCallback(() => {
    setCurrencyState((prev) => {
      const idx = SUPPORTED_CURRENCIES.findIndex((c) => c.code === prev);
      const nextIdx = (idx + 1) % SUPPORTED_CURRENCIES.length;
      const nextCurr = SUPPORTED_CURRENCIES[nextIdx].code;
      try {
        localStorage.setItem(STORAGE_KEY, nextCurr);
      } catch {
        // ignore
      }
      return nextCurr;
    });
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

  const getRate = useCallback(
    (targetCurrency: string): number => {
      const curr = targetCurrency.toUpperCase();
      if (curr === "USD") return 1.0;

      // Try dynamically computing exchange rate from CoinGecko BTC quote
      const btcQuote = priceReport?.prices?.["bitcoin"];
      if (btcQuote && btcQuote.usd && btcQuote.usd > 0) {
        const targetVal = btcQuote[curr.toLowerCase()];
        if (typeof targetVal === "number" && targetVal > 0) {
          return targetVal / btcQuote.usd;
        }
      }

      // Try ETH quote
      const ethQuote = priceReport?.prices?.["ethereum"];
      if (ethQuote && ethQuote.usd && ethQuote.usd > 0) {
        const targetVal = ethQuote[curr.toLowerCase()];
        if (typeof targetVal === "number" && targetVal > 0) {
          return targetVal / ethQuote.usd;
        }
      }

      // Safe static fallbacks
      return FALLBACK_RATES[curr] || 1.0;
    },
    [priceReport]
  );

  const getIdr = useCallback(
    (key: string): number => {
      return getUsd(key) * getRate("IDR");
    },
    [getUsd, getRate]
  );

  const formatValuation = useCallback(
    (usdAmount: number, targetCurr?: string): { primary: string; secondary: string } => {
      const activeCode = (targetCurr || currency).toUpperCase();
      const activeInfo = SUPPORTED_CURRENCIES.find((c) => c.code === activeCode) || SUPPORTED_CURRENCIES[0];

      const usdFormatted =
        usdAmount <= 0
          ? "$0.00 USD"
          : usdAmount < 0.01
          ? "< $0.01 USD"
          : `$${usdAmount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} USD`;

      if (activeCode === "USD") {
        return {
          primary: usdFormatted,
          secondary: "",
        };
      }

      const rate = getRate(activeCode);
      const convertedAmount = usdAmount * rate;

      let convertedFormatted = "";
      if (convertedAmount <= 0) {
        convertedFormatted = `${activeInfo.symbol} 0`;
      } else if (activeInfo.decimals === 0) {
        if (convertedAmount < 1) {
          convertedFormatted = `< ${activeInfo.symbol} 1`;
        } else {
          convertedFormatted = `${activeInfo.symbol} ${Math.round(convertedAmount).toLocaleString(activeInfo.locale)}`;
        }
      } else {
        if (convertedAmount < 0.01) {
          convertedFormatted = `< ${activeInfo.symbol}0.01`;
        } else {
          convertedFormatted = `${activeInfo.symbol}${convertedAmount.toLocaleString(activeInfo.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        }
      }

      return {
        primary: `${convertedFormatted} ${activeCode}`,
        secondary: usdFormatted,
      };
    },
    [currency, getRate]
  );

  return {
    priceReport,
    loading,
    refreshPrices,
    currency,
    setCurrency,
    toggleCurrency,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    getRate,
    getUsd,
    getIdr,
    formatValuation,
  };
}
