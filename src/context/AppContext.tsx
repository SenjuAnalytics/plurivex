import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { ScanProgress, ToastMessage, ToastType, WalletView } from "../lib/types";
import { chainsForWallet, hasFundsForWallet, needsScanForWallet, totalBalanceForWallet } from "../lib/chains";
import { rustScan } from "../lib/scan";
import {
  createVerificationToken,
  decrypt,
  encrypt,
  verifyPassword,
} from "../lib/crypto";
import {
  deleteWallet,
  getAllWallets,
  getExistingFingerprints,
  getVerificationToken,
  hasMasterPassword,
  initDb,
  insertWalletsBatch,
  saveMasterPassword,
} from "../lib/db";
import { walletFingerprint } from "../lib/fingerprint";
import { smartNormalizeInput } from "../lib/extract";
import { classify, deriveAddress, deriveSolanaAddress, walletHasScanTarget } from "../lib/wallet";

type Screen = "loading" | "setup" | "unlock" | "app" | "error";

interface AppContextValue {
  screen: Screen;
  initError: string;
  wallets: WalletView[];
  selectedId: number | null;
  search: string;
  scanning: boolean;
  scanProgress: ScanProgress | null;
  selectedSweepIds: Set<number>;
  isSweepModalOpen: boolean;
  setIsSweepModalOpen: (open: boolean) => void;
  toggleSweepSelection: (id: number) => void;
  selectAllFunded: () => void;
  clearSweepSelection: () => void;
  stopScan: () => void;
  setSearch: (v: string) => void;
  setSelectedId: (id: number | null) => void;
  setupPassword: (pw: string) => Promise<void>;
  unlock: (pw: string) => Promise<boolean>;
  lock: () => void;
  importWallets: (raw: string) => Promise<{ added: number; skipped: number }>;
  scanAll: () => Promise<void>;
  scanOne: (id: number) => Promise<void>;
  removeWallet: (id: number) => Promise<void>;
  exportWallets: (format: "txt" | "csv") => Promise<void>;
  revealSecret: (id: number) => Promise<string | null>;
  toast: (text: string, type?: ToastType) => void;
  toasts: ToastMessage[];
  filteredWallets: WalletView[];
  fundedCount: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [masterPw, setMasterPw] = useState("");
  const [wallets, setWallets] = useState<WalletView[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [selectedSweepIds, setSelectedSweepIds] = useState<Set<number>>(new Set());
  const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);
  const scanCancelledRef = useRef(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [initError, setInitError] = useState("");

  const toggleSweepSelection = useCallback((id: number) => {
    setSelectedSweepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFunded = useCallback(() => {
    const fundedIds = wallets.filter((w) => w.hasFunds).map((w) => w.id);
    setSelectedSweepIds(new Set(fundedIds));
  }, [wallets]);

  const clearSweepSelection = useCallback(() => {
    setSelectedSweepIds(new Set());
  }, []);

  const toast = useCallback((text: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  const stopScan = useCallback(() => {
    scanCancelledRef.current = true;
    setScanning(false);
    setScanProgress(null);
    toast("Balance scan stopped", "info");
  }, [toast]);

  const enrich = useCallback((records: Awaited<ReturnType<typeof getAllWallets>>): WalletView[] => {
    return records.map((w) => ({
      ...w,
      totalBalance: totalBalanceForWallet(w.balances, w.type),
      hasFunds: hasFundsForWallet(w.balances, w.type, w.tokens),
    }));
  }, []);

  const sortWallets = useCallback((list: WalletView[]) => {
    return [...list].sort((a, b) => {
      if (a.hasFunds !== b.hasFunds) return b.hasFunds ? 1 : -1;
      if (a.hasFunds && b.hasFunds) return b.totalBalance - a.totalBalance;
      return a.id - b.id;
    });
  }, []);

  const loadWallets = useCallback(async (): Promise<WalletView[]> => {
    const records = await getAllWallets();
    const sorted = sortWallets(enrich(records));
    setWallets(sorted);
    setSelectedId((cur) => cur ?? sorted[0]?.id ?? null);
    return sorted;
  }, [enrich, sortWallets]);

  const setLoadingBalances = useCallback((ids: number[]) => {
    setWallets((prev) =>
      sortWallets(
        prev.map((w) => {
          if (!ids.includes(w.id)) return w;
          const balances = { ...w.balances };
          for (const chain of chainsForWallet(w.type)) balances[chain.key] = "loading";
          return { ...w, balances };
        }),
      ),
    );
  }, [sortWallets]);

  const scanWallets = useCallback(async (targets: WalletView[]) => {
    if (!targets.length) return { funded: 0, errors: 0 };
    scanCancelledRef.current = false;
    setScanning(true);

    const total = targets.length;
    let completed = 0;
    let totalFunded = 0;
    let totalErrors = 0;

    setScanProgress({
      total,
      completed: 0,
      funded: 0,
      isScanning: true,
    });

    // Single wallet fast path
    if (targets.length === 1) {
      setLoadingBalances([targets[0].id]);
      try {
        const summary = await rustScan(targets[0].id);
        await loadWallets();
        setScanning(false);
        setScanProgress(null);
        return { funded: summary.funded, errors: summary.errors };
      } catch (err) {
        setScanning(false);
        setScanProgress(null);
        throw err;
      }
    }

    // Chunked background scanning (batches of 15 wallets at a time)
    const CHUNK_SIZE = 15;
    const chunks: WalletView[][] = [];
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      chunks.push(targets.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      if (scanCancelledRef.current) {
        break;
      }

      const chunkIds = chunk.map((w) => w.id);
      setLoadingBalances(chunkIds);

      try {
        const summary = await rustScan(undefined, chunkIds);
        completed += chunk.length;
        totalFunded += summary.funded;
        totalErrors += summary.errors;

        // Immediately update wallets so user sees results in real time!
        await loadWallets();

        setScanProgress({
          total,
          completed: Math.min(completed, total),
          funded: totalFunded,
          isScanning: true,
        });
      } catch (err) {
        console.error("Chunk scan error:", err);
        totalErrors += 1;
      }
    }

    setScanning(false);
    setScanProgress(null);
    return { funded: totalFunded, errors: totalErrors };
  }, [loadWallets, setLoadingBalances]);

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        const exists = await hasMasterPassword();
        setScreen(exists ? "unlock" : "setup");
      } catch (err) {
        console.error("Init failed:", err);
        setInitError(String(err));
        setScreen("error");
      }
    })();
  }, []);

  const setupPassword = async (pw: string) => {
    const token = await createVerificationToken(pw);
    await saveMasterPassword(token);
    setMasterPw(pw);
    await loadWallets();
    setScreen("app");
    toast("Vault created successfully", "success");
  };

  const unlock = async (pw: string) => {
    const token = await getVerificationToken();
    if (!token) return false;
    const ok = await verifyPassword(token, pw);
    if (!ok) return false;
    setMasterPw(pw);
    const list = await loadWallets();
    setScreen("app");
    const pending = list.filter((w) => walletHasScanTarget(w) && needsScanForWallet(w.balances, w.type));
    if (pending.length) {
      try {
        toast(`Scanning ${pending.length} wallets…`, "info");
        const { funded, errors } = await scanWallets(pending);
        if (errors > 0) {
          toast(`Scan complete · ${funded} funded · ${errors} chains failed`, funded > 0 ? "success" : "error");
        } else {
          toast(`Scan complete · ${funded} funded wallets`, "success");
        }
      } catch (err) {
        console.error("Auto-scan failed:", err);
        toast(`Scan failed: ${String(err)}`, "error");
      }
    }
    return true;
  };

  const lock = () => {
    setMasterPw("");
    setWallets([]);
    setSelectedId(null);
    setScreen("unlock");
  };

  const importWallets = async (raw: string) => {
    const lines = smartNormalizeInput(raw);
    const existing = await getExistingFingerprints();

    let added = 0;
    let skipped = 0;
    const batchToInsert: {
      type: "seed" | "pk" | "sol_pk";
      encryptedSecret: string;
      fingerprint: string;
      address: string | null;
      solAddress?: string | null;
      wordCount: number | null;
    }[] = [];

    for (const line of lines) {
      const type = classify(line);
      if (type === "invalid" || type === "pk_bad_length") continue;

      const fp = await walletFingerprint(line);
      if (existing.has(fp)) {
        skipped++;
        continue;
      }

      let address: string | null = null;
      let solAddress: string | null = null;
      let walletType: "seed" | "pk" | "sol_pk" = "seed";

      if (type === "pk") {
        walletType = "pk";
        address = deriveAddress(line, "pk");
      } else if (type === "sol_pk") {
        walletType = "sol_pk";
        solAddress = deriveSolanaAddress(line);
      } else {
        walletType = "seed";
        address = deriveAddress(line, "seed");
      }

      const encrypted = await encrypt(line, masterPw);
      const wordCount = type === "seed" ? line.trim().split(/\s+/).length : null;

      batchToInsert.push({
        type: walletType,
        encryptedSecret: encrypted,
        fingerprint: fp,
        address,
        solAddress,
        wordCount,
      });

      existing.add(fp);
      added++;
    }

    if (batchToInsert.length > 0) {
      await insertWalletsBatch(batchToInsert);
    }

    const list = await loadWallets();
    if (added > 0) {
      const targets = list.filter(walletHasScanTarget);
      if (targets.length > 0) {
        toast(`Import complete. Scanning ${targets.length} wallets…`, "info");
        scanWallets(targets)
          .then(({ funded, errors }) => {
            if (errors > 0) {
              toast(`Scan complete · ${funded} funded · ${errors} chains failed`, funded > 0 ? "success" : "error");
            } else {
              toast(`Scan complete · ${funded} funded wallets`, "success");
            }
          })
          .catch((err) => {
            console.error("Scan error:", err);
          });
      }
    }
    return { added, skipped };
  };

  const scanAll = async () => {
    const list = await loadWallets();
    const targets = list.filter(walletHasScanTarget);
    if (!targets.length) return;
    const { funded, errors } = await scanWallets(targets);
    if (errors > 0) {
      toast(`Scan complete · ${funded} funded · ${errors} chains failed`, funded > 0 ? "success" : "error");
    } else {
      toast(`Scan complete · ${funded} funded wallets`, "success");
    }
  };

  const scanOne = async (id: number) => {
    const records = await getAllWallets();
    const w = enrich(records).find((x) => x.id === id);
    if (!w || !walletHasScanTarget(w)) return;
    setScanning(true);
    setLoadingBalances([id]);
    try {
      const summary = await rustScan(id);
      await loadWallets();
      if (summary.errors > 0) toast(`${summary.errors} chains failed to scan — please retry`, "error");
    } catch (err) {
      toast(`Scan failed: ${String(err)}`, "error");
    } finally {
      setScanning(false);
    }
  };

  const removeWallet = async (id: number) => {
    await deleteWallet(id);
    await loadWallets();
    setSelectedId((cur) => (cur === id ? wallets.find((w) => w.id !== id)?.id ?? null : cur));
    toast("Wallet deleted", "info");
  };

  const revealSecret = async (id: number) => {
    const w = wallets.find((x) => x.id === id);
    if (!w) return null;
    return decrypt(w.encryptedSecret, masterPw);
  };

  const exportWallets = async (format: "txt" | "csv") => {
    if (!wallets.length) {
      toast("No wallets to export", "error");
      return;
    }

    const lines: string[] = [];
    if (format === "csv") {
      lines.push("#,type,address,sol_address,native_balances,token_balances,secret");
      for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        const secret = await decrypt(w.encryptedSecret, masterPw);
        const nativeBals = Object.entries(w.balances)
          .filter(([_, v]) => v && v !== "loading" && v !== "error" && !v.startsWith("0 "))
          .map(([k, v]) => `${k.toUpperCase()}:${v}`)
          .join(" | ");
        const tokBals = (w.tokens || [])
          .map((t) => `${t.symbol}(${t.chain.toUpperCase()}):${t.balance}`)
          .join(" | ");
        lines.push(
          `${i + 1},${w.type},"${w.address ?? ""}","${w.solAddress ?? ""}","${nativeBals}","${tokBals}","${(secret ?? "").replace(/"/g, '""')}"`,
        );
      }
    } else {
      for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        const secret = await decrypt(w.encryptedSecret, masterPw);
        lines.push(`--- Wallet ${i + 1} (${w.type}) ---`);
        if (w.address) lines.push(`EVM Address: ${w.address}`);
        if (w.solAddress) lines.push(`SOL Address: ${w.solAddress}`);
        lines.push(`Secret:      ${secret}`);
        const nativeBals = Object.entries(w.balances)
          .filter(([_, v]) => v && v !== "loading" && v !== "error")
          .map(([k, v]) => `  • ${k.toUpperCase()}: ${v}`)
          .join("\n");
        if (nativeBals) {
          lines.push("Native Balances:\n" + nativeBals);
        }
        if (w.tokens && w.tokens.length > 0) {
          const tokBals = w.tokens
            .map((t) => `  • ${t.symbol} [${t.chain.toUpperCase()}]: ${t.balance}`)
            .join("\n");
          lines.push("Token Balances:\n" + tokBals);
        }
        lines.push("");
      }
    }

    const path = await save({
      defaultPath: `wallets-export.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!path) return;
    await writeTextFile(path, lines.join("\n"));
    toast(`Export successful · ${wallets.length} wallets`, "success");
  };

  const filteredWallets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter(
      (w) =>
        w.address?.toLowerCase().includes(q) ||
        w.solAddress?.toLowerCase().includes(q) ||
        w.type.includes(q) ||
        String(w.id).includes(q),
    );
  }, [wallets, search]);

  const fundedCount = wallets.filter((w) => w.hasFunds).length;

  const value: AppContextValue = {
    screen,
    initError,
    wallets,
    selectedId,
    search,
    scanning,
    scanProgress,
    selectedSweepIds,
    isSweepModalOpen,
    setIsSweepModalOpen,
    toggleSweepSelection,
    selectAllFunded,
    clearSweepSelection,
    stopScan,
    setSearch,
    setSelectedId,
    setupPassword,
    unlock,
    lock,
    importWallets,
    scanAll,
    scanOne,
    removeWallet,
    exportWallets,
    revealSecret,
    toast,
    toasts,
    filteredWallets,
    fundedCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}