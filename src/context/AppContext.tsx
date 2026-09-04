import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { ScanProgress, ToastMessage, ToastType, WalletView } from "../lib/types";
import { useToastState } from "./hooks/useToastState";
import { useWalletFilters } from "./hooks/useWalletFilters";
import { useWalletOperations, type ExportOptions } from "./hooks/useWalletOperations";
import { useWalletScanner } from "./hooks/useWalletScanner";
import { useAuthVault, type Screen } from "./hooks/useAuthVault";
import { useTokenPrices } from "./hooks/useTokenPrices";
import { decrypt } from "../lib/crypto";
import { deriveDualCredentials } from "../lib/wallet";
import { updateWalletAddresses } from "../lib/db";

export type { ExportOptions };

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
  setupPassword: (pw: string, pin?: string) => Promise<void>;
  unlock: (pw: string) => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  resetVault: () => Promise<void>;
  hasPin: boolean;
  lock: () => void;
  importWallets: (
    raw: string | string[],
    onProgress?: (current: number, total: number) => void
  ) => Promise<{ added: number; skipped: number }>;
  scanAll: () => Promise<void>;
  scanOne: (id: number) => Promise<void>;
  removeWallet: (id: number) => Promise<void>;
  resetAllWallets: (password: string) => Promise<{ success: boolean; error?: string }>;
  exportWallets: (format: "txt" | "csv") => Promise<void>;
  exportWalletsWithOptions: (options: ExportOptions) => Promise<void>;
  revealSecret: (id: number) => Promise<string | null>;
  autoLockMinutes: number;
  setAutoLockMinutes: (mins: number) => void;
  isAirGapped: boolean;
  toggleAirGapped: () => void;
  toast: (text: string, type?: ToastType) => void;
  toasts: ToastMessage[];
  filteredWallets: WalletView[];
  fundedCount: number;
  pricing: ReturnType<typeof useTokenPrices>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { toasts, toast } = useToastState();
  const pricing = useTokenPrices();

  // 1. Core Wallet State & Operations Hook
  const walletOps = useWalletOperations({
    toast,
    masterPw: "", // Will be wired dynamically via auth
    setSelectedId: () => {}, // placeholder overwritten below
    setSelectedSweepIds: () => {},
  });

  // 2. Multi-Chain Scanner Hook
  const scanner = useWalletScanner({
    toast,
    loadWallets: walletOps.loadWallets,
    setLoadingBalances: walletOps.setLoadingBalances,
    enrich: walletOps.enrich,
  });

  // 3. Filters, Search & Modal Visibility Hook
  const filters = useWalletFilters(walletOps.wallets);

  // 4. Auth, Database & Encryption Vault Hook
  const auth = useAuthVault({
    toast,
    loadWallets: walletOps.loadWallets,
    wallets: walletOps.wallets,
  });

  // Re-wire masterPw & selection setters dynamically
  walletOps.importWallets = useWalletOperations({
    toast,
    masterPw: auth.masterPw,
    setSelectedId: filters.setSelectedId,
    setSelectedSweepIds: filters.setSelectedSweepIds,
    scanWallets: scanner.scanWallets,
  }).importWallets;

  walletOps.resetAllWallets = useWalletOperations({
    toast,
    masterPw: auth.masterPw,
    setSelectedId: filters.setSelectedId,
    setSelectedSweepIds: filters.setSelectedSweepIds,
  }).resetAllWallets;

  walletOps.exportWalletsWithOptions = useWalletOperations({
    toast,
    masterPw: auth.masterPw,
    setSelectedId: filters.setSelectedId,
    setSelectedSweepIds: filters.setSelectedSweepIds,
  }).exportWalletsWithOptions;

  walletOps.exportWallets = useWalletOperations({
    toast,
    masterPw: auth.masterPw,
    setSelectedId: filters.setSelectedId,
    setSelectedSweepIds: filters.setSelectedSweepIds,
  }).exportWallets;

  // Reactive Multi-Chain Address Backfill
  useEffect(() => {
    if (!auth.masterPw || !walletOps.wallets.length) return;
    const missing = walletOps.wallets.filter((w) => !w.address || !w.solAddress || (w.type === "seed" && !w.btcAddress));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      let changed = false;
      for (const w of missing) {
        if (cancelled) break;
        try {
          const sec = await decrypt(w.encryptedSecret, auth.masterPw);
          if (!sec) continue;
          const creds = deriveDualCredentials(sec, w.type);
          const newEvm = creds.evmAddress ?? w.address;
          const newSol = creds.solAddress ?? w.solAddress;
          const newBtc = creds.btcAddress ?? w.btcAddress;
          if (newEvm !== w.address || newSol !== w.solAddress || newBtc !== w.btcAddress) {
            await updateWalletAddresses(w.id, newEvm, newSol, newBtc);
            changed = true;
          }
        } catch {}
      }
      if (changed && !cancelled) {
        await walletOps.loadWallets();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.masterPw, walletOps.wallets, walletOps.loadWallets]);

  const value: AppContextValue = {
    screen: auth.screen,
    initError: auth.initError,
    wallets: walletOps.wallets,
    selectedId: filters.selectedId,
    search: filters.search,
    scanning: scanner.scanning,
    scanProgress: scanner.scanProgress,
    selectedSweepIds: filters.selectedSweepIds,
    isSweepModalOpen: filters.isSweepModalOpen,
    setIsSweepModalOpen: filters.setIsSweepModalOpen,
    isExportModalOpen: filters.isExportModalOpen,
    setIsExportModalOpen: filters.setIsExportModalOpen,
    isResetModalOpen: filters.isResetModalOpen,
    setIsResetModalOpen: filters.setIsResetModalOpen,
    tagFilter: filters.tagFilter,
    setTagFilter: filters.setTagFilter,
    setWalletLabel: walletOps.setWalletLabel,
    toggleSweepSelection: filters.toggleSweepSelection,
    selectAllFunded: filters.selectAllFunded,
    clearSweepSelection: filters.clearSweepSelection,
    stopScan: scanner.stopScan,
    setSearch: filters.setSearch,
    setSelectedId: filters.setSelectedId,
    setupPassword: auth.setupPassword,
    unlock: auth.unlock,
    unlockWithPin: auth.unlockWithPin,
    resetVault: auth.resetVault,
    hasPin: auth.hasPin,
    lock: auth.lock,
    importWallets: walletOps.importWallets,
    scanAll: scanner.scanAll,
    scanOne: scanner.scanOne,
    removeWallet: walletOps.removeWallet,
    resetAllWallets: walletOps.resetAllWallets,
    exportWallets: walletOps.exportWallets,
    exportWalletsWithOptions: walletOps.exportWalletsWithOptions,
    revealSecret: auth.revealSecret,
    autoLockMinutes: auth.autoLockMinutes,
    setAutoLockMinutes: auth.setAutoLockMinutes,
    isAirGapped: scanner.isAirGapped,
    toggleAirGapped: scanner.toggleAirGapped,
    toast,
    toasts,
    filteredWallets: filters.filteredWallets,
    fundedCount: filters.fundedCount,
    pricing,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
