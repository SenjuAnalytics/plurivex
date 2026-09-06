import React from "react";
import type { SessionStats } from "../types";

interface SessionTrackerCardProps {
  activeSession: SessionStats | null;
  selectedSlot: number | "all" | null;
  dualWordSolutionsCount?: number;
  onStartSession: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onCancelSession: () => void;
  onClosePanel?: () => void;
  onStopScan?: () => void;
  isOnTheFlyScanning?: boolean;
  scanProgressInfo?: { current: number; total: number; funded: number } | null;
  isSingleWordMissing?: boolean;
}

export const SessionTrackerCard: React.FC<SessionTrackerCardProps> = ({
  activeSession,
  selectedSlot,
  dualWordSolutionsCount,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onCancelSession,
  onClosePanel,
  onStopScan,
  isOnTheFlyScanning = false,
  scanProgressInfo,
  isSingleWordMissing = false,
}) => {
  return (
    <div className={`session-tracker-card ${activeSession ? `is-${activeSession.status}` : "is-idle"}`}>
      <div className="session-tracker-card-header">
        <div className="session-tracker-title-wrap">
          <span
            className={`session-pulse-dot ${
              activeSession?.status === "running"
                ? "dot-running"
                : activeSession?.status === "paused"
                ? "dot-paused"
                : "dot-idle"
            }`}
          />
          <div className="session-title-content">
            <div className="session-title-line">
              <span className="session-title-text">Rayon Multi-Core Hardware Acceleration</span>
              {activeSession ? (
                <span className={`session-status-badge status-${activeSession.status}`}>
                  {activeSession.status === "running"
                    ? "⚡ Running"
                    : activeSession.status === "paused"
                    ? "⏸ Paused"
                    : activeSession.status === "completed"
                    ? "✓ Complete"
                    : "✕ Cancelled"}
                </span>
              ) : (
                <span className="session-status-badge status-idle">STANDBY IN RAM</span>
              )}
            </div>
          </div>
        </div>

        <div className="session-controls-row">
          {(!activeSession || activeSession.status === "completed" || activeSession.status === "cancelled") && (
            isSingleWordMissing ? (
              <span
                className="session-status-badge status-completed"
                title="Semua 2.048 kandidat telah dianalisis instan secara live di memori"
              >
                ✓ Selesai Live (2.048 kata)
              </span>
            ) : (
              <button
                type="button"
                className="session-btn session-btn-resume"
                onClick={onStartSession}
                title="Mulai sesi pencarian brute-force multi-thread di latar belakang dengan auto-checkpoint ke SQLite"
              >
                🚀 Mulai Sesi Baru
              </button>
            )
          )}

          {activeSession?.status === "running" && (
            <>
              <button
                type="button"
                className="session-btn session-btn-pause"
                onClick={onPauseSession}
                title="Jeda komputasi Rayon dan simpan checkpoint index ke database lokal"
              >
                ⏸ Jeda
              </button>
              <button
                type="button"
                className="session-btn session-btn-cancel"
                onClick={onCancelSession}
                title="Batalkan sesi pencarian ini"
              >
                ✕ Batalkan
              </button>
            </>
          )}

          {activeSession?.status === "paused" && (
            <>
              <button
                type="button"
                className="session-btn session-btn-resume"
                onClick={onResumeSession}
                title="Lanjutkan pencarian kombinasi dari checkpoint index terakhir"
              >
                ▶ Lanjutkan
              </button>
              <button
                type="button"
                className="session-btn session-btn-cancel"
                onClick={onCancelSession}
                title="Batalkan sesi pencarian ini"
              >
                ✕ Batalkan
              </button>
            </>
          )}

          {isOnTheFlyScanning && (
            <button
              type="button"
              className="session-btn session-btn-cancel"
              onClick={() => onStopScan?.()}
              title="Hentikan pemindaian saldo on-the-fly"
            >
              ⏹ Stop Auto-Scan Saldo
            </button>
          )}

          {onClosePanel && (
            <button
              type="button"
              className="session-btn session-btn-close"
              onClick={onClosePanel}
              title="Tutup panel sesi"
            >
              ✕ Tutup Panel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar section with meta header */}
      <div className="session-progress-section">
        <div className="session-progress-meta">
          <span className="session-progress-label">
            {activeSession
              ? `Progress: ${activeSession.currentIndex.toLocaleString()} / ${activeSession.totalCombinations.toLocaleString()} kombinasi`
              : selectedSlot === "all"
              ? "Kapasitas Komputasi: 66 Pasangan Posisi (276.8M Kombinasi)"
              : "Kapasitas Komputasi: 4.194.304 kombinasi pasangan kata"}
          </span>
          <span className="session-progress-percent">
            {activeSession ? `${activeSession.percent.toFixed(1)}%` : "0.0%"}
          </span>
        </div>
        <div className="session-progress-bar-container">
          <div
            className={`session-progress-bar-fill ${activeSession?.status === "paused" ? "fill-paused" : ""}`}
            style={{ width: `${activeSession ? Math.max(activeSession.percent, 0.5).toFixed(1) : "0"}%` }}
          />
        </div>
      </div>

      {/* Metrics 2x2 Grid */}
      <div className="session-metrics-grid">
        <div className="session-metric-box">
          <span className="session-metric-label">Progress Kombinasi</span>
          <div className="session-metric-val-wrap">
            <span className="session-metric-value text-emerald">
              {activeSession
                ? `${activeSession.currentIndex.toLocaleString()} / ${
                    activeSession.totalCombinations >= 1_000_000
                      ? `${(activeSession.totalCombinations / 1_000_000).toFixed(2)}M`
                      : activeSession.totalCombinations.toLocaleString()
                  }`
                : selectedSlot === "all"
                ? "66 Pasangan Posisi"
                : "0 / 4.194.304 pasang"}
            </span>
            <span className="session-metric-sub">
              {activeSession
                ? `${activeSession.percent.toFixed(1)}% teruji`
                : selectedSlot === "all"
                ? "276.8M Kombinasi"
                : "Dual-Word Rayon"}
            </span>
          </div>
        </div>

        <div className="session-metric-box">
          <span className="session-metric-label">Kecepatan CPU</span>
          <div className="session-metric-val-wrap">
            <span className="session-metric-value text-cyan">
              {activeSession?.status === "completed"
                ? "Selesai (Standby)"
                : activeSession?.status === "paused"
                ? "Dijeda (Standby)"
                : activeSession && activeSession.speedCps > 0
                ? `${Math.round(activeSession.speedCps).toLocaleString()} pairs/dtk`
                : "Multi-Core Rayon"}
            </span>
            <span className="session-metric-sub">8–16 Parallel Threads</span>
          </div>
        </div>

        <div className="session-metric-box">
          <span className="session-metric-label">Estimasi Sisa (ETA)</span>
          <div className="session-metric-val-wrap">
            <span className="session-metric-value text-amber">
              {activeSession?.status === "completed"
                ? "✓ Selesai"
                : activeSession?.status === "cancelled"
                ? "✕ Dibatalkan"
                : activeSession?.status === "paused"
                ? "⏸ Sesi Dijeda"
                : activeSession?.etaSeconds != null
                ? `${activeSession.etaSeconds < 60 ? `${activeSession.etaSeconds.toFixed(1)} detik` : `${(activeSession.etaSeconds / 60).toFixed(1)} menit`}`
                : activeSession?.status === "running"
                ? "Menghitung..."
                : "Standby"}
            </span>
            <span className="session-metric-sub">
              {activeSession?.status === "completed"
                ? "100% In-Memory Selesai"
                : activeSession?.status === "paused"
                ? "Dijeda di RAM"
                : "Zero-Disk RAM Shield"}
            </span>
          </div>
        </div>

        <div className="session-metric-box">
          <span className="session-metric-label">
            {isOnTheFlyScanning ? "⚡ Live Auto-Scan Saldo" : "Solusi Checksum Valid"}
          </span>
          <div className="session-metric-val-wrap">
            <span className="session-metric-value text-accent">
              {isOnTheFlyScanning && scanProgressInfo
                ? `${scanProgressInfo.current}/${scanProgressInfo.total} Scanned`
                : activeSession
                ? `${activeSession.solutionsCount.toLocaleString()} frasa`
                : `${dualWordSolutionsCount?.toLocaleString() || 0} frasa`}
            </span>
            <span className="session-metric-sub">
              {isOnTheFlyScanning && scanProgressInfo
                ? (scanProgressInfo.funded > 0
                    ? `🎉 ${scanProgressInfo.funded} FUNDED FOUND!`
                    : "RPC Balance Scan on RAM")
                : "BIP-39 SHA-256 Valid"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
