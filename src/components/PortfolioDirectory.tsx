import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { IconWallet, IconScan, IconSearch } from "../icons";

interface PortfolioDirectoryProps {
  onOpenImport?: () => void;
  onOpenSweeper?: () => void;
}

export function PortfolioDirectory({ onOpenImport }: PortfolioDirectoryProps) {
  const {
    wallets,
    setSelectedId,
    scanAll,
    scanning,
    fundedCount,
    toast,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<"all" | "funded" | "evm" | "sol" | "btc">("all");
  const [localSearch, setLocalSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const evmCount = useMemo(() => wallets.filter((w) => Boolean(w.address)).length, [wallets]);
  const solCount = useMemo(() => wallets.filter((w) => Boolean(w.solAddress)).length, [wallets]);
  const btcCount = useMemo(() => wallets.filter((w) => Boolean(w.btcAddress)).length, [wallets]);

  const filteredList = useMemo(() => {
    return wallets.filter((w) => {
      // 1. Category Filter
      if (activeFilter === "funded" && !w.hasFunds) return false;
      if (activeFilter === "evm" && !w.address) return false;
      if (activeFilter === "sol" && !w.solAddress) return false;
      if (activeFilter === "btc" && !w.btcAddress) return false;

      // 2. Search Filter
      if (localSearch.trim()) {
        const q = localSearch.toLowerCase().trim();
        const idMatch = `#${w.id}`.includes(q) || String(w.id) === q;
        const addrMatch =
          Boolean(w.address?.toLowerCase().includes(q)) ||
          Boolean(w.solAddress?.toLowerCase().includes(q)) ||
          Boolean(w.btcAddress?.toLowerCase().includes(q));
        const labelMatch = Boolean(w.label?.toLowerCase().includes(q));
        if (!idMatch && !addrMatch && !labelMatch) return false;
      }
      return true;
    });
  }, [wallets, activeFilter, localSearch]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast("Alamat disalin ke clipboard", "success");
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="portfolio-directory-view" style={{ padding: "20px 24px" }}>
      {/* ── Portfolio Header Hero ── */}
      <div className="portfolio-hero-bar" style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "20px 24px",
        marginBottom: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-border)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent)"
            }}>
              <IconWallet size={15} />
            </span>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
              Inventori Portofolio &amp; Dompet
            </h2>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0 }}>
            Kelola {wallets.length} alamat dompet multi-chain terenkripsi di perangkat lokal Anda.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => scanAll()}
            disabled={scanning || wallets.length === 0}
            style={{ height: "36px", fontSize: "11.5px" }}
          >
            <IconScan size={14} />
            <span>{scanning ? "Memindai…" : "Scan Saldo"}</span>
          </button>

          {onOpenImport && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenImport}
              style={{ height: "36px", fontSize: "11.5px" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Import Dompet</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Filter & Search Control Bar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "14px",
        flexWrap: "wrap"
      }}>
        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "6px", background: "var(--surface-inset)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border)" }}>
          <button
            type="button"
            className={`btn-filter-pill ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            Semua ({wallets.length})
          </button>
          <button
            type="button"
            className={`btn-filter-pill ${activeFilter === "funded" ? "active" : ""}`}
            onClick={() => setActiveFilter("funded")}
          >
            Berisi Saldo ({fundedCount})
          </button>
          <button
            type="button"
            className={`btn-filter-pill ${activeFilter === "evm" ? "active" : ""}`}
            onClick={() => setActiveFilter("evm")}
          >
            EVM ({evmCount})
          </button>
          <button
            type="button"
            className={`btn-filter-pill ${activeFilter === "sol" ? "active" : ""}`}
            onClick={() => setActiveFilter("sol")}
          >
            Solana ({solCount})
          </button>
          {btcCount > 0 && (
            <button
              type="button"
              className={`btn-filter-pill ${activeFilter === "btc" ? "active" : ""}`}
              onClick={() => setActiveFilter("btc")}
            >
              Bitcoin ({btcCount})
            </button>
          )}
        </div>

        {/* Local Search Input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "4px 10px",
          minWidth: "220px"
        }}>
          <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
            <IconSearch size={13} />
          </span>
          <input
            type="text"
            placeholder="Cari ID, alamat, atau label..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              padding: "0",
              fontSize: "11.5px",
              color: "var(--text)",
              outline: "none",
              width: "100%"
            }}
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch("")}
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: "0" }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Wallets Table ── */}
      {filteredList.length === 0 ? (
        <div className="sweeper-empty-notice" style={{ marginTop: "12px", textAlign: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
            <strong style={{ fontSize: "14px", color: "var(--text)" }}>Tidak Ada Dompet Ditemukan</strong>
            <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
              {wallets.length === 0
                ? "Vault Anda saat ini masih kosong. Silakan import Seed Phrase atau Private Key untuk memulai."
                : "Tidak ada dompet yang cocok dengan filter atau kata kunci pencarian Anda."}
            </p>
            {wallets.length === 0 && onOpenImport && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onOpenImport}
                style={{ marginTop: "16px", height: "38px" }}
              >
                Import Dompet Sekarang →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="sweeper-table-wrap" style={{ maxHeight: "calc(100vh - 280px)" }}>
          <table className="sweeper-table">
            <thead>
              <tr>
                <th style={{ width: "36px", textAlign: "center" }}>#</th>
                <th style={{ width: "80px" }}>Tipe</th>
                <th>Alamat Publik</th>
                <th style={{ width: "160px" }}>Saldo Terdeteksi</th>
                <th style={{ width: "110px" }}>Label</th>
                <th style={{ width: "110px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((w) => {
                const primaryAddr = w.address || w.solAddress || w.btcAddress || "";
                const isEvm = Boolean(w.address);
                const isSol = Boolean(w.solAddress);

                // Format balances summary
                const balanceItems: string[] = [];
                if (w.balances) {
                  for (const [chain, balStr] of Object.entries(w.balances)) {
                    if (balStr) {
                      const num = parseFloat(balStr);
                      if (Number.isFinite(num) && num > 0) {
                        const symbol =
                          chain === "bsc"
                            ? "BNB"
                            : chain === "base" || chain === "arb"
                            ? "ETH"
                            : chain.toUpperCase();
                        const displayAmt = num < 0.0001 ? "< 0.0001" : num.toFixed(4);
                        balanceItems.push(`${displayAmt} ${symbol}`);
                      }
                    }
                  }
                }
                if (w.tokens) {
                  for (const t of w.tokens) {
                    const num = parseFloat(t.balance);
                    if (Number.isFinite(num) && num > 0) {
                      const displayAmt = num < 0.0001 ? "< 0.0001" : num.toFixed(4);
                      balanceItems.push(`${displayAmt} ${t.symbol}`);
                    }
                  }
                }

                return (
                  <tr
                    key={w.id}
                    className={`sweeper-row ${w.hasFunds ? "sweepable" : ""}`}
                    onClick={() => setSelectedId(w.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--mono)", fontSize: "10.5px" }}>
                      #{w.id}
                    </td>

                    <td>
                      <span className="status-badge" style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        fontSize: "9px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        color: "var(--text-dim)"
                      }}>
                        {w.type === "seed" ? "SEED" : w.type === "sol_pk" ? "SOL PK" : "EVM PK"}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="mono" style={{ fontSize: "11.5px", color: "var(--text)", fontWeight: 600 }}>
                          {primaryAddr ? `${primaryAddr.slice(0, 10)}...${primaryAddr.slice(-8)}` : "—"}
                        </span>
                        {primaryAddr && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(primaryAddr, `addr-${w.id}`);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: copiedId === `addr-${w.id}` ? "var(--ok)" : "var(--text-dim)",
                              cursor: "pointer",
                              padding: "2px",
                              display: "inline-flex",
                              alignItems: "center"
                            }}
                            title="Salin Alamat"
                          >
                            {copiedId === `addr-${w.id}` ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        )}
                        {isEvm && isSol && (
                          <span style={{ fontSize: "8.5px", background: "var(--surface-3)", padding: "1px 4px", borderRadius: "3px", color: "var(--text-dim)" }}>
                            DUAL-CHAIN
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      {w.hasFunds && balanceItems.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {balanceItems.slice(0, 2).map((item, idx) => (
                            <span key={idx} style={{ color: "var(--ok)", fontWeight: 700, fontSize: "11px", fontFamily: "var(--mono)" }}>
                              ● {item}
                            </span>
                          ))}
                          {balanceItems.length > 2 && (
                            <span style={{ fontSize: "9px", color: "var(--text-dim)" }}>
                              +{balanceItems.length - 2} token lainnya
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-faint)", fontSize: "10.5px" }}>0.00 (Nol)</span>
                      )}
                    </td>

                    <td>
                      {w.label ? (
                        <span style={{
                          fontSize: "10px",
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          border: "1px solid var(--accent-border)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: 600
                        }}>
                          {w.label}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-faint)", fontSize: "10px" }}>—</span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(w.id);
                        }}
                        style={{ height: "26px", padding: "0 8px", fontSize: "10.5px" }}
                      >
                        Detail →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
