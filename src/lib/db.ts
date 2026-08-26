import Database from "@tauri-apps/plugin-sql";
import type { WalletRecord, WalletType } from "./types";
import { CHAINS } from "./chains";

const DB_PATH = "sqlite:wallet_inspector.db";
let db: Database | null = null;

export async function getDb() {
  if (!db) db = await Database.load(DB_PATH);
  return db;
}

export async function initDb() {
  await getDb();
}

export async function hasMasterPassword(): Promise<boolean> {
  const database = await getDb();
  const rows = await database.select<{ value: string }[]>(
    "SELECT value FROM meta WHERE key = 'verification'",
  );
  return rows.length > 0;
}

export async function saveMasterPassword(token: string) {
  const database = await getDb();
  await database.execute(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ($1, $2)",
    ["verification", token],
  );
}

export async function getVerificationToken(): Promise<string | null> {
  const database = await getDb();
  const rows = await database.select<{ value: string }[]>(
    "SELECT value FROM meta WHERE key = 'verification'",
  );
  return rows[0]?.value ?? null;
}

export async function insertWallet(data: {
  type: WalletType;
  encryptedSecret: string;
  fingerprint: string;
  address: string | null;
  solAddress?: string | null;
  wordCount: number | null;
}) {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO wallets (type, encrypted_secret, fingerprint, address, sol_address, word_count, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      data.type,
      data.encryptedSecret,
      data.fingerprint,
      data.address,
      data.solAddress ?? null,
      data.wordCount,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertId as number;
}

export async function insertWalletsBatch(
  items: {
    type: WalletType;
    encryptedSecret: string;
    fingerprint: string;
    address: string | null;
    solAddress?: string | null;
    wordCount: number | null;
  }[],
) {
  if (!items.length) return;
  const database = await getDb();
  const now = new Date().toISOString();

  const BATCH_SIZE = 40;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const valuePlaceholders: string[] = [];
    const params: (string | number | null)[] = [];

    chunk.forEach((data, idx) => {
      const base = idx * 7;
      valuePlaceholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`,
      );
      params.push(
        data.type,
        data.encryptedSecret,
        data.fingerprint,
        data.address,
        data.solAddress ?? null,
        data.wordCount,
        now,
      );
    });

    const sql = `INSERT OR IGNORE INTO wallets (type, encrypted_secret, fingerprint, address, sol_address, word_count, created_at) VALUES ${valuePlaceholders.join(", ")}`;
    await database.execute(sql, params);
  }
}

export async function getAllWallets(): Promise<WalletRecord[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      type: WalletType;
      encrypted_secret: string;
      address: string | null;
      sol_address: string | null;
      word_count: number | null;
      label: string | null;
      created_at: string;
    }[]
  >("SELECT * FROM wallets ORDER BY id ASC");

  let balances: { wallet_id: number; chain: string; balance: string | null }[] = [];
  try {
    balances = await database.select<
      { wallet_id: number; chain: string; balance: string | null }[]
    >("SELECT wallet_id, chain, balance FROM balances");
  } catch {
    balances = [];
  }

  let tokens: {
    wallet_id: number;
    chain: string;
    token_symbol: string;
    token_name: string | null;
    balance: string;
    raw_balance: string | null;
    contract_address: string | null;
  }[] = [];
  try {
    tokens = await database.select<
      {
        wallet_id: number;
        chain: string;
        token_symbol: string;
        token_name: string | null;
        balance: string;
        raw_balance: string | null;
        contract_address: string | null;
      }[]
    >("SELECT wallet_id, chain, token_symbol, token_name, balance, raw_balance, contract_address FROM token_balances");
  } catch {
    tokens = [];
  }

  return rows.map((r) => {
    const balMap: Record<string, string | null> = {};
    for (const c of CHAINS) balMap[c.key] = null;
    for (const b of balances.filter((x) => x.wallet_id === r.id)) {
      balMap[b.chain] = b.balance;
    }
    const walletTokens = tokens
      .filter((x) => x.wallet_id === r.id)
      .map((t) => ({
        walletId: t.wallet_id,
        chain: t.chain,
        symbol: t.token_symbol,
        name: t.token_name ?? t.token_symbol,
        balance: t.balance,
        rawBalance: t.raw_balance ?? undefined,
        contractAddress: t.contract_address ?? undefined,
      }));

    return {
      id: r.id,
      type: r.type,
      encryptedSecret: r.encrypted_secret,
      address: r.address,
      solAddress: r.sol_address,
      wordCount: r.word_count,
      label: r.label,
      createdAt: r.created_at,
      balances: balMap,
      tokens: walletTokens,
    };
  });
}

export async function saveBalance(walletId: number, chain: string, balance: string) {
  const database = await getDb();
  await database.execute(
    `INSERT OR REPLACE INTO balances (wallet_id, chain, balance, updated_at)
     VALUES ($1, $2, $3, $4)`,
    [walletId, chain, balance, new Date().toISOString()],
  );
}

export async function deleteWallet(id: number) {
  const database = await getDb();
  try {
    await database.execute("DELETE FROM token_balances WHERE wallet_id = $1", [id]);
  } catch {
    /* ignore if table empty */
  }
  await database.execute("DELETE FROM balances WHERE wallet_id = $1", [id]);
  await database.execute("DELETE FROM wallets WHERE id = $1", [id]);
}

export async function getExistingFingerprints(): Promise<Set<string>> {
  const database = await getDb();
  const rows = await database.select<{ fingerprint: string }[]>(
    "SELECT fingerprint FROM wallets",
  );
  return new Set(rows.map((r) => r.fingerprint));
}