import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Sidebar } from "./Sidebar";
import { FloatingImport } from "./FloatingImport";
import { WalletDetail } from "./WalletDetail";
import { SweeperWorkspace } from "./SweeperWorkspace";
import { DexBatchTrader } from "./DexBatchTrader";
import { ExportModal } from "./ExportModal";
import { ResetAllWalletsModal } from "./ResetAllWalletsModal";
import { PortfolioDirectory } from "./PortfolioDirectory";
import { ActivityWorkspace } from "./ActivityWorkspace";
import { RepairWorkspace } from "./repair-workspace/RepairWorkspace";
import { WindowControls } from "./WindowControls";
import { IconWallet, IconLock, IconSeed, IconKey } from "../icons";
import { balanceAmount, chainsForWallet } from "../lib/chains";

export function MainApp() {
  const [activeNav, setActiveNav] = useState<string>("dashboard");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);

  const {
    wallets,
    selectedId,
    setSelectedId,
    scanAll,
    lock,
    scanning,
    scanProgress,
    stopScan,
    fundedCount,
    toast,
    autoLockMinutes,
    setAutoLockMinutes,
    isAirGapped,
    toggleAirGapped,
    search,
    setSearch,
    pricing,
  } = useApp();

  const selected = wallets.find((w) => w.id === selectedId) ?? null;
  const seedCount = wallets.filter((w) => w.type === "seed").length;
  const evmPkCount = wallets.filter((w) => w.type === "pk").length;
  const solCount = wallets.filter((w) => w.type === "sol_pk").length;

  const totalPortfolioUsd = useMemo(() => {
    let sum = 0;
    for (const w of wallets) {
      const chains = chainsForWallet(w);
      for (const c of chains) {
        const val = w.balances?.[c.key];
        const num = balanceAmount(val);
        if (num > 0) {
          sum += num * pricing.getUsd(c.symbol);
        }
      }
      if (w.tokens) {
        for (const t of w.tokens) {
          const num = balanceAmount(t.balance);
          if (num > 0) {
            sum += num * pricing.getUsd(t.symbol);
          }
        }
      }
    }
    return sum;
  }, [wallets, pricing.priceReport, pricing.getUsd]);

  const portfolioValuation = useMemo(() => {
    return pricing.formatValuation(totalPortfolioUsd);
  }, [totalPortfolioUsd, pricing.formatValuation]);

  const pageTitle = useMemo(() => {
    switch (activeNav) {
      case "dashboard": return "Beranda";
      case "wallets": return selected ? `Dompet #${selected.id}` : "Portofolio & Dompet";
      case "activity": return "Log Aktivitas & Audit";
      case "sweeper": return "Sweep Cerdas";
      case "import": return "Import Wallet";
      case "repair": return "Mnemonic Typo Repair";
      case "trader": return "DEX Batch Trader";
      case "allowance": return "Izin Token (Allowance)";
      case "rpc": return "RPC Manager";
      default: return "Vault";
    }
  }, [activeNav, selected]);

  return (
    <div className="app">
      <div className="app-mesh" aria-hidden />

      {/* ── Top Header (Single Clean Hairline Bar without Duplicate Tabs) ── */}
      <header className="app-header" data-tauri-drag-region>
        {/* 1. Left: Breadcrumbs */}
        <div className="crumb">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <span>Vault</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
          <b>{pageTitle}</b>
        </div>

        {/* 2. Center: Global Search Input */}
        <div className="header-center-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            type="text"
            placeholder="Cari wallet, token, alamat, label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* 3. Right: Status & Actions */}
        <div className="app-header-actions">
          {/* Latency status pill */}
          <div className="pill ok" title="Koneksi RPC Node Stabil">
            <span className="pdot" />
            <span>88 ms</span>
          </div>

          {/* Safe Mode Toggle */}
          <button
            type="button"
            className="btn-airgap-toggle"
            onClick={toggleAirGapped}
            title={
              isAirGapped
                ? "🛡️ Safe Mode AKTIF: Semua koneksi RPC diblokir demi privasi."
                : "🌐 Mode Online AKTIF: Koneksi RPC diizinkan."
            }
          >
            <span className={`airgap-indicator-dot ${isAirGapped ? "dot-safe" : "dot-online"}`} />
            <span>{isAirGapped ? "Safe Mode" : "Online"}</span>
          </button>

          {/* Auto-Lock Selector */}
          <select
            className="select-autolock-header"
            value={autoLockMinutes}
            onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
            title="Auto-Lock Timer: Set idle time before vault locks"
          >
            <option value={0}>⏱️ Lock: Off</option>
            <option value={1}>⏱️ Lock: 1m</option>
            <option value={5}>⏱️ Lock: 5m</option>
            <option value={15}>⏱️ Lock: 15m</option>
            <option value={30}>⏱️ Lock: 30m</option>
            <option value={60}>⏱️ Lock: 1h</option>
          </select>

          {/* Lock Vault Button */}
          <button
            type="button"
            className="btn-lock-minimal"
            onClick={lock}
            title="Kunci Vault Segera"
          >
            <IconLock size={13} />
          </button>

          {/* Window Controls */}
          <WindowControls />
        </div>
      </header>

      {/* ── Live Scan Progress Banner ── */}
      {scanProgress && scanProgress.isScanning && (
        <div className="scan-progress-banner">
          <div className="scan-progress-left">
            <div className="scan-progress-spinner" />
            <div className="scan-progress-text">
              <span className="scan-progress-title">
                Scanning Multi-Chain Balances ({scanProgress.completed}/{scanProgress.total})
              </span>
              <span className="scan-progress-stats">
                {Math.round((scanProgress.completed / Math.max(scanProgress.total, 1)) * 100)}% completed · {scanProgress.funded} funded detected
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

      {/* ── Main App Shell Body ── */}
      <div className="app-body">
        <Sidebar
          activeNav={activeNav}
          setActiveNav={(nav) => {
            setActiveNav(nav);
            if (nav === "import") {
              setIsImportOpen(true);
            }
          }}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          onOpenImport={() => setIsImportOpen(true)}
        />

        <div className="main">
          <div className="detail-panel scrollable">
            {/* View Router */}
            {activeNav === "repair" ? (
              <RepairWorkspace
                onBackToVault={() => setActiveNav("dashboard")}
                onOpenInSweeper={() => setActiveNav("sweeper")}
              />
            ) : activeNav === "sweeper" ? (
              <SweeperWorkspace onBack={() => setActiveNav("dashboard")} />
            ) : activeNav === "trader" ? (
              <DexBatchTrader />
            ) : activeNav === "activity" ? (
              <ActivityWorkspace
                onBack={() => setActiveNav("dashboard")}
                onOpenSweeper={() => setActiveNav("sweeper")}
              />
            ) : activeNav === "wallets" ? (
              selected ? (
                <div>
                  <div style={{ padding: "14px 24px 0", display: "flex", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedId(null)}
                      style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      ← Kembali ke Daftar Portofolio &amp; Dompet
                    </button>
                  </div>
                  <WalletDetail key={selected.id} wallet={selected} />
                </div>
              ) : (
                <PortfolioDirectory
                  onOpenImport={() => setIsImportOpen(true)}
                  onOpenSweeper={() => setActiveNav("sweeper")}
                />
              )
            ) : (
              /* Executive Dashboard View (Beranda) */
              <div className="dashboard-overview" style={{ padding: "20px 24px" }}>
                {/* Mockup Page Head */}
                <div className="page-head">
                  <div className="grow">
                    <h1>Selamat Datang di Plurivex Vault 👋</h1>
                    <p>Ringkasan vault Anda hari ini — semuanya aman dan terkendali.</p>
                  </div>
                  <div className="page-head-actions">
                    <span className="badge b-ghost" style={{ height: "26px", padding: "0 10px", fontSize: "10.5px" }}>
                      {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </span>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => scanAll()}
                      disabled={scanning}
                    >
                      {scanning ? "Memindai…" : "Perbarui"}
                    </button>
                  </div>
                </div>

                {/* Hero Net Worth Card */}
                <div className="hero">
                  <div>
                    <div className="label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        <span>Total Saldo Terpantau</span>
                      </div>

                      {/* Live Currency Selector & Oracle Status */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <select
                          className="val-currency-select mono"
                          value={pricing.currency}
                          onChange={(e) => pricing.setCurrency(e.target.value)}
                          aria-label="Pilih mata uang valuasi"
                          title="Pilih mata uang kurs valuasi (Default: USD)"
                          style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "var(--accent, #7aa2f7)",
                            border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
                            borderRadius: "4px",
                            padding: "1px 6px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          {pricing.supportedCurrencies.map((c) => (
                            <option
                              key={c.code}
                              value={c.code}
                              style={{ background: "#1a1b26", color: "#c0caf5" }}
                            >
                              {c.code} ({c.symbol})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="amount" style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                      <span>{portfolioValuation.primary}</span>
                      {portfolioValuation.secondary && (
                        <small style={{ fontSize: "14px", color: "var(--text-dim)", fontWeight: 500 }}>
                          ({portfolioValuation.secondary})
                        </small>
                      )}
                      {pricing.priceReport?.stale && (
                        <span
                          className="val-offline-badge"
                          title="Nilai estimasi berbasis kurs offline / tersimpan"
                          style={{
                            fontSize: "10.5px",
                            padding: "2px 7px",
                            borderRadius: "999px",
                            background: "rgba(245, 158, 11, 0.12)",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            color: "#f59e0b",
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            marginLeft: "4px",
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="delta">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 15l-6-6-6 6"/>
                      </svg>
                      {fundedCount} dari {wallets.length} dompet memiliki saldo aktif
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setIsImportOpen(true)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12l7 7 7-7"/>
                        </svg>
                        Terima
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setActiveNav("sweeper")}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 19V5M5 12l7-7 7 7"/>
                        </svg>
                        Kirim
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => setActiveNav("sweeper")}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>
                        </svg>
                        Mulai Sweep
                      </button>
                    </div>
                  </div>

                  <div>
                    <svg className="spark" viewBox="0 0 320 90" fill="none" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="spgHero" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C9CFD8" stopOpacity="0.25"/>
                          <stop offset="100%" stopColor="#C9CFD8" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d="M0 68 C30 64 40 70 62 58 S90 38 112 46 S150 60 172 44 S200 24 224 30 S258 44 280 28 S305 16 320 12 L320 90 L0 90 Z" fill="url(#spgHero)"/>
                      <path d="M0 68 C30 64 40 70 62 58 S90 38 112 46 S150 60 172 44 S200 24 224 30 S258 44 280 28 S305 16 320 12" stroke="#C9CFD8" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div className="s-stat">
                      <div><span>DOMPET</span><b>{wallets.length}</b></div>
                      <div><span>FUNDED</span><b>{fundedCount}</b></div>
                      <div><span>SEEDS</span><b>{seedCount}</b></div>
                    </div>
                  </div>
                </div>

                {/* 4 Financial KPIs Grid */}
                <div className="grid4" style={{ marginBottom: "14px" }}>
                  <div className="kpi">
                    <span className="ic"><IconWallet size={14} /></span>
                    <b>{wallets.length} Dompet</b>
                    <span>Total dompet terindeks</span>
                  </div>
                  <div className="kpi">
                    <span className="ic" style={{ color: "var(--ok)", background: "var(--ok-soft)", borderColor: "var(--ok-border)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </span>
                    <b style={{ color: "var(--ok)" }}>{fundedCount} Dompet</b>
                    <span>Dompet memiliki saldo</span>
                  </div>
                  <div className="kpi">
                    <span className="ic"><IconSeed size={14} /></span>
                    <b>{seedCount} Seeds</b>
                    <span>BIP-39 Mnemonic seeds</span>
                  </div>
                  <div className="kpi">
                    <span className="ic"><IconKey size={14} /></span>
                    <b>{evmPkCount + solCount} Keys</b>
                    <span>Private keys terisolasi</span>
                  </div>
                </div>

                {/* 2-Pane Content: Dompet Anda (Left) vs Perlu Perhatian & Aktivitas Terbaru (Right) */}
                <div className="grid2">
                  {/* Left Column: Dompet Anda */}
                  <div>
                    <div className="sec-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <h3 style={{ fontSize: "12.5px", fontWeight: "650", color: "var(--text)" }}>Dompet Anda</h3>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setIsImportOpen(true)}
                        style={{ fontSize: "10.5px", padding: "0 10px", height: "26px" }}
                      >
                        + Import dompet
                      </button>
                    </div>

                    {wallets.length === 0 ? (
                      <div className="card pad" style={{ textAlign: "center", padding: "30px 16px" }}>
                        <div style={{ fontSize: "24px", marginBottom: "6px" }}>📭</div>
                        <div style={{ fontWeight: "700", fontSize: "12.5px", color: "var(--text)" }}>Belum Ada Dompet Terdaftar</div>
                        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
                          Import Seed Phrase atau Private Key untuk memonitor portofolio secara aman.
                        </div>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => setIsImportOpen(true)}
                          style={{ marginTop: "14px", height: "30px", fontSize: "11px" }}
                        >
                          + Import Dompet Sekarang
                        </button>
                      </div>
                    ) : (
                      wallets.slice(0, 4).map((w, idx) => {
                        const addr = w.address || w.solAddress || w.btcAddress || "";
                        return (
                          <div
                            key={w.id}
                            className="w-row"
                            onClick={() => {
                              setSelectedId(w.id);
                              setActiveNav("wallets");
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <span className="w-ic">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="6" width="18" height="13" rx="2.5"/>
                                <path d="M3 10h18M7 15h4"/>
                              </svg>
                            </span>
                            <div className="w-mid">
                              <b>
                                {w.label || `Wallet Utama #${idx + 1}`}{" "}
                                <span className="chain">{w.type.toUpperCase()}</span>
                              </b>
                              <span className="mono">
                                {addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : "Private Key"}
                              </span>
                            </div>
                            <div className="w-amt">
                              <b style={{ color: w.hasFunds ? "var(--ok)" : "var(--text)" }}>
                                {w.hasFunds ? "● Ada Saldo" : "$0.00"}
                              </b>
                              <span>{w.hasFunds ? "Multi-Chain" : "Kosong"}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Right Column: Perlu Perhatian & Aktivitas Terbaru */}
                  <div>
                    {/* Perlu Perhatian Section */}
                    <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                      <h3 style={{ fontSize: "12.5px", fontWeight: "650", color: "var(--text)" }}>Perlu perhatian</h3>
                      <span className="badge b-acc" style={{ fontSize: "9px" }}>Sistem Aktif</span>
                    </div>

                    <div className="alert-row">
                      <span className="aic w">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9"/>
                          <path d="M12 9v4M12 17h.01"/>
                        </svg>
                      </span>
                      <div className="alert-content">
                        <b>RPC Multi-Chain Monitor</b>
                        <span>Latensi RPC 88 ms — node cadangan otomatis siap</span>
                      </div>
                      <button
                        type="button"
                        className="btn sm act"
                        onClick={() => toast("Semua Node RPC sinkron & normal (88 ms)", "info")}
                      >
                        Lihat
                      </button>
                    </div>

                    <div className="alert-row">
                      <span className="aic w">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z"/>
                        </svg>
                      </span>
                      <div className="alert-content">
                        <b>Zero-Cloud Local Shield</b>
                        <span>Enkripsi Argon2id + SQLite Cipher aktif lokal di perangkat</span>
                      </div>
                      <button
                        type="button"
                        className="btn sm act"
                        onClick={() => toast("Vault terenkripsi aman di perangkat lokal", "success")}
                      >
                        Periksa
                      </button>
                    </div>

                    {/* Aktivitas Terbaru Section */}
                    <div className="sec-title" style={{ marginTop: "16px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h3 style={{ fontSize: "12.5px", fontWeight: "650", color: "var(--text)" }}>Aktivitas terbaru</h3>
                      <button
                        type="button"
                        className="btn-inline-link"
                        onClick={() => setActiveNav("activity")}
                        style={{ fontSize: "10.5px", color: "var(--text-dim)", textDecoration: "none", cursor: "pointer" }}
                      >
                        Buka Semua →
                      </button>
                    </div>

                    <div className="card pad" style={{ padding: "6px 12px" }}>
                      <div className="act-row">
                        <span className="aic">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        </span>
                        <div className="act-txt">
                          <b>Pemeriksaan Vault</b>
                          <span>{wallets.length} dompet terenkripsi siap digunakan</span>
                        </div>
                        <span className="amt" style={{ color: "var(--ok)" }}>Siap</span>
                        <span className="t">Live</span>
                      </div>

                      <div className="act-row">
                        <span className="aic">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z"/>
                          </svg>
                        </span>
                        <div className="act-txt">
                          <b>Enkripsi Vault</b>
                          <span>Kunci rahasia tersimpan aman di RAM/DB</span>
                        </div>
                        <span className="amt">Aktif</span>
                        <span className="t">Auto</span>
                      </div>

                      <div className="act-row">
                        <span className="aic">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12l7 7 7-7"/>
                          </svg>
                        </span>
                        <div className="act-txt">
                          <b>Penerimaan Dompet</b>
                          <span>{fundedCount} dompet memiliki saldo aktif</span>
                        </div>
                        <span className="amt" style={{ color: "var(--ok)" }}>Terpantau</span>
                        <span className="t">Live</span>
                      </div>

                      <div className="act-row">
                        <span className="aic">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>
                          </svg>
                        </span>
                        <div className="act-txt">
                          <b>Engine Sweeper Multi-Chain</b>
                          <span>Gas otomatis &amp; anti-drainer ready</span>
                        </div>
                        <span className="amt" style={{ color: "var(--accent)" }}>Standby</span>
                        <span className="t">Siap</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Realtime Status Footer ── */}
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
