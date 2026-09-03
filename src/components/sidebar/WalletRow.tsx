import { memo, useCallback, useMemo, useState } from "react";
import { shortAddr } from "../../lib/wallet";
import {
  formatCompactBalance,
  hasFundsOnEvm,
  hasFundsOnChain,
  balanceAmount,
} from "../../lib/chains";
import type { WalletView } from "../../lib/types";
import { IconSeed, IconKey } from "../../icons";
import { ChainIcon } from "../../icons/ChainIcon";
import { CustomCheckbox } from "./CustomCheckbox";

export type Filter = "all" | "funded" | "btc" | "evm" | "sol";

interface WalletRowProps {
  hideCheckbox?: boolean;
  wallet: WalletView;
  index: number;
  selected: boolean;
  sweepChecked: boolean;
  filterScope?: Filter;
  targetChain?: string;
  onSelect: (id: number) => void;
  onToggleSweep: (id: number) => void;
}

export const WalletRow = memo(function WalletRow({
  wallet,
  index,
  selected,
  sweepChecked,
  hideCheckbox,
  filterScope = "all",
  targetChain = "all",
  onSelect,
  onToggleSweep,
}: WalletRowProps) {
  const handleSelect = useCallback(() => onSelect(wallet.id), [onSelect, wallet.id]);
  const handleToggle = useCallback(() => onToggleSweep(wallet.id), [onToggleSweep, wallet.id]);

  const approximateUsdRate: Record<string, number> = {
    btc: 95000,
    bitcoin: 95000,
    eth: 2600,
    bsc: 600,
    base: 2600,
    arbitrum: 2600,
    polygon: 0.5,
    avalanche: 25,
    solana: 180,
  };

  const nativeBalances = Object.entries(wallet.balances)
    .filter(([chainKey, val]) => {
      if (!val || val === "loading" || val === "error") return false;
      const num = balanceAmount(val);
      if (num <= 0) return false;

      if (targetChain && targetChain !== "all") {
        return chainKey.toLowerCase() === targetChain.toLowerCase();
      }

      if (filterScope === "btc" && chainKey.toLowerCase() !== "btc") return false;
      if (filterScope === "evm" && (chainKey.toLowerCase() === "sol" || chainKey.toLowerCase() === "btc")) return false;
      if (filterScope === "sol" && chainKey.toLowerCase() !== "sol") return false;
      return true;
    })
    .map(([chainKey, val]) => {
      const safeVal = val ?? "";
      const num = balanceAmount(safeVal);
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

  const tokenBalances = (wallet.tokens || [])
    .filter((tok) => {
      const num = parseFloat(tok.balance);
      if (isNaN(num) || num <= 0) return false;

      if (targetChain && targetChain !== "all") {
        return tok.chain.toLowerCase() === targetChain.toLowerCase();
      }

      if (filterScope === "btc") return false;
      if (filterScope === "evm" && tok.chain.toLowerCase() === "sol") return false;
      if (filterScope === "sol" && tok.chain.toLowerCase() !== "sol") return false;
      return true;
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

  const primaryHolding = nativeBalances[0] || tokenBalances[0] || null;

  let displayAddress: string | null = null;
  if (targetChain === "btc" || filterScope === "btc") {
    displayAddress = wallet.btcAddress ?? wallet.address ?? wallet.solAddress;
  } else if (targetChain === "sol" || filterScope === "sol") {
    displayAddress = wallet.solAddress ?? wallet.address ?? wallet.btcAddress;
  } else if ((targetChain && targetChain !== "all") || filterScope === "evm") {
    displayAddress = wallet.address ?? wallet.solAddress ?? wallet.btcAddress;
  } else {
    if (primaryHolding && primaryHolding.chainKey.toLowerCase() === "btc") {
      displayAddress = wallet.btcAddress ?? wallet.address ?? wallet.solAddress;
    } else if (primaryHolding && primaryHolding.chainKey.toLowerCase() === "sol") {
      displayAddress = wallet.solAddress ?? wallet.address ?? wallet.btcAddress;
    } else {
      displayAddress = wallet.address ?? wallet.solAddress ?? wallet.btcAddress;
    }
  }

  const remainingNative = nativeBalances.slice(primaryHolding && !primaryHolding.isToken ? 1 : 0);
  const remainingTokens = tokenBalances.slice(primaryHolding && primaryHolding.isToken ? 1 : 0);
  const totalExtraCount = remainingNative.length + remainingTokens.length;

  const isFundedInScope = useMemo(() => {
    if (filterScope === "btc") {
      return hasFundsOnChain("btc", wallet.balances, wallet.tokens);
    }
    if (filterScope === "evm") {
      return hasFundsOnEvm(wallet.balances, wallet.tokens);
    }
    if (filterScope === "sol") {
      return hasFundsOnChain("sol", wallet.balances, wallet.tokens);
    }
    if (targetChain && targetChain !== "all") {
      return hasFundsOnChain(targetChain, wallet.balances, wallet.tokens);
    }
    return wallet.hasFunds;
  }, [filterScope, targetChain, wallet.balances, wallet.tokens, wallet.hasFunds]);

  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`wallet-card-row${selected ? " active" : ""}${
        isFundedInScope ? " has-funds" : ""
      }${sweepChecked ? " is-checked" : ""}`}
      style={isHovered ? { zIndex: 1000 } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
            <span className="card-addr mono" title={displayAddress || undefined}>
              {displayAddress ? shortAddr(displayAddress) : "invalid"}
            </span>
            {wallet.label && (
              <span className={`card-tag-pill tag-${wallet.label.toLowerCase()}`}>
                {wallet.label}
              </span>
            )}
          </div>
        </div>

        <div className="card-slot-sub">
          <span className={`card-type-tag tag-${wallet.address && wallet.solAddress ? "dual" : wallet.type}`}>
            {wallet.address && wallet.solAddress ? "DUAL" : wallet.type === "seed" ? "SEED" : wallet.type === "pk" ? "EVM" : "SOL"}
          </span>

          <div className="card-bals-cluster">
            {!primaryHolding ? (
              <span className="card-sub-idle mono">0 assets</span>
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
    </div>
  );
});
