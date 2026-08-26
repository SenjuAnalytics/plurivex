import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { balanceAmount, chainsForWallet, formatCompactBalance, type Chain } from "../lib/chains";
import type { WalletView } from "../lib/types";
import { isSolanaWallet, walletDisplayAddress, walletHasScanTarget } from "../lib/wallet";
import { IconScan, ChainIcon } from "../icons";

function BalanceCard({ chain, value }: { chain: Chain; value: string | null }) {
  const num = value && value !== "loading" && value !== "error" ? balanceAmount(value) : 0;
  const state = value === "loading" ? "loading" : value === "error" ? "error" : num > 0 ? "positive" : "zero";

  return (
    <div className={`bal-card bal-${chain.key}`} style={{ "--chain-color": chain.color } as React.CSSProperties}>
      <div className="bal-card-top">
        <div className="bal-card-chain-meta">
          <ChainIcon chain={chain.key} size={18} />
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
    toggleSweepSelection,
    selectedSweepIds,
    setIsSweepModalOpen,
  } = useApp();
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

  const handleSweepThisWallet = () => {
    if (!selectedSweepIds.has(wallet.id)) {
      toggleSweepSelection(wallet.id);
    }
    setIsSweepModalOpen(true);
  };

  const badgeClass =
    wallet.type === "seed"
      ? "badge-seed"
      : wallet.type === "pk"
        ? "badge-pk"
        : wallet.type === "sol_pk"
          ? "badge-sol"
          : "badge-invalid";

  return (
    <div className={`detail-card${wallet.hasFunds ? " has-funds" : ""}`}>
      {/* Module A: Identity & Security Hero */}
      <div className="detail-hero">
        <div className="detail-hero-bg" aria-hidden />
        <div className="detail-hero-content">
          <div className="detail-hero-left">
            <div className="detail-meta-row">
              <span className={`badge ${badgeClass}`}>
                {wallet.type === "seed"
                  ? "BIP-39 Mnemonic Seed"
                  : wallet.type === "pk"
                    ? "EVM Private Key"
                    : wallet.type === "sol_pk"
                      ? "Solana Private Key"
                      : "Invalid Key"}
              </span>
              {wallet.hasFunds && <span className="funded-badge">💰 Funded Asset</span>}
            </div>

            <div className="detail-address-label">{isSol ? "SOLANA PUBLIC ADDRESS" : "EVM PUBLIC ADDRESS"}</div>
            <div className="detail-address-box">
              <span className="detail-address mono" onClick={copyAddr} title="Click to copy address">
                {displayAddr ?? "Invalid address"}
              </span>
              <button type="button" className="btn-copy-mini" onClick={copyAddr} title="Copy full address">
                Copy
              </button>
            </div>

            <div className="detail-secret-box">
              <span className="secret-label">VAULT SECRET:</span>
              <span className="detail-secret mono">
                {revealed && secret ? secret : "••••••••••••••••••••••••••••••••••••••••••••••••"}
              </span>
              <div className="secret-actions">
                <button type="button" className="btn-reveal-mini" onClick={toggleReveal}>
                  {revealed ? "🔒 Hide" : "👁️ Reveal"}
                </button>
                {revealed && secret && (
                  <button type="button" className="btn-copy-mini" onClick={copySecret}>
                    Copy Key
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="detail-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleSweepThisWallet} title="Sweep funds from this wallet">
              ⚡ Sweep
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={scan}
              disabled={!walletHasScanTarget(wallet) || scanning}
            >
              <IconScan size={14} />
              {scanning ? "Scanning…" : "Rescan"}
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={() => removeWallet(wallet.id)}
              title="Remove wallet from vault"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
