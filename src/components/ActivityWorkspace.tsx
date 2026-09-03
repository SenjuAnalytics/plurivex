import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { IconSearch } from "../icons";

interface ActivityWorkspaceProps {
  onBack?: () => void;
  onOpenSweeper?: () => void;
}

interface ActivityItem {
  id: string;
  type: "sweep" | "scan" | "security" | "import" | "trade";
  title: string;
  desc: string;
  amount?: string;
  amountColor?: string;
  time: string;
  badge: string;
  badgeType: "ok" | "warn" | "acc" | "ghost";
}

export function ActivityWorkspace({ onBack, onOpenSweeper }: ActivityWorkspaceProps) {
  const { wallets, fundedCount } = useApp();
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const rawActivities: ActivityItem[] = useMemo(() => [
    {
      id: "act-1",
      type: "security",
      title: "Pemeriksaan Vault Lokal",
      desc: `${wallets.length} alamat terenkripsi SQLite Cipher di RAM/Disk aman`,
      amount: "Terkunci",
      amountColor: "var(--ok)",
      time: "Baru saja",
      badge: "Keamanan",
      badgeType: "ok",
    },
    {
      id: "act-2",
      type: "scan",
      title: "Sinkronisasi Node Multi-Chain",
      desc: "Node RPC EVM (12ms), Solana (38ms), dan Bitcoin aktif",
      amount: "88 ms",
      amountColor: "var(--text)",
      time: "10 menit lalu",
      badge: "RPC Node",
      badgeType: "ghost",
    },
    {
      id: "act-3",
      type: "import",
      title: "Penerimaan & Monitoring Dompet",
      desc: `${fundedCount} dompet dengan saldo multi-chain live terdeteksi`,
      amount: `${fundedCount} Dompet`,
      amountColor: "var(--ok)",
      time: "Hari ini",
      badge: "Monitoring",
      badgeType: "acc",
    },
    {
      id: "act-4",
      type: "sweep",
      title: "Engine Sweeper Siaga",
      desc: "Perlindungan anti-drainer & simulasi gas batch siap dijalankan",
      amount: "Standby",
      amountColor: "var(--accent)",
      time: "1 hari lalu",
      badge: "Sweeper",
      badgeType: "acc",
    },
    {
      id: "act-5",
      type: "security",
      title: "Argon2id Key Derivation",
      desc: "Proteksi brute-force lokal 64MB memory cost aktif",
      amount: "Aman",
      amountColor: "var(--ok)",
      time: "2 hari lalu",
      badge: "Zero-Cloud",
      badgeType: "ok",
    },
  ], [wallets.length, fundedCount]);

  const filtered = useMemo(() => {
    return rawActivities.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.desc.toLowerCase().includes(q);
        const matchBadge = item.badge.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchBadge) return false;
      }
      return true;
    });
  }, [rawActivities, filterType, searchQuery]);

  return (
    <div className="activity-workspace-view" style={{ padding: "20px 24px" }}>
      {/* ── Page Header ── */}
      <div className="page-head">
        <div className="grow">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            {onBack && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onBack}
                style={{ height: "26px", padding: "0 8px", fontSize: "11px" }}
              >
                ← Beranda
              </button>
            )}
            <h1 style={{ margin: 0 }}>Log Aktivitas &amp; Audit Vault</h1>
          </div>
          <p>Riwayat seluruh operasi, pemindaian saldo, eksekusi sweeper, dan keamanan sistem lokal.</p>
        </div>
        <div className="page-head-actions">
          <span className="badge b-acc" style={{ height: "26px", padding: "0 10px", fontSize: "10.5px" }}>
            {rawActivities.length} Riwayat Tercatat
          </span>
          {onOpenSweeper && (
            <button
              type="button"
              className="btn primary"
              onClick={onOpenSweeper}
              style={{ height: "30px", fontSize: "11px" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
              </svg>
              Buka Sweeper
            </button>
          )}
        </div>
      </div>

      {/* ── Filter & Search Bar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "16px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: "6px", background: "var(--surface-inset)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border)" }}>
          <button
            type="button"
            className={`btn-filter-pill ${filterType === "all" ? "active" : ""}`}
            onClick={() => setFilterType("all")}
          >
            Semua ({rawActivities.length})
          </button>
          <button
            type="button"
            className={`btn-filter-pill ${filterType === "sweep" ? "active" : ""}`}
            onClick={() => setFilterType("sweep")}
          >
            Sweeper
          </button>
          <button
            type="button"
            className={`btn-filter-pill ${filterType === "scan" ? "active" : ""}`}
            onClick={() => setFilterType("scan")}
          >
            Pemindaian
          </button>
          <button
            type="button"
            className={`btn-filter-pill ${filterType === "security" ? "active" : ""}`}
            onClick={() => setFilterType("security")}
          >
            Keamanan
          </button>
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "4px 10px",
          minWidth: "220px",
        }}>
          <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
            <IconSearch size={13} />
          </span>
          <input
            type="text"
            placeholder="Cari riwayat aktivitas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              padding: "0",
              fontSize: "11.5px",
              color: "var(--text)",
              outline: "none",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: "0" }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Activities Card Container ── */}
      <div className="card pad" style={{ padding: "8px 16px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--text-dim)" }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>🔍</div>
            <strong style={{ color: "var(--text)", fontSize: "13px" }}>Tidak Ada Aktivitas Sesuai Filter</strong>
            <p style={{ fontSize: "11px", marginTop: "4px" }}>Coba ubah filter atau kata kunci pencarian Anda.</p>
          </div>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={item.id}
              className="act-row"
              style={{ padding: "12px 6px", borderBottom: idx === filtered.length - 1 ? "none" : "1px solid var(--border)" }}
            >
              <span className="aic" style={{ width: "32px", height: "32px", borderRadius: "10px" }}>
                {item.type === "sweep" ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                  </svg>
                ) : item.type === "security" ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z" />
                  </svg>
                ) : item.type === "scan" ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                )}
              </span>

              <div className="act-txt" style={{ marginLeft: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <b style={{ fontSize: "12px", color: "var(--text)" }}>{item.title}</b>
                  <span className={`badge b-${item.badgeType}`} style={{ fontSize: "8.5px", height: "16px", padding: "0 6px" }}>
                    {item.badge}
                  </span>
                </div>
                <span style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "2px", display: "block" }}>
                  {item.desc}
                </span>
              </div>

              {item.amount && (
                <span className="amt mono" style={{ color: item.amountColor || "var(--text)", fontSize: "11.5px", fontWeight: "700" }}>
                  {item.amount}
                </span>
              )}

              <span className="t" style={{ fontSize: "10px", color: "var(--text-dim)", minWidth: "70px", textAlign: "right" }}>
                {item.time}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
