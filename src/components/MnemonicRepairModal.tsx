import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../context/AppContext";
import { IconSeed } from "../icons";

export interface WordAnalysis {
  index: number;
  rawWord: string;
  isValidBip39: boolean;
  isPlaceholder?: boolean;
  suggestions: string[];
}

export interface TargetAddressMatch {
  positionIndex: number;
  word: string;
  phrase: string;
  matchedAddress: string;
  chainFamily: string;
}

export interface PositionCandidateGroup {
  positionIndex: number;
  candidateCount: number;
  sampleWords: string[];
}

export interface SlotCandidateWord {
  word: string;
  positionIndex: number;
  fullPhrase: string;
}

export interface MnemonicRepairResult {
  totalWords: number;
  isLengthValid: boolean;
  hasInvalidWords: boolean;
  isChecksumValid: boolean;
  isSingleWordMissing?: boolean;
  missingWordIndex?: number | null;
  candidateValidWords?: string[];
  words: WordAnalysis[];
  autoRepairedPhrases: string[];
  targetMatch?: TargetAddressMatch | null;
  positionCandidates?: PositionCandidateGroup[];
  allSlotCandidates?: SlotCandidateWord[];
}

function findInsertedWordIndex(originalWords: string[], solutionWords: string[]): number {
  if (solutionWords.length === originalWords.length + 1) {
    for (let i = 0; i < solutionWords.length; i++) {
      const matches = originalWords.every((w, origIdx) => {
        const solIdx = origIdx >= i ? origIdx + 1 : origIdx;
        return solutionWords[solIdx]?.toLowerCase() === w.toLowerCase();
      });
      if (matches) return i;
    }
  }
  // For typo replacement (same length)
  for (let i = 0; i < solutionWords.length; i++) {
    if (solutionWords[i]?.toLowerCase() !== originalWords[i]?.toLowerCase()) return i;
  }
  return solutionWords.length - 1;
}

interface MnemonicRepairModalProps {
  isOpen: boolean;
  initialPhrase?: string;
  onClose: () => void;
  onApplyRepairedPhrase?: (phrase: string) => void;
}

export function MnemonicRepairModal({
  isOpen,
  initialPhrase = "",
  onClose,
  onApplyRepairedPhrase,
}: MnemonicRepairModalProps) {
  const { importWallets, toast } = useApp();
  const [phrase, setPhrase] = useState(initialPhrase);
  const [targetAddress, setTargetAddress] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<number | "all" | null>("all");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [analysis, setAnalysis] = useState<MnemonicRepairResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [solutionsLimit, setSolutionsLimit] = useState(35);
  const [candidatesLimit, setCandidatesLimit] = useState(60);
  const isSolutionsScrollingRef = useRef(false);
  const isCandidatesScrollingRef = useRef(false);

  const origWords = useMemo(() => phrase.trim().split(/\s+/).filter(Boolean), [phrase]);

  useEffect(() => {
    setSolutionsLimit(35);
    setCandidatesLimit(60);
  }, [selectedSlot, candidateSearch, phrase]);

  const handleSolutionsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSolutionsScrollingRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      isSolutionsScrollingRef.current = true;
      setSolutionsLimit((prev) => Math.min(prev + 35, filteredSolutions.length));
      setTimeout(() => {
        isSolutionsScrollingRef.current = false;
      }, 100);
    }
  };

  const handleCandidatesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isCandidatesScrollingRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      isCandidatesScrollingRef.current = true;
      setCandidatesLimit((prev) => prev + 60);
      setTimeout(() => {
        isCandidatesScrollingRef.current = false;
      }, 100);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialPhrase) {
        setPhrase(initialPhrase);
        setSelectedSlot("all");
        triggerAnalysis(initialPhrase, targetAddress, "all");
      } else {
        setPhrase("");
        setAnalysis(null);
        setSelectedSlot("all");
      }
    }
  }, [isOpen, initialPhrase]);

  const triggerAnalysis = async (
    textToAnalyze: string,
    targetAddr = targetAddress,
    slot: number | "all" | null = selectedSlot
  ) => {
    const trimmed = textToAnalyze.trim();
    if (!trimmed) {
      setAnalysis(null);
      return;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    const placeholderIdx = words.findIndex((w) =>
      ["?", "*", "_", "x", "missing", "unknown", "blank", "none", "null", "???"].includes(w.toLowerCase())
    );

    let effectiveSlot: number | null = null;

    if (placeholderIdx !== -1) {
      effectiveSlot = placeholderIdx;
      setSelectedSlot(effectiveSlot);
    } else if (typeof slot === "number") {
      effectiveSlot = slot;
      setSelectedSlot(slot);
    } else {
      // Default to "all" (Semua Posisi Diuji)
      effectiveSlot = null;
      setSelectedSlot("all");
    }

    setLoading(true);
    try {
      const res = await invoke<MnemonicRepairResult>("vault_repair_mnemonic", {
        phrase: trimmed,
        targetAddress: targetAddr.trim() || null,
        missingPosition: effectiveSlot,
      });
      setAnalysis(res);
    } catch (err) {
      console.error("Mnemonic repair error:", err);
      toast(`Repair analysis failed: ${String(err)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleWordReplace = (index: number, newWord: string) => {
    const currentWords = phrase.trim().split(/\s+/).filter(Boolean);
    if (index >= currentWords.length) {
      currentWords.push(newWord);
    } else if (index >= 0 && index < currentWords.length) {
      if (analysis?.isSingleWordMissing && selectedSlot !== null && selectedSlot === index) {
        currentWords.splice(index, 0, newWord);
      } else {
        currentWords[index] = newWord;
      }
    }
    const updatedPhrase = currentWords.join(" ");
    setPhrase(updatedPhrase);
    setSelectedSlot(null);
    triggerAnalysis(updatedPhrase, targetAddress, null);
  };

  const handleApplySolution = (solutionPhrase: string) => {
    setPhrase(solutionPhrase);
    setSelectedSlot(null);
    triggerAnalysis(solutionPhrase, targetAddress, null);
    toast("Applied repaired mnemonic phrase!", "success");
  };

  const handleApplyAll = async (solutionsToApply: string[]) => {
    if (!solutionsToApply || solutionsToApply.length === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: solutionsToApply.length });
    try {
      if (onApplyRepairedPhrase) {
        onApplyRepairedPhrase(solutionsToApply.join("\n"));
        toast(`Applied ${solutionsToApply.length} candidate phrases to import panel!`, "success");
        onClose();
        return;
      }

      const { added, skipped } = await importWallets(
        solutionsToApply,
        (current, total) => setImportProgress({ current, total })
      );
      if (added > 0) {
        toast(`Imported ${added} candidate wallets into vault (${skipped} duplicates)! Run 'Scan All' to find the funded wallet.`, "success");
        onClose();
      } else if (skipped > 0) {
        toast(`All ${skipped} candidate wallets already exist in your vault.`, "info");
        onClose();
      } else {
        toast("No wallets were imported.", "error");
      }
    } catch (err) {
      console.error("Batch import error:", err);
      toast(`Failed to import all candidates: ${String(err)}`, "error");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleDirectImport = async () => {
    const targetPhrase = phrase.trim();
    if (!targetPhrase) return;

    setImporting(true);
    setImportProgress(null);
    try {
      if (onApplyRepairedPhrase) {
        onApplyRepairedPhrase(targetPhrase);
        onClose();
        return;
      }

      const { added, skipped } = await importWallets(targetPhrase);
      if (added > 0) {
        toast(`Successfully imported wallet from repaired mnemonic!`, "success");
        onClose();
      } else if (skipped > 0) {
        toast(`Wallet already exists in your vault (duplicate).`, "info");
        onClose();
      } else {
        toast(`Could not derive valid wallet from this phrase.`, "error");
      }
    } catch (err) {
      console.error("Direct import error:", err);
      toast(`Failed to import repaired mnemonic: ${String(err)}`, "error");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const copyToClipboard = () => {
    if (!phrase.trim()) return;
    navigator.clipboard.writeText(phrase.trim());
    toast("Mnemonic phrase copied to clipboard!", "info");
  };

  const hasSidePanels = Boolean(
    analysis &&
      (analysis.isSingleWordMissing ||
        analysis.autoRepairedPhrases.length > 0 ||
        (analysis.allSlotCandidates && analysis.allSlotCandidates.length > 0))
  );

  const filteredSolutions = useMemo(() => {
    if (!analysis?.autoRepairedPhrases) return [];
    if (!candidateSearch.trim()) return analysis.autoRepairedPhrases;
    const q = candidateSearch.trim().toLowerCase();
    return analysis.autoRepairedPhrases.filter((sol) => {
      const words = sol.trim().split(/\s+/);
      return words.some((w) => w.toLowerCase().startsWith(q));
    });
  }, [analysis?.autoRepairedPhrases, candidateSearch]);

  const filteredAllCandidates = useMemo(() => {
    if (!analysis?.allSlotCandidates) return [];
    if (!candidateSearch.trim()) return analysis.allSlotCandidates;
    const q = candidateSearch.trim().toLowerCase();
    return analysis.allSlotCandidates.filter((item) => item.word.toLowerCase().startsWith(q));
  }, [analysis?.allSlotCandidates, candidateSearch]);

  const filteredSingleCandidates = useMemo(() => {
    if (!analysis?.candidateValidWords) return [];
    if (!candidateSearch.trim()) return analysis.candidateValidWords;
    const q = candidateSearch.trim().toLowerCase();
    return analysis.candidateValidWords.filter((w) => w.toLowerCase().startsWith(q));
  }, [analysis?.candidateValidWords, candidateSearch]);

  const parsedSolutions = useMemo(() => {
    return filteredSolutions.map((sol) => {
      const solWords = sol.trim().split(/\s+/);
      const diffIdx = findInsertedWordIndex(origWords, solWords);
      const prefix = solWords.slice(0, diffIdx).join(" ");
      const solvedWord = solWords[diffIdx] || "";
      const suffix = solWords.slice(diffIdx + 1).join(" ");
      return {
        phrase: sol,
        diffIdx,
        solvedWord,
        prefix,
        suffix,
      };
    });
  }, [filteredSolutions, origWords]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`mnemonic-triptych-layout ${hasSidePanels ? "is-triptych" : "is-single"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT PANEL: Valid Checksum Solutions */}
        {hasSidePanels && (
          <div className="triptych-panel triptych-left-panel">
            <div className="triptych-panel-header">
              <div className="triptych-header-titles">
                <h4 className="missing-solver-title text-emerald text-xs font-bold">
                  ✨ Valid Checksum Solutions ({filteredSolutions.length} Candidates
                  {typeof selectedSlot === "number" ? ` for Slot #${selectedSlot + 1}` : " - Semua Posisi"})
                </h4>
                <p className="missing-solver-desc text-xxs text-dim">
                  Lolos pengujian matematis kriptografis BIP-39 SHA-256 Checksum
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
                  title="Copy all candidate phrases separated by newlines"
                >
                  📋 Copy All
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-primary btn-apply-all"
                  onClick={() => handleApplyAll(filteredSolutions)}
                  disabled={importing || filteredSolutions.length === 0}
                  title="Batch import all valid candidate wallets to vault for balance scanning"
                >
                  {importing
                    ? `⚡ Importing ${importProgress ? `${importProgress.current}/${importProgress.total} (${Math.round((importProgress.current / importProgress.total) * 100)}%)` : "…"}`
                    : `⚡ Apply All (${filteredSolutions.length})`}
                </button>
              </div>
            </div>

            <div className="triptych-panel-body" onScroll={handleSolutionsScroll}>
              <div className="solutions-list">
                {parsedSolutions.slice(0, solutionsLimit).map((item, idx) => (
                  <div key={idx} className="solution-item">
                    <div className="solution-item-header">
                      <div className="solution-badges-wrap">
                        <span className="solution-slot-tag">Slot #{item.diffIdx + 1}</span>
                        <span className="solution-target-word">{item.solvedWord}</span>
                      </div>
                      <button
                        type="button"
                        className="solution-apply-btn"
                        onClick={() => handleApplySolution(item.phrase)}
                        title={`Terapkan solusi dengan kata '${item.solvedWord}'`}
                      >
                        Apply
                      </button>
                    </div>
                    <div className="solution-text mono">
                      {item.prefix ? `${item.prefix} ` : ""}
                      <span className="solution-word-solved">{item.solvedWord}</span>
                      {item.suffix ? ` ${item.suffix}` : ""}
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
            </div>
          </div>
        )}

        {/* CENTER PANEL: Main Mnemonic Tool */}
        <div className="triptych-panel triptych-center-panel modal-card mnemonic-repair-modal">
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title-wrap">
              <div className="modal-icon-badge text-emerald">
                <IconSeed size={18} />
              </div>
              <div>
                <div className="modal-title-row">
                  <h3 className="modal-title">Mnemonic Typo Repair Tool</h3>
                  <span className="badge badge-accent">BIP-39 Heuristic Engine</span>
                </div>
              <p className="modal-subtitle">
                Detects misspelled words using Levenshtein distance against 2,048 BIP-39 words & solves checksums.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Input Area */}
        {/* Input Area */}
        <div className="modal-body">
          <div className="repair-input-card compact">
            <div className="repair-input-header">
              <div className="flex items-center gap-2">
                <label className="input-label text-xs font-bold">Raw Mnemonic Recovery Phrase</label>
                <span className="mono text-xxs text-dim">
                  ({phrase.trim() ? phrase.trim().split(/\s+/).length : 0} words)
                </span>
              </div>
              <div className="repair-input-actions-inline">
                <button
                  type="button"
                  className="btn btn-xs btn-ghost text-xxs py-0 px-2"
                  onClick={() => {
                    setPhrase("");
                    setAnalysis(null);
                    setSelectedSlot(null);
                  }}
                  disabled={!phrase}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost text-accent text-xxs py-0 px-2"
                  onClick={() => triggerAnalysis(phrase, targetAddress, selectedSlot)}
                  disabled={!phrase.trim() || loading}
                >
                  {loading ? "Analyzing…" : "Re-Analyze"}
                </button>
              </div>
            </div>
            <textarea
              className="repair-textarea compact"
              rows={2}
              placeholder="e.g. abandon ability able about above absent absorb aple access..."
              value={phrase}
              onChange={(e) => {
                const val = e.target.value;
                setPhrase(val);
                triggerAnalysis(val, targetAddress, selectedSlot);
              }}
            />
          </div>

          {/* Mode C: Target Address Matcher Input */}
          <div className="target-address-box compact">
            <div className="target-address-header">
              <label className="input-label text-xxs flex items-center gap-1">
                🎯 Target Address <span className="text-dim">(Optional — BTC bc1q.../1..., EVM 0x..., or SOL)</span>
              </label>
              {targetAddress && (
                <button
                  type="button"
                  className="btn btn-xs btn-ghost text-xxs text-dim py-0 px-1"
                  onClick={() => {
                    setTargetAddress("");
                    triggerAnalysis(phrase, "", selectedSlot);
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <input
              type="text"
              className="target-address-input compact"
              placeholder="Tempelkan alamat target dompet (cth: bc1q..., 1..., 0x..., atau Solana) untuk deteksi presisi 100%"
              value={targetAddress}
              onChange={(e) => {
                const val = e.target.value;
                setTargetAddress(val);
                triggerAnalysis(phrase, val, selectedSlot);
              }}
            />
          </div>

          {/* Mode C Victory Banner: Target Address Matched! */}
          {analysis?.targetMatch && (
            <div className="target-match-victory-card compact">
              <div className="target-match-header">
                <span className="victory-badge text-xs">🎯 100% EXACT FORENSIC MATCH FOUND!</span>
                <span className="victory-chain">{analysis.targetMatch.chainFamily.toUpperCase()}</span>
              </div>
              <div className="target-match-body compact">
                <div className="target-match-detail text-xs">
                  <span className="text-dim">Posisi:</span>
                  <strong className="text-accent">Slot #{analysis.targetMatch.positionIndex + 1}</strong>
                  <span className="text-dim ml-2">Kata:</span>
                  <strong className="text-emerald mono font-bold">"{analysis.targetMatch.word}"</strong>
                </div>
              </div>
              <div className="target-match-footer">
                <button
                  type="button"
                  className="btn btn-xs btn-primary victory-apply-btn"
                  onClick={() => {
                    handleApplySolution(analysis.targetMatch!.phrase);
                    toast(`Frasa berhasil dipulihkan dengan kata '${analysis.targetMatch!.word}'!`, "success");
                  }}
                >
                  ⚡ Terapkan Kata '{analysis.targetMatch.word}'
                </button>
              </div>
            </div>
          )}

          {/* Mode B: All 12 Position Selector */}
          {analysis && (analysis.isSingleWordMissing || (analysis.positionCandidates && analysis.positionCandidates.length > 0)) && (
            <div className="position-selector-box compact">
              <div className="position-selector-header">
                <span className="text-xxs font-semibold text-dim">
                  📍 Posisi Kata yang Hilang (Pilih Slot untuk Menguji Posisi):
                </span>
                {selectedSlot !== "all" && (
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost text-xxs text-accent py-0 px-1"
                    onClick={() => {
                      setSelectedSlot("all");
                      triggerAnalysis(phrase, targetAddress, "all");
                    }}
                  >
                    ↺ Semua Posisi
                  </button>
                )}
              </div>
              <div className="position-tabs compact">
                <button
                  type="button"
                  className={`position-tab-btn compact ${selectedSlot === "all" ? "active" : ""}`}
                  onClick={() => {
                    setSelectedSlot("all");
                    triggerAnalysis(phrase, targetAddress, "all");
                  }}
                  title="Uji semua 12 posisi sekaligus"
                >
                  🌐 Semua ({analysis.allSlotCandidates?.length || (12 * 128)})
                </button>
                {Array.from({ length: 12 }, (_, i) => {
                  const candidateInfo = analysis.positionCandidates?.find((p) => p.positionIndex === i);
                  const isCurrent = selectedSlot === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`position-tab-btn compact ${isCurrent ? "active" : ""}`}
                      onClick={() => {
                        setSelectedSlot(i);
                        triggerAnalysis(phrase, targetAddress, i);
                      }}
                      title={`Slot #${i + 1} (${candidateInfo?.candidateCount || 128} kata valid)`}
                    >
                      #{i + 1}
                      {candidateInfo && (
                        <span className="tab-count">{candidateInfo.candidateCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <div className="repair-results-section">
              {/* Status Header */}
              <div className="repair-status-bar">
                <div className="status-indicator-group">
                  <span
                    className={`status-pill ${
                      analysis.isChecksumValid
                        ? "pill-success"
                        : analysis.isSingleWordMissing
                        ? "pill-warning"
                        : analysis.isLengthValid
                        ? "pill-success"
                        : "pill-danger"
                    }`}
                  >
                    {analysis.isSingleWordMissing
                      ? (selectedSlot === "all"
                          ? "1 Word Missing (Semua Posisi) 🔍"
                          : `Missing Word #${(typeof selectedSlot === "number" ? selectedSlot : (analysis.missingWordIndex ?? 0)) + 1} 🔍`)
                      : `${analysis.totalWords} Words ${analysis.isLengthValid ? "✓ (Standard)" : "✕ (Expected 12/24)"}`}
                  </span>

                  <span
                    className={`status-pill ${
                      !analysis.hasInvalidWords
                        ? "pill-success"
                        : analysis.isSingleWordMissing
                        ? "pill-warning"
                        : "pill-danger"
                    }`}
                  >
                    {!analysis.hasInvalidWords
                      ? "All BIP-39 Valid ✓"
                      : analysis.isSingleWordMissing
                      ? "1 Word Missing ❓"
                      : "Typo Detected ⚠️"}
                  </span>

                  <span
                    className={`status-pill ${
                      analysis.isChecksumValid ? "pill-success" : "pill-danger"
                    }`}
                  >
                    Checksum: {analysis.isChecksumValid ? "VALID ✓" : "INCOMPLETE / INVALID ✕"}
                  </span>
                </div>
              </div>

              {/* Word Chips Grid */}
              <div className="repair-words-grid">
                {analysis.words.map((w) => (
                  <div
                    key={w.index}
                    className={`repair-word-card ${
                      w.isPlaceholder
                        ? "is-missing"
                        : w.isValidBip39
                        ? "is-valid"
                        : "is-typo"
                    } cursor-pointer`}
                    onClick={() => {
                      setSelectedSlot(w.index);
                      triggerAnalysis(phrase, targetAddress, w.index);
                    }}
                    title={`Klik untuk menguji Slot #${w.index + 1}`}
                  >
                    <div className="word-card-top">
                      <span className="word-index">#{w.index + 1}</span>
                      <span className="word-badge">
                        {w.isPlaceholder
                          ? (selectedSlot === "all" ? "UJI POSISI" : "MISSING")
                          : w.isValidBip39 ? "✓" : "TYPO"}
                      </span>
                    </div>
                    <div className="word-val mono">
                      {w.isPlaceholder
                        ? (selectedSlot === "all" ? "🌐 (semua)" : "❓ (missing)")
                        : w.rawWord}
                    </div>

                    {!w.isPlaceholder && !w.isValidBip39 && w.suggestions.length > 0 && (
                      <div className="word-suggestions">
                        <span className="suggestion-label">Suggestions:</span>
                        <div className="suggestion-chips">
                          {w.suggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              className="suggestion-chip"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWordReplace(w.index, sug);
                              }}
                              title={`Set Word #${w.index + 1} to '${sug}'`}
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <div className="modal-footer-right flex items-center gap-2.5">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={copyToClipboard}
                disabled={!phrase.trim()}
              >
                Copy Phrase
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDirectImport}
                disabled={
                  !phrase.trim() ||
                  importing ||
                  (analysis !== null && !analysis.isChecksumValid)
                }
              >
                {importing
                  ? (importProgress
                      ? `Importing ${importProgress.current}/${importProgress.total} (${Math.round((importProgress.current / importProgress.total) * 100)}%)…`
                      : "Importing…")
                  : analysis?.isChecksumValid
                  ? "Import to Vault →"
                  : "Valid Checksum Required"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Auto-Discovery Candidates */}
        {hasSidePanels && (
          <div className="triptych-panel triptych-right-panel">
            <div className="triptych-panel-header">
              <div className="triptych-header-titles">
                <h4 className="missing-solver-title text-emerald text-xs font-bold">
                  {selectedSlot === "all"
                    ? `✨ Auto-Discovery (${analysis?.allSlotCandidates?.length || analysis?.candidateValidWords?.length || 0} Candidates)`
                    : typeof selectedSlot === "number"
                    ? `✨ Slot #${selectedSlot + 1} Discovery (${analysis?.candidateValidWords?.length || 0} Words)`
                    : `✨ Auto-Discovery (${analysis?.candidateValidWords?.length || 0} Candidates)`}
                </h4>
                <p className="missing-solver-desc text-xxs text-dim">
                  {selectedSlot === "all"
                    ? "Sistem menguji 12 posisi (24.576 kombinasi). Klik kata untuk melengkapi frasa:"
                    : typeof selectedSlot === "number"
                    ? `Sistem menguji seluruh 2.048 kata untuk Slot #${selectedSlot + 1}:`
                    : "Sistem menguji kemungkinan kata. Klik kata untuk melengkapi frasa:"}
                </p>
              </div>
              <input
                type="text"
                className="candidate-search-input"
                placeholder="Cari kata (cth: 'a', 'b', 'c')..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
              />
            </div>

            <div className="triptych-panel-body" onScroll={handleCandidatesScroll}>
              <div className="candidate-words-cloud">
                {selectedSlot === "all" && filteredAllCandidates.length > 0 ? (
                  <>
                    {filteredAllCandidates.slice(0, candidatesLimit).map((item, idx) => (
                      <button
                        key={`${item.positionIndex}-${item.word}-${idx}`}
                        type="button"
                        className="candidate-word-btn"
                        onClick={() => {
                          handleWordReplace(item.positionIndex, item.word);
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
                ) : (
                  <>
                    {filteredSingleCandidates.slice(0, candidatesLimit).map((cand) => (
                      <button
                        key={cand}
                        type="button"
                        className="candidate-word-btn"
                        onClick={() => {
                          const targetSlot = typeof selectedSlot === "number" ? selectedSlot : (analysis?.missingWordIndex ?? ((analysis?.words?.length ?? 1) - 1));
                          handleWordReplace(targetSlot, cand);
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
