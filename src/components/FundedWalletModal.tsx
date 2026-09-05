import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export interface FundedWalletData {
  phrase: string;
  btcAddress?: string | null;
  btcBalance?: string | null;
  evmAddress?: string | null;
  evmBalances?: Record<string, string>;
  solAddress?: string | null;
  solBalance?: string | null;
  totalUsdEstimate?: number;
}

interface FundedWalletModalProps {
  isOpen: boolean;
  data: FundedWalletData | null;
  onClose: () => void;
  onConfirmImport?: (phrase: string) => Promise<boolean>;
  onOpenInVault?: () => void;
  onOpenInSweeper?: () => void;
}

export function FundedWalletModal({
  isOpen,
  data,
  onClose,
  onConfirmImport,
  onOpenInVault,
  onOpenInSweeper,
}: FundedWalletModalProps) {
  const [isImported, setIsImported] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsImported(false);
      setIsImporting(false);
      setCopied(false);
    }
  }, [isOpen, data?.phrase]);

  if (!isOpen || !data) return null;

  const handleCopyPhrase = () => {
    navigator.clipboard.writeText(data.phrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleImportToVault = async () => {
    setIsImporting(true);
    let success = true;
    if (onConfirmImport) {
      success = await onConfirmImport(data.phrase);
    }
    setIsImporting(false);
    if (success) {
      setIsImported(true);
      if (onOpenInVault) {
        onOpenInVault();
      }
    }
  };

  const handleImportAndSweep = async () => {
    setIsImporting(true);
    let success = true;
    if (onConfirmImport) {
      success = await onConfirmImport(data.phrase);
    }
    setIsImporting(false);
    if (success) {
      setIsImported(true);
      if (onOpenInSweeper) {
        onOpenInSweeper();
      }
    }
  };

  return createPortal(
    <div className="modal-backdrop jackpot-backdrop" onClick={onClose}>
      <div className="jackpot-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Celebration Shimmer Header */}
        <div className="jackpot-modal-glow" aria-hidden />

        <div className="jackpot-badge-row">
          <span className="jackpot-sparkle-pill">🎉 FUNDED WALLET DETECTED</span>
          <span className="jackpot-usd-badge">
            Est. ~${data.totalUsdEstimate ? data.totalUsdEstimate.toFixed(2) : "0.00"} USD
          </span>
        </div>

        <h2 className="jackpot-title">
          {isImported ? "Dompet Berhasil Diamankan ke Vault!" : "Dompet Berisi Saldo Ditemukan!"}
        </h2>
        <p className="jackpot-subtitle">
          {isImported
            ? "Frasa pemulihan telah disimpan secara lokal ke Vault SQLite terenkripsi Argon2id Anda."
            : "Kombinasi frasa pemulihan valid terdeteksi memiliki saldo on-chain aktif. Tinjau rincian di bawah ini sebelum menyimpannya ke Vault lokal terenkripsi."}
        </p>

        {/* Guardrail Banner */}
        {isImported ? (
          <div className="jackpot-saved-banner">
            <span className="jackpot-guardrail-icon">✅</span>
            <div>
              <strong>Tersimpan di Vault:</strong> Dompet telah masuk ke database lokal dan siap dipantau atau disweep.
            </div>
          </div>
        ) : (
          <div className="jackpot-guardrail-banner">
            <span className="jackpot-guardrail-icon">🛡️</span>
            <div>
              <strong>Guardrail Vault Aktif:</strong> Dompet ini <u>belum</u> disimpan ke database lokal. Konfirmasi penyimpanan di bawah, atau salin frasa saja demi keamanan.
            </div>
          </div>
        )}

        {/* Mnemonic Box */}
        <div className="jackpot-phrase-box">
          <div className="jackpot-phrase-header">
            <span className="text-xxs font-bold text-amber-400">BIP-39 RECOVERED MNEMONIC</span>
            <button
              type="button"
              className="btn btn-xs btn-ghost text-amber-200"
              onClick={handleCopyPhrase}
            >
              📋 Salin Frasa
            </button>
          </div>
          <p className="jackpot-phrase-text mono">{data.phrase}</p>
        </div>

        {/* Network Balance Breakdown */}
        <div className="jackpot-balances-grid">
          {data.btcAddress && (
            <div className="jackpot-balance-item">
              <span className="jackpot-chain-name text-amber-400">Bitcoin (BTC)</span>
              <span className="jackpot-addr mono">{data.btcAddress.slice(0, 10)}…{data.btcAddress.slice(-6)}</span>
              <span className="jackpot-bal text-emerald font-bold">{data.btcBalance || "0 BTC"}</span>
            </div>
          )}

          {data.evmAddress && (
            <div className="jackpot-balance-item">
              <span className="jackpot-chain-name text-cyan">EVM (Ethereum / L2)</span>
              <span className="jackpot-addr mono">{data.evmAddress.slice(0, 8)}…{data.evmAddress.slice(-6)}</span>
              <div className="jackpot-evm-chains">
                {data.evmBalances && Object.entries(data.evmBalances).map(([chain, bal]) => (
                  <span key={chain} className="jackpot-mini-tag">
                    {chain.toUpperCase()}: <strong>{bal}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.solAddress && (
            <div className="jackpot-balance-item">
              <span className="jackpot-chain-name text-purple-400">Solana (SOL)</span>
              <span className="jackpot-addr mono">{data.solAddress.slice(0, 8)}…{data.solAddress.slice(-6)}</span>
              <span className="jackpot-bal text-emerald font-bold">{data.solBalance || "0 SOL"}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {/* Action Buttons with Guardrail Confirmation */}
        <div className="jackpot-actions-row">
          {!isImported ? (
            <>
              <button
                type="button"
                className="btn btn-primary jackpot-primary-btn"
                disabled={isImporting}
                onClick={handleImportToVault}
              >
                {isImporting ? "Menyimpan…" : "🔐 Simpan ke Vault"}
              </button>

              {onOpenInSweeper && (
                <button
                  type="button"
                  className="btn btn-outline-accent"
                  disabled={isImporting}
                  onClick={handleImportAndSweep}
                >
                  ⚡ Simpan & Sweep
                </button>
              )}

              <button
                type="button"
                className="jackpot-btn-copy-only"
                onClick={handleCopyPhrase}
              >
                {copied ? "✓ Tersalin!" : "📋 Salin Saja"}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
              >
                Abaikan
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary jackpot-primary-btn"
                onClick={() => {
                  if (onOpenInVault) onOpenInVault();
                  onClose();
                }}
              >
                🔐 Buka di Vault
              </button>

              {onOpenInSweeper && (
                <button
                  type="button"
                  className="btn btn-outline-accent"
                  onClick={() => {
                    onOpenInSweeper();
                    onClose();
                  }}
                >
                  ⚡ Buka di Sweeper
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
              >
                Tutup
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
