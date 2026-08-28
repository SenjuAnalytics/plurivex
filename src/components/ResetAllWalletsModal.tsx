import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";

export function ResetAllWalletsModal() {
  const { isResetModalOpen, setIsResetModalOpen, wallets, resetAllWallets } = useApp();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isResetModalOpen) {
      setPassword("");
      setError(null);
      setLoading(false);
      setShowPassword(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isResetModalOpen]);

  if (!isResetModalOpen) return null;

  const handleClose = () => {
    if (loading) return;
    setIsResetModalOpen(false);
  };

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setError("Silakan masukkan Master Password Anda.");
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await resetAllWallets(password);
      if (res.success) {
        setIsResetModalOpen(false);
      } else {
        setError(res.error || "Kata sandi salah. Verifikasi gagal.");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(`Gagal me-reset: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-card reset-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Glow Header Accent Bar */}
        <div className="reset-card-glow-bar" />

        <div className="reset-modal-header">
          <div className="reset-modal-title-row">
            <div className="reset-modal-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <h3 className="reset-title-text">Reset All Wallets</h3>
              <p className="reset-modal-subtitle">Tindakan Permanen & Pembersihan Vault Database</p>
            </div>
          </div>
          <button
            type="button"
            className="reset-modal-close-btn"
            onClick={handleClose}
            disabled={loading}
            title="Tutup (ESC)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleConfirm}>
          <div className="reset-modal-body">
            {/* Warning Card */}
            <div className="reset-warning-banner">
              <div className="reset-warning-accent-line" />
              <div className="reset-warning-top">
                <span className="reset-warning-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  PERINGATAN KRITIS
                </span>
                <span className="reset-counter-pill mono">
                  {wallets.length.toLocaleString()} Wallets
                </span>
              </div>
              <p className="reset-warning-text">
                Anda akan menghapus permanen seluruh <strong className="text-white">{wallets.length.toLocaleString()} dompet</strong>,
                saldo, dan data private key dari database SQLite lokal. Tindakan ini <strong className="text-red-highlight">tidak dapat dibatalkan</strong>.
              </p>
            </div>

            {/* Password Input Field */}
            <div className="reset-input-group">
              <label className="reset-input-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Konfirmasi dengan Master Password:</span>
              </label>

              <div className={`reset-password-input-wrap ${error ? "has-error" : ""}`}>
                <span className="reset-input-prefix-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>

                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  className="reset-password-input"
                  placeholder="Masukkan Master Password Anda…"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={loading}
                />

                <button
                  type="button"
                  className="reset-pwd-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? "Sembunyikan Kata Sandi" : "Lihat Kata Sandi"}
                >
                  {showPassword ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                      <span>Tutup</span>
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <span>Lihat</span>
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="reset-error-msg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="reset-modal-footer">
            <button
              type="button"
              className="reset-btn-cancel"
              onClick={handleClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="reset-btn-danger"
              disabled={loading || !password.trim()}
            >
              {loading ? (
                <>
                  <span className="btn-spinner-red" />
                  <span>Membersihkan Database…</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  <span>Hapus Seluruh {wallets.length.toLocaleString()} Dompet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
