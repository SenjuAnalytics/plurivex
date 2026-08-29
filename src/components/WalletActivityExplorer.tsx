import { useApp } from "../context/AppContext";
import { ChainIcon, IconSearch, IconExternalLink } from "../icons";
import type { WalletView } from "../lib/types";
import { isSolanaWallet, walletDisplayAddress } from "../lib/wallet";

export function WalletActivityExplorer({ wallet }: { wallet: WalletView }) {
  const { toast } = useApp();
  const address = walletDisplayAddress(wallet) || "";
  const isSol = isSolanaWallet(wallet.type);

  const explorers = isSol
    ? [
        { name: "Solscan", url: `https://solscan.io/account/${address}`, desc: "Official Solana Explorer" },
        { name: "SolanaFM", url: `https://solana.fm/address/${address}`, desc: "Fast Solana Analytics" },
        { name: "Step Finance", url: `https://app.step.finance/en/dashboard?watching=${address}`, desc: "Solana Portfolio Manager" },
      ]
    : [
        { name: "DeBank", url: `https://debank.com/profile/${address}`, desc: "Universal Multi-Chain Portfolio", icon: "eth" },
        { name: "Etherscan", url: `https://etherscan.io/address/${address}`, desc: "Ethereum L1 Mainnet", icon: "eth" },
        { name: "BscScan", url: `https://bscscan.com/address/${address}`, desc: "BNB Smart Chain Explorer", icon: "bsc" },
        { name: "BaseScan", url: `https://basescan.org/address/${address}`, desc: "Coinbase Base Network", icon: "base" },
        { name: "Arbiscan", url: `https://arbiscan.io/address/${address}`, desc: "Arbitrum One L2 Explorer", icon: "arb" },
        { name: "Arkham Intelligence", url: `https://platform.arkhamintelligence.com/explorer/address/${address}`, desc: "On-Chain Entity Intelligence" },
      ];

  const handleOpenUrl = (url: string) => {
    window.open(url, "_blank");
    toast("Opening block explorer in browser", "success");
  };

  return (
    <div className="explorer-hub-panel">
      <div className="explorer-hub-header">
        <div className="explorer-title-box">
          <div className="explorer-badge">ON-CHAIN HUBS & SCANNERS</div>
          <h3>Explorer & Activity Hub</h3>
          <p>Inspect live transaction history, token approvals, and on-chain interactions across top blockchain explorers.</p>
        </div>
      </div>

      <div className="explorers-grid">
        {explorers.map((exp) => (
          <div key={exp.name} className="explorer-card" onClick={() => handleOpenUrl(exp.url)}>
            <div className="explorer-card-top">
              {exp.icon ? <ChainIcon chain={exp.icon} size={18} /> : <span className="explorer-logo"><IconSearch size={16} /></span>}
              <span className="explorer-name">{exp.name}</span>
              <span className="explorer-external-arrow"><IconExternalLink size={13} /></span>
            </div>
            <div className="explorer-desc">{exp.desc}</div>
            <div className="explorer-url mono">{exp.url.replace("https://", "").slice(0, 36)}…</div>
          </div>
        ))}
      </div>
    </div>
  );
}
