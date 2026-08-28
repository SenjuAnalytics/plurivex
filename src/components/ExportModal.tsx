import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";

type ExportPreset = "all" | "funded" | "public_only" | "tagged";
type ExportFormat = "csv" | "txt";

export function ExportModal() {
  const {
    isExportModalOpen,
    setIsExportModalOpen,
    wallets,
    fundedCount,
    tagFilter,
    exportWalletsWithOptions,
    toast,
  } = useApp();

  const [preset, setPreset] = useState<ExportPreset>("all");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedTag, setSelectedTag] = useState<string>(tagFilter || "Main");
  const [isExporting, setIsExporting] = useState(false);

  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const w of wallets) {
      if (w.label?.trim()) set.add(w.label.trim());
    }
    return Array.from(set);
  }, [wallets]);

  // Calculate matching wallet count for current selection
  const matchingCount = useMemo(() => {
    if (preset === "funded") return fundedCount;
    if (preset === "tagged") {
      return wallets.filter((w) => w.label?.toLowerCase() === selectedTag.toLowerCase()).length;
    }
    return wallets.length;
  }, [preset, fundedCount, wallets, selectedTag]);

  if (!isExportModalOpen) return null;

  const handleExport = async () => {
    if (matchingCount === 0) {
      toast("No wallets match this filter", "error");
      return;
    }
    setIsExporting(true);
    try {
      await exportWalletsWithOptions({
        format,
        filter: preset,
        tag: preset === "tagged" ? selectedTag : undefined,
      });
      setIsExportModalOpen(false);
    } catch (err) {
      console.error("Export error:", err);
      toast("Failed to export wallets", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setIsExportModalOpen(false)}>
      <div
        className="modal-card export-vault-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "560px", width: "100%" }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-title-icon">📤</span>
            <div>
              <h3 className="modal-title">Flexible Vault Exporter</h3>
              <p className="modal-subtitle">Export credentials and audit balances with custom security presets</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setIsExportModalOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="export-modal-body">
          {/* Section 1: Preset Mode Selection — redesigned as selectable rows with explicit
              risk indicator (contains keys vs address-only) and a real selection marker,
              instead of 4 visually-identical boxes. */}
          <div className="export-section">
            <label className="export-section-label">1. CHOOSE EXPORT PRESET</label>
            <div className="export-presets-list">
              <div
                className={`export-preset-row ${preset === "all" ? "active" : ""}`}
                onClick={() => setPreset("all")}
              >
                <span className="preset-select-dot" aria-hidden />
                <span className="preset-icon-badge risk-secret">📦</span>
                <div className="preset-row-info">
                  <span className="preset-name">Full Vault Backup</span>
                  <span className="preset-card-desc">
                    All {wallets.length} wallets with EVM/Solana addresses, private keys &amp; seed phrases.
                  </span>
                </div>
                <div className="preset-row-meta">
                  <span className="preset-risk-tag risk-secret">Contains Keys</span>
                  <span className="preset-card-badge mono">{wallets.length} Wallets</span>
                </div>
              </div>

              <div
                className={`export-preset-row ${preset === "funded" ? "active" : ""}`}
                onClick={() => setPreset("funded")}
              >
                <span className="preset-select-dot" aria-hidden />
                <span className="preset-icon-badge risk-secret">💰</span>
                <div className="preset-row-info">
                  <span className="preset-name">Funded Only</span>
                  <span className="preset-card-desc">
                    Only wallets holding native gas or tokens ($ &gt; 0). Skips empty wallets.
                  </span>
                </div>
                <div className="preset-row-meta">
                  <span className="preset-risk-tag risk-secret">Contains Keys</span>
                  <span className="preset-card-badge mono">{fundedCount} Wallets</span>
                </div>
              </div>

              <div
                className={`export-preset-row ${preset === "public_only" ? "active" : ""}`}
                onClick={() => setPreset("public_only")}
              >
                <span className="preset-select-dot" aria-hidden />
                <span className="preset-icon-badge risk-safe">🛡️</span>
                <div className="preset-row-info">
                  <span className="preset-name">Public Addresses Only</span>
                  <span className="preset-card-desc">
                    Safe sharing mode. Only exports EVM 0x and Solana addresses without secrets.
                  </span>
                </div>
                <div className="preset-row-meta">
                  <span className="preset-risk-tag risk-safe">No Secrets</span>
                  <span className="preset-card-badge mono">{wallets.length} Wallets</span>
                </div>
              </div>

              <div
                className={`export-preset-row ${preset === "tagged" ? "active" : ""}`}
                onClick={() => setPreset("tagged")}
              >
                <span className="preset-select-dot" aria-hidden />
                <span className="preset-icon-badge risk-secret">🏷️</span>
                <div className="preset-row-info">
                  <span className="preset-name">Tagged / Folder Only</span>
                  <span className="preset-card-desc">
                    Export wallets categorized under a specific campaign or purpose tag.
                  </span>
                </div>
                <div className="preset-row-meta">
                  <span className="preset-risk-tag risk-secret">Contains Keys</span>
                  <span className="preset-card-badge mono">
                    {preset === "tagged" ? `${matchingCount} Wallets` : "By Tag"}
                  </span>
                </div>
              </div>
            </div>

            {/* Tag Selector Dropdown if preset === "tagged" */}
            {preset === "tagged" && (
              <div className="export-tag-picker-wrap">
                <span className="export-tag-picker-lbl">Select Folder / Tag:</span>
                <select
                  className="export-tag-select mono"
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                >
                  {["Main", "Airdrop", "Whales", "Burner"].map((t) => (
                    <option key={t} value={t}>
                      {t} ({wallets.filter((w) => w.label?.toLowerCase() === t.toLowerCase()).length})
                    </option>
                  ))}
                  {existingTags
                    .filter((t) => !["main", "airdrop", "whales", "burner"].includes(t.toLowerCase()))
                    .map((t) => (
                      <option key={t} value={t}>
                        {t} ({wallets.filter((w) => w.label?.toLowerCase() === t.toLowerCase()).length})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Format Choice — deliberately a compact segmented pair, visually distinct
              from the preset rows above (icon-in-circle + label, not another card grid) so the
              two decisions don't blur into one repeated pattern. */}
          <div className="export-section">
            <label className="export-section-label">2. CHOOSE FILE FORMAT</label>
            <div className="export-format-segmented">
              <button
                type="button"
                className={`export-format-pill ${format === "csv" ? "active" : ""}`}
                onClick={() => setFormat("csv")}
              >
                <span className="format-pill-icon">📊</span>
                <span className="format-pill-text">
                  <span className="format-title">CSV Spreadsheet</span>
                  <span className="format-desc">Excel &amp; Sheets ready</span>
                </span>
              </button>
              <button
                type="button"
                className={`export-format-pill ${format === "txt" ? "active" : ""}`}
                onClick={() => setFormat("txt")}
              >
                <span className="format-pill-icon">📝</span>
                <span className="format-pill-text">
                  <span className="format-title">Formatted Text</span>
                  <span className="format-desc">Human-readable report</span>
                </span>
              </button>
            </div>
          </div>

          {/* Summary Banner — receipt-style with a status accent bar instead of a flat neutral box */}
          <div className={`export-summary-box ${preset === "public_only" ? "is-safe" : "is-secret"}`}>
            <div className="summary-col">
              <span className="summary-sub">READY TO EXPORT</span>
              <span className="summary-main mono">
                {matchingCount} Wallets ({preset.toUpperCase()})
              </span>
            </div>
            <div className="summary-security-note">
              {preset === "public_only" ? (
                <span className="security-pill is-safe">✓ Safe — zero private keys exported</span>
              ) : (
                <span className="security-pill is-secret">⚠ Contains sensitive decrypted keys</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={() => setIsExportModalOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-confirm"
            onClick={handleExport}
            disabled={isExporting || matchingCount === 0}
          >
            {isExporting ? "Exporting…" : `Export ${matchingCount} Wallets to .${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
