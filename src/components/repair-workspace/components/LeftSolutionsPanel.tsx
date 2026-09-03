import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import type { MnemonicRepairResult, ParsedSolution } from "../types";

interface LeftSolutionsPanelProps {
  analysis: MnemonicRepairResult | null;
  activeSession?: import("../types").SessionStats | null;
  filteredSolutions: string[];
  parsedSolutions: ParsedSolution[];
  selectedSlot: number | "all" | null;
  isOnTheFlyScanning: boolean;
  scanProgressInfo: { current: number; total: number; funded: number } | null;
  onApplySolution: (phrase: string) => void;
  onApplyAll: (solutions: string[]) => void;
  importing: boolean;
  importProgress: { current: number; total: number } | null;
}

export const LeftSolutionsPanel: React.FC<LeftSolutionsPanelProps> = ({
  analysis,
  activeSession,
  filteredSolutions,
  parsedSolutions,
  selectedSlot,
  isOnTheFlyScanning,
  scanProgressInfo,
  onApplySolution,
  onApplyAll,
  importing,
  importProgress,
}) => {
  const { toast } = useApp();
  const [solutionsLimit, setSolutionsLimit] = useState<number>(35);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setSolutionsLimit((prev) => Math.min(prev + 35, filteredSolutions.length));
    }
  };

  const isDualAll = analysis?.isDualWordMissing && selectedSlot === "all";

  // Dynamic titles reflecting persistent session vs instant preview
  const getPanelHeader = () => {
    if (activeSession?.status === "completed") {
      const isScanFinished = !isOnTheFlyScanning || (scanProgressInfo && scanProgressInfo.current >= scanProgressInfo.total);
      return {
        title: `⚡ Hasil Sesi Persisten #${activeSession.sessionId.slice(0, 8)} (${filteredSolutions.length} Solusi · Selesai)`,
        desc: isScanFinished
          ? `Menampilkan seluruh ${filteredSolutions.length} frasa terverifikasi · Auto Scan Selesai`
          : `Menampilkan seluruh ${filteredSolutions.length} frasa terverifikasi · Auto-Scan Saldo on-chain sedang berjalan di RAM (${scanProgressInfo?.current || 0}/${scanProgressInfo?.total || 0})...`,
        badgeClass: "text-emerald",
      };
    }
    if (activeSession?.status === "running") {
      return {
        title: `⚡ Sesi Persisten Aktif #${activeSession.sessionId.slice(0, 8)} (${activeSession.percent.toFixed(1)}% · ${filteredSolutions.length} Solusi)`,
        desc: `Komputasi Rayon multi-thread & auto-scan saldo on-chain sedang berjalan otomatis di RAM...`,
        badgeClass: "text-cyan",
      };
    }
    if (activeSession?.status === "paused") {
      return {
        title: `⏸ Sesi Persisten Dijeda #${activeSession.sessionId.slice(0, 8)} (${filteredSolutions.length} Solusi)`,
        desc: `Menampilkan frasa kandidat dari checkpoint SQLite terakhir.`,
        badgeClass: "text-amber",
      };
    }
    return {
      title: `✨ Pratinjau Cepat Leksikal (${filteredSolutions.length} Solusi Awal${typeof selectedSlot === "number" ? ` · Slot #${selectedSlot + 1}` : ""})`,
      desc: isDualAll
        ? "Pratinjau awal di RAM. Klik 'Mulai Sesi Baru' untuk komputasi penuh & auto-scan saldo otomatis."
        : "Lolos pengujian matematis kriptografis BIP-39 SHA-256 Checksum.",
      badgeClass: "text-emerald",
    };
  };

  const headerInfo = getPanelHeader();

  return (
    <div className="triptych-panel triptych-left-panel">
      <div className="triptych-panel-header">
        <div className="triptych-header-titles">
          <h4 className={`missing-solver-title ${headerInfo.badgeClass} text-xs font-bold`}>
            {headerInfo.title}
          </h4>
          <p className="missing-solver-desc text-xxs text-dim">
            {headerInfo.desc}
          </p>
        </div>
        <div className="triptych-header-actions">
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(filteredSolutions.join("\n"));
              toast(`Copied all ${filteredSolutions.length} candidate phrases to clipboard!`, "info");
            }}
            title="Salin semua frasa kandidat ke clipboard"
          >
            📋 Copy All
          </button>
          <button
            type="button"
            className="btn btn-xs btn-primary btn-apply-all"
            onClick={() => onApplyAll(filteredSolutions)}
            disabled={importing || filteredSolutions.length === 0}
            title="Batch import semua kandidat dompet ke vault"
          >
            {importing
              ? `⚡ Importing ${importProgress ? `${importProgress.current}/${importProgress.total}` : "…"}`
              : `⚡ Apply All (${filteredSolutions.length})`}
          </button>
        </div>
      </div>

      {/* On-The-Fly Balance Scanner Progress Bar */}
      {isOnTheFlyScanning && scanProgressInfo && (
        <div className="onthefly-scan-banner">
          <div className="onthefly-scan-info">
            <span className="onthefly-spin-icon">🔄</span>
            <span className="onthefly-text">
              Scanning di RAM: <strong>{scanProgressInfo.current}/{scanProgressInfo.total}</strong> · Ditemukan: <strong className="text-emerald">{scanProgressInfo.funded} funded</strong>
            </span>
          </div>
          <div className="onthefly-progress-bar">
            <div
              className="onthefly-progress-fill"
              style={{ width: `${(scanProgressInfo.current / scanProgressInfo.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="triptych-panel-body" onScroll={handleScroll}>
        {analysis?.isChecksumValid ? (
          <div className="empty-panel-state valid-checksum-confirmed">
            <span className="empty-state-icon text-emerald">✅</span>
            <h5 className="text-emerald font-bold">BIP-39 Checksum Valid!</h5>
            <p>
              Frasa ini 100% sempurna dan lolos uji integritas kriptografis SHA-256 Checksum. Tidak ada kata yang hilang atau salah ketik.
            </p>
            <div className="valid-phrase-info-box">
              <span className="badge badge-accent">DOMPET SIAP DIGUNAKAN</span>
              <p className="text-xxs text-dim mt-2">
                Gunakan tombol <strong>Import to Vault →</strong> di bawah editor untuk menyimpan dompet ini langsung ke Vault Anda.
              </p>
            </div>
          </div>
        ) : parsedSolutions.length === 0 ? (
          <div className="empty-panel-state">
            <span className="empty-state-icon">✨</span>
            <h5>Valid Checksum Solutions</h5>
            <p>
              Masukkan seed phrase di panel tengah. Sistem akan menguji kriptografi SHA-256 Checksum dan menampilkan kombinasi frasa valid di sini.
            </p>
          </div>
        ) : (
          <div className="solutions-list">
          {parsedSolutions.slice(0, solutionsLimit).map((item, idx) => (
            <div key={idx} className="solution-item">
              <div className="solution-item-header">
                <div className="solution-badges-wrap">
                  <span className="solution-slot-tag">{item.slotLabel}</span>
                  <span className="solution-target-word">{item.solvedWords}</span>
                </div>
                <button
                  type="button"
                  className="solution-apply-btn"
                  onClick={() => onApplySolution(item.phrase)}
                  title={`Terapkan solusi (${item.solvedWords})`}
                >
                  Apply
                </button>
              </div>
              <div className="solution-text mono">
                {item.words.map((w, wIdx) => {
                  const isSolved = item.diffIndices.includes(wIdx);
                  return (
                    <span
                      key={wIdx}
                      className={isSolved ? "solution-word-solved" : undefined}
                    >
                      {w}{wIdx < item.words.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredSolutions.length > solutionsLimit && (
            <button
              type="button"
              className="load-more-btn"
              onClick={() => setSolutionsLimit((prev) => Math.min(prev + 35, filteredSolutions.length))}
            >
              Menampilkan {solutionsLimit} dari {filteredSolutions.length} solusi (Scroll ke bawah atau klik untuk muat lagi ↓)
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
