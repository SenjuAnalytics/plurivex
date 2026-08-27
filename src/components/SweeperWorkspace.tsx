import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  SWEEP_CHAINS,
  fetchLiveFeeData,
  estimateWalletSweep,
  executeSweepSingle,
  type WalletSweepEstimate,
  type SweepTxResult,
} from "../lib/sweeper";
import { formatCompactBalance } from "../lib/chains";
import { isEvmWallet, isSolanaWallet, shortAddr } from "../lib/wallet";
import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { ChainIcon } from "../icons";

function isValidSolAddress(addr: string): boolean {
  try {
    const pub = new PublicKey(addr.trim());
    return PublicKey.isOnCurve(pub.toBuffer());
  } catch {
    return false;
  }
}

function getWalletTargetAddr(w: { address: string | null; solAddress: string | null }, isEvm: boolean): string {
  return (isEvm ? w.address : (w.solAddress || w.address)) ?? "";
}

export function SweeperWorkspace({ onBack }: { onBack?: () => void }) {
  const {
    wallets,
    selectedSweepIds,
    selectAllFunded,
    revealSecret,
    scanAll,
    toast,
  } = useApp();

  const [chainKey, setChainKey] = useState<string>("bsc");
  const [recipient, setRecipient] = useState<string>("");
  const [gasPriceGwei, setGasPriceGwei] = useState<number>(1.2);
  const [gasMode, setGasMode] = useState<"standard" | "fast" | "turbo" | "custom">("standard");
  const [customGwei, setCustomGwei] = useState<string>("1.5");
  const [liveFeeGwei, setLiveFeeGwei] = useState<number>(1.2);
  const [loadingEstimates, setLoadingEstimates] = useState<boolean>(false);
  const [estimates, setEstimates] = useState<Record<number, WalletSweepEstimate>>({});
  const [sweeping, setSweeping] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number; msg: string } | null>(null);
  const [txResults, setTxResults] = useState<Record<number, SweepTxResult>>({});

  const activeChain = SWEEP_CHAINS[chainKey] || SWEEP_CHAINS.bsc;

  const isEvmChain = chainKey !== "sol";

  // Target wallets: STRICTLY selected wallets that match the active network family (EVM vs SOL)
  const targetWallets = useMemo(() => {
    if (selectedSweepIds.size === 0) return [];
    return wallets.filter((w) => {
      if (!selectedSweepIds.has(w.id)) return false;
      if (isEvmChain) {
        return isEvmWallet(w.type) && !!w.address;
      } else {
        return isSolanaWallet(w.type) && !!w.solAddress;
      }
    });
  }, [wallets, selectedSweepIds, isEvmChain]);

  const activeFamilyFundedCount = useMemo(() => {
    return wallets.filter((w) => w.hasFunds && (isEvmChain ? isEvmWallet(w.type) : isSolanaWallet(w.type))).length;
  }, [wallets, isEvmChain]);

  // Load live fee data when chain changes
  useEffect(() => {
    let active = true;
    fetchLiveFeeData(chainKey)
      .then((data) => {
        if (!active) return;
        setLiveFeeGwei(data.gasPriceGwei);
        setGasPriceGwei(data.gasPriceGwei);
      })
      .catch((err) => console.warn("Failed fetching fee data:", err));
    return () => {
      active = false;
    };
  }, [chainKey]);

  // Estimate balances and net amounts
  useEffect(() => {
    if (targetWallets.length === 0) return;
    let active = true;
    setLoadingEstimates(true);

    const runEstimates = async () => {
      const results: Record<number, WalletSweepEstimate> = {};
      for (const w of targetWallets) {
        const addr = getWalletTargetAddr(w, isEvmChain);
        if (!addr) continue;
        const est = await estimateWalletSweep(w.id, addr, chainKey, gasPriceGwei);
        if (!active) return;
        results[w.id] = est;
      }
      if (active) {
        setEstimates(results);
        setLoadingEstimates(false);
      }
    };

    runEstimates();
    return () => {
      active = false;
    };
  }, [chainKey, gasPriceGwei, targetWallets]);

  const validRecipient = isEvmChain ? ethers.utils.isAddress(recipient.trim()) : isValidSolAddress(recipient);
  const sweepableWallets = targetWallets.filter((w) => estimates[w.id]?.isSweepable);
  const totalNetFormatted = useMemo(() => {
    if (sweepableWallets.length === 0) return `0 ${activeChain.symbol}`;
    if (chainKey === "sol") {
      const totalLamports = sweepableWallets.reduce((acc, w) => {
        const est = estimates[w.id];
        return est ? acc + BigInt(est.netWei.toString()) : acc;
      }, 0n);
      return `${(Number(totalLamports) / 1e9).toFixed(6)} SOL`;
    }
    const totalNetWei = sweepableWallets.reduce((acc, w) => {
      const est = estimates[w.id];
      return est ? acc.add(est.netWei) : acc;
    }, ethers.BigNumber.from(0));
    return `${Number(ethers.utils.formatEther(totalNetWei)).toFixed(6)} ${activeChain.symbol}`;
  }, [sweepableWallets, estimates, chainKey, activeChain]);

  const handleStartSweep = async () => {
    if (!validRecipient) {
      toast(isEvmChain ? "Please enter a valid EVM destination address (0x...)" : "Please enter a valid Solana Base58 destination address", "error");
      return;
    }
    if (sweepableWallets.length === 0) {
      toast("No sweepable wallets found for this network (balances are lower than gas fee)", "error");
      return;
    }

    setSweeping(true);
    const results: Record<number, SweepTxResult> = {};
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < sweepableWallets.length; i++) {
      const w = sweepableWallets[i];
      setSweepProgress({
        current: i + 1,
        total: sweepableWallets.length,
        msg: `Broadcasting from wallet ${shortAddr(getWalletTargetAddr(w, isEvmChain))}...`,
      });

      const secret = await revealSecret(w.id);
      if (!secret) {
        results[w.id] = { walletId: w.id, address: getWalletTargetAddr(w, isEvmChain), success: false, error: "Failed to decrypt key" };
        failCount++;
        continue;
      }

      const res = await executeSweepSingle(
        w.id,
        secret,
        w.type,
        chainKey,
        recipient.trim(),
        gasPriceGwei,
      );

      results[w.id] = res;
      if (res.success) {
        successCount++;
      } else {
        failCount++;
      }
      setTxResults({ ...results });
    }

    setSweeping(false);
    setSweepProgress(null);

    if (successCount > 0) {
      toast(`Successfully swept funds from ${successCount} wallets!`, "success");
      scanAll();
    }
    if (failCount > 0) {
      toast(`${failCount} transactions failed to broadcast`, "error");
    }
  };

  return (
    <div className="sweeper-workspace-panel">
      {/* 1. Header Banner */}
      <div className="sweeper-hero-header">
        <div className="sweeper-title-wrap">
          <div className="sweeper-badge">VAULT CONSOLIDATION ENGINE</div>
          <h2>Fund Sweeper</h2>
          <p>Consolidate native liquid balances (BNB, ETH, SOL) from multiple sub-wallets directly into your designated master cold storage address.</p>
        </div>
        {onBack && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Back to Portfolio
          </button>
        )}
      </div>

            {/* 2. Step 1: Configuration Form */}
      <div className="sweeper-control-deck">
        {/* Row 1: Network Selection Bar */}
        <div className="sweeper-network-row">
          <span className="network-row-label">1. SELECT BLOCKCHAIN NETWORK:</span>
          <div className="network-pills-wrap">
            {Object.values(SWEEP_CHAINS).map((c) => (
              <button
                key={c.key}
                type="button"
                className={`network-pill-btn ${chainKey === c.key ? "active" : ""}`}
                onClick={() => setChainKey(c.key)}
              >
                <ChainIcon chain={c.key} size={16} />
                <span className="net-pill-name">{c.name.split(" ")[0]}</span>
                <span className="net-pill-badge mono">{c.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: 2-Column Split: Master Destination (62%) & Gas Presets (38%) */}
                {/* Row 2: 2-Column Split: Master Destination (60%) & Gas Presets (40%) */}
        <div className="sweeper-inputs-row">
          {/* Destination Vault Input */}
          <div className="sweeper-deck-col col-recipient">
            <div className="deck-col-header">
              <span className="deck-col-label">2. MASTER DESTINATION RECIPIENT ADDRESS</span>
              {recipient ? (
                <span className={`deck-val-badge ${validRecipient ? "valid" : "invalid"}`}>
                  {validRecipient ? (isEvmChain ? "✓ Valid EVM Address" : "✓ Valid Solana Address") : (isEvmChain ? "✕ Invalid 0x Address" : "✕ Invalid Solana Address")}
                </span>
              ) : (
                <span className="deck-hint">Consolidation vault destination</span>
              )}
            </div>
            <div className="deck-input-wrap">
              <input
                type="text"
                className="deck-input-field mono"
                placeholder={isEvmChain ? "Paste destination 0x address (e.g. from Binance, OKX, Ledger, Safe)" : "Paste destination Solana address (e.g. from Phantom, Backpack, Binance)"}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={sweeping}
              />
              {recipient && (
                <button
                  type="button"
                  className="deck-clear-btn"
                  onClick={() => setRecipient("")}
                  title="Clear input"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Gas Engine Speed Presets */}
          {isEvmChain ? (
            <div className="sweeper-deck-col col-gas">
              <div className="deck-col-header">
                <span className="deck-col-label">3. GAS ENGINE SPEED ({gasPriceGwei.toFixed(2)} GWEI)</span>
                <span className="deck-gas-live mono">
                  <span className="live-dot" /> Live: {liveFeeGwei.toFixed(2)} Gwei
                </span>
              </div>
              <div className="gas-segmented-bar">
                <button
                  type="button"
                  className={`gas-seg-btn ${gasMode === "standard" ? "active" : ""}`}
                  onClick={() => {
                    setGasMode("standard");
                    setGasPriceGwei(Number(liveFeeGwei.toFixed(2)));
                  }}
                  disabled={sweeping}
                  title={`Standard network gas (${liveFeeGwei.toFixed(2)} Gwei)`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={`gas-seg-btn ${gasMode === "fast" ? "active" : ""}`}
                  onClick={() => {
                    setGasMode("fast");
                    setGasPriceGwei(Number((liveFeeGwei * 1.25).toFixed(2)));
                  }}
                  disabled={sweeping}
                  title={`Fast priority gas (${(liveFeeGwei * 1.25).toFixed(2)} Gwei)`}
                >
                  Fast ⚡
                </button>
                <button
                  type="button"
                  className={`gas-seg-btn ${gasMode === "turbo" ? "active" : ""}`}
                  onClick={() => {
                    setGasMode("turbo");
                    setGasPriceGwei(Number((liveFeeGwei * 2.0).toFixed(2)));
                  }}
                  disabled={sweeping}
                  title={`Turbo priority gas (${(liveFeeGwei * 2.0).toFixed(2)} Gwei)`}
                >
                  Turbo 🚀
                </button>
                {gasMode === "custom" ? (
                  <div className="gas-custom-inline">
                    <input
                      type="number"
                      step="0.01"
                      min="0.001"
                      className="gas-custom-num mono"
                      value={customGwei}
                      onChange={(e) => {
                        setCustomGwei(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (Number.isFinite(val) && val > 0) {
                          setGasPriceGwei(val);
                        }
                      }}
                      autoFocus
                      placeholder="Gwei"
                    />
                    <span className="gas-custom-lbl">G</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="gas-seg-btn"
                    onClick={() => {
                      setGasMode("custom");
                      const parsed = parseFloat(customGwei);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        setGasPriceGwei(parsed);
                      }
                    }}
                    disabled={sweeping}
                    title="Enter custom Gwei manually"
                  >
                    Custom ✏️
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="sweeper-deck-col col-gas">
              <div className="deck-col-header">
                <span className="deck-col-label">3. SOLANA NETWORK TRANSACTION FEE</span>
                <span className="deck-gas-live mono text-emerald">● Fixed Protocol Fee</span>
              </div>
              <div className="gas-segmented-bar sol-fee-container">
                <span className="sol-fee-text mono">0.000005 SOL (5,000 Lamports · Fixed Fast)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Step 2: Target Wallets Matrix */}
      <div className="sweeper-wallets-section">
        <div className="sweeper-section-header">
          <div className="section-title-box">
            <h4>FUNDED TARGET WALLETS ({targetWallets.length})</h4>
            <span className="section-sub">
              {loadingEstimates
                ? "Calculating realtime gas & net proceeds…"
                : `${sweepableWallets.length} of ${targetWallets.length} wallets ready to sweep`}
            </span>
          </div>
        </div>

        {targetWallets.length === 0 ? (
          <div className="sweeper-empty-notice">
            <span className="notice-icon">👈</span>
            <div className="empty-notice-text">
              <strong>No Wallets Selected for Sweeper</strong>
              <p>
                Please check/select the wallets you want to sweep from the <b>Wallets Directory</b> on the left sidebar, or{" "}
                <button type="button" className="btn-inline-link" onClick={() => selectAllFunded(isEvmChain ? "evm" : "sol")}>
                  Select All Funded {isEvmChain ? "EVM" : "Solana"} Wallets ({activeFamilyFundedCount})
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div className="sweeper-table-wrap scrollable">
            <table className="sweeper-table">
              <thead>
                <tr>
                  <th style={{ width: 54, textAlign: "center" }}>#</th>
                  <th>Wallet Address</th>
                  <th>Gross Balance</th>
                  <th>Estimated Gas</th>
                  <th>Net Yield to Master</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {targetWallets.map((w, idx) => {
                  const est = estimates[w.id];
                  const res = txResults[w.id];

                  return (
                    <tr
                      key={w.id}
                      className={`sweeper-row ${est?.isSweepable ? "sweepable" : "zero"}`}
                    >
                      <td style={{ width: 54, textAlign: "center" }} className="mono text-muted">
                        #{String(idx + 1).padStart(2, "0")}
                      </td>
                      <td>
                        <span className="wallet-addr mono">{getWalletTargetAddr(w, isEvmChain) ? shortAddr(getWalletTargetAddr(w, isEvmChain)) : "invalid"}</span>
                      </td>
                      <td className="mono">{est ? formatCompactBalance(est.balanceFormatted) : "…"}</td>
                      <td className="mono text-muted">{est ? formatCompactBalance(est.feeFormatted) : "…"}</td>
                      <td className="mono bold text-emerald">
                        {est ? (est.isSweepable ? formatCompactBalance(est.netFormatted) : "0 (Dust < Gas)") : "…"}
                      </td>
                      <td>
                        {res ? (
                          res.success ? (
                            <span className="status-badge success" title={res.txHash}>✓ Swept</span>
                          ) : (
                            <span className="status-badge error" title={res.error}>✕ Failed</span>
                          )
                        ) : est?.isSweepable ? (
                          <span className="status-badge ready">● Ready</span>
                        ) : (
                          <span className="status-badge dust">Insufficient Gas</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Execution Dock */}
      <div className="sweeper-execute-dock">
        <div className="dock-summary">
          <div className="dock-stat">
            <span className="dock-lbl">Sweepable Wallets:</span>
            <span className="dock-val mono text-emerald">{sweepableWallets.length} of {targetWallets.length}</span>
          </div>
          <div className="dock-stat">
            <span className="dock-lbl">Total Net to Master:</span>
            <span className="dock-val mono bold text-emerald">{totalNetFormatted}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-start-sweep"
          onClick={handleStartSweep}
          disabled={sweeping || sweepableWallets.length === 0 || !validRecipient}
        >
          {sweeping
            ? `Sweeping (${sweepProgress?.current || 0}/${sweepProgress?.total || 0})…`
            : `⚡ Execute Multi-Wallet Sweep (${sweepableWallets.length} Wallets)`}
        </button>
      </div>
    </div>
  );
}
