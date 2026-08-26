import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { isEvmWallet, isSolanaWallet, shortAddr, walletDisplayAddress } from "../lib/wallet";
import { formatCompactBalance } from "../lib/chains";
import type { WalletView } from "../lib/types";
import { IconSearch, IconSeed, IconKey } from "../icons";

type Filter = "all" | "evm" | "sol" | "funded";

function CustomCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={`custom-checkbox-btn ${checked ? "is-checked" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      title={checked ? "Deselect" : "Select wallet for batch sweep"}
      aria-label="Select wallet"
    >
      <div className="custom-checkbox-box">
        {checked && (
          <svg
            className="custom-checkbox-svg"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        )}
      </div>
    </button>
  );
}

function WalletRow({
  wallet,
  index,
  selected,
  sweepChecked,
  onSelect,
  onToggleSweep,
}: {
  wallet: WalletView;
  index: number;
  selected: boolean;
  sweepChecked: boolean;
  onSelect: () => void;
  onToggleSweep: () => void;
}) {
  const display = walletDisplayAddress(wallet);

  // Compute clean compact balance preview text
  const positiveBalances = Object.entries(wallet.balances)
    .filter(([_, val]) => {
      if (!val || val === "loading" || val === "error") return false;
      const num = parseFloat(val.split(" ")[0]);
      return num > 0;
    })
    .map(([_, val]) => formatCompactBalance(val));

  const balanceSummary = positiveBalances.length > 0
    ? positiveBalances.slice(0, 2).join(" · ") + (positiveBalances.length > 2 ? "…" : "")
    : wallet.tokens && wallet.tokens.length > 0
      ? `${wallet.tokens.length} token${wallet.tokens.length > 1 ? "s" : ""}`
      : null;

  return (
    <div
      className={`wallet-item-wrap${selected ? " active" : ""}${
        wallet.hasFunds ? " has-funds" : ""
      }${sweepChecked ? " is-checked" : ""}`}
    >
      <div className="wallet-item-check">
        <CustomCheckbox checked={sweepChecked} onChange={onToggleSweep} />
      </div>
      <button
        type="button"
        className={`wallet-item${selected ? " active" : ""}${wallet.hasFunds ? " has-funds" : ""}`}
        onClick={onSelect}
      >
        <div className={`wallet-item-icon ${wallet.type === "pk" ? "pk" : wallet.type === "seed" ? "seed" : wallet.type === "sol_pk" ? "sol" : "invalid"}`}>
          {wallet.type === "seed" ? <IconSeed size={13} /> : wallet.type === "pk" ? <IconKey size={13} /> : wallet.type === "sol_pk" ? "◎" : "!"}
        </div>
        <div className="wallet-item-info">
          <div className="wallet-item-row-top">
            <span className="wallet-item-idx mono">#{String(index).padStart(2, "0")}</span>
            <span className="wallet-item-addr mono">
              {display ? shortAddr(display) : "invalid"}
            </span>
          </div>
          <div className="wallet-item-row-sub">
            <span className="wallet-type-tag">
              {wallet.type === "seed" ? "SEED" : wallet.type === "pk" ? "EVM" : "SOL"}
            </span>
            {balanceSummary ? (
              <span className="wallet-bal-preview mono" title={positiveBalances.join(" · ")}>
                {balanceSummary}
              </span>
            ) : (
              <span className="wallet-idle-preview">0 assets</span>
            )}
          </div>
        </div>
        {wallet.hasFunds && (
          <span className="fund-dot-badge" title="Has positive funds">
            ●
          </span>
        )}
      </button>
    </div>
  );
}

function WalletSection({
  title,
  wallets,
  selectedId,
  selectedSweepIds,
  onSelect,
  onToggleSweep,
  startIndex,
}: {
  title: string;
  wallets: WalletView[];
  selectedId: number | null;
  selectedSweepIds: Set<number>;
  onSelect: (id: number) => void;
  onToggleSweep: (id: number) => void;
  startIndex: number;
}) {
  if (!wallets.length) return null;
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-label">{title} <span>{wallets.length}</span></div>
      {wallets.map((w, i) => (
        <WalletRow
          key={w.id}
          wallet={w}
          index={startIndex + i + 1}
          selected={selectedId === w.id}
          sweepChecked={selectedSweepIds.has(w.id)}
          onSelect={() => onSelect(w.id)}
          onToggleSweep={() => onToggleSweep(w.id)}
        />
      ))}
    </div>
  );
}

export function Sidebar() {
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
    setIsSweepModalOpen,
  } = useApp();
  const [filter, setFilter] = useState<Filter>("all");

  const evmWallets = useMemo(
    () => filteredWallets.filter((w) => isEvmWallet(w.type)),
    [filteredWallets],
  );
  const solWallets = useMemo(
    () => filteredWallets.filter((w) => isSolanaWallet(w.type)),
    [filteredWallets],
  );

  const list = useMemo(() => {
    if (filter === "funded") return filteredWallets.filter((w) => w.hasFunds);
    if (filter === "evm") return evmWallets;
    if (filter === "sol") return solWallets;
    return filteredWallets;
  }, [filter, filteredWallets, evmWallets, solWallets]);

  const showGrouped = filter === "all" && !search.trim();
  const fundedCount = useMemo(() => wallets.filter((w) => w.hasFunds).length, [wallets]);
  const isAllFundedSelected = fundedCount > 0 && selectedSweepIds.size >= fundedCount;

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title-row">
          <h2>Wallets Directory</h2>
          <span className="count-badge mono">{wallets.length}</span>
        </div>

        <div className="search-wrap">
          <IconSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search address or secret…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs filter-tabs-4">
          <button
            type="button"
            className={`filter-tab${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({wallets.length})
          </button>
          <button
            type="button"
            className={`filter-tab funded-tab${filter === "funded" ? " active" : ""}`}
            onClick={() => setFilter("funded")}
          >
            💰 Funded ({fundedCount})
          </button>
          <button
            type="button"
            className={`filter-tab${filter === "evm" ? " active" : ""}`}
            onClick={() => setFilter("evm")}
          >
            EVM ({evmWallets.length})
          </button>
          <button
            type="button"
            className={`filter-tab${filter === "sol" ? " active" : ""}`}
            onClick={() => setFilter("sol")}
          >
            SOL ({solWallets.length})
          </button>
        </div>

        {/* Batch Selection Toolbar */}
        <div className="sidebar-batch-bar">
          <button
            type="button"
            className="batch-action-btn"
            onClick={() => (isAllFundedSelected ? clearSweepSelection() : selectAllFunded())}
            disabled={fundedCount === 0}
          >
            {isAllFundedSelected ? "✕ Deselect All" : `☑️ Select All Funded (${fundedCount})`}
          </button>
          {selectedSweepIds.size > 0 && (
            <button
              type="button"
              className="batch-sweep-btn"
              onClick={() => setIsSweepModalOpen(true)}
            >
              ⚡ Sweep ({selectedSweepIds.size})
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-list scrollable">
        {!list.length ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">
              {filter === "funded" ? "💰" : "🔍"}
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
        ) : showGrouped ? (
          <>
            <WalletSection
              title="EVM NETWORKS"
              wallets={evmWallets}
              selectedId={selectedId}
              selectedSweepIds={selectedSweepIds}
              onSelect={setSelectedId}
              onToggleSweep={toggleSweepSelection}
              startIndex={0}
            />
            <WalletSection
              title="SOLANA NETWORK"
              wallets={solWallets}
              selectedId={selectedId}
              selectedSweepIds={selectedSweepIds}
              onSelect={setSelectedId}
              onToggleSweep={toggleSweepSelection}
              startIndex={evmWallets.length}
            />
          </>
        ) : (
          list.map((w, i) => (
            <WalletRow
              key={w.id}
              wallet={w}
              index={i + 1}
              selected={selectedId === w.id}
              sweepChecked={selectedSweepIds.has(w.id)}
              onSelect={() => setSelectedId(w.id)}
              onToggleSweep={() => toggleSweepSelection(w.id)}
            />
          ))
        )}
      </div>

      {/* Floating sweep action bar at the bottom if items checked */}
      {selectedSweepIds.size > 0 && (
        <div className="sidebar-sweep-dock">
          <div className="dock-left">
            <span className="dock-count mono">{selectedSweepIds.size} selected</span>
            <button type="button" className="dock-clear-btn" onClick={clearSweepSelection}>
              Clear
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm dock-sweep-btn"
            onClick={() => setIsSweepModalOpen(true)}
          >
            ⚡ Sweep Funds
          </button>
        </div>
      )}
    </aside>
  );
}
