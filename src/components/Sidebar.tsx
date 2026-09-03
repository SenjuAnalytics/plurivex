import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { isEvmWallet, isSolanaWallet } from "../lib/wallet";
import {
  hasFundsOnEvm,
  hasFundsOnSol,
  hasFundsOnChain,
  totalBalanceOnEvm,
  totalBalanceOnSol,
  balanceAmount,
} from "../lib/chains";
import type { WalletView } from "../lib/types";
import { IconSearch, IconWallet } from "../icons";
import { WalletRow, type Filter } from "./sidebar/WalletRow";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { SidebarFilterTabs } from "./sidebar/SidebarFilterTabs";

const ITEM_HEIGHT = 58;
const BUFFER_ITEMS = 12;

type ListItem =
  | { type: "header"; id: string; title: string; count: number }
  | { type: "wallet"; id: number; wallet: WalletView; index: number };

interface SidebarProps {
  activeNav?: string;
  setActiveNav?: (nav: string) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (fn: (prev: boolean) => boolean) => void;
  onOpenImport?: () => void;
}

export function Sidebar({
  activeNav = "wallets",
  setActiveNav,
  isCollapsed = false,
  setIsCollapsed,
  onOpenImport,
}: SidebarProps) {
  const {
    filteredWallets,
    wallets,
    selectedId,
    setSelectedId,
    search,
    setSearch,
    selectedSweepIds,
    toggleSweepSelection,
    selectAllFunded,
    clearSweepSelection,
    tagFilter,
    setTagFilter,
    lock,
  } = useApp();

  const [filter, setFilter] = useState<Filter>("all");
  const [chainFilter, setChainFilter] = useState<string>("all");

  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const w of wallets) {
      if (w.label?.trim()) set.add(w.label.trim());
    }
    return Array.from(set);
  }, [wallets]);

  const evmWallets = useMemo(() => {
    const arr = filteredWallets.filter((w) => Boolean(w.address));
    return arr.slice().sort((a, b) => {
      const aFunds = hasFundsOnEvm(a.balances, a.tokens);
      const bFunds = hasFundsOnEvm(b.balances, b.tokens);
      if (aFunds !== bFunds) return bFunds ? 1 : -1;
      if (aFunds && bFunds) {
        const balA = totalBalanceOnEvm(a.balances, a.tokens);
        const balB = totalBalanceOnEvm(b.balances, b.tokens);
        if (balB !== balA) return balB - balA;
      }
      return a.id - b.id;
    });
  }, [filteredWallets]);

  const btcWallets = useMemo(() => {
    const arr = filteredWallets.filter((w) => Boolean(w.btcAddress));
    return arr.slice().sort((a, b) => {
      const aFunds = hasFundsOnChain("btc", a.balances, a.tokens);
      const bFunds = hasFundsOnChain("btc", b.balances, b.tokens);
      if (aFunds !== bFunds) return bFunds ? 1 : -1;
      if (aFunds && bFunds) {
        const balA = balanceAmount(a.balances["btc"]);
        const balB = balanceAmount(b.balances["btc"]);
        if (balB !== balA) return balB - balA;
      }
      return a.id - b.id;
    });
  }, [filteredWallets]);

  const solWallets = useMemo(() => {
    const arr = filteredWallets.filter((w) => Boolean(w.solAddress));
    return arr.slice().sort((a, b) => {
      const aFunds = hasFundsOnSol(a.balances, a.tokens);
      const bFunds = hasFundsOnSol(b.balances, b.tokens);
      if (aFunds !== bFunds) return bFunds ? 1 : -1;
      if (aFunds && bFunds) {
        const balA = totalBalanceOnSol(a.balances, a.tokens);
        const balB = totalBalanceOnSol(b.balances, b.tokens);
        if (balB !== balA) return balB - balA;
      }
      return a.id - b.id;
    });
  }, [filteredWallets]);

  const fundedCount = useMemo(() => wallets.filter((w) => w.hasFunds).length, [wallets]);
  const evmFundedCount = useMemo(
    () => wallets.filter((w) => Boolean(w.address) && hasFundsOnEvm(w.balances, w.tokens)).length,
    [wallets],
  );
  const solFundedCount = useMemo(
    () => wallets.filter((w) => Boolean(w.solAddress) && hasFundsOnSol(w.balances, w.tokens)).length,
    [wallets],
  );
  const btcFundedCount = useMemo(
    () => wallets.filter((w) => Boolean(w.btcAddress) && hasFundsOnChain("btc", w.balances, w.tokens)).length,
    [wallets],
  );
  const bscFundedCount = useMemo(
    () => wallets.filter((w) => hasFundsOnChain("bsc", w.balances, w.tokens)).length,
    [wallets],
  );
  const ethFundedCount = useMemo(
    () => wallets.filter((w) => hasFundsOnChain("eth", w.balances, w.tokens)).length,
    [wallets],
  );
  const baseFundedCount = useMemo(
    () => wallets.filter((w) => hasFundsOnChain("base", w.balances, w.tokens)).length,
    [wallets],
  );
  const arbFundedCount = useMemo(
    () => wallets.filter((w) => hasFundsOnChain("arb", w.balances, w.tokens)).length,
    [wallets],
  );

  const list: WalletView[] = useMemo(() => {
    if (filter === "funded") {
      let res = filteredWallets.filter((w) => w.hasFunds);
      if (chainFilter !== "all") {
        res = res.filter((w) => hasFundsOnChain(chainFilter, w.balances, w.tokens));
        if (chainFilter === "sol") {
          return res.slice().sort((a, b) => totalBalanceOnSol(b.balances, b.tokens) - totalBalanceOnSol(a.balances, a.tokens));
        } else {
          return res.slice().sort((a, b) => balanceAmount(b.balances[chainFilter]) - balanceAmount(a.balances[chainFilter]));
        }
      }
      return res;
    }
    if (filter === "btc") return btcWallets;
    if (filter === "evm") return evmWallets;
    if (filter === "sol") return solWallets;
    return filteredWallets;
  }, [filter, chainFilter, filteredWallets, btcWallets, evmWallets, solWallets]);

  const activeScopeFundedCount =
    filter === "btc"
      ? btcFundedCount
      : filter === "evm"
        ? evmFundedCount
        : filter === "sol"
          ? solFundedCount
          : fundedCount;

  const isAllFundedSelected = activeScopeFundedCount > 0 && selectedSweepIds.size >= activeScopeFundedCount;

  const selectedFamily = useMemo<"evm" | "sol" | null>(() => {
    if (selectedSweepIds.size === 0) return null;
    const firstSelectedId = Array.from(selectedSweepIds)[0];
    const firstWallet = wallets.find((w) => w.id === firstSelectedId);
    if (!firstWallet) return null;
    return isEvmWallet(firstWallet.type) ? "evm" : "sol";
  }, [selectedSweepIds, wallets]);

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
  }, [setSelectedId]);

  const handleToggleSweep = useCallback((id: number) => {
    toggleSweepSelection(id);
  }, [toggleSweepSelection]);

  const items: ListItem[] = useMemo(() => {
    return list.map((w, i) => ({
      type: "wallet",
      id: w.id,
      wallet: w,
      index: i + 1,
    }));
  }, [list]);

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(750);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      setContainerHeight(scrollRef.current.clientHeight || 750);
    }
  }, []);

  const totalHeight = items.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_ITEMS);
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`} id="sidebar">
      {/* Brand Header */}
      <div className="sb-top">
        <img src="/app-icon.png" alt="Plurivex" className="sb-logo" style={{ objectFit: "contain", borderRadius: "6px" }} />
        <div className="sb-brand">
          <b>PLURIVEX</b>
          <span>SECURE VAULT CONSOLE</span>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <nav className="sb-nav">
        <div className="nav-label">Utama</div>
        <button
          type="button"
          className={`nav-itm ${activeNav === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveNav?.("dashboard")}
          title="Beranda Dashboard"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>
          </svg>
          <span>Beranda</span>
        </button>

        <button
          type="button"
          className={`nav-itm ${activeNav === "wallets" ? "active" : ""}`}
          onClick={() => setActiveNav?.("wallets")}
          title="Direktori 1.000 Dompet"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V6a2 2 0 012-2h2a2 2 0 012 2v1"/><path d="M3 12h18"/>
          </svg>
          <span>Portofolio &amp; Dompet</span>
          {fundedCount > 0 && <span className="nav-badge" style={{ background: "var(--ok)", color: "#16191F" }}>{fundedCount}</span>}
        </button>

        <button
          type="button"
          className={`nav-itm ${activeNav === "activity" ? "active" : ""}`}
          onClick={() => setActiveNav?.("activity")}
          title="Aktivitas & Log Vault"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3-8 4 16 3-8h4"/>
          </svg>
          <span>Aktivitas</span>
          <span className="nav-badge" style={{ background: "var(--accent)", color: "#16191F" }}>4</span>
        </button>

        <div className="nav-label">Operasi</div>
        <button
          type="button"
          className={`nav-itm ${activeNav === "sweeper" ? "active" : ""}`}
          onClick={() => setActiveNav?.("sweeper")}
          title="Sweep Cerdas (Multi-Wallet Sweeper)"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>
          </svg>
          <span>Sweep Cerdas</span>
        </button>

        <button
          type="button"
          className={`nav-itm ${activeNav === "import" ? "active" : ""}`}
          onClick={() => {
            setActiveNav?.("import");
            onOpenImport?.();
          }}
          title="Import Wallet"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>
          </svg>
          <span>Import Wallet</span>
        </button>

        <button
          type="button"
          className={`nav-itm ${activeNav === "repair" ? "active" : ""}`}
          onClick={() => setActiveNav?.("repair")}
          title="Mnemonic Typo Repair & Forensics"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="4.5"/><path d="M8 12.5V20M8 16.5h.01M15.5 5.2a4.5 4.5 0 010 8.6M15.5 11.5V20"/>
          </svg>
          <span>Typo Repair</span>
          <span className="nav-badge" style={{ background: "var(--accent)", color: "#16191F" }}>PRO</span>
        </button>

        <button
          type="button"
          className={`nav-itm ${activeNav === "trader" ? "active" : ""}`}
          onClick={() => setActiveNav?.("trader")}
          title="DEX Batch Trader"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
          </svg>
          <span>DEX Trader</span>
        </button>

        <div className="nav-label">Keamanan &amp; Jaringan</div>
        <button
          type="button"
          className={`nav-itm ${activeNav === "allowance" ? "active" : ""}`}
          onClick={() => setActiveNav?.("allowance")}
          title="Izin Token (Allowance Manager)"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>
          </svg>
          <span>Izin Token</span>
          <span className="nav-badge">3</span>
        </button>

        <button
          type="button"
          className={`nav-itm ${activeNav === "rpc" ? "active" : ""}`}
          onClick={() => setActiveNav?.("rpc")}
          title="RPC Node Manager"
        >
          <svg className="nic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>
            <path d="M7 7.5h.01M7 16.5h.01M11 7.5h.01M11 16.5h.01"/>
          </svg>
          <span>RPC Manager</span>
        </button>
      </nav>

      {/* Directory Section Header (Shown when browsing Wallets Directory) */}
      <div className="sidebar-head">
        <SidebarHeader
          totalWallets={wallets.length}
          search={search}
          onSearchChange={setSearch}
        />

        <SidebarFilterTabs
          totalCount={wallets.length}
          filter={filter}
          setFilter={setFilter}
          chainFilter={chainFilter}
          setChainFilter={setChainFilter}
          fundedCount={fundedCount}
          bscFundedCount={bscFundedCount}
          solFundedCount={solFundedCount}
          ethFundedCount={ethFundedCount}
          btcFundedCount={btcFundedCount}
          baseFundedCount={baseFundedCount}
          arbFundedCount={arbFundedCount}
          existingTags={existingTags}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          activeScopeFundedCount={activeScopeFundedCount}
          selectedSweepCount={selectedSweepIds.size}
          isAllFundedSelected={isAllFundedSelected}
          onSelectAllFunded={selectAllFunded}
          onClearSweepSelection={clearSweepSelection}
        />
      </div>

      <div
        className="sidebar-list scrollable"
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        {!items.length ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">
              {filter === "funded" ? <IconWallet size={22} /> : <IconSearch size={22} />}
            </div>
            {filter === "funded" ? (
              <>No funded wallets detected yet.<br />Run <b>Scan All</b> to check live balances.</>
            ) : filter === "evm" ? (
              <>No EVM wallets found.</>
            ) : filter === "sol" ? (
              <>No Solana wallets found.</>
            ) : (
              <>No matching wallets found.</>
            )}
          </div>
        ) : (
          <div style={{ height: `${totalHeight}px`, position: "relative", width: "100%" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${offsetY}px)`,
                willChange: "transform",
              }}
            >
              {visibleItems.map((item) => {
                if (item.type === "header") {
                  return (
                    <div
                      key={item.id}
                      className="sidebar-section-label"
                      style={{ height: "32px", display: "flex", alignItems: "center", marginBottom: "6px" }}
                    >
                      {item.title} <span>{item.count}</span>
                    </div>
                  );
                }
                const w = item.wallet;
                return (
                  <WalletRow
                    key={w.id}
                    wallet={w}
                    index={item.index}
                    selected={selectedId === w.id}
                    sweepChecked={selectedSweepIds.has(w.id)}
                    filterScope={filter}
                    targetChain={filter === "funded" ? chainFilter : "all"}
                    hideCheckbox={
                      selectedFamily !== null &&
                      (selectedFamily === "evm" ? !isEvmWallet(w.type) : !isSolanaWallet(w.type))
                    }
                    onSelect={handleSelect}
                    onToggleSweep={handleToggleSweep}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Shield & Collapse Controls */}
      <div className="sb-bottom">
        <div className="sb-sec">
          <span className="shield">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z"/>
            </svg>
          </span>
          <div>
            <b>Perisai Aktif</b>
            <span>Argon2id · AES-256 GCM</span>
          </div>
        </div>

        <div className="sb-colidx">
          <button
            type="button"
            className="sb-col"
            onClick={() => setIsCollapsed?.((prev) => !prev)}
            title={isCollapsed ? "Buka Sidebar" : "Ringkas Sidebar"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 4v16"/>
            </svg>
          </button>
          <button
            type="button"
            className="sb-col"
            onClick={lock}
            title="Kunci Vault Segera"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
