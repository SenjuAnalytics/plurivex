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
import {
  chainsForWallet,
  hasFundsForWallet,
  hasFundsOnEvm,
  hasFundsOnSol,
  needsScanForWallet,
  totalBalanceForWallet,
} from "../lib/chains";
import { rustScan } from "../lib/scan";
import {
  createVerificationToken,
  decrypt,
  encrypt,
  verifyPassword,
} from "../lib/crypto";
import {
  deleteAllWallets,
  deleteWallet,
  getAllWallets,
  cleanupDuplicateWallets,
  getExistingAddresses,
  upgradeWalletToSeed,
  getExistingFingerprints,
  getVerificationToken,
  hasMasterPassword,
  initDb,
  insertWalletsBatch,
  saveMasterPassword,
  updateWalletLabel,
  updateWalletAddresses,
} from "../lib/db";
import { walletFingerprint } from "../lib/fingerprint";
import { smartNormalizeInput } from "../lib/extract";
import {
  classify,
  deriveDualCredentials,
  isEvmWallet,
  walletHasScanTarget,
} from "../lib/wallet";

type Screen = "loading" | "setup" | "unlock" | "app" | "error";

export interface ExportOptions {
  format: "txt" | "csv";
  filter: "all" | "funded" | "tagged" | "public_only";
  tag?: string | null;
}

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
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  isResetModalOpen: boolean;
  setIsResetModalOpen: (open: boolean) => void;
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;
  setWalletLabel: (id: number, label: string | null) => Promise<void>;
  toggleSweepSelection: (id: number) => void;
  selectAllFunded: (filter?: "all" | "evm" | "sol") => void;
  clearSweepSelection: () => void;
  stopScan: () => void;
  setSearch: (v: string) => void;
  setSelectedId: (id: number | null) => void;
  setupPassword: (pw: string) => Promise<void>;
  unlock: (pw: string) => Promise<boolean>;
  lock: () => void;
  importWallets: (raw: string | string[]) => Promise<{ added: number; skipped: number }>;
  scanAll: () => Promise<void>;
  scanOne: (id: number) => Promise<void>;
  removeWallet: (id: number) => Promise<void>;
  resetAllWallets: (password: string) => Promise<{ success: boolean; error?: string }>;
  exportWallets: (format: "txt" | "csv") => Promise<void>;
  exportWalletsWithOptions: (options: ExportOptions) => Promise<void>;
  revealSecret: (id: number) => Promise<string | null>;
  autoLockMinutes: number;
  setAutoLockMinutes: (mins: number) => void;
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const scanCancelledRef = useRef(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [initError, setInitError] = useState("");

  const toast = useCallback((text: string, type: ToastType = "info") => {
    setToasts((prev) => {
      // Prevent duplicate stacked notifications with identical text
      if (prev.some((t) => t.text === text)) return prev;
      const id = Date.now() + Math.random();
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
      return [...prev, { id, text, type }];
    });
  }, []);

  const toggleSweepSelection = useCallback((id: number) => {
    const targetWallet = wallets.find((w) => w.id === id);
    if (!targetWallet) return;
    const isTargetEvm = isEvmWallet(targetWallet.type);

    // If currently deselecting, allow it directly
    if (selectedSweepIds.has(id)) {
      setSelectedSweepIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    // Security check: Never allow mixing EVM and Solana in the same batch selection
    if (selectedSweepIds.size > 0) {
      const firstExistingId = Array.from(selectedSweepIds)[0];
      const firstExisting = wallets.find((w) => w.id === firstExistingId);
      if (firstExisting) {
        const isExistingEvm = isEvmWallet(firstExisting.type);
        if (isExistingEvm !== isTargetEvm) {
          toast(
            `Security: Cannot mix ${isTargetEvm ? "EVM" : "Solana"} with ${isExistingEvm ? "EVM" : "Solana"} wallets. Clear selection first.`,
            "error"
          );
          return;
        }
      }
    }

    setSelectedSweepIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [wallets, selectedSweepIds, toast]);

  const selectAllFunded = useCallback((filter?: "all" | "evm" | "sol") => {
    let matching = wallets.filter((w) => w.hasFunds);
    if (filter === "sol") {
      matching = matching.filter((w) => Boolean(w.solAddress) && hasFundsOnSol(w.balances, w.tokens));
    } else if (filter === "evm") {
      matching = matching.filter((w) => Boolean(w.address) && hasFundsOnEvm(w.balances, w.tokens));
    }
    const fundedIds = matching.map((w) => w.id);
    setSelectedSweepIds((prev) => {
      const allSelected = fundedIds.length > 0 && fundedIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(fundedIds);
    });
  }, [wallets]);

  const clearSweepSelection = useCallback(() => {
    setSelectedSweepIds(new Set());
  }, []);

  const setWalletLabel = useCallback(
    async (id: number, label: string | null) => {
      try {
        await updateWalletLabel(id, label);
        setWallets((prev) =>
          prev.map((w) => (w.id === id ? { ...w, label } : w))
        );
        toast(label ? `Wallet tagged as "${label}"` : "Tag cleared", "success");
      } catch (err) {
        console.error("Failed to update wallet label:", err);
        toast("Failed to update tag", "error");
      }
    },
    [toast]
  );

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

  // Seamless reactive backfill: Ensures every wallet automatically gains dual EVM + Solana identity
  useEffect(() => {
    if (!masterPw || !wallets.length) return;
    const missing = wallets.filter((w) => !w.address || !w.solAddress);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      let changed = false;
      for (const w of missing) {
        if (cancelled) break;
        try {
          const sec = await decrypt(w.encryptedSecret, masterPw);
          if (!sec) continue;
          const creds = deriveDualCredentials(sec, w.type);
          const newEvm = creds.evmAddress ?? w.address;
          const newSol = creds.solAddress ?? w.solAddress;
          if (newEvm !== w.address || newSol !== w.solAddress) {
            await updateWalletAddresses(w.id, newEvm, newSol);
            changed = true;
          }
        } catch {}
      }
      if (changed && !cancelled) {
        await loadWallets();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [masterPw, wallets, loadWallets]);

  const unlock = async (pw: string) => {
    const token = await getVerificationToken();
    if (!token) return false;
    const ok = await verifyPassword(token, pw);
    if (!ok) return false;
    setMasterPw(pw);
    const list = await loadWallets();
    setScreen("app");

    // Seamless background backfill for dual EVM + Solana addresses on legacy wallets
    setTimeout(async () => {
      try {
        const needsBackfill = list.filter((w) => !w.address || !w.solAddress);
        if (needsBackfill.length > 0) {
          for (const w of needsBackfill) {
            try {
              const sec = await decrypt(w.encryptedSecret, pw);
              const creds = deriveDualCredentials(sec, w.type);
              if (creds.evmAddress !== w.address || creds.solAddress !== w.solAddress) {
                await updateWalletAddresses(w.id, creds.evmAddress, creds.solAddress);
              }
            } catch {}
          }
          await loadWallets();
        }
      } catch (e) {
        console.warn("Dual backfill error:", e);
      }
    }, 400);

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

  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(() => {
    const saved = localStorage.getItem("plurivex_autolock_minutes");
    return saved !== null ? Number(saved) : 0; // Default: Off (User opt-in)
  });

  const setAutoLockMinutes = useCallback((mins: number) => {
    setAutoLockMinutesState(mins);
    localStorage.setItem("plurivex_autolock_minutes", String(mins));
    if (mins === 0) {
      toast("Auto-lock disabled (Never)", "info");
    } else if (mins < 1) {
      toast(`Auto-lock set to ${Math.round(mins * 60)}s (Quick Test)`, "info");
    } else {
      toast(`Auto-lock set to ${mins} minute${mins > 1 ? "s" : ""}`, "info");
    }
  }, [toast]);

  const lock = useCallback(() => {
    setMasterPw("");
    setWallets([]);
    setSelectedId(null);
    setScreen("unlock");
  }, []);

  // Fitur #49: Auto-Lock Security Timer (User-configurable, default 5m)
  useEffect(() => {
    if (screen !== "app" || autoLockMinutes <= 0) return;

    let timer: any = null;
    const IDLE_TIMEOUT_MS = autoLockMinutes * 60 * 1000;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lock();
        toast(`Vault automatically locked due to inactivity (${autoLockMinutes < 1 ? Math.round(autoLockMinutes * 60) + "s" : autoLockMinutes + "m"} idle)`, "info");
      }, IDLE_TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"];
    for (const evt of events) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }

    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      for (const evt of events) {
        window.removeEventListener(evt, resetTimer);
      }
    };
  }, [screen, autoLockMinutes, lock, toast]);

  const importWallets = async (input: string | string[]) => {
    const lines = Array.isArray(input) ? input : smartNormalizeInput(input);
    const existing = await getExistingFingerprints();
    const existingAddresses = await getExistingAddresses();

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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i % 50 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      const type = classify(line);
      if (type === "invalid" || type === "pk_bad_length") continue;

      const fp = await walletFingerprint(line);
      if (existing.has(fp)) {
        skipped++;
        continue;
      }

      let walletType: "seed" | "pk" | "sol_pk" = type === "pk" ? "pk" : type === "sol_pk" ? "sol_pk" : "seed";
      const creds = deriveDualCredentials(line, walletType);
      const address = creds.evmAddress;
      const solAddress = creds.solAddress;

      // Address-Level Deduplication Check
      if (address) {
        const lower = address.toLowerCase();
        if (existingAddresses.evm.has(lower)) {
          const existingItem = existingAddresses.evm.get(lower)!;
          if (existingItem.type === "seed") {
            // Already have seed phrase, incoming pk or seed is redundant
            skipped++;
            continue;
          } else if (existingItem.type === "pk" && walletType === "seed") {
            // Existing is pk, incoming is superior seed phrase -> UPGRADE!
            const encrypted = await encrypt(line, masterPw);
            const wordCount = line.trim().split(/\s+/).length;
            await upgradeWalletToSeed(existingItem.id, encrypted, fp, wordCount);
            existingAddresses.evm.set(lower, { id: existingItem.id, type: "seed" });
            existing.add(fp);
            added++;
            continue;
          } else {
            skipped++;
            continue;
          }
        }
        existingAddresses.evm.set(lower, { id: 0, type: walletType });
      }

      if (solAddress) {
        if (existingAddresses.sol.has(solAddress)) {
          skipped++;
          continue;
        }
        existingAddresses.sol.set(solAddress, { id: 0, type: walletType });
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
      try {
        await cleanupDuplicateWallets();
      } catch (e) {
        console.warn("Cleanup duplicate notice:", e);
      }
    }

    const list = await loadWallets();
    if (added > 0) {
      const insertedEvm = new Set(batchToInsert.map((b) => b.address?.toLowerCase()).filter(Boolean));
      const insertedSol = new Set(batchToInsert.map((b) => b.solAddress).filter(Boolean));
      const newlyAdded = list.filter(
        (w) =>
          (w.address && insertedEvm.has(w.address.toLowerCase())) ||
          (w.solAddress && insertedSol.has(w.solAddress))
      );
      const targets = newlyAdded.filter(walletHasScanTarget);
      if (targets.length > 0) {
        toast(`Import complete. Scanning ${targets.length} newly added wallets…`, "info");
        scanWallets(targets)
          .then(({ funded, errors }) => {
            if (errors > 0) {
              toast(`Scan complete · ${funded} funded · ${errors} chains failed`, funded > 0 ? "success" : "error");
            } else {
              toast(`Scan complete · ${funded} funded wallets found`, "success");
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

  const resetAllWallets = async (password: string): Promise<{ success: boolean; error?: string }> => {
    let ok = false;
    const token = await getVerificationToken();
    if (token) {
      ok = await verifyPassword(token, password);
    } else if (masterPw) {
      ok = password === masterPw;
    }

    if (!ok) {
      return { success: false, error: "Incorrect Master Password. Verification failed." };
    }

    try {
      await deleteAllWallets();
      await loadWallets();
      setSelectedId(null);
      setSelectedSweepIds(new Set());
      toast("All wallets have been reset and cleared from database", "info");
      return { success: true };
    } catch (err) {
      console.error("Reset wallets error:", err);
      return { success: false, error: `Failed to reset wallets: ${String(err)}` };
    }
  };

  const revealSecret = async (id: number) => {
    const w = wallets.find((x) => x.id === id);
    if (!w) return null;
    return decrypt(w.encryptedSecret, masterPw);
  };

  const exportWalletsWithOptions = async (options: ExportOptions) => {
    let targets = wallets;
    if (options.filter === "funded") {
      targets = targets.filter((w) => w.hasFunds);
    } else if (options.filter === "tagged" && options.tag) {
      if (options.tag === "untagged") {
        targets = targets.filter((w) => !w.label);
      } else {
        targets = targets.filter((w) => w.label?.toLowerCase() === options.tag?.toLowerCase());
      }
    }

    if (!targets.length) {
      toast("No wallets match the export criteria", "error");
      return;
    }

    const lines: string[] = [];

    if (options.format === "csv") {
      if (options.filter === "public_only") {
        lines.push("#,label,type,evm_address,solana_address,has_funds");
        targets.forEach((w, i) => {
          lines.push(
            `${i + 1},"${w.label ?? ""}",${w.type},"${w.address ?? ""}","${w.solAddress ?? ""}",${w.hasFunds ? "YES" : "NO"}`,
          );
        });
      } else {
        lines.push("#,label,type,evm_address,solana_address,native_balances,token_balances,secret_key_or_mnemonic,evm_pk,sol_pk");
        for (let i = 0; i < targets.length; i++) {
          const w = targets[i];
          let secret = "";
          let creds = { evmPrivateKey: null as string | null, solPrivateKey: null as string | null };
          try {
            secret = (await decrypt(w.encryptedSecret, masterPw)) ?? "";
            creds = deriveDualCredentials(secret, w.type);
          } catch {}
          const nativeBals = Object.entries(w.balances)
            .filter(([_, v]) => v && v !== "loading" && v !== "error" && !v.startsWith("0 "))
            .map(([k, v]) => `${k.toUpperCase()}:${v}`)
            .join(" | ");
          const tokBals = (w.tokens || [])
            .map((t) => `${t.symbol}(${t.chain.toUpperCase()}):${t.balance}`)
            .join(" | ");
          lines.push(
            `${i + 1},"${w.label ?? ""}",${w.type},"${w.address ?? ""}","${w.solAddress ?? ""}","${nativeBals}","${tokBals}","${secret.replace(/"/g, '""')}","${creds.evmPrivateKey ?? ""}","${creds.solPrivateKey ?? ""}"`,
          );
        }
      }
    } else {
      lines.push("=================================================");
      lines.push("          PLURIVEX MULTI-WALLET EXPORT           ");
      lines.push(`Generated: ${new Date().toLocaleString()}`);
      lines.push(`Total Wallets: ${targets.length}`);
      lines.push(`Export Mode: ${options.filter.toUpperCase()}`);
      lines.push("=================================================\n");

      for (let i = 0; i < targets.length; i++) {
        const w = targets[i];
        lines.push(`--- Wallet #${i + 1} [${w.type.toUpperCase()}] ${w.label ? `[TAG: ${w.label.toUpperCase()}]` : ""} ---`);
        if (w.address) lines.push(`  • EVM Address:     ${w.address}`);
        if (w.solAddress) lines.push(`  • Solana Address:  ${w.solAddress}`);

        if (options.filter !== "public_only") {
          try {
            const secret = await decrypt(w.encryptedSecret, masterPw);
            const creds = secret ? deriveDualCredentials(secret, w.type) : null;
            if (w.type === "seed") {
              lines.push(`  • Mnemonic Seed:   ${secret}`);
            } else {
              lines.push(`  • Raw Secret:      ${secret}`);
            }
            if (creds?.evmPrivateKey) lines.push(`  • EVM Private Key: ${creds.evmPrivateKey}`);
            if (creds?.solPrivateKey) lines.push(`  • Sol Private Key: ${creds.solPrivateKey}`);
          } catch {}
        }

        const nativeBals = Object.entries(w.balances)
          .filter(([_, v]) => v && v !== "loading" && v !== "error")
          .map(([k, v]) => `    - ${k.toUpperCase()}: ${v}`)
          .join("\n");
        if (nativeBals) {
          lines.push("  • Native Balances:\n" + nativeBals);
        }
        if (w.tokens && w.tokens.length > 0) {
          const tokBals = w.tokens
            .map((t) => `    - ${t.symbol} [${t.chain.toUpperCase()}]: ${t.balance}`)
            .join("\n");
          lines.push("  • Token Balances:\n" + tokBals);
        }
        lines.push("");
      }
    }

    const path = await save({
      defaultPath: `plurivex-wallets-${options.filter}.${options.format}`,
      filters: [{ name: options.format.toUpperCase(), extensions: [options.format] }],
    });
    if (!path) return;
    await writeTextFile(path, lines.join("\n"));
    toast(`Exported ${targets.length} wallets successfully`, "success");
  };

  const exportWallets = async (format: "txt" | "csv") => {
    await exportWalletsWithOptions({ format, filter: "all" });
  };

  const filteredWallets = useMemo(() => {
    let result = wallets;

    // Apply tag filter
    if (tagFilter) {
      if (tagFilter === "untagged") {
        result = result.filter((w) => !w.label);
      } else if (tagFilter === "funded") {
        result = result.filter((w) => w.hasFunds);
      } else {
        result = result.filter((w) => w.label?.toLowerCase() === tagFilter.toLowerCase());
      }
    }

    // Apply search filter
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (w) =>
          w.address?.toLowerCase().includes(q) ||
          w.solAddress?.toLowerCase().includes(q) ||
          w.label?.toLowerCase().includes(q) ||
          w.type.includes(q) ||
          String(w.id).includes(q),
      );
    }

    return result;
  }, [wallets, search, tagFilter]);

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
    isExportModalOpen,
    setIsExportModalOpen,
    isResetModalOpen,
    setIsResetModalOpen,
    tagFilter,
    setTagFilter,
    setWalletLabel,
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
    resetAllWallets,
    exportWallets,
    exportWalletsWithOptions,
    revealSecret,
    autoLockMinutes,
    setAutoLockMinutes,
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