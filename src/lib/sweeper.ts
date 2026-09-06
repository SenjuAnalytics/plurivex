import { invoke } from "@tauri-apps/api/core";
import { ethers } from "ethers";
import type { WalletType } from "./types";
import { shortAddr } from "./wallet";

export interface SweepChainConfig {
  key: string;
  name: string;
  symbol: string;
  chainId: number;
  explorerUrl: string;
}

export const SWEEP_CHAINS: Record<string, SweepChainConfig> = {
  eth: {
    key: "eth",
    name: "Ethereum",
    symbol: "ETH",
    chainId: 1,
    explorerUrl: "https://etherscan.io/tx/",
  },
  bsc: {
    key: "bsc",
    name: "BNB Chain",
    symbol: "BNB",
    chainId: 56,
    explorerUrl: "https://bscscan.com/tx/",
  },
  base: {
    key: "base",
    name: "Base",
    symbol: "ETH",
    chainId: 8453,
    explorerUrl: "https://basescan.org/tx/",
  },
  arb: {
    key: "arb",
    name: "Arbitrum",
    symbol: "ETH",
    chainId: 42161,
    explorerUrl: "https://arbiscan.io/tx/",
  },
  sol: {
    key: "sol",
    name: "Solana",
    symbol: "SOL",
    chainId: 101,
    explorerUrl: "https://solscan.io/tx/",
  },
};

export interface LiveFeeData {
  gasPriceGwei: number;
  priorityFeeGwei: number;
  estimatedFeePerTxEth: string;
  chainId: number;
  symbol: string;
}

interface ChainFeeRaw {
  gas_price_gwei: number;
  priority_fee_gwei: number;
  estimated_fee_eth: string;
  chain_id: number;
  symbol: string;
}

interface AccountInfoRaw {
  balance_hex: string;
  balance_eth: number;
  balance_formatted: string;
  nonce: number;
}

export async function fetchLiveFeeData(chainKey: string): Promise<LiveFeeData> {
  const res = await invoke<ChainFeeRaw>("get_chain_fee_data", { chainKey });
  return {
    gasPriceGwei: res.gas_price_gwei,
    priorityFeeGwei: res.priority_fee_gwei,
    estimatedFeePerTxEth: res.estimated_fee_eth,
    chainId: res.chain_id,
    symbol: res.symbol,
  };
}

export interface WalletSweepEstimate {
  walletId: number;
  address: string;
  balanceWei: ethers.BigNumber;
  balanceFormatted: string;
  feeWei: ethers.BigNumber;
  feeFormatted: string;
  netWei: ethers.BigNumber;
  netFormatted: string;
  isSweepable: boolean;
  statusText: string;
}

export async function estimateWalletSweep(
  walletId: number,
  address: string,
  chainKey: string,
  gasPriceGwei: number,
): Promise<WalletSweepEstimate> {
  const cfg = SWEEP_CHAINS[chainKey] || SWEEP_CHAINS.eth;

  // 1. Solana Balance and Fee Estimation
  if (chainKey === "sol") {
    const feeLamports = 5000n;
    const feeFormatted = "0.000005 SOL";

    try {
      const acc = await invoke<AccountInfoRaw>("get_account_nonce_and_balance", {
        chainKey,
        address,
      });

      const lamports = BigInt(acc.balance_hex);
      const balanceFormatted = acc.balance_formatted;

      if (lamports <= feeLamports) {
        return {
          walletId,
          address,
          balanceWei: ethers.BigNumber.from(0),
          balanceFormatted,
          feeWei: ethers.BigNumber.from(0),
          feeFormatted,
          netWei: ethers.BigNumber.from(0),
          netFormatted: "0.000000 SOL",
          isSweepable: false,
          statusText: "Balance < Gas Fee (Dust)",
        };
      }

      const netLamports = lamports - feeLamports;
      const netSol = Number(netLamports) / 1e9;
      const netFormatted = `${netSol.toFixed(6)} SOL`;

      return {
        walletId,
        address,
        balanceWei: ethers.BigNumber.from(lamports.toString()),
        balanceFormatted,
        feeWei: ethers.BigNumber.from(feeLamports.toString()),
        feeFormatted,
        netWei: ethers.BigNumber.from(netLamports.toString()),
        netFormatted,
        isSweepable: true,
        statusText: "Ready to Sweep ✓",
      };
    } catch (err) {
      return {
        walletId,
        address,
        balanceWei: ethers.BigNumber.from(0),
        balanceFormatted: "0 SOL",
        feeWei: ethers.BigNumber.from(0),
        feeFormatted,
        netWei: ethers.BigNumber.from(0),
        netFormatted: "0 SOL",
        isSweepable: false,
        statusText: `Failed to read balance: ${String(err)}`,
      };
    }
  }

  // 2. EVM Balance and Fee Estimation
  const gasPriceWei = ethers.utils.parseUnits(gasPriceGwei.toString(), "gwei");
  const feeWei = gasPriceWei.mul(21000);
  const feeFormatted = `${Number(ethers.utils.formatEther(feeWei)).toFixed(8)} ${cfg.symbol}`;

  try {
    const acc = await invoke<AccountInfoRaw>("get_account_nonce_and_balance", {
      chainKey,
      address,
    });

    const balanceWei = ethers.BigNumber.from(acc.balance_hex);
    const balanceFormatted = acc.balance_formatted;

    if (balanceWei.lte(feeWei)) {
      return {
        walletId,
        address,
        balanceWei,
        balanceFormatted,
        feeWei,
        feeFormatted,
        netWei: ethers.BigNumber.from(0),
        netFormatted: `0.00000000 ${cfg.symbol}`,
        isSweepable: false,
        statusText: "Balance < Gas Fee (Dust)",
      };
    }

    const netWei = balanceWei.sub(feeWei);
    const netFormatted = `${Number(ethers.utils.formatEther(netWei)).toFixed(8)} ${cfg.symbol}`;

    return {
      walletId,
      address,
      balanceWei,
      balanceFormatted,
      feeWei,
      feeFormatted,
      netWei,
      netFormatted,
      isSweepable: true,
      statusText: "Ready to Sweep ✓",
    };
  } catch (err) {
    return {
      walletId,
      address,
      balanceWei: ethers.BigNumber.from(0),
      balanceFormatted: `0 ${cfg.symbol}`,
      feeWei,
      feeFormatted,
      netWei: ethers.BigNumber.from(0),
      netFormatted: `0 ${cfg.symbol}`,
      isSweepable: false,
      statusText: `Failed to read balance: ${String(err)}`,
    };
  }
}

export interface SweepTxResult {
  walletId: number;
  address: string;
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  amountSent?: string;
  error?: string;
}

export async function executeSweepSingle(
  walletId: number,
  secret: string,
  walletType: WalletType,
  chainKey: string,
  recipientAddress: string,
  customGasPriceGwei?: number,
  senderAddress?: string,
): Promise<SweepTxResult> {
  const cfg = SWEEP_CHAINS[chainKey] || SWEEP_CHAINS.eth;

  // 1. Solana Sweep Execution
  if (chainKey === "sol") {
    try {
      let fromAddress = senderAddress;
      if (!fromAddress) {
        try {
          fromAddress = await invoke<string>("get_solana_address", {
            secret,
            walletType,
          });
        } catch {
          return {
            walletId,
            address: recipientAddress,
            success: false,
            error: "Invalid Solana secret key or mnemonic",
          };
        }
      }

      if (!fromAddress) {
        return {
          walletId,
          address: recipientAddress,
          success: false,
          error: "Unable to determine Solana sender address",
        };
      }

      const acc = await invoke<AccountInfoRaw>("get_account_nonce_and_balance", {
        chainKey: "sol",
        address: fromAddress,
      });
      const recentBlockhash = await invoke<string>("get_solana_recent_blockhash");

      const lamports = BigInt(acc.balance_hex);
      const feeLamports = 5000n;

      if (lamports <= feeLamports) {
        return {
          walletId,
          address: fromAddress,
          success: false,
          error: "Insufficient SOL for network transaction fee (0.000005 SOL)",
        };
      }

      const netLamports = lamports - feeLamports;
      const lamportsToSend = netLamports.toString();

      let accountDetails: {
        exists?: boolean;
        owner?: string;
        account_type?: string;
        authority?: string | null;
        is_system_program?: boolean;
      } | null = null;
      try {
        accountDetails = await invoke<{
          exists?: boolean;
          owner?: string;
          account_type?: string;
          authority?: string | null;
          is_system_program?: boolean;
        }>("get_solana_account_details", { address: fromAddress });
      } catch {
        /* proceed if diagnostic not available */
      }

      if (accountDetails && !accountDetails.is_system_program) {
        if (accountDetails.account_type === "custom_program") {
          return {
            walletId,
            address: fromAddress,
            success: false,
            error: `Akun ini dikelola oleh Smart Contract (${shortAddr(accountDetails.owner || "")}). Hanya program tersebut yang berwenang mendebit dana (transfer native standar ditolak konsensus Solana).`,
          };
        }
        if (accountDetails.account_type === "token_account") {
          return {
            walletId,
            address: fromAddress,
            success: false,
            error: `Akun ini adalah SPL Token Account (ATA). Saldo SOL di dalamnya adalah dana sewa (rent reserve) token.`,
          };
        }
      }

      if (accountDetails?.account_type === "nonce_account") {
        const authorityStr = accountDetails.authority;
        if (authorityStr && authorityStr !== fromAddress) {
          return {
            walletId,
            address: fromAddress,
            success: false,
            error: `Akun ini adalah Durable Nonce, dan hak kuasanya (Authority) dipegang oleh ${shortAddr(authorityStr)}. Hanya pemegang kunci authority tersebut yang dapat menandatangani penarikan dana.`,
          };
        }
      }

      // Sign transaction offline natively in Rust (Zero-Disk & Zero-Webview key exposure)
      interface SolanaSignResult {
        rawTxBase64: string;
        fromAddress: string;
      }

      const signResult = await invoke<SolanaSignResult>("sign_solana_transfer", {
        secret,
        walletType,
        tx: {
          recipient: recipientAddress.trim(),
          lamports: lamportsToSend,
          recentBlockhash,
          isNonceAccount: accountDetails?.account_type === "nonce_account",
        },
      });

      // Self-check: verify that derived fromAddress matches expected
      if (signResult.fromAddress !== fromAddress) {
        return {
          walletId,
          address: fromAddress,
          success: false,
          error: `Solana sender address mismatch (expected ${fromAddress}, derived ${signResult.fromAddress})`,
        };
      }

      const txHash = await invoke<string>("broadcast_solana_tx", {
        rawTxBase64: signResult.rawTxBase64,
      });

      const amountSent = `${(Number(netLamports) / 1e9).toFixed(6)} SOL`;

      return {
        walletId,
        address: fromAddress,
        success: true,
        txHash,
        explorerUrl: `${cfg.explorerUrl}${txHash}`,
        amountSent,
      };
    } catch (err) {
      return {
        walletId,
        address: recipientAddress,
        success: false,
        error: String(err),
      };
    }
  }

  // 2. EVM Sweep Execution
  // Derivation done natively in Rust (Zero key exposure in webview memory)
  let fromAddress = senderAddress;
  if (!fromAddress) {
    try {
      fromAddress = await invoke<string>("get_evm_address", {
        secret,
        walletType,
      });
    } catch {
      return {
        walletId,
        address: recipientAddress,
        success: false,
        error: "Invalid wallet type or secret for EVM",
      };
    }
  }

  if (!fromAddress) {
    return {
      walletId,
      address: recipientAddress,
      success: false,
      error: "Invalid wallet type or secret for EVM",
    };
  }

  try {
    const acc = await invoke<AccountInfoRaw>("get_account_nonce_and_balance", {
      chainKey,
      address: fromAddress,
    });
    const feeData = await invoke<ChainFeeRaw>("get_chain_fee_data", { chainKey });

    const gasPrice = customGasPriceGwei
      ? ethers.utils.parseUnits(customGasPriceGwei.toString(), "gwei")
      : ethers.utils.parseUnits(feeData.gas_price_gwei.toString(), "gwei");

    const gasLimit = ethers.BigNumber.from(21000);
    const fee = gasLimit.mul(gasPrice);
    const balance = ethers.BigNumber.from(acc.balance_hex);

    if (balance.lte(fee)) {
      return {
        walletId,
        address: fromAddress,
        success: false,
        error: `Insufficient balance for gas fee (${ethers.utils.formatEther(balance)} <= ${ethers.utils.formatEther(fee)})`,
      };
    }

    const netAmount = balance.sub(fee);

    // Sign transaction offline natively in Rust (Zero-Disk & Zero-Webview key exposure)
    interface EvmSignResult {
      rawTx: string;
      fromAddress: string;
    }

    const signResult = await invoke<EvmSignResult>("sign_evm_transfer", {
      secret,
      walletType,
      tx: {
        chainId: cfg.chainId,
        toAddress: recipientAddress.trim(),
        valueWeiHex: netAmount.toHexString(),
        gasPriceWeiHex: gasPrice.toHexString(),
        gasLimit: gasLimit.toNumber(),
        nonce: acc.nonce,
      },
    });

    // Self-check: verify that key-derived sender matches expected fromAddress
    if (signResult.fromAddress.toLowerCase() !== fromAddress.toLowerCase()) {
      return {
        walletId,
        address: fromAddress,
        success: false,
        error: `Sender address mismatch (expected ${fromAddress}, derived from key ${signResult.fromAddress})`,
      };
    }

    const rawTx = signResult.rawTx;

    // Broadcast raw transaction via native Rust client (CORS-free)
    const txHash = await invoke<string>("broadcast_raw_tx", {
      chainKey,
      rawTx,
    });

    const amountSent = `${Number(ethers.utils.formatEther(netAmount)).toFixed(8)} ${cfg.symbol}`;

    return {
      walletId,
      address: fromAddress,
      success: true,
      txHash,
      explorerUrl: `${cfg.explorerUrl}${txHash}`,
      amountSent,
    };
  } catch (err) {
    return {
      walletId,
      address: fromAddress,
      success: false,
      error: String(err),
    };
  }
}
