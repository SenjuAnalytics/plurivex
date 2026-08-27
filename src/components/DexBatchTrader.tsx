import { useState } from "react";
import { useApp } from "../context/AppContext";
import { ChainIcon } from "../icons";
import type { WalletView } from "../lib/types";

export function DexBatchTrader({ wallet: _wallet }: { wallet: WalletView }) {
  const { selectedSweepIds, toast } = useApp();
  const [selectedChain, setSelectedChain] = useState<"bsc" | "eth" | "base" | "arb" | "sol">("bsc");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const [amountPerWallet, setAmountPerWallet] = useState("0.05");
  const [slippage, setSlippage] = useState("1.0");
  const [traderMode, setTraderMode] = useState<"distributed" | "sweep">("distributed");
  const [isExecuting, setIsExecuting] = useState(false);

  const activeWalletsCount = selectedSweepIds.size > 0 ? selectedSweepIds.size : 1;

  const handleExecuteBatchTrade = () => {
    if (!tokenAddress.trim()) {
      toast("Please enter a target token contract address", "error");
      return;
    }
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      toast(`Batch ${tradeAction.toUpperCase()} order prepared for ${activeWalletsCount} wallets`, "success");
    }, 1200);
  };

  return (
    <div className="dex-trader-panel">
      {/* 1. Header Banner */}
      <div className="dex-header">
        <div className="dex-title-box">
          <div className="dex-badge">MULTI-WALLET SWAP ENGINE</div>
          <h3>DEX Batch Trader</h3>
          <p>Execute parallel buys and sells across Uniswap, PancakeSwap, & Raydium from multiple wallets simultaneously.</p>
        </div>
        <div className="dex-mode-pills">
          <button
            type="button"
            className={`mode-pill ${tradeAction === "buy" ? "active-buy" : ""}`}
            onClick={() => setTradeAction("buy")}
          >
            🟢 Batch Buy
          </button>
          <button
            type="button"
            className={`mode-pill ${tradeAction === "sell" ? "active-sell" : ""}`}
            onClick={() => setTradeAction("sell")}
          >
            🔴 Batch Sell
          </button>
        </div>
      </div>

      {/* 2. Form Grid */}
      <div className="dex-form-grid">
        {/* Network Selection */}
        <div className="dex-field">
          <label className="dex-label">1. Blockchain Network</label>
          <div className="dex-chain-tabs">
            {[
              { key: "bsc", name: "BNB Chain", dex: "PancakeSwap" },
              { key: "eth", name: "Ethereum", dex: "Uniswap V3" },
              { key: "base", name: "Base", dex: "Aerodrome" },
              { key: "arb", name: "Arbitrum", dex: "Camelot" },
              { key: "sol", name: "Solana", dex: "Raydium" },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                className={`dex-chain-btn ${selectedChain === c.key ? "active" : ""}`}
                onClick={() => setSelectedChain(c.key as any)}
              >
                <ChainIcon chain={c.key} size={16} />
                <div className="chain-info">
                  <span className="chain-title">{c.name}</span>
                  <span className="chain-dex">{c.dex}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Token Input */}
        <div className="dex-field">
          <label className="dex-label">2. Target Token Contract / Mint Address</label>
          <div className="token-input-box">
            <input
              type="text"
              className="dex-input mono"
              placeholder="Paste token address (e.g. 0x... or Solana Mint)"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
            />
            {tokenAddress && (
              <button type="button" className="btn-clear-input" onClick={() => setTokenAddress("")}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Trade Configuration */}
        <div className="dex-config-row">
          <div className="dex-field flex-1">
            <label className="dex-label">3. Amount per Wallet</label>
            <div className="amount-input-wrap">
              <input
                type="text"
                className="dex-input mono"
                value={amountPerWallet}
                onChange={(e) => setAmountPerWallet(e.target.value)}
              />
              <span className="amount-unit">{selectedChain === "bsc" ? "BNB" : selectedChain === "sol" ? "SOL" : "ETH"}</span>
            </div>
          </div>

          <div className="dex-field w-32">
            <label className="dex-label">Slippage (%)</label>
            <input
              type="text"
              className="dex-input mono"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </div>

          <div className="dex-field flex-1">
            <label className="dex-label">Execution Strategy</label>
            <div className="strategy-pills">
              <button
                type="button"
                className={`strat-btn ${traderMode === "distributed" ? "active" : ""}`}
                onClick={() => setTraderMode("distributed")}
              >
                🎯 Distributed Sniper
              </button>
              <button
                type="button"
                className={`strat-btn ${traderMode === "sweep" ? "active" : ""}`}
                onClick={() => setTraderMode("sweep")}
              >
                ⚡ Auto-Consolidate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Execution Summary Bar */}
      <div className="dex-summary-bar">
        <div className="summary-left">
          <div className="summary-wallets">
            <span className="summary-highlight mono">{activeWalletsCount}</span> Active Wallets Selected
          </div>
          <div className="summary-est">
            Estimated Total: <strong className="mono">{(parseFloat(amountPerWallet || "0") * activeWalletsCount).toFixed(4)} {selectedChain === "bsc" ? "BNB" : selectedChain === "sol" ? "SOL" : "ETH"}</strong>
          </div>
        </div>

        <button
          type="button"
          className={`btn-execute-trade ${tradeAction === "buy" ? "btn-buy" : "btn-sell"}`}
          onClick={handleExecuteBatchTrade}
          disabled={isExecuting}
        >
          {isExecuting ? "Broadcasting Transactions…" : `⚡ Execute Batch ${tradeAction === "buy" ? "Buy" : "Sell"} (${activeWalletsCount} Wallets)`}
        </button>
      </div>
    </div>
  );
}
