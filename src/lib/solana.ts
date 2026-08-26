import { getPublicKey } from "@noble/ed25519";
import bs58 from "bs58";

const BASE58_LINE = /^[1-9A-HJ-NP-Za-km-z]{32,88}$/;

export function isBase58Line(value: string): boolean {
  return BASE58_LINE.test(value.trim());
}

export function deriveSolanaAddress(secret: string): string | null {
  try {
    const bytes = bs58.decode(secret.trim());
    let pub: Uint8Array;
    if (bytes.length === 64) {
      pub = bytes.slice(32, 64);
    } else if (bytes.length === 32) {
      pub = getPublicKey(bytes);
    } else {
      return null;
    }
    return bs58.encode(pub);
  } catch {
    return null;
  }
}

export function isSolanaKeyStr(secret: string): boolean {
  return deriveSolanaAddress(secret) !== null;
}

export function normalizeSolSecret(secret: string): string {
  const trimmed = secret.trim();
  const bytes = bs58.decode(trimmed);
  if (bytes.length === 64 || bytes.length === 32) {
    return bs58.encode(bytes);
  }
  return trimmed;
}

export function formatSolBalance(lamports: bigint): string {
  const amount = Number(lamports) / 1e9;
  if (!Number.isFinite(amount) || amount === 0) return "0 SOL";
  if (amount < 0.00001) return `${amount.toFixed(9).replace(/\.?0+$/, "")} SOL`;
  if (amount < 1) return `${amount.toFixed(6).replace(/\.?0+$/, "")} SOL`;
  return `${amount.toFixed(5)} SOL`;
}