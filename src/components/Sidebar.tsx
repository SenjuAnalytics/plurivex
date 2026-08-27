import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { isEvmWallet, isSolanaWallet, shortAddr, walletDisplayAddress } from "../lib/wallet";
import { formatCompactBalance } from "../lib/chains";
import type { WalletView } from "../lib/types";
import { IconSearch, IconSeed, IconKey } from "../icons";

type Filter = "all" | "evm" | "sol" | "funded";

function CustomCheckbox({
  checked,
  disabled,
  disabledReason,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={`custom-checkbox-btn ${checked ? "is-checked" : ""} ${disabled ? "is-disabled" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      disabled={disabled}
      title={disabled ? disabledReason : checked ? "Deselect" : "Select wallet for batch sweep"}
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
  hideCheckbox,
  onSelect,
  onToggleSweep,
}: {
  hideCheckbox?: boolean;
  wallet: WalletView;
  index: number;
  selected: boolean;
  sweepChecked: boolean;
  onSelect: () => void;
  onToggleSweep: () => void;
}) {
  const display = walletDisplayAddress(wallet);

  // Compute clean primary & secondary balance previews
  const positiveBalances = Object.entries(wallet.balances)
    .filter(([_, val]) => {
      if (!val || val === "loading" || val === "error") return false;
      const num = parseFloat(val.split(" ")[0]);
      return num > 0;
    })
    .map(([_, val]) => formatCompactBalance(val));

  const primaryBalance = positiveBalances.length > 0 ? positiveBalances[0] : null;
  const secondaryBalance = positiveBalances.length > 1 ? positiveBalances.slice(1).join(" · ") : null;

  return (
    <div
      className={`wallet-card-row${selected ? " active" : ""}${
        wallet.hasFunds ? " has-funds" : ""
      }${sweepChecked ? " is-checked" : ""}`}
      onClick={onSelect}
    >
      {!hideCheckbox && (
        <div className="card-check-slot" onClick={(e) => e.stopPropagation()}>
          <CustomCheckbox checked={sweepChecked} onChange={onToggleSweep} />
        </div>
      )}

      <div className={`card-icon-slot ${wallet.type === "pk" ? "pk" : wallet.type === "seed" ? "seed" : wallet.type === "sol_pk" ? "sol" : "invalid"}`}>
        {wallet.type === "seed" ? <IconSeed size={12} /> : wallet.type === "pk" ? <IconKey size={12} /> : wallet.type === "sol_pk" ? "◎" : "!"}
      </div>

      <div className="card-content-slot">
        <div className="card-slot-top">
          <div className="card-addr-group">
            <span className="card-idx mono">#{String(index).padStart(2, "0")}</span>
            <span className="card-addr mono">{display ? shortAddr(display) : "invalid"}</span>
          </div>
          {primaryBalance ? (
            <span className="card-primary-bal mono">{primaryBalance}</span>
          ) : (
            <span className="card-idle-bal mono">0.00</span>
          )}
        </div>

        <div className="card-slot-sub">
          <span className={`card-type-tag tag-${wallet.type}`}>
            {wallet.type === "seed" ? "SEED" : wallet.type === "pk" ? "EVM" : "SOL"}
          </span>
          {secondaryBalance ? (
            <span className="card-sub-bal mono" title={positiveBalances.join(" · ")}>
              {secondaryBalance}
            </span>
          ) : wallet.tokens && wallet.tokens.length > 0 ? (
            <span className="card-sub-tokens mono">
              +{wallet.tokens.length} token{wallet.tokens.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="card-sub-idle">0 assets</span>
          )}
        </div>
      </div>

      {wallet.hasFunds && <span className="card-fund-dot" title="Active funded asset" />}
    </div>
  );
}

function WalletSection({
  title,
  wallets,
  selectedId,
  selectedSweepIds,
  selectedFamily,
  onSelect,
  onToggleSweep,
  startIndex,
}: {
  selectedFamily: "evm" | "sol" | null;
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
          hideCheckbox={selectedFamily !== null && (selectedFamily === "evm" ? !isEvmWallet(w.type) : !isSolanaWallet(w.type))}
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
  const evmFundedCount = useMemo(() => evmWallets.filter((w) => w.hasFunds).length, [evmWallets]);
  const solFundedCount = useMemo(() => solWallets.filter((w) => w.hasFunds).length, [solWallets]);
  const activeScopeFundedCount = filter === "evm" ? evmFundedCount : filter === "sol" ? solFundedCount : fundedCount;
  const isAllFundedSelected = activeScopeFundedCount > 0 && selectedSweepIds.size >= activeScopeFundedCount;
  const selectedFamily = useMemo<"evm" | "sol" | null>(() => {
    if (selectedSweepIds.size === 0) return null;
    const firstSelectedId = Array.from(selectedSweepIds)[0];
    const firstWallet = wallets.find((w) => w.id === firstSelectedId);
    if (!firstWallet) return null;
    return isEvmWallet(firstWallet.type) ? "evm" : "sol";
  }, [selectedSweepIds, wallets]);

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
        {(fundedCount > 0 || selectedSweepIds.size > 0) && (
          <div className="sidebar-batch-bar">
            {fundedCount > 0 && (
              <button
                type="button"
                className="batch-action-btn"
                onClick={() => selectAllFunded(filter === "evm" ? "evm" : filter === "sol" ? "sol" : "all")}
                title={isAllFundedSelected ? "Deselect all funded wallets" : "Select all funded wallets"}
              >
                {isAllFundedSelected ? "✕ Deselect Funded" : `☑️ Select All Funded (${activeScopeFundedCount})`}
              </button>
            )}

            {selectedSweepIds.size > 0 && (
              <button
                type="button"
                className="batch-action-btn btn-clear-selection"
                onClick={clearSweepSelection}
                title="Clear all checked checkboxes"
              >
                ✕ Clear ({selectedSweepIds.size})
              </button>
            )}
          </div>
        )}
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
              selectedFamily={selectedFamily}
              onSelect={setSelectedId}
              onToggleSweep={toggleSweepSelection}
              startIndex={0}
            />
            <WalletSection
              title="SOLANA NETWORK"
              wallets={solWallets}
              selectedId={selectedId}
              selectedSweepIds={selectedSweepIds}
              selectedFamily={selectedFamily}
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
              hideCheckbox={selectedFamily !== null && (selectedFamily === "evm" ? !isEvmWallet(w.type) : !isSolanaWallet(w.type))}
              onSelect={() => setSelectedId(w.id)}
              onToggleSweep={() => toggleSweepSelection(w.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
