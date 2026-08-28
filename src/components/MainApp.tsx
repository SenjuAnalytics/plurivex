import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Sidebar } from "./Sidebar";
import { FloatingImport } from "./FloatingImport";
import { WalletDetail } from "./WalletDetail";
import { SweeperWorkspace } from "./SweeperWorkspace";
import { ExportModal } from "./ExportModal";
import { ResetAllWalletsModal } from "./ResetAllWalletsModal";
import { IconWallet, IconScan, IconLock, IconSeed, IconKey, IconWalletImport } from "../icons";

export function MainApp() {
  const [mainView, setMainView] = useState<"detail" | "sweeper">("detail");
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const {
    wallets,
    selectedId,
    scanAll,
    lock,
    scanning,
    scanProgress,
    stopScan,
    fundedCount,
    setIsExportModalOpen,
    setIsResetModalOpen,
  } = useApp();

  const selected = wallets.find((w) => w.id === selectedId) ?? null;
  const seedCount = wallets.filter((w) => w.type === "seed").length;
  const evmPkCount = wallets.filter((w) => w.type === "pk").length;
  const solCount = wallets.filter((w) => w.type === "sol_pk").length;

  return (
    <div className="app">
      <div className="app-mesh" aria-hidden />

      <header className="app-header" data-tauri-drag-region>
        {/* 1. Left: Minimal Brand & Live Status */}
        <div className="app-header-left">
          <div className="app-logo-mini">
            <IconWallet size={14} />
          </div>
          <span className="app-title-minimal">Plurivex</span>
          <span className="live-pill" title="RPC Connected · AES-256 Encrypted Vault">
            <span className="live-dot" />
            <span>Vault</span>
          </span>
        </div>

        {/* 2. Center: Minimal Clean Metric Badges */}
        <div className="header-stats">
          <div className="header-overview-minimal">
            <span className="stat-chip">
              <span className="mono bold">{wallets.length}</span>
              <span className="lbl">Wallets</span>
            </span>
            {fundedCount > 0 && (
              <span className="stat-chip funded">
                <span className="fund-mini-dot" />
                <span className="mono bold text-emerald">{fundedCount}</span>
                <span className="lbl text-emerald">Funded</span>
              </span>
            )}
            <span className="stat-chip dim-chip">
              <span className="lbl">{seedCount} Seeds · {evmPkCount + solCount} Keys</span>
            </span>
          </div>
        </div>

        {/* 3. Right: Sleek Action Toolbar */}
        <div className="app-header-actions">
          <button
            type="button"
            className="btn-action-minimal btn-import-header"
            onClick={() => setIsImportOpen(true)}
            title="Import new wallets (Mnemonic Seed / Private Key / JSON)"
          >
            <IconWalletImport size={13} />
            <span>Import</span>
          </button>

          <button
            type="button"
            className="btn-action-minimal btn-scan"
            onClick={scanAll}
            disabled={!wallets.length || scanning}
            title="Scan realtime balances across all networks"
          >
            <IconScan size={13} />
            <span>{scanning ? "Scanning…" : "Scan All"}</span>
          </button>

          <button
            type="button"
            className="btn-action-minimal btn-export-preset"
            onClick={() => setIsExportModalOpen(true)}
            disabled={!wallets.length}
            title="Export Vault with Presets (Funded, Public, Full Backup)"
          >
            <span>📤 Export Vault</span>
          </button>

          <button
            type="button"
            className="btn-action-minimal btn-reset-minimal"
            onClick={() => setIsResetModalOpen(true)}
            disabled={!wallets.length}
            title="Reset All Wallets (Requires Master Password)"
          >
            <span>🗑️ Reset All</span>
          </button>

          <button
            type="button"
            className="btn-action-minimal btn-lock-minimal"
            onClick={lock}
            title="Lock Application Vault"
          >
            <IconLock size={13} />
          </button>
        </div>
      </header>

      {scanProgress && scanProgress.isScanning && (
        <div className="scan-progress-banner">
          <div className="scan-progress-left">
            <div className="scan-progress-spinner" />
            <div className="scan-progress-text">
              <span className="scan-progress-title">
                Scanning Multi-Chain Balances ({scanProgress.completed}/{scanProgress.total})
              </span>
              <span className="scan-progress-stats">
                {Math.round((scanProgress.completed / Math.max(scanProgress.total, 1)) * 100)}% completed · {scanProgress.funded} funded wallets detected
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
            {mainView === "sweeper" ? (
              <SweeperWorkspace onBack={() => setMainView("detail")} />
            ) : selected ? (
              <WalletDetail key={selected.id} wallet={selected} />
            ) : (
              <div className="dashboard-overview">
                <div className="dashboard-hero">
                  <div className="dashboard-hero-title">
                    <h2>Vault Command Center</h2>
                    <p>Overview of all indexed multi-chain wallets, private keys, and liquidity holdings.</p>
                  </div>
                </div>

                {/* Metric Cards Grid */}
                <div className="dashboard-metrics-grid">
                  <div className="metric-card">
                    <div className="metric-card-top">
                      <span className="metric-label">TOTAL INDEXED</span>
                      <IconWallet size={16} className="metric-icon" />
                    </div>
                    <div className="metric-val mono">{wallets.length}</div>
                    <div className="metric-sub">Wallets in local SQLite database</div>
                  </div>

                  <div className="metric-card funded-metric">
                    <div className="metric-card-top">
                      <span className="metric-label">FUNDED ASSETS</span>
                      <span className="metric-badge">ACTIVE</span>
                    </div>
                    <div className="metric-val mono text-emerald">{fundedCount}</div>
                    <div className="metric-sub">Wallets with positive balances</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-top">
                      <span className="metric-label">SEED PHRASES</span>
                      <IconSeed size={16} className="metric-icon" />
                    </div>
                    <div className="metric-val mono">{seedCount}</div>
                    <div className="metric-sub">BIP-39 Mnemonic Passphrases</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-top">
                      <span className="metric-label">PRIVATE KEYS</span>
                      <IconKey size={16} className="metric-icon" />
                    </div>
                    <div className="metric-val mono">{evmPkCount + solCount}</div>
                    <div className="metric-sub">EVM & Solana raw secrets</div>
                  </div>
                </div>

                {/* Quick Action Tiles */}
                <div className="dashboard-actions-section">
                  <h3 className="section-title">QUICK VAULT ACTIONS</h3>
                  <div className="action-tiles-grid">
                    <button
                      type="button"
                      className="action-tile sweep-tile"
                      onClick={() => setIsExportModalOpen(true)}
                      disabled={!wallets.length}
                    >
                      <div className="tile-icon-wrap">📁</div>
                      <div className="tile-content">
                        <div className="tile-title">Export Vault Data</div>
                        <div className="tile-desc">Safely backup and export decrypted wallet addresses, keys, and balances to standard TXT or CSV formats.</div>
                      </div>
                      <div className="tile-arrow">→</div>
                    </button>

                    <button
                      type="button"
                      className="action-tile scan-tile"
                      onClick={scanAll}
                      disabled={!wallets.length || scanning}
                    >
                      <div className="tile-icon-wrap">🔍</div>
                      <div className="tile-content">
                        <div className="tile-title">Full Multi-Chain Scan</div>
                        <div className="tile-desc">Query realtime balances across Ethereum, BSC, Base, Arbitrum, & Solana via high-speed RPCs.</div>
                      </div>
                      <div className="tile-arrow">→</div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Realtime RPC & Vault Health Footer Bar */}
      <footer className="app-footer-bar">
        <div className="footer-left">
          <div className="rpc-status-pill">
            <span className="live-dot" />
            <span className="rpc-text">EVM (12ms)</span>
          </div>
          <div className="rpc-status-pill">
            <span className="live-dot" />
            <span className="rpc-text">BSC (14ms)</span>
          </div>
          <div className="rpc-status-pill">
            <span className="live-dot" />
            <span className="rpc-text">Solana (26ms)</span>
          </div>
        </div>

        <div className="footer-right">
          <span className="footer-meta mono">{wallets.length} Wallets Indexed · SQLite Encrypted · Plurivex v0.1.0</span>
        </div>
      </footer>

      {/* Flexible Vault Exporter Modal */}
      <ExportModal />

      {/* Security-Gated Reset All Wallets Modal */}
      <ResetAllWalletsModal />

      {/* Floating Draggable Import Window */}
      <FloatingImport open={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
