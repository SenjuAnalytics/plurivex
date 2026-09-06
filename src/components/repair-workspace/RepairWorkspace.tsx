import React, { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../../context/AppContext";
import { FundedWalletModal } from "../FundedWalletModal";
import { IconArrowLeft } from "../../icons";
import { useMnemonicAnalysis } from "./hooks/useMnemonicAnalysis";
import { useOnTheFlyScan } from "./hooks/useOnTheFlyScan";
import { LeftSolutionsPanel } from "./components/LeftSolutionsPanel";
import { CenterEditorPanel } from "./components/CenterEditorPanel";
import { RightCandidatesPanel } from "./components/RightCandidatesPanel";
import { SessionTrackerCard } from "./components/SessionTrackerCard";
import { RayonMetricsBar } from "./components/RayonMetricsBar";
import type { SessionStats, ParsedSolution } from "./types";

interface RepairWorkspaceProps {
  initialPhrase?: string;
  onBackToVault: () => void;
  onOpenInSweeper?: () => void;
  onApplyRepairedPhrase?: (phrase: string) => void;
}

function findChangedWordIndices(originalWords: string[], candidateWords: string[]): number[] {
  const origLen = originalWords.length;
  const candLen = candidateWords.length;

  // Kasus 1: 1 kata disisipkan (11 kata -> 12 kata)
  if (candLen === origLen + 1) {
    for (let k = 0; k < candLen; k++) {
      let matches = true;
      let oIdx = 0;
      for (let cIdx = 0; cIdx < candLen; cIdx++) {
        if (cIdx === k) continue;
        if ((originalWords[oIdx] || "").toLowerCase() !== (candidateWords[cIdx] || "").toLowerCase()) {
          matches = false;
          break;
        }
        oIdx++;
      }
      if (matches) {
        return [k];
      }
    }
  }

  // Kasus 2: 2 kata disisipkan (10 kata -> 12 kata)
  if (candLen === origLen + 2) {
    for (let p1 = 0; p1 < candLen; p1++) {
      for (let p2 = p1 + 1; p2 < candLen; p2++) {
        let matches = true;
        let oIdx = 0;
        for (let cIdx = 0; cIdx < candLen; cIdx++) {
          if (cIdx === p1 || cIdx === p2) continue;
          if ((originalWords[oIdx] || "").toLowerCase() !== (candidateWords[cIdx] || "").toLowerCase()) {
            matches = false;
            break;
          }
          oIdx++;
        }
        if (matches) {
          return [p1, p2];
        }
      }
    }
  }

  // Kasus 3: Panjang sama (Typo replacement)
  const diffs: number[] = [];
  const maxLen = Math.max(origLen, candLen);
  for (let i = 0; i < maxLen; i++) {
    if ((originalWords[i] || "").toLowerCase() !== (candidateWords[i] || "").toLowerCase()) {
      diffs.push(i);
    }
  }
  return diffs;
}

export const RepairWorkspace: React.FC<RepairWorkspaceProps> = ({
  initialPhrase = "",
  onBackToVault,
  onOpenInSweeper,
  onApplyRepairedPhrase,
}) => {
  const { toast, importWallets } = useApp();
  const [phrase, setPhrase] = useState<string>(initialPhrase);
  const [targetAddress, setTargetAddress] = useState<string>("");
  const [candidateSearch, setCandidateSearch] = useState<string>("");
  const [importing, setImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Custom Hooks
  const {
    analysis,
    setAnalysis,
    loading,
    selectedSlot,
    setSelectedSlot,
    triggerAnalysis,
  } = useMnemonicAnalysis();

  // On-the-fly In-Memory Balance Scanner with continuous real-time queue streaming
  const {
    isOnTheFlyScanning,
    scanProgressInfo,
    isFundedWalletOpen,
    fundedWalletData,
    confirmImportFundedWallet,
    dismissFundedWallet,
    enqueuePhrases,
    resetScanQueue,
    stopScan,
  } = useOnTheFlyScan();

  // Persistent Recovery Session State
  const [activeSession, setActiveSession] = useState<SessionStats | null>(null);
  const [showSessionTracker, setShowSessionTracker] = useState<boolean>(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => {
    if (initialPhrase) {
      setPhrase(initialPhrase);
      setSelectedSlot("all");
      triggerAnalysis(initialPhrase, "", "all");
    }
  }, [initialPhrase, setSelectedSlot, triggerAnalysis]);

  // Session Polling with real-time on-the-fly streaming balance scan
  useEffect(() => {
    if (!activeSession || (activeSession.status !== "running" && activeSession.status !== "paused")) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const stat = await invoke<SessionStats>("get_recovery_session_status", {
          sessionId: activeSession.sessionId,
        });
        setActiveSession(stat);

        if (stat.targetMatch && !analysis?.targetMatch) {
          setAnalysis((prev) => (prev ? { ...prev, targetMatch: stat.targetMatch } : null));
          toast(`🎯 Target address match discovered on ${stat.targetMatch.chainFamily.toUpperCase()}!`, "success");
        }

        // Stream newly discovered candidate phrases to live in-memory balance scanner in real time!
        if (stat.recentSolutions && stat.recentSolutions.length > 0) {
          enqueuePhrases(stat.recentSolutions);
        }

        if (stat.status === "completed" || stat.status === "cancelled") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (stat.status === "completed") {
            toast(`✓ Sesi pencarian selesai! Ditemukan ${stat.solutionsCount.toLocaleString()} kombinasi valid.`, "success");
          }
        }
      } catch (e) {
        console.error("Session polling error:", e);
      }
    };

    pollingIntervalRef.current = setInterval(poll, 400);
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeSession?.sessionId, activeSession?.status, analysis?.targetMatch, setAnalysis, toast, enqueuePhrases]);

  // Clean up in-memory recovery session secrets ONLY upon unmount (Deliver-then-Wipe finalizer)
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sessionIdRef.current = activeSession?.sessionId ?? null;
  }, [activeSession?.sessionId]);

  useEffect(() => {
    return () => {
      const id = sessionIdRef.current;
      if (id) {
        invoke("clear_recovery_session", { sessionId: id }).catch(() => {});
      }
    };
  }, []);

  const handleStartSession = async () => {
    if (!phrase.trim()) return;
    try {
      resetScanQueue();
      setShowSessionTracker(true);
      const rec = await invoke<SessionStats>("start_recovery_session", {
        phrase: phrase.trim(),
        targetAddress: targetAddress.trim() || null,
      });
      setActiveSession({
        sessionId: rec.sessionId,
        status: "running",
        currentIndex: 0,
        totalCombinations: rec.totalCombinations,
        percent: 0,
        solutionsCount: 0,
        speedCps: 0,
        etaSeconds: null,
        targetMatch: null,
        recentSolutions: [],
      });
      toast(`🚀 Sesi pencarian 100% In-Memory #${rec.sessionId.slice(0, 8)} dimulai! Auto-scan saldo aktif secara live di RAM.`, "info");
    } catch (err) {
      toast(`Gagal memulai sesi: ${String(err)}`, "error");
    }
  };

  const handlePauseSession = async () => {
    if (!activeSession) return;
    try {
      await invoke("pause_recovery_session", { sessionId: activeSession.sessionId });
      setActiveSession((prev) => (prev ? { ...prev, status: "paused" } : null));
      toast("⏸ Sesi pemulihan dijeda di RAM.", "info");
    } catch (err) {
      toast(`Gagal menjeda sesi: ${String(err)}`, "error");
    }
  };

  const handleResumeSession = async () => {
    if (!activeSession) return;
    try {
      await invoke("resume_recovery_session", { sessionId: activeSession.sessionId });
      setActiveSession((prev) => (prev ? { ...prev, status: "running" } : null));
      toast("▶ Melanjutkan sesi pemulihan di RAM...", "info");
    } catch (err) {
      toast(`Gagal melanjutkan sesi: ${String(err)}`, "error");
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    try {
      await invoke("cancel_recovery_session", { sessionId: activeSession.sessionId });
      setActiveSession((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      toast("✕ Sesi pemulihan dibatalkan.", "info");
    } catch (err) {
      toast(`Gagal membatalkan sesi: ${String(err)}`, "error");
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
        onBackToVault();
        return;
      }

      const { added, skipped } = await importWallets(
        solutionsToApply,
        (current: number, total: number) => setImportProgress({ current, total })
      );
      if (added > 0) {
        toast(`Imported ${added} candidate wallets into vault (${skipped} duplicates)! Run 'Scan All' to find the funded wallet.`, "success");
        onBackToVault();
      } else if (skipped > 0) {
        toast(`All ${skipped} candidate wallets already exist in your vault.`, "info");
        onBackToVault();
      } else {
        toast("No wallets were imported.", "error");
      }
    } catch (err) {
      console.error("Batch import error:", err);
      toast(`Failed to import all candidates: ${String(err)}`, "error");
    } finally {
      setImporting(false);
    }
  };

  const handleDirectImport = async () => {
    const targetPhrase = phrase.trim();
    if (!targetPhrase) return;

    setImporting(true);
    try {
      if (onApplyRepairedPhrase) {
        onApplyRepairedPhrase(targetPhrase);
        toast("Frasa mnemonic diterapkan ke panel impor!", "success");
        onBackToVault();
        return;
      }

      const { added, skipped } = await importWallets(targetPhrase);
      if (added > 0) {
        toast("Dompet dari frasa valid berhasil diimpor ke Vault!", "success");
        onBackToVault();
      } else if (skipped > 0) {
        toast("Dompet sudah ada di dalam Vault Anda (duplikat).", "info");
        onBackToVault();
      } else {
        toast("Gagal menurunkan dompet valid dari frasa ini.", "error");
      }
    } catch (err) {
      console.error("Direct import error:", err);
      toast(`Gagal mengimpor frasa: ${String(err)}`, "error");
    } finally {
      setImporting(false);
    }
  };

  // Filtered & Parsed Candidates
  const origWords = useMemo(() => phrase.trim().split(/\s+/).filter(Boolean), [phrase]);

  const rawSessionSolutions = activeSession?.recentSolutions;

  const currentSolutionsPool = useMemo(() => {
    if (rawSessionSolutions && rawSessionSolutions.length > 0) {
      return rawSessionSolutions;
    }
    return analysis?.autoRepairedPhrases || [];
  }, [rawSessionSolutions, analysis?.autoRepairedPhrases]);

  const filteredSolutions = useMemo(() => {
    if (!currentSolutionsPool || currentSolutionsPool.length === 0) return [];
    if (!candidateSearch.trim()) return currentSolutionsPool;
    const q = candidateSearch.trim().toLowerCase();
    return currentSolutionsPool.filter((sol) => {
      const words = sol.trim().split(/\s+/);
      return words.some((w) => w.toLowerCase().startsWith(q));
    });
  }, [currentSolutionsPool, candidateSearch]);

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

  const parsedSolutions: ParsedSolution[] = useMemo(() => {
    return filteredSolutions.map((sol) => {
      const solWords = sol.trim().split(/\s+/);
      const diffIndices = findChangedWordIndices(origWords, solWords);
      const slotLabel = diffIndices.map((idx) => `Slot #${idx + 1}`).join(" & ");
      const solvedWords = diffIndices.map((idx) => solWords[idx] || "").join(" · ");
      return {
        phrase: sol,
        diffIndices,
        slotLabel,
        solvedWords,
        words: solWords,
      };
    });
  }, [filteredSolutions, origWords]);


  return (
    <div className="repair-workspace-panel">
      {/* 1. Top Hero Header (Identik rapi dengan Sweeper Workspace) */}
      <div className="repair-hero-header">
        <div className="repair-title-wrap">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-accent">BIP-39 FORENSIC HEURISTICS</span>
            {analysis?.detectedLanguage && analysis.detectedLanguage !== "english" && (
              <span className="badge badge-cyan">🌐 {analysis.detectedLanguage.toUpperCase()}</span>
            )}
            {analysis?.isDualWordMissing && (
              <span className="badge badge-warning">⚡ RAYON MULTI-THREAD</span>
            )}
          </div>
          <h2>Mnemonic Typo & Missing Word Recovery</h2>
          <p>
            Sistem diagnostik kriptografis untuk mendeteksi salah ketik kata (typo), memulihkan kata yang hilang, dan mencocokkan target address secara 100% presisi.
          </p>
        </div>

        <div className="repair-hero-actions">
          <button
            type="button"
            className={`btn btn-sm btn-session-toggle ${showSessionTracker ? "is-open" : ""}`}
            onClick={() => setShowSessionTracker((prev) => !prev)}
            title={showSessionTracker ? "Tutup panel Hardware Acceleration & Auto-Scan" : "Buka panel Hardware Acceleration & Auto-Scan"}
          >
            ⚡ Live RAM Acceleration
            {activeSession && activeSession.status === "running" && (
              <span className="session-status-pill status-running">
                <span className="pulse-dot" /> ⚡ AKTIF
              </span>
            )}
            {activeSession && activeSession.status === "paused" && (
              <span className="session-status-pill status-paused">
                <span className="pulse-dot" /> ⏸ PAUSED
              </span>
            )}
          </button>

          {onBackToVault && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onBackToVault}
              title="Kembali ke Vault Command Center"
            >
              <IconArrowLeft size={13} /> Back to Vault
            </button>
          )}
        </div>
      </div>

      {/* 2. Zero-Knowledge & Transposition Alerts */}
      <RayonMetricsBar analysis={analysis} onApplySolution={handleApplySolution} />

      {/* 3. Persistent Session Tracker (aktif jika dibuka via toggle atau saat sesi dimulai) */}
      {showSessionTracker && (
        <SessionTrackerCard
          activeSession={activeSession}
          selectedSlot={selectedSlot}
          dualWordSolutionsCount={analysis?.dualWordSolutionsCount}
          onStartSession={handleStartSession}
          onPauseSession={handlePauseSession}
          onResumeSession={handleResumeSession}
          onCancelSession={handleCancelSession}
          onClosePanel={() => setShowSessionTracker(false)}
          onStopScan={stopScan}
          isOnTheFlyScanning={isOnTheFlyScanning}
          scanProgressInfo={scanProgressInfo}
          isSingleWordMissing={Boolean(analysis?.isSingleWordMissing)}
        />
      )}

      {/* 4. Main Body: 3-Panel Flanking Layout (Selalu tampil permanen dengan tinggi yang sama) */}
      <div className="mnemonic-workspace-body">
        <LeftSolutionsPanel
          analysis={analysis}
          activeSession={activeSession}
          filteredSolutions={filteredSolutions}
          parsedSolutions={parsedSolutions}
          selectedSlot={selectedSlot}
          isOnTheFlyScanning={isOnTheFlyScanning}
          scanProgressInfo={scanProgressInfo}
          onApplySolution={handleApplySolution}
          onApplyAll={handleApplyAll}
          importing={importing}
          importProgress={importProgress}
        />

        <CenterEditorPanel
          phrase={phrase}
          setPhrase={setPhrase}
          targetAddress={targetAddress}
          setTargetAddress={setTargetAddress}
          analysis={analysis}
          loading={loading}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          triggerAnalysis={triggerAnalysis}
          onWordReplace={handleWordReplace}
          onApplySolution={handleApplySolution}
          onDirectImport={handleDirectImport}
          importing={importing}
        />

        <RightCandidatesPanel
          phrase={phrase}
          analysis={analysis}
          activeSession={activeSession}
          selectedSlot={selectedSlot}
          filteredSolutions={filteredSolutions}
          filteredAllCandidates={filteredAllCandidates}
          filteredSingleCandidates={filteredSingleCandidates}
          parsedSolutions={parsedSolutions}
          candidateSearch={candidateSearch}
          setCandidateSearch={setCandidateSearch}
          onApplySolution={handleApplySolution}
          onWordReplace={handleWordReplace}
        />
      </div>

      {/* Celebratory Funded Wallet Modal with Guardrail */}
      <FundedWalletModal
        isOpen={isFundedWalletOpen}
        data={fundedWalletData}
        onClose={dismissFundedWallet}
        onConfirmImport={confirmImportFundedWallet}
        onOpenInVault={() => {
          dismissFundedWallet();
          onBackToVault();
        }}
        onOpenInSweeper={
          onOpenInSweeper
            ? () => {
                dismissFundedWallet();
                onOpenInSweeper();
              }
            : undefined
        }
      />
    </div>
  );
};
