import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useApp } from "../context/AppContext";
import { WindowControls } from "./WindowControls";
import { IconShield, IconLock, IconScan, IconZap, IconKey, IconEye, IconEyeOff } from "../icons";

function AuthLayout({ children, title, desc }: { children: ReactNode; title: string; desc: string }) {
  return (
    <section className="opening">
      {/* ── Window Titlebar ── */}
      <div className="opening-topbar" data-tauri-drag-region>
        <div className="opening-topbar-left">
          <img src="/app-icon.png" alt="Plurivex" style={{ width: "16px", height: "16px", borderRadius: "4px", objectFit: "contain" }} />
          <span className="opening-topbar-title">Plurivex — Vault Console</span>
        </div>
        <div className="opening-topbar-status">
          <span><span className="tb-dot" />Aman · Argon2id</span>
          <span>Zero-Cloud</span>
        </div>
        <WindowControls />
      </div>

      {/* ── Split Screen Body ── */}
      <div className="opening-body">
        {/* Left Hero Panel */}
        <div className="op-left">
          <div>
            <div className="brand-row">
              <img src="/app-icon.png" alt="Plurivex" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "contain" }} />
              <div className="brand-txt">
                <b>PLURIVEX</b>
                <span>SECURE VAULT CONSOLE</span>
              </div>
            </div>

            <h1 style={{ marginTop: "48px" }}>
              Vault Anda.<br />
              <em>Sepenuhnya di tangan Anda.</em>
            </h1>
            <p className="sub">
              Kumpulkan, pindai, dan amankan aset digital dari banyak dompet — sekali alur, semua di satu tempat yang ramah dan terenkripsi.
            </p>

            <ul className="feat">
              <li>
                <span className="ic"><IconShield size={15} /></span>
                <span><b>Keamanan berlapis</b> — PIN 6-digit, kata sandi master, dan enkripsi penuh di perangkat lokal.</span>
              </li>
              <li>
                <span className="ic"><IconScan size={15} /></span>
                <span><b>Pemindaian langsung</b> — Temukan saldo yang tersebar di ribuan alamat multi-chain secara instan.</span>
              </li>
              <li>
                <span className="ic"><IconZap size={15} /></span>
                <span><b>Sweep sekali klik</b> — Kumpulkan semua aset dari banyak dompet dengan aman dan hemat gas.</span>
              </li>
            </ul>
          </div>

          <div className="foot">
            <span className="dot" />
            Sistem aman · Semua kunci tersimpan lokal di SQLite terenkripsi · v0.1.0
          </div>
        </div>

        {/* Right Auth Card Panel */}
        <div className="op-right">
          <div className="lock-card">
            <div className="lock-ic">
              <IconLock size={22} />
            </div>
            <h2>{title}</h2>
            <p className="hint">{desc}</p>
            {children}
            <div className="auth-features">
              <span>Argon2id</span>
              <span>AES-256</span>
              <span>SQLite</span>
              <span>Zero-Cloud</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SetupScreen() {
  const { setupPassword } = useApp();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (pw.length < 8) { setError("Kata sandi minimal 8 karakter"); return; }
    if (pw !== confirm) { setError("Kata sandi konfirmasi tidak cocok"); return; }
    if (pin && pin.trim().length > 0 && pin.trim().length !== 6) {
      setError("PIN cepat harus tepat 6 digit angka");
      return;
    }
    setLoading(true);
    try {
      await setupPassword(pw, pin.trim());
    } catch {
      setError("Gagal membuat vault");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Buat Vault Baru" desc="Kata sandi master akan mengenkripsi seluruh seed phrase & private key di perangkat Anda.">
      <div className="field">
        <label><IconLock size={12} /> Kata Sandi Master</label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Minimal 8 karakter"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ paddingRight: "36px" }}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
          >
            {showPw ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
        </div>
      </div>

      <div className="field">
        <label><IconLock size={12} /> Konfirmasi Kata Sandi</label>
        <input
          type={showPw ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Ulangi kata sandi"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>

      <div className="field" style={{ marginTop: "12px", borderTop: "1px dashed var(--border)", paddingTop: "12px" }}>
        <label><IconKey size={12} /> PIN Cepat 6-Digit (Opsional)</label>
        <input
          type="password"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Contoh: 123456 (untuk buka cepat)"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <span style={{ fontSize: "10px", color: "var(--text-dim)", display: "block", marginTop: "3px" }}>
          Gunakan PIN 6 digit untuk membuka vault harian secara instan via keypad.
        </span>
      </div>

      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary btn-block" style={{ height: "44px", marginTop: "14px" }} onClick={submit} disabled={loading}>
        {loading ? "Membuat vault…" : "Buat Vault Lokal →"}
      </button>
    </AuthLayout>
  );
}

export function UnlockScreen() {
  const { unlock, unlockWithPin, resetVault, hasPin } = useApp();
  const [authMode, setAuthMode] = useState<"pin" | "password">(hasPin ? "pin" : "password");
  const [pin, setPin] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Handle PIN submission
  const handlePinSubmit = useCallback(async (pinToSubmit: string) => {
    if (pinToSubmit.length < 4) {
      setError("Masukkan minimal 4-6 digit PIN");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ok = await unlockWithPin(pinToSubmit);
      if (!ok) {
        setError("PIN yang dimasukkan salah");
        setPin("");
      }
    } catch (err) {
      setError(`Gagal membuka vault: ${String(err)}`);
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [unlockWithPin]);

  // Handle Master Password submission
  const handlePwSubmit = async () => {
    if (!pw.trim()) {
      setError("Masukkan kata sandi master");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ok = await unlock(pw);
      if (!ok) setError("Kata sandi master salah");
    } catch (err) {
      setError(`Gagal membuka vault: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard listener for PIN mode
  useEffect(() => {
    if (authMode !== "pin" || isForgotOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setPin((prev) => {
          if (prev.length < 6) {
            const next = prev + e.key;
            if (next.length === 6) {
              setTimeout(() => handlePinSubmit(next), 50);
            }
            return next;
          }
          return prev;
        });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pin.length > 0) {
          handlePinSubmit(pin);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authMode, pin, isForgotOpen, handlePinSubmit]);

  const handleKeypadPress = (val: string) => {
    if (loading) return;
    setError("");
    if (val === "backspace") {
      setPin((prev) => prev.slice(0, -1));
    } else if (val === "switch") {
      setAuthMode((m) => (m === "pin" ? "password" : "pin"));
    } else {
      setPin((prev) => {
        if (prev.length < 6) {
          const next = prev + val;
          if (next.length === 6) {
            setTimeout(() => handlePinSubmit(next), 50);
          }
          return next;
        }
        return prev;
      });
    }
  };

  const handleExecuteReset = async () => {
    if (resetConfirmInput.trim().toUpperCase() !== "RESET") {
      setError("Ketik 'RESET' untuk mengonfirmasi penghapusan vault");
      return;
    }
    setIsResetting(true);
    try {
      await resetVault();
      setIsForgotOpen(false);
    } catch (err) {
      setError(`Gagal mereset vault: ${String(err)}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <AuthLayout
        title="Buka Vault"
        desc={
          authMode === "pin"
            ? "Masukkan PIN 6 digit untuk membuka vault Anda"
            : "Masukkan kata sandi master untuk mengakses dompet terenkripsi"
        }
      >
        {authMode === "pin" ? (
          <div>
            {/* 6 Pindots Indicator */}
            <div className="pindots">
              {Array.from({ length: 6 }).map((_, i) => (
                <i key={i} className={i < pin.length ? "on" : ""} />
              ))}
            </div>

            {/* 3x4 Keypad Grid */}
            <div className="keypad">
              <button type="button" onClick={() => handleKeypadPress("1")}>1</button>
              <button type="button" onClick={() => handleKeypadPress("2")}>2</button>
              <button type="button" onClick={() => handleKeypadPress("3")}>3</button>
              <button type="button" onClick={() => handleKeypadPress("4")}>4</button>
              <button type="button" onClick={() => handleKeypadPress("5")}>5</button>
              <button type="button" onClick={() => handleKeypadPress("6")}>6</button>
              <button type="button" onClick={() => handleKeypadPress("7")}>7</button>
              <button type="button" onClick={() => handleKeypadPress("8")}>8</button>
              <button type="button" onClick={() => handleKeypadPress("9")}>9</button>
              <button
                type="button"
                className="ghost"
                onClick={() => handleKeypadPress("switch")}
                title="Beralih ke Kata Sandi"
              >
                <IconKey size={17} />
              </button>
              <button type="button" onClick={() => handleKeypadPress("0")}>0</button>
              <button
                type="button"
                className="ghost"
                onClick={() => handleKeypadPress("backspace")}
                title="Hapus Digit"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 5H8.5L2.5 12l6 7H21a1 1 0 001-1V6a1 1 0 00-1-1z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>
                </svg>
              </button>
            </div>

            {error && <p className="field-error" style={{ textAlign: "center", marginBottom: "12px" }}>{error}</p>}

            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ height: "46px" }}
              onClick={() => handlePinSubmit(pin)}
              disabled={loading || pin.length === 0}
            >
              {loading ? "Membuka Vault…" : "Buka Vault →"}
            </button>
          </div>
        ) : (
          <div>
            <div className="field">
              <label><IconLock size={12} /> Kata Sandi Master</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  onKeyDown={(e) => e.key === "Enter" && handlePwSubmit()}
                  autoFocus
                  style={{ paddingRight: "36px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                >
                  {showPw ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                </button>
              </div>
            </div>

            {error && <p className="field-error">{error}</p>}

            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ height: "46px", marginTop: "14px" }}
              onClick={handlePwSubmit}
              disabled={loading}
            >
              {loading ? "Membuka Vault…" : "Buka Vault →"}
            </button>
          </div>
        )}

        {/* Alternative Links (Switcher & Forgot Password) */}
        <div className="alt-links-row">
          <button
            type="button"
            className="alt-link"
            onClick={() => {
              setError("");
              setAuthMode((m) => (m === "pin" ? "password" : "pin"));
            }}
          >
            {authMode === "pin" ? "Lanjut dengan kata sandi" : "Lanjut dengan PIN"}
          </button>
          <button
            type="button"
            className="alt-link"
            onClick={() => {
              setError("");
              setResetConfirmInput("");
              setIsForgotOpen(true);
            }}
          >
            Lupa kata sandi?
          </button>
        </div>
      </AuthLayout>

      {/* ── Modal Dialog: Lupa Kata Sandi / Reset Vault ── */}
      {isForgotOpen && (
        <div className="forgot-modal-overlay" onClick={() => !isResetting && setIsForgotOpen(false)}>
          <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-modal-ic">
                <IconShield size={20} />
              </div>
              <div className="forgot-modal-title">
                <h3>Pemulihan &amp; Reset Vault</h3>
                <span>Sistem Brankas Lokal (Zero-Cloud Storage)</span>
              </div>
            </div>

            <div className="forgot-modal-body">
              <p>
                <b>Plurivex</b> beroperasi secara 100% lokal di perangkat Anda. Demi privasi dan keamanan tingkat militer, tidak ada server terpusat yang menyimpan cadangan kata sandi Anda.
              </p>
              <p style={{ color: "var(--warning)" }}>
                ⚠️ Jika Anda lupa kata sandi master, Anda harus mereset brankas ini dan mengimpor ulang dompet menggunakan Seed Phrase atau Private Key cadangan Anda.
              </p>

              <div className="field" style={{ marginTop: "16px" }}>
                <label>Ketik <b style={{ color: "var(--danger)" }}>RESET</b> untuk mengonfirmasi:</label>
                <input
                  type="text"
                  value={resetConfirmInput}
                  onChange={(e) => setResetConfirmInput(e.target.value)}
                  placeholder="RESET"
                  autoFocus
                />
              </div>
            </div>

            <div className="forgot-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsForgotOpen(false)}
                disabled={isResetting}
              >
                Kembali
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleExecuteReset}
                disabled={resetConfirmInput.trim().toUpperCase() !== "RESET" || isResetting}
              >
                {isResetting ? "Mereset…" : "Reset & Buat Baru"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}