import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { balanceAmount, chainsForWallet, type Chain } from "../lib/chains";
import type { WalletView } from "../lib/types";
import { isSolanaWallet, walletDisplayAddress, walletHasScanTarget } from "../lib/wallet";
import { IconScan, IconEth } from "./Icons";

function BalanceCard({ chain, value }: { chain: Chain; value: string | null }) {
  const num = value && value !== "loading" && value !== "error" ? balanceAmount(value) : 0;
  const state = value === "loading" ? "loading" : value === "error" ? "error" : num > 0 ? "positive" : "zero";

  return (
    <div className={`bal-card bal-${chain.key}`} style={{ "--chain-color": chain.color } as React.CSSProperties}>
      <div className="bal-card-top">
        {chain.key === "eth" ? (
          <IconEth size={16} />
        ) : (
          <span className="bal-card-dot" />
        )}
        <span className="bal-card-name">{chain.label}</span>
      </div>
      <div className={`bal-card-val ${state}`}>
        {value === "loading" && <span className="bal-spinner" />}
        {value === "error" && "Failed"}
        {value && value !== "loading" && value !== "error" && value}
        {!value && <span className="bal-pending">Not scanned</span>}
      </div>
    </div>
  );
}

export function WalletDetail({ wallet }: { wallet: WalletView }) {
  const { scanOne, removeWallet, revealSecret, toast } = useApp();
  const [revealed, setRevealed] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setSecret(null);
    setScanning(false);
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
    toast("Address copied", "success");
  };

  const scan = async () => {
    setScanning(true);
    await scanOne(wallet.id);
    setScanning(false);
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
      <div className="detail-hero">
        <div className="detail-hero-bg" aria-hidden />
        <div className="detail-hero-content">
          <div className="detail-hero-left">
            <span className={`badge ${badgeClass}`}>
              {wallet.type === "seed"
                ? "seed phrase"
                : wallet.type === "pk"
                  ? "private key"
                  : wallet.type === "sol_pk"
                    ? "Solana key"
                    : "invalid"}
            </span>
            {wallet.hasFunds && <span className="funded-badge">Funded</span>}
            <div className="detail-address-label">{isSol ? "Solana Address" : "EVM Address"}</div>
            <div className="detail-address mono">{displayAddr ?? "Invalid address"}</div>
            <div className="detail-secret mono">
              {revealed && secret ? secret : "••••••••••••••••••••••••••••"}
            </div>
          </div>
          <div className="detail-actions">
            <button className="btn btn-ghost btn-sm" onClick={copyAddr} disabled={!displayAddr}>Copy</button>
            <button className="btn btn-ghost btn-sm" onClick={toggleReveal}>
              {revealed ? "Hide" : "Reveal"}
            </button>
            <button className="btn btn-primary btn-sm" onClick={scan} disabled={!walletHasScanTarget(wallet) || scanning}>
              <IconScan size={14} />
              {scanning ? "…" : "Scan"}
            </button>
            <button className="btn btn-danger-ghost btn-sm" onClick={() => removeWallet(wallet.id)}>Delete</button>
          </div>
        </div>
      </div>
      <div className="balance-section">
        <h4 className="balance-section-title">
          {isSol ? "Solana Balance (Native)" : "Multi-Chain EVM Balance (Native)"}
        </h4>
        <div className="balance-cards">
          {walletChains.map((c) => (
            <BalanceCard key={c.key} chain={c} value={wallet.balances[c.key]} />
          ))}
        </div>
      </div>

      {wallet.tokens && wallet.tokens.length > 0 && (
        <div className="balance-section token-section">
          <div className="token-section-header">
            <h4 className="balance-section-title">
              Token Balances ({wallet.tokens.length})
            </h4>
            <span className="token-section-subtitle">Detected ERC-20 & SPL Tokens</span>
          </div>
          <div className="token-cards-grid">
            {wallet.tokens.map((tok, idx) => (
              <div key={`${tok.chain}-${tok.symbol}-${idx}`} className="token-card">
                <div className="token-card-top">
                  <span className="token-symbol" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {(tok.symbol === "WETH" || tok.symbol === "ETH") && <IconEth size={14} />}
                    {tok.symbol}
                  </span>
                  <span className={`token-chain-badge chain-${tok.chain}`}>{tok.chain.toUpperCase()}</span>
                </div>
                <div className="token-card-name">{tok.name}</div>
                <div className="token-card-balance">{tok.balance}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}