import { IconChartPie, IconZap, IconRefresh, IconHistory, IconScan, IconTrash } from "../../icons";
import type { WalletType } from "../../lib/types";

export type DetailMode = "portfolio" | "sweeper" | "dex" | "explorer";

interface AllocationItem {
  chain: string;
  label: string;
  color: string;
  usd: number;
  pct: number;
}

interface WalletHeaderProps {
  activeTab: DetailMode;
  setActiveTab: (t: DetailMode) => void;
  walletType: WalletType;
  hasFunds: boolean;
  walletLabel: string | null;
  isEditingTag: boolean;
  tagInput: string;
  setTagInput: (val: string) => void;
  setIsEditingTag: (val: boolean) => void;
  saveTag: () => void;
  onSetPresetTag: (tag: string) => void;
  onScan: () => void;
  onDelete: () => void;
  hasScanTarget: boolean;
  scanning: boolean;
  totalUsd: number;
  allocations: AllocationItem[];
}

export function WalletHeader({
  activeTab,
  setActiveTab,
  walletType,
  hasFunds,
  walletLabel,
  isEditingTag,
  tagInput,
  setTagInput,
  setIsEditingTag,
  saveTag,
  onSetPresetTag,
  onScan,
  onDelete,
  hasScanTarget,
  scanning,
  totalUsd,
  allocations,
}: WalletHeaderProps) {
  return (
    <>
      {/* 1. Multi-Mode Workspace Header Tabs */}
      <div className="workspace-tabs-bar">
        <button
          type="button"
          className={`workspace-tab ${activeTab === "portfolio" ? "active" : ""}`}
          onClick={() => setActiveTab("portfolio")}
        >
          <IconChartPie size={13} /> Portfolio & Balances
        </button>
        <button
          type="button"
          className={`workspace-tab ${activeTab === "sweeper" ? "active" : ""}`}
          onClick={() => setActiveTab("sweeper")}
        >
          <IconZap size={13} /> Fund Sweeper
        </button>
        <button
          type="button"
          className={`workspace-tab ${activeTab === "dex" ? "active" : ""}`}
          onClick={() => setActiveTab("dex")}
        >
          <IconRefresh size={13} /> DEX Batch Trader
        </button>
        <button
          type="button"
          className={`workspace-tab ${activeTab === "explorer" ? "active" : ""}`}
          onClick={() => setActiveTab("explorer")}
        >
          <IconHistory size={13} /> Explorer Hub
        </button>
      </div>

      {/* 2. Symmetrical Executive Identity & Security Card */}
      <div className="hero-executive-card">
        <div className="hero-top-row">
          <div className="hero-tags-group">
            <span className="hero-type-badge">
              {walletType === "seed"
                ? "TRI-CHAIN BIP-39 SEED"
                : walletType === "pk"
                  ? "MULTI-CHAIN KEY"
                  : "SOLANA KEY"}
            </span>
            {hasFunds && <span className="hero-funded-pill">Funded Asset</span>}

            {/* Folder / Label Tag Manager */}
            <div className="detail-tag-cluster">
              {isEditingTag ? (
                <div className="tag-inline-form">
                  <input
                    type="text"
                    className="tag-input-sm mono"
                    value={tagInput}
                    placeholder="Tag name…"
                    autoFocus
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTag();
                      if (e.key === "Escape") setIsEditingTag(false);
                    }}
                  />
                  <button type="button" className="btn-tag-action btn-tag-save" onClick={saveTag}>✓</button>
                  <button type="button" className="btn-tag-action btn-tag-cancel" onClick={() => setIsEditingTag(false)}>✕</button>
                </div>
              ) : (
                <div className="tag-pills-row">
                  <button
                    type="button"
                    className={`tag-display-btn ${walletLabel ? `tag-${walletLabel.toLowerCase()}` : "tag-none"}`}
                    onClick={() => { setTagInput(walletLabel || ""); setIsEditingTag(true); }}
                    title="Click to edit label"
                  >
                    {walletLabel ? walletLabel : "+ Add Tag"}
                  </button>
                  {["Main", "Airdrop", "Whales", "Burner"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`tag-preset-chip ${walletLabel?.toLowerCase() === p.toLowerCase() ? "active" : ""}`}
                      onClick={() => onSetPresetTag(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hero-actions-toolbar">
            <button
              type="button"
              className={`btn-hero-action btn-hero-scan ${scanning ? "is-scanning" : ""}`}
              onClick={onScan}
              disabled={!hasScanTarget || scanning}
              title="Rescan balances across all configured chains"
            >
              <IconScan size={13} className={scanning ? "spin-scan" : ""} />
              <span>{scanning ? "Scanning…" : "Rescan Wallet"}</span>
            </button>
            <button
              type="button"
              className="btn-hero-action btn-hero-delete"
              onClick={onDelete}
              title="Remove wallet from vault"
            >
              <IconTrash size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Compact Valuation Bar (Only if positive assets exist) */}
        {totalUsd > 0 && (
          <div className="hero-valuation-strip">
            <div className="valuation-strip-left">
              <span className="val-strip-lbl">ESTIMATED NET ASSETS:</span>
              <span className="val-strip-val mono">
                ${totalUsd < 0.01 ? "< 0.01" : totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
            <div className="valuation-strip-right">
              {allocations.map((a) => (
                <span key={a.label} className="val-alloc-tag">
                  <span className="alloc-dot" style={{ background: a.color }} />
                  {a.label} {a.pct}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
