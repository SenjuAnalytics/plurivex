import { getPublicKey } from "@noble/ed25519";
import { Keypair } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
import { ethers } from "ethers";
import bs58 from "bs58";

const BASE58_LINE = /^[1-9A-HJ-NP-Za-km-z]{32,88}$/;

export function isBase58Line(value: string): boolean {
  return BASE58_LINE.test(value.trim());
}

export function deriveSolanaFromMnemonic(mnemonic: string): { address: string; privateKeyBase58: string } | null {
  try {
    const seedHex = ethers.utils.mnemonicToSeed(mnemonic.trim()).replace(/^0x/, "");
    const derived = derivePath("m/44'/501'/0'/0'", seedHex);
    const kp = Keypair.fromSeed(derived.key);
    return {
      address: kp.publicKey.toBase58(),
      privateKeyBase58: bs58.encode(kp.secretKey),
    };
  } catch {
    return null;
  }
}

export function deriveSolanaFromHex(hexKey: string): { address: string; privateKeyBase58: string } | null {
  try {
    const cleanHex = hexKey.trim().replace(/^0x/i, "");
    if (cleanHex.length !== 64) return null;
    const raw32 = ethers.utils.arrayify("0x" + cleanHex);
    const kp = Keypair.fromSeed(raw32);
    return {
      address: kp.publicKey.toBase58(),
      privateKeyBase58: bs58.encode(kp.secretKey),
    };
  } catch {
    return null;
  }
}

export function deriveEvmFromSolanaKey(secret: string): { address: string; privateKeyHex: string } | null {
  try {
    const trimmed = secret.trim();
    const bytes = bs58.decode(trimmed);
    let raw32: Uint8Array;
    if (bytes.length === 64) {
      raw32 = bytes.slice(0, 32);
    } else if (bytes.length === 32) {
      raw32 = bytes;
    } else {
      return null;
    }
    const hex = ethers.utils.hexlify(raw32);
    const wallet = new ethers.Wallet(hex);
    return {
      address: wallet.address,
      privateKeyHex: hex,
    };
  } catch {
    return null;
  }
}

export function deriveSolanaAddress(secret: string): string | null {
  try {
    const trimmed = secret.trim();
    // 1. If it's a seed phrase (multiple words)
    if (trimmed.split(/\s+/).length >= 12) {
      const derived = deriveSolanaFromMnemonic(trimmed);
      return derived ? derived.address : null;
    }
    // 2. If it's a 64-char hex EVM key
    const hexClean = trimmed.replace(/^0x/i, "");
    if (/^[0-9a-fA-F]{64}$/.test(hexClean)) {
      const derived = deriveSolanaFromHex(hexClean);
      return derived ? derived.address : null;
    }
    // 3. If it's a base58 string
    if (isBase58Line(trimmed)) {
      const bytes = bs58.decode(trimmed);
      let pub: Uint8Array;
      if (bytes.length === 64) {
        pub = bytes.slice(32, 64);
      } else if (bytes.length === 32) {
        pub = getPublicKey(bytes);
      } else {
        return null;
      }
      return bs58.encode(pub);
    }
    return null;
  } catch {
    return null;
  }
}

export function isSolanaKeyStr(secret: string): boolean {
  const trimmed = secret.trim();
  if (!isBase58Line(trimmed)) return false;
  try {
    const bytes = bs58.decode(trimmed);
    return bytes.length === 64 || bytes.length === 32;
  } catch {
    return false;
  }
}

export function normalizeSolSecret(secret: string): string {
  try {
    const trimmed = secret.trim();
    if (!isBase58Line(trimmed)) return trimmed;
    const bytes = bs58.decode(trimmed);
    if (bytes.length === 64 || bytes.length === 32) {
      return bs58.encode(bytes);
    }
    return trimmed;
  } catch {
    return secret.trim();
  }
}

export function formatSolBalance(lamports: bigint): string {
  const amount = Number(lamports) / 1e9;
  if (!Number.isFinite(amount) || amount === 0) return "0 SOL";
  if (amount < 0.00001) return `${amount.toFixed(9).replace(/\.?0+$/, "")} SOL`;
  if (amount < 1) return `${amount.toFixed(6).replace(/\.?0+$/, "")} SOL`;
  return `${amount.toFixed(5)} SOL`;
}