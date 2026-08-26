import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  SWEEP_CHAINS,
  fetchLiveFeeData,
  estimateWalletSweep,
  executeSweepSingle,
  type WalletSweepEstimate,
  type SweepTxResult,
} from "../lib/sweeper";
import { shortAddr } from "../lib/wallet";
import { ethers } from "ethers";
import { ChainIcon } from "../icons";

export function SweepModal() {
  const {
    wallets,
    selectedSweepIds,
    isSweepModalOpen,
    setIsSweepModalOpen,
    revealSecret,
    scanAll,
    toast,
  } = useApp();

  const [chainKey, setChainKey] = useState<string>("eth");
  const [recipient, setRecipient] = useState<string>("");
  const [gasPriceGwei, setGasPriceGwei] = useState<number>(1.2);
  const [liveFeeGwei, setLiveFeeGwei] = useState<number>(1.2);
  const [loadingEstimates, setLoadingEstimates] = useState<boolean>(false);
  const [estimates, setEstimates] = useState<Record<number, WalletSweepEstimate>>({});
  const [sweeping, setSweeping] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number; msg: string } | null>(null);
  const [txResults, setTxResults] = useState<Record<number, SweepTxResult>>({});

  const activeChain = SWEEP_CHAINS[chainKey] || SWEEP_CHAINS.eth;
  const selectedWallets = wallets.filter((w) => selectedSweepIds.has(w.id));

  // Load live fee data when chain changes
  useEffect(() => {
    if (!isSweepModalOpen) return;
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
  }, [chainKey, isSweepModalOpen]);

  // Estimate balances and net amounts whenever selected wallets, chain, or gas price changes
  useEffect(() => {
    if (!isSweepModalOpen || selectedWallets.length === 0) return;
    let active = true;
    setLoadingEstimates(true);

    const runEstimates = async () => {
      const results: Record<number, WalletSweepEstimate> = {};
      for (const w of selectedWallets) {
        if (!w.address) continue;
        const est = await estimateWalletSweep(w.id, w.address, chainKey, gasPriceGwei);
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
  }, [chainKey, gasPriceGwei, isSweepModalOpen, selectedSweepIds]);

  if (!isSweepModalOpen) return null;

  const validRecipient = ethers.utils.isAddress(recipient.trim());
  const sweepableWallets = selectedWallets.filter((w) => estimates[w.id]?.isSweepable);
  const totalNetWei = sweepableWallets.reduce((acc, w) => {
    const est = estimates[w.id];
    return est ? acc.add(est.netWei) : acc;
  }, ethers.BigNumber.from(0));
  const totalNetFormatted = `${Number(ethers.utils.formatEther(totalNetWei)).toFixed(8)} ${activeChain.symbol}`;

  const handleStartSweep = async () => {
    if (!validRecipient) {
      toast("Invalid recipient address (must be a valid 0x address)", "error");
      return;
    }
    if (sweepableWallets.length === 0) {
      toast("No sweepable wallets found (balance is lower than gas fee)", "error");
      return;
    }

    setSweeping(true);
    setTxResults({});
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < sweepableWallets.length; i++) {
      const w = sweepableWallets[i];
      setSweepProgress({
        current: i + 1,
        total: sweepableWallets.length,
        msg: `Sending from wallet #${w.id} (${shortAddr(w.address || "")})...`,
      });

      try {
        const secret = await revealSecret(w.id);
        if (!secret) {
          setTxResults((prev) => ({
            ...prev,
            [w.id]: {
              walletId: w.id,
              address: w.address || "",
              success: false,
              error: "Failed to decrypt private key / invalid master password",
            },
          }));
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

        setTxResults((prev) => ({ ...prev, [w.id]: res }));
        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        setTxResults((prev) => ({
          ...prev,
          [w.id]: {
            walletId: w.id,
            address: w.address || "",
            success: false,
            error: String(err),
          },
        }));
        failCount++;
      }
    }

    setSweeping(false);
    setSweepProgress(null);

    if (successCount > 0) {
      toast(`Successfully swept funds from ${successCount} wallets!`, "success");
      // Refresh balances in background
      setTimeout(() => scanAll(), 3000);
    }
    if (failCount > 0) {
      toast(`${failCount} transactions failed to broadcast. Check logs for details.`, "error");
    }
  };

  return (
    <div className="sweep-modal-backdrop" onClick={() => !sweeping && setIsSweepModalOpen(false)}>
      <div className="sweep-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="sweep-modal-header">
          <div className="sweep-modal-title">
            <span className="sweep-title-icon">⚡</span>
            <div>
              <h3>Sweep Funds (Batch Sweeper)</h3>
              <p className="sweep-subtitle">
                Consolidate all native balances from {selectedWallets.length} selected wallets into your main address
              </p>
            </div>
          </div>
          {!sweeping && (
            <button className="btn-icon sweep-close-btn" onClick={() => setIsSweepModalOpen(false)}>
              ✕
            </button>
          )}
        </div>

        <div className="sweep-modal-body">
          {/* 1. Chain Selection */}
          <div className="sweep-section">
            <label className="sweep-label">1. Select Blockchain Network:</label>
            <div className="sweep-chain-tabs">
              {Object.values(SWEEP_CHAINS).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`sweep-chain-btn ${chainKey === c.key ? "active" : ""}`}
                  onClick={() => !sweeping && setChainKey(c.key)}
                >
                  <span className="chain-badge" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <ChainIcon chain={c.key} size={15} />
                    {c.symbol}
                  </span>
                  <span className="chain-name">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Destination Address */}
          <div className="sweep-section">
            <label className="sweep-label">2. Recipient Destination Address (Your Main Wallet):</label>
            <div className="sweep-input-wrap">
              <input
                type="text"
                className={`sweep-input ${recipient && !validRecipient ? "input-error" : ""}`}
                placeholder="0x... (Ethereum / Exchange / Cold Wallet address)"
                value={recipient}
                disabled={sweeping}
                onChange={(e) => setRecipient(e.target.value.trim())}
              />
              {recipient && (
                <span className={`sweep-val-badge ${validRecipient ? "is-valid" : "is-invalid"}`}>
                  {validRecipient ? "Valid Address ✓" : "Invalid 0x Address ✗"}
                </span>
              )}
            </div>
          </div>

          {/* 3. Gas Strategy */}
          <div className="sweep-section">
            <div className="sweep-gas-header">
              <label className="sweep-label">3. Network Gas Fee Strategy:</label>
              <span className="sweep-live-gas">
                Current Network Gas: <strong>{liveFeeGwei.toFixed(2)} Gwei</strong>
              </span>
            </div>
            <div className="sweep-gas-presets">
              <button
                type="button"
                className={`gas-preset-btn ${gasPriceGwei === liveFeeGwei ? "active" : ""}`}
                onClick={() => setGasPriceGwei(liveFeeGwei)}
                disabled={sweeping}
              >
                🌱 Normal ({liveFeeGwei.toFixed(2)} Gwei)
              </button>
              <button
                type="button"
                className={`gas-preset-btn ${gasPriceGwei === Math.max(0.5, liveFeeGwei * 0.8) ? "active" : ""}`}
                onClick={() => setGasPriceGwei(Number(Math.max(0.5, liveFeeGwei * 0.8).toFixed(2)))}
                disabled={sweeping}
              >
                🐢 Economy ({(liveFeeGwei * 0.8).toFixed(2)} Gwei)
              </button>
              <button
                type="button"
                className={`gas-preset-btn ${gasPriceGwei === liveFeeGwei * 1.2 ? "active" : ""}`}
                onClick={() => setGasPriceGwei(Number((liveFeeGwei * 1.2).toFixed(2)))}
                disabled={sweeping}
              >
                🚀 Fast ({(liveFeeGwei * 1.2).toFixed(2)} Gwei)
              </button>
            </div>
          </div>

          {/* 4. Calculation Preview Table */}
          <div className="sweep-section">
            <div className="sweep-table-header">
              <label className="sweep-label">4. Breakdown & Net Estimate:</label>
              {loadingEstimates && <span className="sweep-calc-loading">Calculating on-chain balances…</span>}
            </div>

            <div className="sweep-table-container">
              <table className="sweep-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Origin Balance</th>
                    <th>Gas Fee</th>
                    <th>Net Received</th>
                    <th>Status / Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedWallets.map((w) => {
                    const est = estimates[w.id];
                    const tx = txResults[w.id];

                    return (
                      <tr key={w.id} className={est?.isSweepable ? "row-sweepable" : "row-dust"}>
                        <td>
                          <div className="sweep-wallet-col">
                            <span className="wallet-idx">#{w.id}</span>
                            <span className="wallet-addr">{shortAddr(w.address || "")}</span>
                          </div>
                        </td>
                        <td>{est ? est.balanceFormatted : "..."}</td>
                        <td>{est ? est.feeFormatted : "..."}</td>
                        <td className="net-col">
                          <strong>{est ? est.netFormatted : "..."}</strong>
                        </td>
                        <td>
                          {tx ? (
                            tx.success ? (
                              <a
                                href={tx.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="tx-link success"
                              >
                                ✓ Success (Tx: {tx.txHash?.slice(0, 8)}…)
                              </a>
                            ) : (
                              <span className="tx-status error" title={tx.error}>
                                ✗ Failed: {tx.error?.slice(0, 30)}…
                              </span>
                            )
                          ) : (
                            <span className={`est-status ${est?.isSweepable ? "ok" : "warn"}`}>
                              {est ? est.statusText : "Checking…"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Banner */}
            <div className="sweep-summary-banner">
              <div className="sweep-summary-stat">
                <span className="sum-lbl">Sweepable Wallets:</span>
                <span className="sum-val">
                  {sweepableWallets.length} of {selectedWallets.length} wallets
                </span>
              </div>
              <div className="sweep-summary-stat total-net">
                <span className="sum-lbl">Total Net Amount to Receive:</span>
                <span className="sum-val accent">{totalNetFormatted}</span>
              </div>
            </div>
          </div>

          {/* Live Progress Bar */}
          {sweepProgress && (
            <div className="sweep-progress-box">
              <div className="sweep-progress-top">
                <div className="spinner-sm" />
                <span>
                  Broadcasting Transactions ({sweepProgress.current}/{sweepProgress.total})
                </span>
              </div>
              <p className="sweep-progress-msg">{sweepProgress.msg}</p>
              <div className="sweep-progress-bar">
                <div
                  className="sweep-progress-fill"
                  style={{
                    width: `${Math.round((sweepProgress.current / Math.max(sweepProgress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="sweep-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={sweeping}
            onClick={() => setIsSweepModalOpen(false)}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sweep-start"
            disabled={sweeping || !validRecipient || sweepableWallets.length === 0}
            onClick={handleStartSweep}
          >
            {sweeping
              ? "Broadcasting Transactions…"
              : `⚡ Sweep Now (${sweepableWallets.length} Wallets)`}
          </button>
        </div>
      </div>
    </div>
  );
}
