import { shortAddr } from "../../lib/wallet";
import { IconAlertTriangle, IconCheckCircle } from "../../icons";

export interface SolanaAccountDetails {
  exists: boolean;
  owner: string;
  owner_label: string;
  is_system_program: boolean;
  account_type: string;
  authority?: string | null;
  token_mint?: string | null;
  lamports: number;
  sol_balance: number;
  executable: boolean;
  space: number;
}

interface SolanaDiagnosticCardProps {
  solAccount: SolanaAccountDetails | null;
  loadingSolAccount: boolean;
  solAccountError: string | null;
  fetchSolAccount: () => void;
  toast: (msg: string, type?: "info" | "success" | "error") => void;
}

export function SolanaDiagnosticCard({
  solAccount,
  loadingSolAccount,
  solAccountError,
  fetchSolAccount,
  toast,
}: SolanaDiagnosticCardProps) {
  return (
    <div className="sol-account-analysis">
      <span className="sol-account-analysis-title">ON-CHAIN ACCOUNT ANALYSIS</span>
      <div className="credential-row sol-owner-credential-row">
        <span className="credential-sub-lbl mono">Account Owner:</span>
        {loadingSolAccount ? (
          <span className="credential-val mono text-muted text-xs">Querying Solana on-chain validator…</span>
        ) : solAccountError ? (
          <div className="sol-owner-row">
            <span className="credential-val mono text-danger text-xs">
              <IconAlertTriangle size={12} /> Query failed: {solAccountError}
            </span>
            <button type="button" className="btn-credential-action" onClick={fetchSolAccount}>
              Retry
            </button>
          </div>
        ) : solAccount ? (
          <div className="sol-owner-row">
            <span
              className={`sol-owner-badge ${
                solAccount.is_system_program ? "badge-sys-safe" : "badge-non-sys-warn"
              }`}
            >
              {solAccount.is_system_program ? (
                <>
                  <IconCheckCircle size={11} /> System Program (Standard EOA)
                </>
              ) : (
                <>
                  <IconAlertTriangle size={11} /> {solAccount.owner_label}
                </>
              )}
            </span>
            <span className="sol-owner-id-code mono" title={`Owner Program ID: ${solAccount.owner}`}>
              {solAccount.owner}
            </span>
            <button
              type="button"
              className="btn-credential-action btn-copy-owner-id"
              onClick={() => {
                navigator.clipboard.writeText(solAccount.owner);
                toast("Owner Program ID copied to clipboard", "success");
              }}
              title={`Copy full owner Program ID: ${solAccount.owner}`}
            >
              Copy ID
            </button>
          </div>
        ) : null}
      </div>

      {solAccount && solAccount.authority && (
        <div className="credential-row">
          <span className="credential-sub-lbl mono">
            {solAccount.account_type === "nonce_account" ? "Nonce Authority:" : "Token Owner (Authority):"}
          </span>
          <div className="sol-owner-row">
            <span className="sol-owner-id-code mono" title={solAccount.authority}>
              {solAccount.authority}
            </span>
            <button
              type="button"
              className="btn-credential-action btn-copy-owner-id"
              onClick={() => {
                navigator.clipboard.writeText(solAccount.authority!);
                toast("Authority address copied to clipboard", "success");
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {solAccount && solAccount.token_mint && (
        <div className="credential-row">
          <span className="credential-sub-lbl mono">Token Mint:</span>
          <div className="sol-owner-row">
            <span className="sol-owner-id-code mono" title={solAccount.token_mint}>
              {solAccount.token_mint}
            </span>
            <button
              type="button"
              className="btn-credential-action btn-copy-owner-id"
              onClick={() => {
                navigator.clipboard.writeText(solAccount.token_mint!);
                toast("Token Mint copied to clipboard", "success");
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {solAccount && !solAccount.is_system_program && (
        <div className="sol-non-standard-alert">
          {solAccount.account_type === "nonce_account" ? (
            <>
              <b>Durable Nonce Account:</b> Akun ini adalah akun Durable Nonce (ukuran 80 byte). Saldo{" "}
              {solAccount.sol_balance} SOL di dalamnya adalah dana sewa (rent reserve). Transfer native standar akan
              ditolak validator. Penarikan saldo dapat dilakukan via instruksi <code>nonceWithdraw</code> dengan tanda
              tangan dari Nonce Authority ({solAccount.authority ? shortAddr(solAccount.authority) : "tertera di atas"}).
            </>
          ) : solAccount.account_type === "token_account" ? (
            <>
              <b>SPL Token Account (ATA):</b> Akun ini adalah Token Account / Wrapped SOL. Penarikan saldo sewa SOL
              memerlukan penutupan akun token via instruksi <code>closeAccount</code> dari Token Program.
            </>
          ) : (
            <>
              <b>Custom Program Account:</b> Akun ini dikelola oleh program <code>{solAccount.owner}</code>. Transfer
              native standar tidak dapat mendebit dana secara langsung.
            </>
          )}
        </div>
      )}
    </div>
  );
}
