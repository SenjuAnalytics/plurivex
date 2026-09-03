import React, { useState } from "react";
import { IconSearch } from "../../../icons";
import { useApp } from "../../../context/AppContext";
import type { MnemonicRepairResult, SlotCandidateWord, ParsedSolution } from "../types";

interface RightCandidatesPanelProps {
  phrase: string;
  analysis: MnemonicRepairResult | null;
  activeSession?: import("../types").SessionStats | null;
  selectedSlot: number | "all" | null;
  filteredSolutions: string[];
  filteredAllCandidates: SlotCandidateWord[];
  filteredSingleCandidates: string[];
  parsedSolutions: ParsedSolution[];
  candidateSearch: string;
  setCandidateSearch: (val: string) => void;
  onApplySolution: (phrase: string) => void;
  onWordReplace: (index: number, word: string) => void;
}

export const RightCandidatesPanel: React.FC<RightCandidatesPanelProps> = ({
  phrase,
  analysis,
  activeSession,
  selectedSlot,
  filteredSolutions,
  filteredAllCandidates,
  filteredSingleCandidates,
  parsedSolutions,
  candidateSearch,
  setCandidateSearch,
  onApplySolution,
  onWordReplace,
}) => {
  const { toast } = useApp();
  const [candidatesLimit, setCandidatesLimit] = useState<number>(60);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setCandidatesLimit((prev) => prev + 60);
    }
  };

  const hasCandidates =
    Boolean(phrase.trim()) &&
    ((analysis?.isDualWordMissing && selectedSlot === "all" && parsedSolutions.length > 0) ||
      (selectedSlot === "all" && filteredAllCandidates.length > 0) ||
      filteredSingleCandidates.length > 0);

  const getRightHeader = () => {
    if (activeSession?.status === "completed") {
      return {
        title: `✨ Katalog Solusi Sesi #${activeSession.sessionId.slice(0, 8)} (${filteredSolutions.length} Pasangan Valid)`,
        desc: "Klik salah satu pasangan atau kata untuk langsung menerapkannya ke dalam editor:",
      };
    }
    if (activeSession?.status === "running") {
      return {
        title: `✨ Streaming Solusi Sesi #${activeSession.sessionId.slice(0, 8)} (${filteredSolutions.length} Ditemukan)`,
        desc: "Mengumpulkan kombinasi kata valid secara live di latar belakang...",
      };
    }
    return {
      title: analysis?.isDualWordMissing && selectedSlot === "all"
        ? `✨ Auto-Discovery (${filteredSolutions.length} Solusi Pasangan)`
        : selectedSlot === "all"
        ? `✨ Auto-Discovery (${analysis?.allSlotCandidates?.length || analysis?.candidateValidWords?.length || 0} Candidates)`
        : typeof selectedSlot === "number"
        ? `✨ Slot #${selectedSlot + 1} Discovery (${filteredSingleCandidates.length || analysis?.candidateValidWords?.length || 0} Words)`
        : `✨ Auto-Discovery (${analysis?.candidateValidWords?.length || 0} Candidates)`,
      desc: analysis?.isDualWordMissing && selectedSlot === "all"
        ? "Sistem menguji kombinasi 2 kata via Rayon parallel threads. Klik pasangan untuk melengkapi:"
        : selectedSlot === "all"
        ? "Sistem menguji 12 posisi (24.576 kombinasi). Klik kata untuk melengkapi frasa:"
        : typeof selectedSlot === "number"
        ? `Sistem menguji kemungkinan kata valid untuk Slot #${selectedSlot + 1}:`
        : "Sistem menguji kemungkinan kata. Klik kata untuk melengkapi frasa:",
    };
  };

  const rightHeader = getRightHeader();

  return (
    <div className="triptych-panel triptych-right-panel">
      <div className="triptych-panel-header">
        <div className="triptych-header-titles">
          <h4 className="missing-solver-title text-emerald text-xs font-bold">
            {rightHeader.title}
          </h4>
          <p className="missing-solver-desc text-xxs text-dim">
            {rightHeader.desc}
          </p>
        </div>
        <div className="triptych-header-actions" style={{ width: "100%" }}>
          <div className="candidate-search-wrap-full" style={{ width: "100%", position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: "10px", color: "var(--text-dim, #64748b)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
              <IconSearch size={13} />
            </span>
            <input
              type="text"
              className="candidate-search-input"
              style={{ width: "100%", height: "28px", paddingLeft: "30px", paddingRight: candidateSearch ? "26px" : "10px", fontSize: "11px", boxSizing: "border-box" }}
              placeholder={
                analysis?.isDualWordMissing && selectedSlot === "all"
                  ? "Cari pasangan kata (cth: 'abandon')..."
                  : "Cari kata (cth: 'a', 'b', 'c')..."
              }
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
            />
            {candidateSearch && (
              <button
                type="button"
                onClick={() => setCandidateSearch("")}
                style={{ position: "absolute", right: "8px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "11px", padding: 0 }}
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="triptych-panel-body" onScroll={handleScroll}>
        {!hasCandidates ? (
          <div className="empty-panel-state">
            <span className="empty-state-icon">🔍</span>
            <h5>Auto-Discovery Standby</h5>
            <p>
              Kata-kata BIP-39 yang cocok secara leksikal & matematis akan otomatis muncul di panel ini ketika Anda memasukkan frasa.
            </p>
          </div>
        ) : analysis?.isDualWordMissing && selectedSlot === "all" ? (
          <div className="candidate-pairs-grid">
            {parsedSolutions.slice(0, candidatesLimit).map((item, idx) => (
              <button
                key={`${item.phrase}-${idx}`}
                type="button"
                className="candidate-pair-card"
                onClick={() => {
                  onApplySolution(item.phrase);
                  toast(`Solusi ${item.slotLabel} diterapkan: ${item.solvedWords}`, "success");
                }}
                title={`Klik untuk melengkapi frasa dengan ${item.slotLabel} (${item.solvedWords})`}
              >
                <span className="pair-slots-badge">{item.slotLabel}</span>
                <span className="pair-words-text">{item.solvedWords}</span>
                <span className="pair-apply-indicator">Terapkan →</span>
              </button>
            ))}
            {parsedSolutions.length > candidatesLimit && (
              <button
                type="button"
                className="load-more-btn"
                onClick={() => setCandidatesLimit((prev) => prev + 40)}
              >
                + Tampilkan Lebih Banyak ({candidatesLimit}/{parsedSolutions.length})
              </button>
            )}
          </div>
        ) : (
          <div className="candidate-words-cloud">
            {selectedSlot === "all" && filteredAllCandidates.length > 0 ? (
              <>
                {filteredAllCandidates.slice(0, candidatesLimit).map((item, idx) => (
                  <button
                    key={`${item.positionIndex}-${item.word}-${idx}`}
                    type="button"
                    className="candidate-word-btn"
                    onClick={() => {
                      onWordReplace(item.positionIndex, item.word);
                      toast(`Slot #${item.positionIndex + 1} dilengkapi dengan kata '${item.word}'!`, "success");
                    }}
                    title={`Lengkapi Slot #${item.positionIndex + 1} dengan '${item.word}'`}
                  >
                    <span className="slot-badge">#{item.positionIndex + 1}</span> {item.word}
                  </button>
                ))}
                {filteredAllCandidates.length > candidatesLimit && (
                  <button
                    type="button"
                    className="load-more-btn"
                    onClick={() => setCandidatesLimit((prev) => prev + 120)}
                  >
                    + Tampilkan Lebih Banyak ({candidatesLimit}/{filteredAllCandidates.length})
                  </button>
                )}
              </>
            ) : filteredSingleCandidates.length > 0 ? (
              <>
                {filteredSingleCandidates.slice(0, candidatesLimit).map((cand) => (
                  <button
                    key={cand}
                    type="button"
                    className="candidate-word-btn"
                    onClick={() => {
                      const targetSlot =
                        typeof selectedSlot === "number"
                          ? selectedSlot
                          : analysis?.missingWordIndex ?? ((analysis?.words?.length ?? 1) - 1);
                      onWordReplace(targetSlot, cand);
                      toast(`Slot #${targetSlot + 1} dilengkapi dengan kata '${cand}'!`, "success");
                    }}
                  >
                    <span className="plus-sign">+</span> {cand}
                  </button>
                ))}
                {filteredSingleCandidates.length > candidatesLimit && (
                  <button
                    type="button"
                    className="load-more-btn"
                    onClick={() => setCandidatesLimit((prev) => prev + 120)}
                  >
                    + Tampilkan Lebih Banyak ({candidatesLimit}/{filteredSingleCandidates.length})
                  </button>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
