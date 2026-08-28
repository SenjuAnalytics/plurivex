import { ethers } from "ethers";
import { wordlists } from "@ethersproject/wordlists";
import {
  isBase58Line,
  isSolanaKeyStr,
  normalizeSolSecret,
  deriveSolanaAddress,
  deriveSolanaFromMnemonic,
  deriveSolanaFromHex,
  deriveEvmFromSolanaKey,
} from "./solana";
import type { WalletType } from "./types";

export {
  deriveSolanaAddress,
  isSolanaKeyStr,
  deriveSolanaFromMnemonic,
  deriveSolanaFromHex,
  deriveEvmFromSolanaKey,
} from "./solana";

const MNEMONIC_LENGTHS = [12, 15, 18, 21, 24];

let bip39Set: Set<string> | null = null;

function getBip39Set(): Set<string> {
  if (!bip39Set) {
    bip39Set = new Set();
    const wl = wordlists.en;
    for (let i = 0; i < 2048; i++) bip39Set.add(wl.getWord(i));
  }
  return bip39Set;
}

function isBip39Word(word: string): boolean {
  return getBip39Set().has(word.toLowerCase());
}

export function isValidSeedPhrase(text: string): boolean {
  try {
    return ethers.utils.isValidMnemonic(text.trim());
  } catch {
    return false;
  }
}

export function isValidWalletEntry(text: string): boolean {
  const t = text.trim();
  if (isSolanaKeyStr(t)) return true;
  if (isPrivateKeyStr(t)) {
    try {
      const hex = t.replace(/^0x/i, "");
      new ethers.Wallet(hex.startsWith("0x") ? hex : `0x${hex}`);
      return true;
    } catch {
      return false;
    }
  }
  return isValidSeedPhrase(t);
}

export function isPrivateKeyStr(s: string): boolean {
  const t = s.trim();
  const hex = t.replace(/^0x/i, "");
  return /^[0-9a-fA-F]+$/.test(hex) && hex.length === 64;
}

export function classify(line: string): WalletType | "pk_bad_length" {
  const t = line.trim();
  const hex = t.replace(/^0x/i, "");
  const words = t.split(/\s+/).filter(Boolean);
  if (/^[0-9a-fA-F]+$/.test(hex) && words.length === 1) {
    return hex.length === 64 ? "pk" : "pk_bad_length";
  }
  if (MNEMONIC_LENGTHS.includes(words.length) && isValidSeedPhrase(t)) return "seed";
  if (words.length === 1 && isSolanaKeyStr(t)) return "sol_pk";
  return "invalid";
}

function extractFromLine(line: string) {
  const t = line.trim();
  if (!t) return { words: [] as string[] };
  if (isPrivateKeyStr(t)) return { privateKey: t };

  const numbered = t.match(/^(\d{1,3})[.):\-\]]\s+(.+)$/);
  if (numbered) {
    const content = numbered[2].trim();
    if (!content) return { words: [] as string[], number: +numbered[1] };
    return { words: content.split(/\s+/).filter(Boolean), number: +numbered[1] };
  }
  return { words: t.split(/\s+/).filter(Boolean) };
}

function isHexToken(value: string): boolean {
  const hex = value.replace(/^0x/i, "");
  return /^[0-9a-fA-F]{32,64}$/.test(hex);
}

function isLikelyLabelLine(words: string[]): boolean {
  if (!words.length) return true;
  const joined = words.join(" ").toLowerCase();
  if (joined === "sol" || joined === "evm" || joined === "protrader") return true;
  if (words.length <= 3 && words.every((w) => /^[a-zA-Z0-9²]+$/.test(w))) {
    if (words.length === 1 && /^[A-Z]/.test(words[0]) && words[0].length < 28) return true;
    if (words.length > 1 && words.every((w) => /^[A-Z]/.test(w))) return true;
  }
  return false;
}

export function normalizeInput(raw: string): string[] {
  const result: string[] = [];
  let words: string[] = [];

  const flush = () => {
    if (!words.length) return;
    const phrase = words.join(" ");
    if (isValidWalletEntry(phrase)) result.push(phrase);
    words = [];
  };

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (MNEMONIC_LENGTHS.includes(words.length) && isValidSeedPhrase(words.join(" "))) flush();
      words = [];
      continue;
    }

    if (isHexToken(trimmed) || isBase58Line(trimmed)) {
      flush();
      words = [];
      continue;
    }

    const item = extractFromLine(line);
    if ("privateKey" in item && item.privateKey) {
      flush();
      result.push(item.privateKey);
      continue;
    }

    const lineWords = item.words ?? [];
    if (!lineWords.length) continue;
    if (isLikelyLabelLine(lineWords)) {
      flush();
      words = [];
      continue;
    }

    if (item.number === 1 && words.length) flush();

    const seedWords = lineWords.filter((w) => /^[a-z]+$/.test(w) && isBip39Word(w));
    if (!seedWords.length) {
      words = [];
      continue;
    }
    if (seedWords.length !== lineWords.length) {
      words = [];
      continue;
    }

    words.push(...seedWords);
    if (MNEMONIC_LENGTHS.includes(words.length) && isValidSeedPhrase(words.join(" "))) flush();
  }
  flush();
  return result;
}

export function canonicalKey(text: string): string {
  const t = text.trim();
  const hex = t.replace(/^0x/i, "");
  if (/^[0-9a-fA-F]{64}$/.test(hex) && !/\s/.test(t)) {
    return "pk:" + hex.toLowerCase();
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (MNEMONIC_LENGTHS.includes(words.length) && isValidSeedPhrase(t)) {
    return "seed:" + words.map((w) => w.toLowerCase()).join(" ");
  }
  if (isSolanaKeyStr(t)) return `sol:${normalizeSolSecret(t)}`;
  return "seed:" + words.map((w) => w.toLowerCase()).join(" ");
}

export function deriveAddress(secret: string, type: WalletType): string | null {
  try {
    if (type === "pk") {
      const norm = secret.trim().replace(/^0x/i, "0x");
      return new ethers.Wallet(norm.startsWith("0x") ? norm : "0x" + norm).address;
    }
    if (type === "seed") {
      return ethers.Wallet.fromMnemonic(secret.trim()).address;
    }
  } catch {
    return null;
  }
  return null;
}

export function deriveEvmWallet(secret: string, type: WalletType): ethers.Wallet | null {
  try {
    if (type === "pk") {
      const norm = secret.trim().replace(/^0x/i, "");
      return new ethers.Wallet("0x" + norm);
    }
    if (type === "seed") {
      return ethers.Wallet.fromMnemonic(secret.trim());
    }
  } catch {
    return null;
  }
  return null;
}

export interface DualCredentials {
  evmAddress: string | null;
  solAddress: string | null;
  evmPrivateKey: string | null;
  solPrivateKey: string | null;
}

export function deriveDualCredentials(secret: string, type: WalletType): DualCredentials {
  const t = secret.trim();
  let evmAddress: string | null = null;
  let solAddress: string | null = null;
  let evmPrivateKey: string | null = null;
  let solPrivateKey: string | null = null;

  try {
    if (type === "seed") {
      // EVM Derivation
      try {
        const w = ethers.Wallet.fromMnemonic(t);
        evmAddress = w.address;
        evmPrivateKey = w.privateKey;
      } catch {}

      // Solana Derivation from Mnemonic
      const sol = deriveSolanaFromMnemonic(t);
      if (sol) {
        solAddress = sol.address;
        solPrivateKey = sol.privateKeyBase58;
      }
    } else if (type === "pk") {
      // EVM Derivation
      try {
        const norm = t.replace(/^0x/i, "");
        const w = new ethers.Wallet("0x" + norm);
        evmAddress = w.address;
        evmPrivateKey = "0x" + norm;
      } catch {}

      // Solana Derivation from 32-byte EVM PK
      const sol = deriveSolanaFromHex(t);
      if (sol) {
        solAddress = sol.address;
        solPrivateKey = sol.privateKeyBase58;
      }
    } else if (type === "sol_pk") {
      // Solana Key
      solAddress = deriveSolanaAddress(t);
      solPrivateKey = t;

      // EVM Derivation from Solana Key bytes
      const evm = deriveEvmFromSolanaKey(t);
      if (evm) {
        evmAddress = evm.address;
        evmPrivateKey = evm.privateKeyHex;
      }
    }
  } catch (e) {
    console.warn("Dual derivation error:", e);
  }

  return {
    evmAddress,
    solAddress,
    evmPrivateKey,
    solPrivateKey,
  };
}

export function derivePrivateKeyFromSecret(secret: string, type: WalletType): string | null {
  try {
    const creds = deriveDualCredentials(secret, type);
    return creds.evmPrivateKey ?? creds.solPrivateKey;
  } catch {
    return null;
  }
}

export function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export function walletDisplayAddress(
  wallet: {
    address: string | null;
    solAddress: string | null;
    type: WalletType;
  },
  preferFamily?: "evm" | "sol",
): string | null {
  if (preferFamily === "sol") {
    return wallet.solAddress ?? wallet.address;
  }
  if (preferFamily === "evm") {
    return wallet.address ?? wallet.solAddress;
  }
  if (wallet.type === "sol_pk") return wallet.solAddress ?? wallet.address;
  return wallet.address ?? wallet.solAddress;
}

export function isSolanaWallet(type: WalletType): boolean {
  return type === "sol_pk";
}

export function isEvmWallet(type: WalletType): boolean {
  return type === "seed" || type === "pk";
}

export function walletHasScanTarget(wallet: {
  address: string | null;
  solAddress: string | null;
  type: WalletType;
}): boolean {
  return Boolean(wallet.address || wallet.solAddress);
}

export function maskSecret(secret: string, type: WalletType): string {
  const t = secret.trim();
  if (type === "pk" || type === "sol_pk") return t.slice(0, 8) + "…" + t.slice(-6);
  const w = t.split(/\s+/);
  if (w.length <= 4) return t;
  return w.slice(0, 3).join(" ") + " … " + w.slice(-2).join(" ");
}

export function entryStatus(text: string) {
  const type = classify(text);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const hex = text.trim().replace(/^0x/i, "");

  if (type === "seed") return { kind: "seed" as const, ok: true, status: `${words.length} words ✓` };
  if (MNEMONIC_LENGTHS.includes(words.length)) {
    return { kind: "invalid" as const, ok: false, status: `${words.length} words ✗` };
  }
  if (type === "sol_pk") return { kind: "sol_pk" as const, ok: true, status: "Solana ✓" };
  if (type === "pk") return { kind: "pk" as const, ok: true, status: "64 hex ✓" };
  if (type === "pk_bad_length") return { kind: "invalid" as const, ok: false, status: `${hex.length}/64 hex` };
  if (words.length > 1) return { kind: "invalid" as const, ok: false, status: `${words.length} words ✗` };
  return { kind: "invalid" as const, ok: false, status: "invalid format" };
}