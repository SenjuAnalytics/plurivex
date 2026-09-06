import { useCallback, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  getAllWallets,
  deleteWallet,
  deleteAllWallets,
  updateWalletLabel,
  insertWalletsBatch,
  cleanupDuplicateWallets,
  getExistingFingerprints,
  getExistingAddresses,
  getVerificationToken,
} from "../../lib/db";
import {
  chainsForWallet,
  hasFundsForWallet,
  totalBalanceForWallet,
} from "../../lib/chains";
import { encrypt, encryptBatch, decrypt, verifyPassword } from "../../lib/crypto";
import { walletFingerprint } from "../../lib/fingerprint";
import { smartNormalizeInputNative } from "../../lib/extract";
import {
  classify,
  deriveDualCredentialsNative,
  deriveDualCredentialsBatchNative,
  walletHasScanTarget,
  type DualCredentials,
} from "../../lib/wallet";
import type { ToastType, WalletView } from "../../lib/types";

export interface ExportOptions {
  format: "txt" | "csv";
  filter: "all" | "funded" | "tagged" | "public_only";
  tag?: string | null;
}

interface UseWalletOperationsProps {
  toast: (text: string, type?: ToastType) => void;
  masterPw: string;
  setSelectedId: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedSweepIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  scanWallets?: (targets: WalletView[]) => Promise<{ funded: number; errors: number }>;
}

export function useWalletOperations({
  toast,
  masterPw,
  setSelectedId,
  setSelectedSweepIds,
  scanWallets,
}: UseWalletOperationsProps) {
  const [wallets, setWallets] = useState<WalletView[]>([]);

  const enrich = useCallback((records: Awaited<ReturnType<typeof getAllWallets>>): WalletView[] => {
    return records.map((w) => ({
      ...w,
      totalBalance: totalBalanceForWallet(w.balances, w.type),
      hasFunds: hasFundsForWallet(w.balances, w.type, w.tokens),
    }));
  }, []);

  const sortWallets = useCallback((list: WalletView[]) => {
    return [...list].sort((a, b) => {
      if (a.hasFunds !== b.hasFunds) return b.hasFunds ? 1 : -1;
      if (a.hasFunds && b.hasFunds) return b.totalBalance - a.totalBalance;
      return a.id - b.id;
    });
  }, []);

  const loadWallets = useCallback(async (): Promise<WalletView[]> => {
    const records = await getAllWallets();
    const sorted = sortWallets(enrich(records));
    setWallets(sorted);
    setSelectedId((cur) => cur ?? sorted[0]?.id ?? null);
    return sorted;
  }, [enrich, sortWallets, setSelectedId]);

  const setLoadingBalances = useCallback(
    (ids: number[]) => {
      setWallets((prev) =>
        sortWallets(
          prev.map((w) => {
            if (!ids.includes(w.id)) return w;
            const balances = { ...w.balances };
            for (const chain of chainsForWallet(w.type)) balances[chain.key] = "loading";
            return { ...w, balances };
          })
        )
      );
    },
    [sortWallets]
  );

  const setWalletLabel = useCallback(
    async (id: number, label: string | null) => {
      try {
        await updateWalletLabel(id, label);
        setWallets((prev) => prev.map((w) => (w.id === id ? { ...w, label } : w)));
        toast(label ? `Wallet tagged as "${label}"` : "Tag cleared", "success");
      } catch (err) {
        console.error("Failed to update wallet label:", err);
        toast("Failed to update tag", "error");
      }
    },
    [toast]
  );

  const importWallets = async (
    input: string | string[],
    onProgress?: (current: number, total: number) => void
  ) => {
    const lines = Array.isArray(input) ? input : await smartNormalizeInputNative(input);
    const existing = await getExistingFingerprints();
    const existingAddresses = await getExistingAddresses();

    let added = 0;
    let skipped = 0;

    const derivedList = await deriveDualCredentialsBatchNative(lines, "seed");

    const itemsToProcess: {
      line: string;
      walletType: "seed" | "pk" | "sol_pk";
      fp: string;
      address: string | null;
      solAddress: string | null;
      btcAddress: string | null;
      wordCount: number | null;
    }[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (onProgress && (i % 25 === 0 || i === lines.length - 1)) {
        onProgress(i + 1, lines.length);
      }

      const line = lines[i];
      const classifiedType = classify(line);
      if (classifiedType === "invalid" || classifiedType === "pk_bad_length") {
        skipped++;
        continue;
      }
      const walletType: "seed" | "pk" | "sol_pk" = classifiedType;

      const fp = await walletFingerprint(line);
      if (existing.has(fp)) {
        skipped++;
        continue;
      }

      const derived = derivedList[i] || (await deriveDualCredentialsNative(line, walletType));
      const address = derived.evmAddress ?? null;
      const solAddress = derived.solAddress ?? null;
      const btcAddress = derived.btcAddress ?? null;

      if (address && existingAddresses.evm?.has(address.toLowerCase())) {
        skipped++;
        continue;
      }
      if (solAddress && existingAddresses.sol?.has(solAddress)) {
        skipped++;
        continue;
      }
      if (btcAddress && existingAddresses.btc?.has(btcAddress)) {
        skipped++;
        continue;
      }

      const wordCount = walletType === "seed" ? line.trim().split(/\s+/).length : null;

      itemsToProcess.push({
        line,
        walletType,
        fp,
        address,
        solAddress: solAddress ?? null,
        btcAddress: btcAddress ?? null,
        wordCount,
      });

      existing.add(fp);
      added++;
    }

    const batchToInsert: any[] = [];

    if (itemsToProcess.length > 0) {
      try {
        const encryptedBlobs = await encryptBatch(
          itemsToProcess.map((it) => it.line),
          masterPw
        );
        for (let j = 0; j < itemsToProcess.length; j++) {
          batchToInsert.push({
            type: itemsToProcess[j].walletType,
            encryptedSecret: encryptedBlobs[j],
            fingerprint: itemsToProcess[j].fp,
            address: itemsToProcess[j].address,
            solAddress: itemsToProcess[j].solAddress,
            btcAddress: itemsToProcess[j].btcAddress,
            wordCount: itemsToProcess[j].wordCount,
          });
        }
      } catch (err) {
        for (const it of itemsToProcess) {
          const enc = await encrypt(it.line, masterPw);
          batchToInsert.push({
            type: it.walletType,
            encryptedSecret: enc,
            fingerprint: it.fp,
            address: it.address,
            solAddress: it.solAddress,
            btcAddress: it.btcAddress,
            wordCount: it.wordCount,
          });
        }
      }

      await insertWalletsBatch(batchToInsert);
      try {
        await cleanupDuplicateWallets();
      } catch {}
    }

    const list = await loadWallets();
    if (added > 0 && scanWallets) {
      const insertedEvm = new Set(batchToInsert.map((b) => b.address?.toLowerCase()).filter(Boolean));
      const insertedSol = new Set(batchToInsert.map((b) => b.solAddress).filter(Boolean));
      const newlyAdded = list.filter(
        (w) =>
          (w.address && insertedEvm.has(w.address.toLowerCase())) ||
          (w.solAddress && insertedSol.has(w.solAddress))
      );
      const targets = newlyAdded.filter(walletHasScanTarget);
      if (targets.length > 0) {
        toast(`Import complete. Scanning ${targets.length} newly added wallets…`, "info");
        scanWallets(targets)
          .then(({ funded, errors }) => {
            if (errors > 0) {
              toast(`Scan complete · ${funded} funded · ${errors} chains failed`, funded > 0 ? "success" : "error");
            } else {
              toast(`Scan complete · ${funded} funded wallets found`, "success");
            }
          })
          .catch((err) => console.error("Scan error:", err));
      }
    }
    return { added, skipped };
  };

  const removeWallet = async (id: number) => {
    await deleteWallet(id);
    await loadWallets();
    setSelectedId((cur) => (cur === id ? wallets.find((w) => w.id !== id)?.id ?? null : cur));
    toast("Wallet deleted", "info");
  };

  const resetAllWallets = async (password: string): Promise<{ success: boolean; error?: string }> => {
    let ok = false;
    const token = await getVerificationToken();
    if (token) {
      ok = await verifyPassword(token, password);
    } else if (masterPw) {
      ok = password === masterPw;
    }

    if (!ok) {
      return { success: false, error: "Incorrect Master Password. Verification failed." };
    }

    try {
      await deleteAllWallets();
      await loadWallets();
      setSelectedId(null);
      setSelectedSweepIds(new Set());
      toast("All wallets have been reset and cleared from database", "info");
      return { success: true };
    } catch (err) {
      console.error("Reset wallets error:", err);
      return { success: false, error: `Failed to reset wallets: ${String(err)}` };
    }
  };

  const exportWalletsWithOptions = async (options: ExportOptions) => {
    let targets = wallets;
    if (options.filter === "funded") {
      targets = targets.filter((w) => w.hasFunds);
    } else if (options.filter === "tagged" && options.tag) {
      if (options.tag === "untagged") {
        targets = targets.filter((w) => !w.label);
      } else {
        targets = targets.filter((w) => w.label?.toLowerCase() === options.tag?.toLowerCase());
      }
    }

    if (!targets.length) {
      toast("No wallets match the export criteria", "error");
      return;
    }

    if (options.filter !== "public_only") {
      const confirmed = window.confirm(
        "⚠️ PERINGATAN KEAMANAN: Anda akan mengekspor Secret Key / Seed Mnemonic dalam bentuk plaintext ke disk. Pastikan perangkat Anda aman. Lanjutkan ekspor?"
      );
      if (!confirmed) {
        toast("Ekspor dibatalkan demi keamanan", "info");
        return;
      }
    }

    const lines: string[] = [];

    if (options.format === "csv") {
      if (options.filter === "public_only") {
        lines.push("#,label,type,btc_address,evm_address,solana_address,has_funds");
        targets.forEach((w, i) => {
          lines.push(
            `${i + 1},"${w.label ?? ""}",${w.type},"${w.btcAddress ?? ""}","${w.address ?? ""}","${w.solAddress ?? ""}",${w.hasFunds ? "YES" : "NO"}`
          );
        });
      } else {
        lines.push("#,label,type,btc_address,evm_address,solana_address,native_balances,token_balances,secret_key_or_mnemonic,btc_wif,evm_pk,sol_pk");
        for (let i = 0; i < targets.length; i++) {
          const w = targets[i];
          let secret = "";
          let creds: DualCredentials | null = null;
          try {
            secret = (await decrypt(w.encryptedSecret, masterPw)) ?? "";
            creds = await deriveDualCredentialsNative(secret, w.type);
          } catch {}
          const nativeBals = Object.entries(w.balances)
            .filter(([_, v]) => v && v !== "loading" && v !== "error" && !v.startsWith("0 "))
            .map(([k, v]) => `${k.toUpperCase()}:${v}`)
            .join(" | ");
          const tokBals = (w.tokens || [])
            .map((t) => `${t.symbol}(${t.chain.toUpperCase()}):${t.balance}`)
            .join(" | ");
          lines.push(
            `${i + 1},"${w.label ?? ""}",${w.type},"${w.btcAddress ?? ""}","${w.address ?? ""}","${w.solAddress ?? ""}","${nativeBals}","${tokBals}","${secret.replace(/"/g, '""')}","${creds?.btcPrivateKey ?? ""}","${creds?.evmPrivateKey ?? ""}","${creds?.solPrivateKey ?? ""}"`
          );
        }
      }
    } else {
      lines.push("=================================================");
      lines.push("          PLURIVEX MULTI-WALLET EXPORT           ");
      lines.push(`Generated: ${new Date().toLocaleString()}`);
      lines.push(`Total Wallets: ${targets.length}`);
      lines.push(`Export Mode: ${options.filter.toUpperCase()}`);
      lines.push("=================================================\n");

      for (let i = 0; i < targets.length; i++) {
        const w = targets[i];
        lines.push(`--- Wallet #${i + 1} [${w.type.toUpperCase()}] ${w.label ? `[TAG: ${w.label.toUpperCase()}]` : ""} ---`);
        if (w.btcAddress) lines.push(`  • Bitcoin Address: ${w.btcAddress}`);
        if (w.address) lines.push(`  • EVM Address:     ${w.address}`);
        if (w.solAddress) lines.push(`  • Solana Address:  ${w.solAddress}`);

        if (options.filter !== "public_only") {
          try {
            const secret = await decrypt(w.encryptedSecret, masterPw);
            const creds = secret ? await deriveDualCredentialsNative(secret, w.type) : null;
            if (w.type === "seed") {
              lines.push(`  • Mnemonic Seed:   ${secret}`);
            } else {
              lines.push(`  • Raw Secret:      ${secret}`);
            }
            if (creds?.btcPrivateKey) lines.push(`  • Bitcoin WIF PK:  ${creds.btcPrivateKey}`);
            if (creds?.evmPrivateKey) lines.push(`  • EVM Private Key: ${creds.evmPrivateKey}`);
            if (creds?.solPrivateKey) lines.push(`  • Sol Private Key: ${creds.solPrivateKey}`);
          } catch {}
        }

        const nativeBals = Object.entries(w.balances)
          .filter(([_, v]) => v && v !== "loading" && v !== "error")
          .map(([k, v]) => `    - ${k.toUpperCase()}: ${v}`)
          .join("\n");
        if (nativeBals) lines.push("  • Native Balances:\n" + nativeBals);
        if (w.tokens && w.tokens.length > 0) {
          const tokBals = w.tokens
            .map((t) => `    - ${t.symbol} [${t.chain.toUpperCase()}]: ${t.balance}`)
            .join("\n");
          lines.push("  • Token Balances:\n" + tokBals);
        }
        lines.push("");
      }
    }

    const path = await save({
      defaultPath: `plurivex-wallets-${options.filter}.${options.format}`,
      filters: [{ name: options.format.toUpperCase(), extensions: [options.format] }],
    });
    if (!path) return;
    await writeTextFile(path, lines.join("\n"));
    toast(`Exported ${targets.length} wallets successfully`, "success");
  };

  const exportWallets = async (format: "txt" | "csv") => {
    await exportWalletsWithOptions({ format, filter: "all" });
  };

  return {
    wallets,
    setWallets,
    enrich,
    sortWallets,
    loadWallets,
    setLoadingBalances,
    setWalletLabel,
    importWallets,
    removeWallet,
    resetAllWallets,
    exportWallets,
    exportWalletsWithOptions,
  };
}
