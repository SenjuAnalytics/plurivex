import { canonicalKey } from "./wallet";

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export async function walletFingerprint(text: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(canonicalKey(text)));
  return toB64(new Uint8Array(hash));
}