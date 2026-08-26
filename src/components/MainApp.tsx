import { useApp } from "../context/AppContext";
import { Sidebar } from "./Sidebar";
import { FloatingImport } from "./FloatingImport";
import { WalletDetail } from "./WalletDetail";
import { SweepModal } from "./SweepModal";
import { IconWallet, IconShield, IconScan, IconExport, IconLock } from "./Icons";

export function MainApp() {
  const {
    wallets,
    selectedId,
    scanAll,
    exportWallets,
    lock,
    scanning,
    scanProgress,
    stopScan,
    fundedCount,
  } = useApp();

  const selected = wallets.find((w) => w.id === selectedId) ?? null;
  const seedCount = wallets.filter((w) => w.type === "seed").length;
  const evmPkCount = wallets.filter((w) => w.type === "pk").length;
  const solCount = wallets.filter((w) => w.type === "sol_pk").length;

  return (
    <div className="app">
      <FloatingImport />
      <SweepModal />
      <div className="app-mesh" aria-hidden />

      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">
            <IconWallet size={18} />
          </div>
          <div>
            <div className="app-title">Plurix</div>
            <div className="app-subtitle">
              <IconShield size={12} />
              Local · Encrypted · Read-only
            </div>
          </div>
        </div>

        <div className="header-stats">
          <div className="mini-stat">
            <span className="mini-stat-val">{wallets.length}</span>
            <span className="mini-stat-lbl">Total</span>
          </div>
          <div className="mini-stat accent">
            <span className="mini-stat-val">{fundedCount}</span>
            <span className="mini-stat-lbl">Funded</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-val">{seedCount}</span>
            <span className="mini-stat-lbl">Seed</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-val">{evmPkCount}</span>
            <span className="mini-stat-lbl">EVM PK</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-val">{solCount}</span>
            <span className="mini-stat-lbl">Solana</span>
          </div>
        </div>

        <div className="app-header-actions">
          <button className="btn btn-ghost" onClick={() => exportWallets("txt")} disabled={!wallets.length}>
            <IconExport size={15} /> TXT
          </button>
          <button className="btn btn-ghost" onClick={() => exportWallets("csv")} disabled={!wallets.length}>
            <IconExport size={15} /> CSV
          </button>
          <button className="btn btn-primary" onClick={scanAll} disabled={!wallets.length || scanning}>
            <IconScan size={15} />
            {scanning ? "Scanning…" : "Scan All"}
          </button>
          <button className="btn btn-ghost" onClick={lock}>
            <IconLock size={15} /> Lock
          </button>
        </div>
      </header>

      {scanProgress && scanProgress.isScanning && (
        <div className="scan-progress-banner">
          <div className="scan-progress-left">
            <div className="scan-progress-spinner" />
            <div className="scan-progress-text">
              <span className="scan-progress-title">
                Scanning Balances in Background ({scanProgress.completed}/{scanProgress.total})
              </span>
              <span className="scan-progress-stats">
                {Math.round((scanProgress.completed / Math.max(scanProgress.total, 1)) * 100)}% completed · {scanProgress.funded} funded wallets
              </span>
            </div>
          </div>
          <div className="scan-progress-bar-wrap">
            <div
              className="scan-progress-bar-fill"
              style={{
                width: `${Math.round((scanProgress.completed / Math.max(scanProgress.total, 1)) * 100)}%`,
              }}
            />
          </div>
          <button type="button" className="btn btn-ghost btn-sm scan-stop-btn" onClick={stopScan}>
            Stop
          </button>
        </div>
      )}

      <div className="app-body">
        <Sidebar />
        <div className="main">
          <div className="detail-panel scrollable">
            {selected ? (
              <WalletDetail key={selected.id} wallet={selected} />
            ) : (
              <div className="detail-empty">
                <div className="empty-visual">
                  <div className="empty-ring" />
                  <IconWallet size={32} />
                </div>
                <h3>Select a wallet to inspect</h3>
                <p>Click the floating wallet icon to import, then select a wallet from the sidebar to inspect addresses and balances.</p>
                <div className="empty-steps">
                  <span><b>1</b> Import</span>
                  <span className="empty-arrow">→</span>
                  <span><b>2</b> Scan</span>
                  <span className="empty-arrow">→</span>
                  <span><b>3</b> Check balances</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}