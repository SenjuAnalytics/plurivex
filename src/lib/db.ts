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

  // O(N) Indexing by wallet_id to eliminate 190+ million nested loop iterations
  const balancesByWallet = new Map<number, { chain: string; balance: string | null }[]>();
  for (const b of balances) {
    const list = balancesByWallet.get(b.wallet_id);
    if (list) list.push(b);
    else balancesByWallet.set(b.wallet_id, [b]);
  }

  const tokensByWallet = new Map<number, typeof tokens>();
  for (const t of tokens) {
    const list = tokensByWallet.get(t.wallet_id);
    if (list) list.push(t);
    else tokensByWallet.set(t.wallet_id, [t]);
  }

  return rows.map((r) => {
    const balMap: Record<string, string | null> = {};
    for (const c of CHAINS) balMap[c.key] = null;
    const wBalances = balancesByWallet.get(r.id);
    if (wBalances) {
      for (const b of wBalances) {
        balMap[b.chain] = b.balance;
      }
    }
    const wTokens = tokensByWallet.get(r.id);
    const walletTokens = wTokens
      ? wTokens.map((t) => ({
          walletId: t.wallet_id,
          chain: t.chain,
          symbol: t.token_symbol,
          name: t.token_name ?? t.token_symbol,
          balance: t.balance,
          rawBalance: t.raw_balance ?? undefined,
          contractAddress: t.contract_address ?? undefined,
        }))
      : [];

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

export async function deleteAllWallets(): Promise<void> {
  const database = await getDb();
  try {
    await database.execute("DELETE FROM token_balances");
  } catch {
    /* ignore */
  }
  try {
    await database.execute("DELETE FROM balances");
  } catch {
    /* ignore */
  }
  await database.execute("DELETE FROM wallets");
}

export async function getExistingFingerprints(): Promise<Set<string>> {
  const database = await getDb();
  const rows = await database.select<{ fingerprint: string }[]>(
    "SELECT fingerprint FROM wallets",
  );
  return new Set(rows.map((r) => r.fingerprint));
}

export async function getExistingAddresses(): Promise<{
  evm: Map<string, { id: number; type: WalletType }>;
  sol: Map<string, { id: number; type: WalletType }>;
}> {
  const database = await getDb();
  const rows = await database.select<{ id: number; type: WalletType; address: string | null; sol_address: string | null }[]>(
    "SELECT id, type, address, sol_address FROM wallets",
  );
  const evm = new Map<string, { id: number; type: WalletType }>();
  const sol = new Map<string, { id: number; type: WalletType }>();
  for (const r of rows) {
    if (r.address) {
      evm.set(r.address.toLowerCase(), { id: r.id, type: r.type });
    }
    if (r.sol_address) {
      sol.set(r.sol_address, { id: r.id, type: r.type });
    }
  }
  return { evm, sol };
}

export async function upgradeWalletToSeed(
  id: number,
  encryptedSecret: string,
  fingerprint: string,
  wordCount: number,
) {
  const database = await getDb();
  await database.execute(
    "UPDATE wallets SET type = 'seed', encrypted_secret = $1, fingerprint = $2, word_count = $3 WHERE id = $4",
    [encryptedSecret, fingerprint, wordCount, id],
  );
}

export async function updateWalletLabel(id: number, label: string | null) {
  const database = await getDb();
  await database.execute("UPDATE wallets SET label = $1 WHERE id = $2", [label, id]);
}

export async function updateWalletAddresses(id: number, address: string | null, solAddress: string | null) {
  const database = await getDb();
  await database.execute("UPDATE wallets SET address = $1, sol_address = $2 WHERE id = $3", [address, solAddress, id]);
}

export async function cleanupDuplicateWallets(): Promise<number> {
  const database = await getDb();
  const rows = await database.select<{ id: number; type: WalletType; address: string | null; sol_address: string | null }[]>(
    "SELECT id, type, address, sol_address FROM wallets ORDER BY id ASC",
  );

  let cleaned = 0;
  const seenEvm = new Map<string, { id: number; type: WalletType }>();
  const seenSol = new Map<string, { id: number; type: WalletType }>();
  const toDelete = new Set<number>();

  for (const r of rows) {
    if (r.address) {
      const lower = r.address.toLowerCase();
      if (seenEvm.has(lower)) {
        const existing = seenEvm.get(lower)!;
        if (existing.type === "seed" && r.type === "pk") {
          toDelete.add(r.id);
        } else if (existing.type === "pk" && r.type === "seed") {
          toDelete.add(existing.id);
          seenEvm.set(lower, { id: r.id, type: r.type });
        } else {
          toDelete.add(r.id);
        }
      } else {
        seenEvm.set(lower, { id: r.id, type: r.type });
      }
    }

    if (r.sol_address) {
      if (seenSol.has(r.sol_address)) {
        toDelete.add(r.id);
      } else {
        seenSol.set(r.sol_address, { id: r.id, type: r.type });
      }
    }
  }

  for (const delId of toDelete) {
    try {
      await database.execute("DELETE FROM token_balances WHERE wallet_id = $1", [delId]);
      await database.execute("DELETE FROM balances WHERE wallet_id = $1", [delId]);
      await database.execute("DELETE FROM wallets WHERE id = $1", [delId]);
      cleaned++;
    } catch (e) {
      console.warn("Failed deleting duplicate wallet:", e);
    }
  }

  return cleaned;
}