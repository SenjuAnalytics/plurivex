import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { isEvmWallet, isSolanaWallet, shortAddr, walletDisplayAddress } from "../lib/wallet";
import { formatCompactBalance } from "../lib/chains";
import type { WalletView } from "../lib/types";
import { IconSearch, IconSeed, IconKey } from "../icons";
import { ChainIcon } from "../icons/ChainIcon";

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

const ITEM_HEIGHT = 58;
const BUFFER_ITEMS = 12;

type ListItem =
  | { type: "header"; id: string; title: string; count: number }
  | { type: "wallet"; id: number; wallet: WalletView; index: number };

const WalletRow = memo(function WalletRow({
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
  onSelect: (id: number) => void;
  onToggleSweep: (id: number) => void;
}) {
  const display = walletDisplayAddress(wallet);
  const handleSelect = useCallback(() => onSelect(wallet.id), [onSelect, wallet.id]);
  const handleToggle = useCallback(() => onToggleSweep(wallet.id), [onToggleSweep, wallet.id]);

  // Approximate USD weight to find the truly largest balance
  const approximateUsdRate: Record<string, number> = {
    eth: 2600,
    bsc: 600,
    base: 2600,
    arbitrum: 2600,
    polygon: 0.5,
    avalanche: 25,
    solana: 180,
  };

  // 1. Gather all positive native chain balances (ETH, BNB, SOL, etc.)
  const nativeBalances = Object.entries(wallet.balances)
    .filter(([_, val]) => {
      if (!val || val === "loading" || val === "error") return false;
      const num = parseFloat(val.split(" ")[0]);
      return num > 0;
    })
    .map(([chainKey, val]) => {
      const safeVal = val ?? "";
      const num = parseFloat(safeVal.split(" ")[0]) || 0;
      const rate = approximateUsdRate[chainKey.toLowerCase()] || 1;
      return {
        key: `native-${chainKey}`,
        chainKey,
        label: chainKey.toUpperCase(),
        num,
        estimatedUsd: num * rate,
        formatted: formatCompactBalance(safeVal),
        isToken: false,
      };
    })
    .sort((a, b) => b.estimatedUsd - a.estimatedUsd || b.num - a.num);

  // 2. Gather all positive token holdings (ERC-20, SPL, etc.)
  const tokenBalances = (wallet.tokens || [])
    .filter((tok) => {
      const num = parseFloat(tok.balance);
      return !isNaN(num) && num > 0;
    })
    .map((tok) => {
      const num = parseFloat(tok.balance) || 0;
      const formatted = `${num < 0.0001 ? "< 0.0001" : num < 1000 ? num.toLocaleString("en-US", { maximumFractionDigits: 4 }) : formatCompactBalance(`${num} ${tok.symbol}`)} ${tok.symbol}`;
      return {
        key: `token-${tok.chain}-${tok.symbol}`,
        chainKey: tok.chain,
        label: `${tok.symbol} (${tok.chain.toUpperCase()})`,
        num,
        formatted,
        isToken: true,
      };
    });

  // NATIVE COIN ALWAYS HAS PRIMARY PRIORITY ON THE CARD
  const primaryHolding = nativeBalances[0] || tokenBalances[0] || null;

  // Extra items for tooltip (+N)
  const remainingNative = nativeBalances.slice(primaryHolding && !primaryHolding.isToken ? 1 : 0);
  const remainingTokens = tokenBalances.slice(primaryHolding && primaryHolding.isToken ? 1 : 0);
  const totalExtraCount = remainingNative.length + remainingTokens.length;

  return (
    <div
      className={`wallet-card-row${selected ? " active" : ""}${
        wallet.hasFunds ? " has-funds" : ""
      }${sweepChecked ? " is-checked" : ""}`}
      onClick={handleSelect}
    >
      {!hideCheckbox && (
        <div className="card-check-slot" onClick={(e) => e.stopPropagation()}>
          <CustomCheckbox checked={sweepChecked} onChange={handleToggle} />
        </div>
      )}

      <div className={`card-icon-slot ${wallet.type === "pk" ? "pk" : wallet.type === "seed" ? "seed" : wallet.type === "sol_pk" ? "sol" : "invalid"}`}>
        {wallet.type === "seed" ? <IconSeed size={12} /> : wallet.type === "pk" ? <IconKey size={12} /> : wallet.type === "sol_pk" ? "◎" : "!"}
      </div>

      <div className="card-content-slot">
        <div className="card-slot-top">
          <div className="card-addr-group">
            <span className="card-idx mono">#{String(index).padStart(2, "0")}</span>
            <span className="card-addr mono" title={display || undefined}>
              {display ? shortAddr(display) : "invalid"}
            </span>
          </div>
        </div>

        <div className="card-slot-sub">
          <span className={`card-type-tag tag-${wallet.type}`}>
            {wallet.type === "seed" ? "SEED" : wallet.type === "pk" ? "EVM" : "SOL"}
          </span>

          <div className="card-bals-cluster">
            {!primaryHolding ? (
              <span className="card-sub-idle">0 assets</span>
            ) : (
              <div className="card-single-primary-wrap">
                <span className="card-bal-badge">
                  <ChainIcon chain={primaryHolding.chainKey} size={13.5} className="card-bal-icon" />
                  <span className="card-primary-bal mono">{primaryHolding.formatted}</span>
                </span>
                {totalExtraCount > 0 && (
                  <span className="card-more-pill-wrap">
                    <span className="card-more-pill mono">
                      +{totalExtraCount}
                    </span>
                    <div className={`card-custom-tooltip ${index <= 2 ? "tooltip-down" : "tooltip-up"}`}>
                      {remainingNative.length > 0 && (
                        <>
                          <div className="card-tooltip-header">Other Native Balances</div>
                          {remainingNative.map((b) => (
                            <div key={b.key} className="card-tooltip-row">
                              <div className="card-tooltip-chain">
                                <ChainIcon chain={b.chainKey} size={13} />
                                <span>{b.label}</span>
                              </div>
                              <span className="card-tooltip-bal mono">{b.formatted}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {remainingTokens.length > 0 && (
                        <>
                          <div
                            className="card-tooltip-header"
                            style={remainingNative.length > 0 ? { marginTop: "4px" } : undefined}
                          >
                            Tokens Held
                          </div>
                          {remainingTokens.map((b) => (
                            <div key={b.key} className="card-tooltip-row">
                              <div className="card-tooltip-chain">
                                <ChainIcon chain={b.chainKey} size={13} />
                                <span>{b.label}</span>
                              </div>
                              <span className="card-tooltip-bal mono">{b.formatted}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {wallet.hasFunds && <span className="card-fund-dot" title="Active funded asset" />}
    </div>
  );
});

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

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
  }, [setSelectedId]);

  const handleToggleSweep = useCallback((id: number) => {
    toggleSweepSelection(id);
  }, [toggleSweepSelection]);

  const items: ListItem[] = useMemo(() => {
    if (showGrouped) {
      const res: ListItem[] = [];
      if (evmWallets.length > 0) {
        res.push({ type: "header", id: "header-evm", title: "EVM NETWORKS", count: evmWallets.length });
        for (let i = 0; i < evmWallets.length; i++) {
          res.push({ type: "wallet", id: evmWallets[i].id, wallet: evmWallets[i], index: i + 1 });
        }
      }
      if (solWallets.length > 0) {
        res.push({ type: "header", id: "header-sol", title: "SOLANA NETWORK", count: solWallets.length });
        for (let i = 0; i < solWallets.length; i++) {
          res.push({
            type: "wallet",
            id: solWallets[i].id,
            wallet: solWallets[i],
            index: evmWallets.length + i + 1,
          });
        }
      }
      return res;
    }
    return list.map((w, i) => ({
      type: "wallet",
      id: w.id,
      wallet: w,
      index: i + 1,
    }));
  }, [showGrouped, evmWallets, solWallets, list]);

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

      <div
        className="sidebar-list scrollable"
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        {!items.length ? (
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
    </aside>
  );
}
