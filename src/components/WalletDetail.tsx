import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { balanceAmount, chainsForWallet, formatCompactBalance, type Chain } from "../lib/chains";
import type { WalletView } from "../lib/types";
import { derivePrivateKeyFromSecret, isSolanaWallet, walletDisplayAddress, walletHasScanTarget } from "../lib/wallet";
import { IconScan, ChainIcon } from "../icons";
import { SweeperWorkspace } from "./SweeperWorkspace";
import { DexBatchTrader } from "./DexBatchTrader";
import { WalletActivityExplorer } from "./WalletActivityExplorer";

type DetailMode = "portfolio" | "sweeper" | "dex" | "explorer";

function BalanceCard({ chain, value }: { chain: Chain; value: string | null }) {
  const num = value && value !== "loading" && value !== "error" ? balanceAmount(value) : 0;
  const state = value === "loading" ? "loading" : value === "error" ? "error" : num > 0 ? "positive" : "zero";

  return (
    <div className={`bal-card bal-${chain.key}`} style={{ "--chain-color": chain.color } as React.CSSProperties}>
      <div className="bal-card-top">
        <div className="bal-card-chain-meta">
          <ChainIcon chain={chain.key} size={16} />
          <span className="bal-card-name">{chain.label}</span>
        </div>
        <span className={`bal-card-status-dot ${state === "positive" ? "live" : ""}`} title={state === "positive" ? "Active balance" : "Ready"} />
      </div>
      <div className={`bal-card-val ${state}`}>
        {value === "loading" && <span className="bal-spinner" />}
        {value === "error" && "Failed"}
        {value && value !== "loading" && value !== "error" && formatCompactBalance(value)}
        {!value && <span className="bal-pending">Not scanned</span>}
      </div>
      <div className="bal-card-sub">
        {state === "positive" ? "Native Liquid Asset" : "0.00 Gas Reserve"}
      </div>
    </div>
  );
}

export function WalletDetail({ wallet }: { wallet: WalletView }) {
  const {
    removeWallet,
    revealSecret,
    scanOne,
    toast,
  } = useApp();
  const [activeTab, setActiveTab] = useState<DetailMode>("portfolio");
  const [revealed, setRevealed] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setSecret(null);
  }, [wallet.id]);

  const toggleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      setSecret(null);
      return;
    }
    const s = await revealSecret(wallet.id);
    setSecret(s);
    setRevealed(true);
  };

  const displayAddr = walletDisplayAddress(wallet);
  const walletChains = chainsForWallet(wallet.type);
  const isSol = isSolanaWallet(wallet.type);
  const derivedPk = secret ? derivePrivateKeyFromSecret(secret, wallet.type) : null;

  const copyAddr = () => {
    if (!displayAddr) return;
    navigator.clipboard.writeText(displayAddr);
    toast("Address copied to clipboard", "success");
  };

  const copySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    toast("Secret key copied to clipboard", "success");
  };

  const scan = async () => {
    setScanning(true);
    await scanOne(wallet.id);
    setScanning(false);
  };

  // Calculate estimated total USD value & allocation
  const { totalUsd, allocations } = useMemo(() => {
    const prices: Record<string, number> = {
      eth: 2650,
      bsc: 580,
      base: 2650,
      arb: 2650,
      sol: 145,
    };
    let sum = 0;
    const allocs: { chain: string; label: string; color: string; usd: number; pct: number }[] = [];

    for (const c of walletChains) {
      const val = wallet.balances[c.key];
      const num = balanceAmount(val);
      const usd = num * (prices[c.key] || 1);
      sum += usd;
      if (usd > 0) {
        allocs.push({ chain: c.key, label: c.label, color: c.color, usd, pct: 0 });
      }
    }

    if (wallet.tokens) {
      for (const t of wallet.tokens) {
        const num = balanceAmount(t.balance);
        const usd = num * (t.symbol === "WETH" ? 2650 : t.symbol === "ARB" ? 0.55 : 1);
        sum += usd;
        if (usd > 0) {
          allocs.push({ chain: t.chain, label: t.symbol, color: "#28a0f0", usd, pct: 0 });
        }
      }
    }

    if (sum > 0) {
      for (const item of allocs) {
        item.pct = Math.round((item.usd / sum) * 100);
      }
    }

    return { totalUsd: sum, allocations: allocs };
  }, [wallet, walletChains]);

  return (
    <div className={`detail-card${wallet.hasFunds ? " has-funds" : ""}`}>
      {/* 1. Multi-Mode Workspace Header Tabs */}
      <div className="workspace-tabs-bar">
        <button
          type="button"
          className={`workspace-tab ${activeTab === "portfolio" ? "active" : ""}`}
          onClick={() => setActiveTab("portfolio")}
        >
          📊 Portfolio & Balances
        </button>
        <button
          type="button"
          className={`workspace-tab ${activeTab === "sweeper" ? "active" : ""}`}
          onClick={() => setActiveTab("sweeper")}
        >
          ⚡ Fund Sweeper
        </button>
        <button
          type="button"
          className={`workspace-tab ${activeTab === "dex" ? "active" : ""}`}
          onClick={() => setActiveTab("dex")}
        >
          🔄 DEX Batch Trader
        </button>
        <button
          type="button"
          className={`workspace-tab ${activeTab === "explorer" ? "active" : ""}`}
          onClick={() => setActiveTab("explorer")}
        >
          📜 Explorer Hub
        </button>
      </div>

      {/* 2. Symmetrical Executive Identity & Security Card */}
      <div className="hero-executive-card">
        <div className="hero-top-row">
          <div className="hero-tags-group">
            <span className="hero-type-badge">
              {wallet.type === "seed"
                ? "BIP-39 Mnemonic Seed"
                : wallet.type === "pk"
                  ? "EVM Private Key"
                  : wallet.type === "sol_pk"
                    ? "Solana Key"
                    : "Invalid Key"}
            </span>
            {wallet.hasFunds && <span className="hero-funded-pill">💰 Funded Asset</span>}
          </div>

          <div className="hero-actions-toolbar">
            <button
              type="button"
              className="btn-hero-action btn-hero-scan"
              onClick={scan}
              disabled={!walletHasScanTarget(wallet) || scanning}
            >
              <IconScan size={13} />
              <span>{scanning ? "Scanning…" : "Rescan"}</span>
            </button>
            <button
              type="button"
              className="btn-hero-action btn-hero-delete"
              onClick={() => removeWallet(wallet.id)}
              title="Remove wallet from vault"
            >
              Delete
            </button>
          </div>
        </div>

        {/* 2-Column Split: Public Address (Left) & Vault Secret (Right) */}
        <div className="hero-credentials-grid">
          <div className="credential-box">
            <div className="credential-label">{isSol ? "SOLANA PUBLIC ADDRESS" : "EVM PUBLIC ADDRESS"}</div>
            <div className="credential-content">
              <span className="credential-val mono" onClick={copyAddr} title="Click to copy full address">
                {displayAddr ?? "Invalid address"}
              </span>
              <button type="button" className="btn-credential-copy" onClick={copyAddr}>
                Copy
              </button>
            </div>
          </div>

          <div className="credential-box">
            <div className="credential-label">
              {wallet.type === "seed" ? "MASTER SEED & DERIVED PRIVATE KEY" : "VAULT SECRET ENCRYPTION"}
            </div>
            <div className="credential-content-multi">
              <div className="credential-secret-row">
                <div className="secret-meta-col">
                  <span className="secret-type-lbl mono">{wallet.type === "seed" ? "Mnemonic Seed:" : "Private Key:"}</span>
                  <span className="credential-val mono secret-val">
                    {revealed && secret ? secret : "••••••••••••••••••••••••••••"}
                  </span>
                </div>
                <div className="credential-actions">
                  <button type="button" className="btn-credential-reveal" onClick={toggleReveal}>
                    {revealed ? "🔒 Hide" : "👁️ Reveal"}
                  </button>
                  {revealed && secret && (
                    <button type="button" className="btn-credential-copy" onClick={copySecret}>
                      Copy {wallet.type === "seed" ? "Seed" : "PK"}
                    </button>
                  )}
                </div>
              </div>

              {/* Derived Child Private Key (Always available if Seed Phrase) */}
              {wallet.type === "seed" && revealed && derivedPk && (
                <div className="credential-secret-row derived-row">
                  <div className="secret-meta-col">
                    <span className="secret-type-lbl mono text-emerald">Child Private Key (Account #0):</span>
                    <span className="credential-val mono secret-val text-emerald">
                      {derivedPk}
                    </span>
                  </div>
                  <div className="credential-actions">
                    <button
                      type="button"
                      className="btn-credential-copy btn-copy-pk"
                      onClick={() => {
                        navigator.clipboard.writeText(derivedPk);
                        toast("Derived Private Key copied to clipboard", "success");
                      }}
                    >
                      Copy PK
                    </button>
                  </div>
                </div>
              )}
            </div>
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

      {/* 3. Conditional Mode Views */}
      {activeTab === "sweeper" ? (
        <SweeperWorkspace onBack={() => setActiveTab("portfolio")} />
      ) : activeTab === "dex" ? (
        <DexBatchTrader wallet={wallet} />
      ) : activeTab === "explorer" ? (
        <WalletActivityExplorer wallet={wallet} />
      ) : (
        <>
          {/* Module B: Native Chain Balance Grid */}
          <div className="balance-section">
            <div className="balance-section-head">
              <h4 className="balance-section-title">
                {isSol ? "NATIVE SOLANA BALANCE" : "MULTI-CHAIN NATIVE BALANCES"}
              </h4>
              <span className="balance-section-hint">Realtime RPC Gas Reserves</span>
            </div>
            <div className="balance-cards">
              {walletChains.map((c) => (
                <BalanceCard key={c.key} chain={c} value={wallet.balances[c.key]} />
              ))}
            </div>
          </div>

          {/* Module C: Detected Token Holdings */}
          <div className="balance-section token-section">
            <div className="token-section-header">
              <h4 className="balance-section-title">
                DETECTED TOKEN HOLDINGS {wallet.tokens ? `(${wallet.tokens.length})` : "(0)"}
              </h4>
              <span className="token-section-subtitle">ERC-20 & SPL Tokens</span>
            </div>

            {wallet.tokens && wallet.tokens.length > 0 ? (
              <div className="token-cards-grid">
                {wallet.tokens.map((tok, idx) => (
                  <div key={`${tok.chain}-${tok.symbol}-${idx}`} className="token-card">
                    <div className="token-card-top">
                      <span className="token-symbol" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <ChainIcon chain={tok.symbol} size={15} />
                        {tok.symbol}
                      </span>
                      <span className={`token-chain-badge chain-${tok.chain}`}>{tok.chain.toUpperCase()}</span>
                    </div>
                    <div className="token-card-name">{tok.name}</div>
                    <div className="token-card-balance mono">{tok.balance}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="token-empty-notice">
                <span className="notice-icon">🪙</span>
                <span>No secondary ERC-20 or SPL tokens detected on this wallet. Native balances are monitored above.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
