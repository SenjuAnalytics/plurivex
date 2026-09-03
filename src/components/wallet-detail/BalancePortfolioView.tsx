import type { Chain } from "../../lib/chains";
import type { WalletView } from "../../lib/types";
import { ChainIcon } from "../../icons/ChainIcon";
import { IconCoin } from "../../icons";
import { BalanceCard } from "./BalanceCard";

interface BalancePortfolioViewProps {
  wallet: WalletView;
  walletChains: readonly Chain[];
  isSol: boolean;
}

export function BalancePortfolioView({
  wallet,
  walletChains,
  isSol,
}: BalancePortfolioViewProps) {
  return (
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
  );
}
