import React from "react";
import type { MnemonicRepairResult } from "../types";

interface RayonMetricsBarProps {
  analysis: MnemonicRepairResult | null;
  onApplySolution: (phrase: string) => void;
}

export const RayonMetricsBar: React.FC<RayonMetricsBarProps> = ({
  analysis,
  onApplySolution,
}) => {
  return (
    <>
      {/* Zero-Knowledge Mnemonic Repair Banner */}
      <div className="zero-knowledge-banner">
        <div className="zk-left">
          <span className="zk-shield-icon">🛡️</span>
          <div className="zk-text-wrap">
            <span className="zk-headline">Zero-Knowledge Offline RAM Processing</span>
            <span className="zk-subtext">
              Pencarian kombinasi dieksekusi murni di RAM lokal komputer via Rust Rayon multi-core. Tanpa log disk atau koneksi cloud.
            </span>
          </div>
        </div>
        <span className="zk-lock-badge">RAM ONLY</span>
      </div>

      {/* Smart Transposition Alert Banner */}
      {analysis?.isTranspositionDetected && analysis.transposedIndices && (
        <div className="transposition-banner">
          <div className="transposition-left">
            <span className="transposition-icon">🔁</span>
            <div className="transposition-text">
              <span className="transposition-headline">
                Kata Tertukar Terdeteksi (Transposition Heuristic)
              </span>
              <span className="transposition-subtext">
                Menukar <strong>Slot #{analysis.transposedIndices[0] + 1}</strong> dengan <strong>Slot #{analysis.transposedIndices[1] + 1}</strong> memulihkan validitas BIP-39 Checksum!
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-primary btn-swap-apply"
            onClick={() => {
              if (analysis.autoRepairedPhrases.length > 0) {
                onApplySolution(analysis.autoRepairedPhrases[0]);
              }
            }}
          >
            Terapkan Penukaran Ini
          </button>
        </div>
      )}
    </>
  );
};
