const SALT_LEN = 16;
const IV_LEN = 12;
const ITERATIONS = 120_000;

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function getCachedDerivedKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const saltKey = `${password}:${toB64(salt)}`;
  let p = keyCache.get(saltKey);
  if (!p) {
    p = deriveKey(password, salt);
    keyCache.set(saltKey, p);
  }
  return p;
}

const DEFAULT_SALT = new TextEncoder().encode("wallet_inspect_s"); // 16 bytes

export async function encrypt(plaintext: string, password: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await getCachedDerivedKey(password, DEFAULT_SALT);
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    enc.encode(plaintext),
  );
  const packed = new Uint8Array(DEFAULT_SALT.length + iv.length + cipher.byteLength);
  packed.set(DEFAULT_SALT, 0);
  packed.set(iv, DEFAULT_SALT.length);
  packed.set(new Uint8Array(cipher), DEFAULT_SALT.length + iv.length);
  return toB64(packed);
}

export async function decrypt(blob: string, password: string): Promise<string> {
  const packed = fromB64(blob);
  const salt = packed.slice(0, SALT_LEN);
  const iv = packed.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const data = packed.slice(SALT_LEN + IV_LEN);
  const key = await getCachedDerivedKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

export async function createVerificationToken(password: string): Promise<string> {
  return encrypt("__vault_ok__", password);
}

export async function verifyPassword(token: string, password: string): Promise<boolean> {
  try {
    const v = await decrypt(token, password);
    return v === "__vault_ok__";
  } catch {
    return false;
  }
}