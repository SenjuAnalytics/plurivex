import { invoke } from "@tauri-apps/api/core";
import { ethers } from "ethers";
import type { WalletType } from "./types";
import { deriveEvmWallet } from "./wallet";

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
    name: "Ethereum Mainnet (L1)",
    symbol: "ETH",
    chainId: 1,
    explorerUrl: "https://etherscan.io/tx/",
  },
  bsc: {
    key: "bsc",
    name: "BNB Smart Chain (BSC)",
    symbol: "BNB",
    chainId: 56,
    explorerUrl: "https://bscscan.com/tx/",
  },
  base: {
    key: "base",
    name: "Base (Layer 2)",
    symbol: "ETH",
    chainId: 8453,
    explorerUrl: "https://basescan.org/tx/",
  },
  arb: {
    key: "arb",
    name: "Arbitrum One (Layer 2)",
    symbol: "ETH",
    chainId: 42161,
    explorerUrl: "https://arbiscan.io/tx/",
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
): Promise<SweepTxResult> {
  const cfg = SWEEP_CHAINS[chainKey] || SWEEP_CHAINS.eth;
  const signer = deriveEvmWallet(secret, walletType);

  if (!signer) {
    return {
      walletId,
      address: recipientAddress,
      success: false,
      error: "Invalid wallet type or secret for EVM",
    };
  }

  const fromAddress = signer.address;

  try {
    const [acc, feeData] = await Promise.all([
      invoke<AccountInfoRaw>("get_account_nonce_and_balance", {
        chainKey,
        address: fromAddress,
      }),
      invoke<ChainFeeRaw>("get_chain_fee_data", { chainKey }),
    ]);

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

    // Sign transaction offline locally in memory
    const txRequest: ethers.providers.TransactionRequest = {
      to: recipientAddress.trim(),
      value: netAmount,
      gasLimit,
      gasPrice,
      nonce: acc.nonce,
      chainId: cfg.chainId,
    };

    const rawTx = await signer.signTransaction(txRequest);

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
