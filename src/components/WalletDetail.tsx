import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../context/AppContext";
import { balanceAmount, chainsForWallet, formatCompactBalance, type Chain } from "../lib/chains";
import type { WalletView } from "../lib/types";
import {
  deriveDualCredentials,
  walletHasScanTarget,
  shortAddr,
} from "../lib/wallet";
import { IconScan, ChainIcon, IconChartPie, IconZap, IconRefresh, IconHistory, IconEye, IconLock, IconSprout, IconAlertTriangle, IconCheckCircle, IconCoin } from "../icons";
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

interface SolanaAccountDetails {
  exists: boolean;
  owner: string;
  owner_label: string;
  is_system_program: boolean;
  account_type: string;
  authority?: string | null;
  token_mint?: string | null;
  lamports: number;
  sol_balance: number;
  executable: boolean;
  space: number;
}

export function WalletDetail({ wallet }: { wallet: WalletView }) {
  const {
    removeWallet,
    revealSecret,
    scanOne,
    toast,
    setWalletLabel,
  } = useApp();
  const [activeTab, setActiveTab] = useState<DetailMode>("portfolio");
  const [revealed, setRevealed] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [tagInput, setTagInput] = useState(wallet.label || "");
  const [solAccount, setSolAccount] = useState<SolanaAccountDetails | null>(null);
  const [loadingSolAccount, setLoadingSolAccount] = useState(false);
  const [solAccountError, setSolAccountError] = useState<string | null>(null);

  useEffect(() => {
    setRevealed(false);
    setSecret(null);
    setIsEditingTag(false);
    setTagInput(wallet.label || "");
  }, [wallet.id, wallet.label]);

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

  const dualCreds = useMemo(() => {
    if (!secret) return null;
    return deriveDualCredentials(secret, wallet.type);
  }, [secret, wallet.type]);

  const evmAddr = wallet.address || dualCreds?.evmAddress;
  const solAddr = wallet.solAddress || dualCreds?.solAddress;
  const evmPk = dualCreds?.evmPrivateKey;
  const solPk = dualCreds?.solPrivateKey;
  const isSol = Boolean(wallet.solAddress && !wallet.address);

  const fetchSolAccount = useCallback(() => {
    if (!solAddr) {
      setSolAccount(null);
      setSolAccountError(null);
      return;
    }
    setLoadingSolAccount(true);
    setSolAccountError(null);

    invoke<SolanaAccountDetails>("get_solana_account_details", { address: solAddr })
      .then((data) => {
        setSolAccount(data);
        setSolAccountError(null);
        setLoadingSolAccount(false);
      })
      .catch((err) => {
        console.error("Failed to get solana account details:", err);
        setSolAccount(null);
        setSolAccountError(String(err));
        setLoadingSolAccount(false);
      });
  }, [solAddr]);

  useEffect(() => {
    fetchSolAccount();
  }, [fetchSolAccount]);

  const walletChains = chainsForWallet(wallet);

  const copyEvmAddr = () => {
    if (!evmAddr) return;
    navigator.clipboard.writeText(evmAddr);
    toast("EVM Address copied to clipboard", "success");
  };

  const copySolAddr = () => {
    if (!solAddr) return;
    navigator.clipboard.writeText(solAddr);
    toast("Solana Address copied to clipboard", "success");
  };

  const copyEvmPk = () => {
    if (!evmPk) return;
    navigator.clipboard.writeText(evmPk);
    toast("EVM Private Key copied to clipboard", "success");
  };

  const copySolPk = () => {
    if (!solPk) return;
    navigator.clipboard.writeText(solPk);
    toast("Solana Private Key copied to clipboard", "success");
  };

  const copySeed = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    toast("Master Seed Phrase copied to clipboard", "success");
  };

  const saveTag = () => {
    setWalletLabel(wallet.id, tagInput.trim() || null);
    setIsEditingTag(false);
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
              {wallet.type === "seed"
                ? "DUAL BIP-39 SEED"
                : wallet.type === "pk"
                  ? "DUAL EVM + SOLANA KEY"
                  : "SOLANA KEY"}
            </span>
            {wallet.hasFunds && <span className="hero-funded-pill">Funded Asset</span>}

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
                    className={`tag-display-btn ${wallet.label ? `tag-${wallet.label.toLowerCase()}` : "tag-none"}`}
                    onClick={() => { setTagInput(wallet.label || ""); setIsEditingTag(true); }}
                    title="Click to edit label"
                  >
                    {wallet.label ? wallet.label : "+ Add Tag"}
                  </button>
                  {["Main", "Airdrop", "Whales", "Burner"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`tag-preset-chip ${wallet.label?.toLowerCase() === p.toLowerCase() ? "active" : ""}`}
                      onClick={() => setWalletLabel(wallet.id, wallet.label?.toLowerCase() === p.toLowerCase() ? null : p)}
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
              className="btn-hero-action btn-hero-scan"
              onClick={scan}
              disabled={!walletHasScanTarget(wallet) || scanning}
            >
              <IconScan size={13} />
              <span>{scanning ? "Scanning…" : "Rescan All"}</span>
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

        {/* 2-Column Split: EVM Identity (Left) & Solana Identity (Right) */}
        <div className="hero-credentials-grid">
          {/* EVM Credentials Box */}
          <div className="credential-box evm-box">
            <div className="credential-header-bar">
              <span className="credential-label">EVM IDENTITY (0x ADDRESS)</span>
              {evmAddr && (
                <button type="button" className="btn-credential-action" onClick={copyEvmAddr}>
                  Copy 0x
                </button>
              )}
            </div>
            <div className="credential-body">
              <div className="credential-row">
                <span className="credential-sub-lbl mono">Address:</span>
                <span className="credential-val mono" onClick={copyEvmAddr} title="Click to copy EVM address">
                  {evmAddr ?? "Not derived"}
                </span>
              </div>
              <div className="credential-row">
                <span className="credential-sub-lbl mono">Private Key:</span>
                <span className="credential-val mono secret-val">
                  {revealed && evmPk ? evmPk : "••••••••••••••••••••••••••••••••"}
                </span>
                {revealed && evmPk && (
                  <button type="button" className="btn-credential-action" onClick={copyEvmPk}>
                    Copy PK
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Solana Credentials Box */}
          <div className="credential-box sol-box">
            <div className="credential-header-bar">
              <span className="credential-label">SOLANA IDENTITY (BASE58)</span>
              {solAddr && (
                <button type="button" className="btn-credential-action" onClick={copySolAddr}>
                  Copy Sol
                </button>
              )}
            </div>
            <div className="credential-body">
              <div className="credential-row">
                <span className="credential-sub-lbl mono">Address:</span>
                <span className="credential-val mono" onClick={copySolAddr} title="Click to copy Solana address">
                  {solAddr ?? "Not derived"}
                </span>
              </div>
              <div className="credential-row">
                <span className="credential-sub-lbl mono">Secret Key:</span>
                <span className="credential-val mono secret-val">
                  {revealed && solPk ? solPk : "••••••••••••••••••••••••••••••••"}
                </span>
                {revealed && solPk && (
                  <button type="button" className="btn-credential-action" onClick={copySolPk}>
                    Copy Sol PK
                  </button>
                )}
              </div>

              {/* On-chain account analysis is a distinct concern from identity/keys above — own sub-section so it doesn't read as "just another credential row" */}
              <div className="sol-account-analysis">
                <span className="sol-account-analysis-title">ON-CHAIN ACCOUNT ANALYSIS</span>
                <div className="credential-row sol-owner-credential-row">
                <span className="credential-sub-lbl mono">Account Owner:</span>
                {loadingSolAccount ? (
                <span className="credential-val mono text-muted text-xs">Querying Solana on-chain validator…</span>
                ) : solAccountError ? (
                <div className="sol-owner-row">
                <span className="credential-val mono text-danger text-xs"><IconAlertTriangle size={12} /> Query failed: {solAccountError}</span>
                <button type="button" className="btn-credential-action" onClick={fetchSolAccount}>
                Retry
                </button>
                </div>
                ) : solAccount ? (
                <div className="sol-owner-row">
                <span
                className={`sol-owner-badge ${
                solAccount.is_system_program
                ? "badge-sys-safe"
                : "badge-non-sys-warn"
                }`}
                >
                {solAccount.is_system_program ? (
                <><IconCheckCircle size={11} /> System Program (Standard EOA)</>
                ) : (
                    <><IconAlertTriangle size={11} /> {solAccount.owner_label}</>
                      )}
                    </span>
                    <span
                      className="sol-owner-id-code mono"
                      title={`Owner Program ID: ${solAccount.owner}`}
                    >
                      {solAccount.owner}
                    </span>
                    <button
                      type="button"
                      className="btn-credential-action btn-copy-owner-id"
                      onClick={() => {
                        navigator.clipboard.writeText(solAccount.owner);
                        toast("Owner Program ID copied to clipboard", "success");
                      }}
                      title={`Copy full owner Program ID: ${solAccount.owner}`}
                    >
                      Copy ID
                    </button>
                  </div>
                ) : null}
                </div>

                {solAccount && solAccount.authority && (
                <div className="credential-row">
                  <span className="credential-sub-lbl mono">
                    {solAccount.account_type === "nonce_account" ? "Nonce Authority:" : "Token Owner (Authority):"}
                  </span>
                  <div className="sol-owner-row">
                    <span className="sol-owner-id-code mono" title={solAccount.authority}>
                      {solAccount.authority}
                    </span>
                    <button
                      type="button"
                      className="btn-credential-action btn-copy-owner-id"
                      onClick={() => {
                        navigator.clipboard.writeText(solAccount.authority!);
                        toast("Authority address copied to clipboard", "success");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                )}

                {solAccount && solAccount.token_mint && (
                <div className="credential-row">
                  <span className="credential-sub-lbl mono">Token Mint:</span>
                  <div className="sol-owner-row">
                    <span className="sol-owner-id-code mono" title={solAccount.token_mint}>
                      {solAccount.token_mint}
                    </span>
                    <button
                      type="button"
                      className="btn-credential-action btn-copy-owner-id"
                      onClick={() => {
                        navigator.clipboard.writeText(solAccount.token_mint!);
                        toast("Token Mint copied to clipboard", "success");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                )}

                {solAccount && !solAccount.is_system_program && (
                <div className="sol-non-standard-alert">
                  {solAccount.account_type === "nonce_account" ? (
                    <>
                      <b>Durable Nonce Account:</b> Akun ini adalah akun Durable Nonce (ukuran 80 byte). Saldo {solAccount.sol_balance} SOL di dalamnya adalah dana sewa (rent reserve). Transfer native standar akan ditolak validator. Penarikan saldo dapat dilakukan via instruksi <code>nonceWithdraw</code> dengan tanda tangan dari Nonce Authority ({solAccount.authority ? shortAddr(solAccount.authority) : "tertera di atas"}).
                    </>
                  ) : solAccount.account_type === "token_account" ? (
                    <>
                      <b>SPL Token Account (ATA):</b> Akun ini adalah Token Account / Wrapped SOL. Penarikan saldo sewa SOL memerlukan penutupan akun token via instruksi <code>closeAccount</code> dari Token Program.
                    </>
                  ) : (
                    <>
                      <b>Custom Program Account:</b> Akun ini dikelola oleh program <code>{solAccount.owner}</code>. Transfer native standar tidak dapat mendebit dana secara langsung.
                    </>
                  )}
                </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BIP-39 Master Mnemonic Banner (If wallet is seed phrase) */}
        {wallet.type === "seed" && (
          <div className="mnemonic-seed-banner">
            <div className="mnemonic-meta">
              <span className="mnemonic-title mono"><IconSprout size={12} /> BIP-39 MASTER SEED PHRASE</span>
              <span className="mnemonic-content mono">
                {revealed && secret ? secret : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
              </span>
            </div>
            <div className="mnemonic-actions">
              <button type="button" className="btn-credential-reveal" onClick={toggleReveal}>
                {revealed ? <><IconLock size={12} /> Hide Vault Secrets</> : <><IconEye size={12} /> Reveal All Secrets</>}
              </button>
              {revealed && secret && (
                <button type="button" className="btn-credential-copy-seed" onClick={copySeed}>
                  Copy Seed
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reveal Bar for PK Wallets */}
        {wallet.type !== "seed" && (
          <div className="pk-reveal-bar">
            <button type="button" className="btn-credential-reveal" onClick={toggleReveal}>
              {revealed ? <><IconLock size={12} /> Hide Vault Keys</> : <><IconEye size={12} /> Reveal Private Keys</>}
            </button>
          </div>
        )}
        
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
                <span className="notice-icon"><IconCoin size={16} /></span>
                <span>No secondary ERC-20 or SPL tokens detected on this wallet. Native balances are monitored above.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
