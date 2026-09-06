# 🧭 PLURIVEX: MATRIKS IMPLEMENTASI REKAYASA & PETA MODUL (ENGINEERING IMPLEMENTATION MATRIX)
*Versi Dokumen: 2.3 (100.00% Verbatim Literal Naming Parity - Master Spec Synchronized)*  
*Klasifikasi: Dokumen Operasional Tim Rekayasa & Eksekusi Internal*

---

## 🎯 1. Tujuan & Panduan Operasional

Dokumen ini merupakan turunan operasional 1:1 (*direct downstream operational tracking document*) dari **`docs/PLURIVEX_MASTER_FEATURE_SPEC.md` (v8.3 Locked)**.

### Standar Klasifikasi Status pada Matriks:
1. **Status Fitur & Roadmap:**
   * 🟢 **Complete & Live:** Sudah diimplementasikan dan aktif di aplikasi desktop.
   * 🟡 **Partial / UI Complete:** Antarmuka visual siap, integrasi on-chain terjadwal.
   * ⚪ **Architecture Stub / Fase X:** Wadah domain backend tersedia di Rust (Architecture Stub Ready).
   * ⏳ **Planned (Fase X):** Masuk antrean eksekusi sesuai fase ketergantungan rekayasa.
2. **Status Kontrak IPC:**
   * `[Live IPC]`: Perintah resmi terdaftar di Tauri Capability ACL & biner aktif.
   * `[Frontend/Context Path - IPC Formalization Pending]`: Fitur aktif di layer frontend/context/SQLite lokal; formalisasi perintah IPC Rust terjadwal pada backlog pelunasan utang teknis (Architecture Debt).
   * `[Planned IPC]`: Perintah yang dirancang untuk dibangun pada fase roadmap terkait.
3. **Status Modul Rust Target (Standardized Legend):**
   * `(Live Source of Truth)`: Modul Rust aktif yang menjadi sumber kebenaran data saat ini.
   * `(Planned Target)`: Modul Rust yang dirancang untuk diimplementasikan pada fase target.

---

## 📊 2. Matriks Pemetaan 60 Fitur ke Arsitektur Sistem (Definitive Freeze Parity)

| No | Nama Fitur Resmi (*Master Spec*) | Modul Rust Target (*Architecture Target*) | Komponen UI (*Frontend Screen*) | Perintah IPC Tauri (*Contract Status*) | Gerbang Mutu / Pengujian (*Test Gate*) | Status & Fase Roadmap Resmi |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | Smart Contract Protokol (`PlurivexSweeper.sol`) | `contracts/evm/PlurivexSweeper.sol` (Planned Target) | `SweeperModal.tsx` / `ExecutionCenter.tsx` | *(Direct RPC Relay)* | Slither Static Analysis + Foundry Gas Optimization Test | ⚪ Architecture Stub / Fase 3 |
| **2** | Solana Native Multi-Instruction Engine | `core/execution/solana_batch.rs` (Planned Target) | `SweeperModal.tsx` | `broadcast_solana_tx` [Live IPC] | Solana Test Validator CU Consumption Check | ⚪ Architecture Stub / Fase 3 |
| **3** | MEV / Flashbots Private Mempool Protection | `core/network/flashbots.rs` (Planned Target) | `SettingsModal.tsx` | `send_private_bundle` [Planned IPC] | Bundle Privacy & Leakage Mempool Test | ⚪ Architecture Stub / Fase 3 |
| **4** | Cross-Chain Bridge & Consolidation (Solana ↔ EVM) | `core/execution/bridge.rs` (Planned Target) | `BridgeModal.tsx` | `estimate_bridge_fee` [Planned IPC] | deBridge DLN / Mayan Finance Cross-Chain Settlement Test | ⚪ Architecture Stub / Fase 5 |
| **5** | Smart Contract Cryptographic Gatekeeper | `core/security/gatekeeper.rs` (Planned Target) | `SecuritySettings.tsx` | `verify_contract_signature` [Planned IPC] | EIP-712 Signature & Binary Hash Verification Test | ⚪ Architecture Stub / Fase 5 |
| **6** | True Dual-Chain Key Derivation (EVM + Solana) | `core/wallets/derivation.rs` (Live Source of Truth) | `AddWalletModal.tsx` | `vault_derive_credentials` [Live IPC] | BIP-39 & SLIP-0010 Official Test Vectors Pass | 🟢 Complete & Live (Fase 0) |
| **7** | Smart Universal Parser & File Extractor | `core/wallets/import.rs` (Live Source of Truth) | `ImportModal.tsx` | `scan_directory_native` [Live IPC] | 10.000 Lines Stress Test (< 1.5s) | 🟢 Complete & Live (Fase 0) |
| **8** | Anti-Duplicate Guard (Deduplikasi Hash) | `lib/fingerprint.ts` & `core/wallets/fingerprint.rs` (Live Source of Truth) | `ImportPanel.tsx` | `walletFingerprint` / `calculate_fingerprint` (SHA-256 Base64 Canonical) | SHA-256 Collision & Deduplication Test (Rust + TS) | 🟢 Complete & Live (Fase 0) |
| **9** | Zero-Cloud SQLite Encrypted Vault | `core/security/crypto.rs` & `session.rs` (Live Source of Truth) | `App.tsx` (Unlock Screen) | `vault_session_unlock`, `vault_session_unlock_with_pin`, `vault_setup_pin_scoped`, `vault_encrypt_with_session`, `vault_encrypt_batch_with_session` [Live IPC] | Argon2id + AES-GCM + Scoped Session 100% Pass | 🟢 Complete & Live (Fase 0 - K3 Hardened) |
| **10** | Mnemonic Typo Repair Tool (Rayon Zero-Disk) | `core/wallets/repair/` & `recovery_session.rs` (Live Source of Truth) | `RepairWorkspace.tsx` | `vault_repair_mnemonic`, `start_recovery_session`, `clear_recovery_session` [Live IPC] | Rayon Multi-Core 4.19M Combinations Pass + RAM Zeroize | 🟢 Complete & Live (Fase 1) |
| **11** | Deep Sub-Account Derivation Scan | `core/wallets/subaccounts.rs` (Planned Target) | `SubAccountScanner.tsx` | `scan_hd_subaccounts` [Planned IPC] | Derivation Index 0–50 Concurrency Test Pass | ⏳ Planned (Fase 1) |
| **12** | Batch Wallet Generator | `core/wallets/generator.rs` (Planned Target) | `BatchGenerateModal.tsx` | `vault_batch_generate` [Planned IPC] | 1.000 Wallets Creation < 2.5s (Reference HW) | ⏳ Planned (Fase 1) |
| **13** | Multi-Core Vanity Address Generator | `core/wallets/vanity.rs` (Planned Target) | `VanityGeneratorModal.tsx` | `start_vanity_search` [Planned IPC] | Thread Scaling (Rayon) & RAM Zeroize Test | ⏳ Planned (Fase 5) |
| **14** | Keystore & Password Mutation Recovery Engine | `core/wallets/keystore_recovery.rs` (Planned Target) | `KeystoreRecoveryModal.tsx` | `recover_keystore_password` [Planned IPC] | Scrypt/PBKDF2 Mutation Dictionary Test | ⏳ Planned (Fase 5) |
| **15** | Offline Air-Gapped Network Interceptor | `app/commands.rs` (Live Source of Truth) | `MainApp.tsx` (Header Switcher) | `set_air_gapped_mode`, `get_air_gapped_mode` [Live IPC] | Fail-Closed Default Isolation & Bidirectional Hook Sync Test | 🟢 Complete & Live (Fase 0) |
| **16** | Animated QR Air-Gap Hardware Vault Coordinator | `core/security/bcur.rs` (Planned Target) | `AnimatedQRModal.tsx` | `decode_bcur_frames` [Planned IPC] | BC-UR 2.0 Multi-Part QR Assembly Test | ⏳ Planned (Fase 5) |
| **17** | Vitalik's ERC-5564 Stealth Address Shield | `core/wallets/stealth.rs` (Planned Target) | `StealthAddressModal.tsx` | `generate_stealth_address` [Planned IPC] | Secp256k1 Diffie-Hellman View Tag Test | ⏳ Planned (Fase 5) |
| **18** | Multi-Threaded Concurrent Balance Scanner | `core/scanner/mod.rs` (Live Source of Truth) | `ScanProgress.tsx` | `scan_balances` [Live IPC] | Parallel Tokio 100 RPC Queries Benchmark | 🟢 Complete & Live (Fase 0) |
| **19** | Native Gas Tracker & Secondary Token Discovery | `adapters/evm/tokens.rs` (Live Source of Truth) | `WalletList.tsx` | `rpc_get_balance` [Live IPC] | ERC-20 & SPL Token Decimals Calculation Test | 🟢 Complete & Live (Fase 0) |
| **20** | Solana Account Type & Rent Analysis | `adapters/solana/client.rs` (Live Source of Truth) | `WalletDetail.tsx` | `get_solana_account_details` [Live IPC] | Program ID & Rent Exemption Audit Test | 🟢 Complete & Live (Fase 0) |
| **21** | Solana Empty Token Rent Reclaimer | `core/execution/solana_rent.rs` (Planned Target)| `RentReclaimerModal.tsx` | `reclaim_token_rent` [Planned IPC] | `closeAccount` Instruction RPC Simulation Test | ⏳ Planned (Fase 3) |
| **22** | Staking & Delegated Rent Deactivator | `core/execution/solana_stake.rs` (Planned Target)| `StakeDeactivateModal.tsx` | `deactivate_sol_stake` [Planned IPC] | Deactivate + Withdraw Stake Account Test | ⏳ Planned (Fase 3) |
| **23** | Token Revoke Guard (Anti-Drainer) | `core/scanner/allowances.rs` (Planned Target) | `TokenRevokeModal.tsx` | `scan_token_allowances` [Planned IPC] | ERC-20 `allowance(owner, spender)` Query Test | ⏳ Planned (Fase 2) |
| **24** | Honeypot & Malicious Tax Pre-Flight Guard | `core/execution/honeypot.rs` (Planned Target) | `PreFlightModal.tsx` | `verify_honeypot_tax` [Planned IPC] | Local Fork Dry-Run Buy/Sell Simulation Test | ⏳ Planned (Fase 2) |
| **25** | Scam Token & Phishing Dust Cleaner | `core/scanner/scam_filter.rs` (Planned Target) | `WalletDetail.tsx` | `purge_scam_tokens` [Planned IPC] | Liquidity Threshold & Blacklist Matching Test | ⏳ Planned (Fase 2) |
| **26** | Multi-Chain Pre-Flight Simulation (EVM & Solana) | `core/execution/simulator.rs` (Planned Target) | `PreFlightModal.tsx` | `simulate_multi_chain_tx` [Planned IPC] | EVM `eth_call` + Solana `simulateTransaction` | ⏳ Planned (Fase 2) |
| **27** | ERC-4337 Smart Account & Paymaster Detector | `adapters/evm/account_abstraction.rs` (Planned Target)| `WalletDetail.tsx` | `detect_smart_accounts` [Planned IPC] | CodeHash & EntryPoint v0.6/v0.7 Audit Test | ⏳ Planned (Fase 5) |
| **28** | On-Chain Intelligence & Explorer Hub | *(Frontend Explorer Hub - Live)* | `WalletActivityExplorer.tsx`| *(Direct Browser URL)* | Safe URL Redirection & Query Sanity Test | 🟢 Complete & Live (Fase 0) |
| **29** | Batch Sweeper Execution Engine | `adapters/evm/client.rs` (Live Source of Truth) | `SweeperModal.tsx` | `broadcast_raw_tx` [Live IPC] | EIP-1559 Base Fee + JIT Signing Test | 🟢 Complete & Live (Fase 0) |
| **30** | DEX Batch Trader (Multi-Wallet Swap) | `core/execution/trader.rs` (Planned Target) | `DexBatchTrader.tsx` | `execute_batch_swap` [Planned IPC] | Slippage & Deadline Enforcement Test | 🟡 Partial / UI Complete (Fase 0) |
| **31** | Batch Disperser (Distributor Gas & Token) | `core/execution/disperser.rs` (Planned Target) | `BatchDisperserModal.tsx` | `execute_token_disperse` [Planned IPC] | Nonce Sequencer & Gas Cap Enforcement Test | ⏳ Planned (Fase 3) |
| **32** | Auto-Refuel Gas Tank | `core/execution/refuel.rs` (Planned Target) | `AutoRefuelModal.tsx` | `refuel_and_sweep` [Planned IPC] | Automated 2-Step Atomic Batch Simulation Test | ⏳ Planned (Fase 3) |
| **33** | Gasless "Permit" Token Sweeper (Zero-ETH Rescue) | `core/execution/permit.rs` (Planned Target) | `GaslessPermitModal.tsx` | `execute_permit_sweep` [Planned IPC] | EIP-2612 / EIP-3009 Signature Verification | ⏳ Planned (Fase 3) |
| **34** | Custom Smart Contract ABI Interactor | `core/execution/abi_caller.rs` (Planned Target)| `CustomAbiModal.tsx` | `execute_custom_abi` [Planned IPC] | Dynamic ABI Encoding (ethers/alloy) Test | ⏳ Planned (Fase 5) |
| **35** | NFT Batch Sweeper & Vault Transfer | `core/execution/nft_sweep.rs` (Planned Target) | `NftSweeperModal.tsx` | `sweep_nft_portfolio` [Planned IPC] | Metaplex & ERC-721 Batch Transfer Receipt Test | ⏳ Planned (Fase 3) |
| **36** | Mass Airdrop Claimer | `core/execution/claimer.rs` (Planned Target) | `AirdropClaimerModal.tsx` | `execute_airdrop_claims` [Planned IPC] | Merkle Proof Verification & Batch Broadcast | ⏳ Planned (Fase 4) |
| **37** | Tax-Loss Harvesting & Dead Token Burner | `core/execution/burner.rs` (Planned Target) | `TaxHarvestModal.tsx` | `burn_worthless_tokens` [Planned IPC] | CSV Export & 0x...dEaD Transfer Receipt Test | ⏳ Planned (Fase 5) |
| **38** | Automated Testnet Faucet & Gas Drip Dispenser | `core/network/faucets.rs` (Planned Target) | `TestnetFaucetModal.tsx` | `request_faucet_funds` [Planned IPC] | Rate Limiter & Multi-Chain Faucet Proxy Test | ⏳ Planned (Fase 4) |
| **39** | Radar Gas & Auto-Schedule | `core/execution/scheduler.rs` (Planned Target) | `GasRadarModal.tsx` | `schedule_tx_on_gas` [Planned IPC] | Low-Gwei Trigger & Timeout Cancel Test | ⏳ Planned (Fase 2) |
| **40** | QR Code Generator & Mobile Deposit Hub | `core/wallets/qr.rs` (Planned Target) | `DepositQrModal.tsx` | `generate_wallet_qr` [Planned IPC] | QR Code Payload & Address Format Validation | ⏳ Planned (Fase 1) |
| **41** | Emergency Vault Purge (Reset All Data) | `core/security/crypto.rs` (Live Source of Truth) | `ResetAllWalletsModal.tsx`| `vault_purge_all_data` [Frontend/Context Path - IPC Formalization Pending] | File Deletion (.db, -wal, -shm) Verification | 🟢 Complete & Live (Fase 0) |
| **42** | Anti-Sybil Cluster & Taint Graph Visualizer | `core/analytics/taint_graph.rs` (Planned Target) | `TaintGraphModal.tsx` | `build_taint_graph` [Planned IPC] | 1.000 Nodes Graph Layout & 60 FPS Render Test | ⏳ Planned (Fase 4) |
| **43** | CEX Deposit Guard & Anti-Contamination Matrix | `core/analytics/cex_guard.rs` (Planned Target) | `CexDepositModal.tsx` | `validate_cex_routes` [Planned IPC] | Sybil Shield Mode & Opt-In Warning Test | ⏳ Planned (Fase 4) |
| **44** | Multi-Chain Airdrop Eligibility Radar | `core/analytics/eligibility.rs` (Planned Target) | `AirdropRadarModal.tsx` | `check_airdrop_eligibility` [Planned IPC] | Multi-Chain Merkle Tree Snapshot Verification | ⏳ Planned (Fase 4) |
| **45** | Multi-Protocol Airdrop Points & XP Radar | `core/analytics/points_radar.rs` (Planned Target) | `PointsRadarModal.tsx` | `fetch_protocol_xp_points` [Planned IPC] | 20+ Protocol API Points Reconciliation Test | ⏳ Planned (Fase 4) |
| **46** | Scheduled Activity Warm-Up Engine | `core/execution/warmup.rs` (Planned Target) | `WalletWarmupModal.tsx` | `schedule_warmup_txs` [Planned IPC] | Periodic Micro-Tx Cron & Low Gas Trigger Test | ⏳ Planned (Fase 4) |
| **47** | Anti-Sybil Randomizer Engine | `core/execution/randomizer.rs` (Planned Target) | `ExecutionQueueModal.tsx` | `apply_sybil_randomizer` [Planned IPC] | Dynamic Delay (5-60s) & Amount Jitter Test | ⏳ Planned (Fase 4) |
| **48** | Solana Priority Fee & Jito Tip Optimizer | `adapters/solana/jito.rs` (Planned Target) | `SettingsModal.tsx` | `optimize_solana_fees` [Planned IPC] | Dynamic CU Calculation & Jito Bundle Tip Test | ⏳ Planned (Fase 4) |
| **49** | User-Configurable Auto-Lock Security Timer | `core/security/session.rs` (Live Source of Truth) | `SettingsModal.tsx` | `vault_lock`, `vault_unlock` [Live IPC] | 30s OS Clipboard Purge & Session Timeout Test | 🟢 Complete & Live (Fase 0) |
| **50** | Multi-Proxy & IP Rotator Manager | `core/network/proxy.rs` (Planned Target) | `ProxySettingsModal.tsx` | `configure_proxy_pool` [Planned IPC] | DNS Leak Mitigation & Proxy Failover Test | ⏳ Planned (Fase 2) |
| **51** | Custom RPC Node Manager & Auto-Fallback | `core/network/rpc_manager.rs` (Live Source of Truth) | `SettingsModal.tsx` | `set_custom_rpc` [Frontend/Context Path - IPC Formalization Pending] | RPC Endpoint Health & Chain ID Match Test | 🟢 Complete & Live (Fase 0) |
| **52** | Multi-Endpoint RPC Hedging Race Engine | `core/network/hedging.rs` (Planned Target) | `RpcSpeedTestModal.tsx` | `race_rpc_latency` [Planned IPC] | Simultaneous 3-Node Racing Response Test | ⏳ Planned (Fase 2) |
| **53** | Live Multi-RPC Latency Watcher | `core/network/rpc_manager.rs` (Live Source of Truth) | `Header.tsx` / `Footer.tsx` | `get_rpc_latencies` [Frontend/Context Path - IPC Formalization Pending] | Polling Interval & Latency Status Render Test | 🟢 Complete & Live (Fase 0) |
| **54** | High-Speed Virtualized Engine (10.000+ Wallets) | *(Frontend Virtualization - Live)* | `Sidebar.tsx` / `WalletList.tsx`| *(React Window / TanStack)* | 10.000 Wallets Scroll & Memory Profile Test | 🟢 Complete & Live (Fase 0) |
| **55** | Tag, Folder & Smart Filter Taxonomy | `db/schema.rs` (Live Source of Truth) | `FolderManagerModal.tsx`| `update_wallet_tags` [Frontend/Context Path - IPC Formalization Pending] | SQLite Index Query Optimization Test (< 50ms) | 🟢 Complete & Live (Fase 0) |
| **56** | Flexible Vault Exporter (CSV/TXT) | `core/wallets/export.rs` (Planned Target; saat ini `src/lib/export.ts`) | `ExportModal.tsx` | `export_vault_data` [Frontend/Context Path - IPC Formalization Pending] | CSV/TXT Format & Password Re-Auth Test | 🟢 Complete & Live (Fase 0) |
| **57** | Realtime Multi-Currency Valuation (USD/IDR & 11 Fiats) | `core/scanner/pricing.rs` & `adapters/pricing/coingecko.rs` (Live Source of Truth) | `WalletDetail.tsx` & `MainApp.tsx` | `get_token_prices` [Live IPC] | CoinGecko Oracle + Offline Stale Cache & Fallback | 🟢 Complete & Live (Fase 0) |
| **58** | Local Vault Net Worth Snapshot & PnL History | `core/analytics/pnl.rs` (Planned Target) | `PnlTrackerModal.tsx` | `query_historical_pnl` [Planned IPC] | Local SQLite Portfolio Snapshot & Chart Render | ⏳ Planned (Fase 5) |
| **59** | Multi-Channel Webhook Notifier (Discord / Slack / Custom Webhook) | `core/notifications/webhook.rs` (Planned Target) | `WebhookSettingsModal.tsx`| `send_test_webhook` [Planned IPC] | Embed Card Payload & Webhook Rate-Limit Test | ⏳ Planned (Fase 5) |
| **60** | Encrypted Portable Vault Archive (`.plurivex`) | `core/archive/plurivex.rs` (Planned Target) | `BackupMigrationModal.tsx`| `export_plurivex_archive` [Planned IPC] | Argon2id Recovery Passphrase & Tar.Gz Extract | ⏳ Planned (Fase 5) |

---

## 🚀 3. Sprint Backlog Fase 1: Fondasi Kunci & Forensik (*Status & Next Work*)

| Task ID | Nama Fitur Resmi (*Master Spec*) | Komponen Rust Target (*Backend*) | Komponen UI (*Frontend*) | Status Eksekusi |
| :---: | :--- | :--- | :--- | :---: |
| **TASK-101** | **Fitur #10: Mnemonic Typo Repair Tool & Jackpot Guardrail** | `src-tauri/src/core/wallets/repair/` | `src/components/repair-workspace/` | ✅ **Completed & Live (30 Unit Tests Pass)** |
| **TASK-105** | **UI 3-Mode Switcher Header Integration** | `src-tauri/src/app/commands.rs` | `src/components/MainApp.tsx` & Header | ✅ **Completed & Live** |
| **TASK-102** | **Fitur #12: Batch Wallet Generator** | `src-tauri/src/core/wallets/generator.rs` | `src/components/BatchGenerateModal.tsx` | ⏳ Siap Bangun (Rayon + BIP-44 Derivation) |
| **TASK-103** | **Fitur #40: QR Code Generator & Mobile Deposit Hub** | `src-tauri/src/core/wallets/qr.rs` | `src/components/DepositQrModal.tsx` | ⏳ Siap Bangun (`qrcode` crate + SVG render) |
| **TASK-104** | **Fitur #11: Deep Sub-Account Derivation Scan** | `src-tauri/src/core/wallets/subaccounts.rs`| `src/components/SubAccountScannerModal.tsx` | ⏳ Siap Bangun (HD Path Index 0–50) |

---

## 🛡️ 4. Agenda Pengerasan Arsitektur Keamanan (*Security Hardening Backlog*)

Inisiatif rekayasa keamanan masa depan yang dijadwalkan secara terpisah (*dedicated milestone*) pasca-pencapaian K3 Penuh:

| Task ID | Inisiatif Rekayasa Keamanan | Target Komponen | Deskripsi Rekayasa | Gerbang Mutu / Target Rilis | Status Eksekusi |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **TASK-SEC-01** | **Pencabutan `sql:allow-execute` & Isolasi 100% SQLite ke Native Rust IPC** | `src-tauri/src/db/`<br>`capabilities/default.json`<br>`src/lib/db.ts` | Memindahkan seluruh eksekusi query SQL mentah di `src/lib/db.ts` (18 pemanggilan `database.execute` dan 10 pemanggilan `database.select`) ke dalam typed scoped Rust IPC commands (`vault_get_wallets_public`, `vault_update_wallet_label`, `vault_delete_wallet`, `vault_delete_all_wallets`, `vault_upsert_balances`). Setelah frontend murni memanggil endpoint IPC Rust yang terisolasi, izin `sql:allow-execute` dicabut dari antarmuka webview untuk memblokir total kemungkinan manipulasi database lokal jika terjadi insiden XSS. | 0 Query SQL Mentah di JS + Pencabutan `sql:allow-execute` dari ACL | ⏳ **Scheduled (Post-K3 Dedicated Milestone)** |

---

> **Status Integritas:** Dokumen matriks ini telah diselaraskan 100% secara 1:1 dengan `docs/PLURIVEX_MASTER_FEATURE_SPEC.md` (v8.3 Locked). Seluruh modul backend target telah disejajarkan secara menyeluruh dengan domain arsitektur resmi master spec.
