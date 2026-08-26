import { invoke, isTauri } from "@tauri-apps/api/core";
import { ethers } from "ethers";
import { formatSolBalance } from "./solana";
import type { TokenBalance, WalletType } from "./types";
import { isSolanaWallet } from "./wallet";

export const CHAINS = [
  {
    key: "eth",
    label: "Ethereum",
    short: "ETH",
    family: "evm" as const,
    rpcs: [
      "https://ethereum.publicnode.com",
      "https://eth.drpc.org",
      "https://cloudflare-eth.com",
      "https://rpc.ankr.com/eth",
    ],
    symbol: "ETH",
    color: "#627eea",
    chainId: 1,
  },
  {
    key: "bsc",
    label: "BNB Chain",
    short: "BSC",
    family: "evm" as const,
    rpcs: [
      "https://bsc-dataseed.binance.org",
      "https://bsc-dataseed1.defibit.io",
      "https://bsc-dataseed2.binance.org",
      "https://rpc.ankr.com/bsc",
    ],
    symbol: "BNB",
    color: "#f0b90b",
    chainId: 56,
  },
  {
    key: "base",
    label: "Base",
    short: "BASE",
    family: "evm" as const,
    rpcs: [
      "https://mainnet.base.org",
      "https://base.publicnode.com",
      "https://rpc.ankr.com/base",
    ],
    symbol: "ETH",
    color: "#0052ff",
    chainId: 8453,
  },
  {
    key: "arb",
    label: "Arbitrum",
    short: "ARB",
    family: "evm" as const,
    rpcs: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum.publicnode.com",
      "https://rpc.ankr.com/arbitrum",
    ],
    symbol: "ETH",
    color: "#28a0f0",
    chainId: 42161,
  },
  {
    key: "sol",
    label: "Solana",
    short: "SOL",
    family: "solana" as const,
    rpcs: [
      "https://api.mainnet-beta.solana.com",
      "https://solana-rpc.publicnode.com",
    ],
    symbol: "SOL",
    color: "#9945ff",
  },
] as const;

export type ChainKey = (typeof CHAINS)[number]["key"];
export type Chain = (typeof CHAINS)[number];

export const EVM_CHAINS = CHAINS.filter((c) => c.family === "evm");
export const SOL_CHAINS = CHAINS.filter((c) => c.family === "solana");

export function chainsForWallet(type: WalletType): readonly Chain[] {
  return isSolanaWallet(type) ? SOL_CHAINS : EVM_CHAINS;
}

const RPC_TIMEOUT_MS = 12_000;

async function rpcGetBalanceWeb(rpc: string, address: string): Promise<bigint> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { result?: string; error?: { message?: string } };
    if (data.error) throw new Error(data.error.message ?? "RPC error");
    if (!data.result) throw new Error("empty RPC result");
    return BigInt(data.result);
  } finally {
    clearTimeout(timer);
  }
}

async function rpcGetSolBalanceWeb(rpc: string, address: string): Promise<bigint> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address, { commitment: "confirmed" }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { result?: { value?: number }; error?: { message?: string } };
    if (data.error) throw new Error(data.error.message ?? "RPC error");
    if (data.result?.value == null) throw new Error("empty RPC result");
    return BigInt(data.result.value);
  } finally {
    clearTimeout(timer);
  }
}

async function rpcGetBalanceNative(rpc: string, address: string): Promise<bigint> {
  const result = await invoke<string>("rpc_get_balance", { address, rpc });
  return BigInt(result);
}

async function rpcGetSolBalanceNative(address: string, rpc: string): Promise<bigint> {
  const result = await invoke<string>("rpc_get_sol_balance", { address, rpc });
  return BigInt(result);
}

function formatBalance(wei: bigint, symbol: string): string {
  const raw = ethers.utils.formatEther(wei);
  const num = parseFloat(raw);
  if (!Number.isFinite(num) || num === 0) return `0 ${symbol}`;
  if (num < 0.00001) return `${raw} ${symbol}`;
  if (num < 1) return `${num.toFixed(6).replace(/\.?0+$/, "")} ${symbol}`;
  return `${num.toFixed(5)} ${symbol}`;
}

export async function fetchBalance(address: string, chain: Chain): Promise<string> {
  if (chain.family === "solana") {
    for (const rpc of chain.rpcs) {
      try {
        const lamports = isTauri()
          ? await rpcGetSolBalanceNative(address, rpc)
          : await rpcGetSolBalanceWeb(rpc, address);
        return formatSolBalance(lamports);
      } catch {
        /* try next rpc */
      }
    }
    return "error";
  }

  let normalized: string;
  try {
    normalized = ethers.utils.getAddress(address.trim());
  } catch {
    return "error";
  }

  for (const rpc of chain.rpcs) {
    try {
      const wei = isTauri()
        ? await rpcGetBalanceNative(rpc, normalized)
        : await rpcGetBalanceWeb(rpc, normalized);
      return formatBalance(wei, chain.symbol);
    } catch {
      /* try next rpc */
    }
  }
  return "error";
}

export function balanceAmount(v: string | null | undefined): number {
  if (!v || v === "error" || v === "loading") return 0;
  const num = parseFloat(v);
  return Number.isFinite(num) ? num : 0;
}

function sumBalance(balances: Record<string, string | null>, chains: readonly Chain[]): number {
  return chains.reduce((sum, c) => sum + balanceAmount(balances[c.key]), 0);
}

export function totalBalanceForWallet(
  balances: Record<string, string | null>,
  type: WalletType,
): number {
  return sumBalance(balances, chainsForWallet(type));
}

export function hasFundsForWallet(
  balances: Record<string, string | null>,
  type: WalletType,
  tokens?: TokenBalance[],
): boolean {
  const nativeHasFunds = chainsForWallet(type).some((c) => balanceAmount(balances[c.key]) > 0);
  if (nativeHasFunds) return true;
  if (tokens && tokens.length > 0) {
    return tokens.some((t) => balanceAmount(t.balance) > 0);
  }
  return false;
}

export function needsScanForWallet(
  balances: Record<string, string | null>,
  type: WalletType,
): boolean {
  return chainsForWallet(type).every((c) => !balances[c.key]);
}