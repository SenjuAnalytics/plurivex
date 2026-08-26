import { useState, type ReactNode } from "react";
import { useApp } from "../context/AppContext";
import { IconShield, IconWallet, IconLock } from "./Icons";

function AuthLayout({ children, title, desc }: { children: ReactNode; title: string; desc: string }) {
  return (
    <div className="auth-screen">
      <div className="auth-mesh" aria-hidden />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon"><IconWallet size={22} /></div>
          <div>
            <span className="auth-brand-name">Plurivex</span>
            <span className="auth-brand-tag"><IconShield size={11} /> 100% Local</span>
          </div>
        </div>
        <h1>{title}</h1>
        <p>{desc}</p>
        {children}
        <div className="auth-features">
          <span>AES-256</span>
          <span>SQLite</span>
          <span>No cloud</span>
        </div>
      </div>
    </div>
  );
}

export function SetupScreen() {
  const { setupPassword } = useApp();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (pw.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (pw !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try { await setupPassword(pw); } catch { setError("Failed to create vault"); }
    finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Create Local Vault" desc="Your master password encrypts all seed phrases & private keys on your device. Only you can unlock it.">
      <div className="field">
        <label><IconLock size={12} /> Master Password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
      <div className="field">
        <label><IconLock size={12} /> Confirm Password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary btn-block" onClick={submit} disabled={loading}>
        {loading ? "Creating vault…" : "Create Vault →"}
      </button>
    </AuthLayout>
  );
}

export function UnlockScreen() {
  const { unlock } = useApp();
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const ok = await unlock(pw);
      if (!ok) setError("Incorrect password");
    } catch (err) {
      setError(`Failed to unlock vault: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Unlock Vault" desc="Enter your master password to access your encrypted wallets.">
      <div className="field">
        <label><IconLock size={12} /> Master Password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter your password" onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary btn-block" onClick={submit} disabled={loading}>
        {loading ? "Unlocking…" : "Unlock Vault →"}
      </button>
    </AuthLayout>
  );
}