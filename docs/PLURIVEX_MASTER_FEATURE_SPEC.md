# Plurivex — Master Product Specification & Engineering Blueprint
> **Dokumen Spesifikasi Resmi 60 Master Fitur, Arsitektur Domain, dan Blueprint Rekayasa Plurivex ("The Diamond 60")**  
> *Versi Dokumen: 8.3 (The Definitive Production Freeze Baseline - Final Locked)*  
> *Target Platform v1: Windows 10/11 (macOS & Linux Parity pada Roadmap v2)*  
> *Lokasi Berkas: `docs/PLURIVEX_MASTER_FEATURE_SPEC.md` (Tersimpan aman secara lokal di perangkat pengembang)*

---

## 🧭 1. Visi Produk & Batasan Sistem (Product Vision & System Boundaries)

**Plurivex** adalah aplikasi desktop *high-performance* berbasis **Rust (Tauri Core) + React/TypeScript** yang berfungsi sebagai **The Ultimate Multi-Chain Desktop Security Vault, Portfolio Auditor, dan Batch Execution Suite**.

### 🏛️ Paradigma Arsitektur Produk:
* **Local-First & Non-Custodial:** Seluruh kredensial brankas, seed phrase, dan kunci privat disimpan secara lokal dalam basis data terenkripsi di komputer pengguna.
* **No Mandatory Proprietary Backend:** Plurivex tidak bergantung pada server/cloud terpusat milik pengembang untuk fungsi penyimpanan dompet atau kustodi aset (*Zero Vendor Cloud for Vault Storage*).
* **Blockchain Infrastructure Dependency:** Fitur-fitur yang membutuhkan konektivitas jaringan (pemindaian saldo, penaksiran harga pasar, simulasi transaksi, penyiaran transaksi, dan webhook) berkomunikasi langsung dengan node RPC blockchain publik/privat (seperti Alchemy, QuickNode, Helius, atau RPC kustom pengguna) dan API agregator pasar pihak ketiga.

Plurivex menggabungkan **4 fungsi konsol operasi (*Crypto Desktop Operating Console*) ke dalam 1 kesatuan desktop**:
1. **🔐 Secure Local Vault:** Mengelola, mengenkripsi, mengimpor, dan mengekspor ribuan dompet (EVM & Solana) secara terenkripsi luring.
2. **📊 Multi-Chain Auditor:** Memindai saldo, mendeteksi token sekunder, menganalisis izin smart contract (*allowance*), memvalidasi tipe akun Solana (Rent & Nonce), dan menghitung valuasi portofolio multi-mata uang.
3. **⚡ High-Assurance Execution Engine:** Menjalankan transfer massal (*batch sweep*), distribusi saldo (*disperser*), swap DEX paralel, pemulihan saldo gasless (*permit*), dan transfer koleksi NFT dengan simulasi pra-eksekusi (*dry-run*).
4. **🌐 Operations & Automation Console:** Memantau latensi multi-RPC, rotasi proksi, otomasi aktivitas terjadwal (*warm-up*), integrasi webhook siaran (Discord/Slack), dan mitigasi risiko klasterisasi Sybil airdrop.

---

### 🛡️ 1.1 Tiga Mode Operasi Produk (Product Operating Modes)

Untuk menjamin kenyamanan operasional dan meminimalisir risiko kesalahan klik (*human error*) saat mengelola ratusan hingga ribuan dompet, antarmuka Plurivex dibagi ke dalam **3 Mode Operasi Terisolasi** yang dapat diganti melalui bilah atas aplikasi (*Global Header Mode Switcher*):

| Mode Operasi | Deskripsi & Hak Akses | Fitur yang Aktif | Tingkat Kontrol Transaksi |
| :--- | :--- | :--- | :---: |
| 🟢 **Read-Only Audit Mode** *(Default)* | Mode penjelajahan aman. Pengguna dapat membiarkan aplikasi terbuka sepanjang hari untuk memantau saldo. Seluruh fungsi penyiaran transaksi dan sweeping **dinonaktifkan secara ketat**. | Scan saldo massal, valuasi USD/IDR, cek token sekunder, analisis akun Solana, explorer hub, deteksi token phishing, PnL tracker. | **Mode Baca Saja (Tanpa Hak Siar Transaksi)** |
| 🔐 **Secure Vault Mode** | Mode pengelolaan identitas kunci kriptografi. Diperlukan konfirmasi Master Password sebelum membuka kredensial sensitif. | Impor/ekspor brankas, batch wallet generator, perbaikan typo seed phrase, pemindaian HD path, edit tag/folder, migrasi arsip `.plurivex`. | **Akses Kredensial Terenkripsi** |
| ⚡ **Execution Mode** | Mode operasi tempur untuk pengiriman transaksi on-chain. Tombol aksi berwarna oranye/merah tegas dengan peringatan *High-Assurance* dan otorisasi kata sandi sebelum transaksi disiarkan. | Batch Sweeper, DEX Batch Trader, Batch Disperser, Solana Rent Reclaimer, Gasless Permit Sweeper, Mass Airdrop Claimer. | **Eksekusi Transaksi Berizin Khusus** |

---

## 📋 2. Taksonomi 60 Master Fitur Plurivex (The Diamond 60)

Seluruh 60 kapabilitas fungsional Plurivex diklasifikasikan ke dalam **7 Pilar Strategis**, lengkap dengan penanda tata kelola & regulasi (*Governance Badges*):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  60 MASTER FITUR PLURIVEX (THE DIAMOND 60)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🌐 PILAR 1: Smart Contract On-Chain & Cross-Chain Engine (Fitur 1 - 5)     │
│ 🔐 PILAR 2: Manajemen Kunci, Brankas & Peralatan Forensik (Fitur 6 - 17)   │
│ 📊 PILAR 3: Inspeksi Saldo, Intelijen On-Chain & Anti-Scam (Fitur 18 - 28)  │
│ ⚡ PILAR 4: Mesin Eksekusi Transaksi, Sweeper & NFT (Fitur 29 - 41)        │
│ 🛡️ PILAR 5: Otomasi Airdrop, Points & Anti-Sybil (Fitur 42 - 49)          │
│ 🌐 PILAR 6: Privasi Jaringan, Multi-Proxy & Node Manager (Fitur 50 - 53)    │
│ 📁 PILAR 7: Pengorganisasian Data, Valuasi & Portabilitas (Fitur 54 - 60)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🌐 PILAR 1: SMART CONTRACT ON-CHAIN & CROSS-CHAIN ENGINE (5 FITUR)

#### 1. Smart Contract Protokol Plurivex (`PlurivexSweeper.sol` - EVM)
* **Deskripsi:** Kontrak pintar Solidity khusus yang di-deploy menggunakan teknik deterministik (`CREATE2`) sehingga memiliki alamat kontrak identik di seluruh blockchain EVM (Ethereum, BNB Chain, Base, Arbitrum, Polygon, Optimism).
* **Fungsi Teknis:**
  * **Atomic Native Sweeping (`sweepNative`):** Menguras saldo koin utama (ETH/BNB/POL) dan secara otomatis membagi dana dalam 1 transaksi atomik: 99.3% ke dompet penerima pengguna dan 0.70% ke Developer Treasury Plurivex.
  * **Multi-Token Batch Sweeping (`batchSweepTokens`):** Menguras banyak token ERC-20 sekaligus (misal USDT + USDC + PEPE) dalam **satu transaksi tunggal**, menghemat biaya gas hingga 70% dibanding transfer terpisah.
  * **Immutable Treasury Protection:** Alamat penerima royalti berstatus `immutable` di blockchain, menjamin transparansi tanpa risiko pengalihan oleh pihak manapun.

#### 2. Solana Native Multi-Instruction Atomic Engine
* **Deskripsi:** Mesin pengeksekusi transaksi atomik di jaringan Solana tanpa perlu mengeluarkan biaya deploy program kustom.
* **Fungsi Teknis:** Memanfaatkan arsitektur bawaan Solana (*Multi-Instruction Transaction*) untuk membundel instruksi transfer 99.3% saldo SOL / SPL Token ke dompet pengguna dan 0.70% fee protokol ke Treasury dalam 1 transaksi terpadu di tingkat validator.

#### 3. MEV / Flashbots Private Mempool Protection (Penyelamat Dompet Bocor)
* **Deskripsi:** Protokol penyelamat aset untuk dompet yang private key-nya sudah bocor/terkompromi dari jeratan bot peretas (*sweeper bot*).
* **Fungsi Teknis:** Menyalurkan transaksi langsung ke penambang via *Flashbots Private Relay (EVM)* atau *Jito Block Engine Bundles (Solana)* tanpa melalui mempool publik, sehingga bot sniper tidak dapat mendeteksi atau mem-frontrun transaksi.

#### 4. Cross-Chain Bridge & Single-Asset Consolidation Engine (Solana ↔ EVM)
* **Deskripsi:** Integrasi protokol jembatan likuiditas lintas-rantai (deBridge DLN / Mayan Finance SDK) untuk menyatukan portofolio yang terpencar.
* **Fungsi Teknis:**
  * **Universal Consolidation:** Menyatukan pecahan saldo dari berbagai jaringan (contoh: 0.5 SOL di Solana + 0.05 ETH di Arbitrum + 0.2 BNB di BSC) dan secara otomatis menukarnya (*swap & bridge*) menjadi 1 jenis token di 1 alamat tujuan (misal: seluruhnya menjadi USDT di Arbitrum).
  * **Integrator Revenue Share:** Mengumpulkan bagi hasil otomatis (0.25% - 0.50%) dari penyedia jembatan likuiditas di setiap transaksi bridge pengguna.

#### 5. Smart Contract Cryptographic Gatekeeper (Anti-Bypass Protection)
* **Deskripsi:** Sistem perlindungan kontrak pintar agar tidak bisa dimanfaatkan secara gratis oleh aplikasi pihak ketiga tanpa melalui antarmuka resmi Plurivex.
* **Fungsi Teknis:** Smart contract memvalidasi tanda tangan kriptografi biner Rust lokal (`ecrecover`) sebelum memproses sweep, menjamin transaksi hanya berasal dari klien resmi Plurivex.

---

### 🔐 PILAR 2: MANAJEMEN KUNCI, BRANKAS & PERALATAN FORENSIK (12 FITUR)

#### 6. True Dual-Chain Key Derivation (EVM + Solana dari 1 Entropi)
* **Deskripsi:** Sistem derivasi otomatis yang menurunkan dua alamat blockchain aktif secara deterministik dari 1 Seed Phrase (BIP-39) atau 1 Private Key 32-byte (alamat format EVM `0x...` dan Solana format `Base58`).

#### 7. Smart Universal Parser & Recursive Directory Extractor `[Authorized Use Only - User-Owned Assets]`
* **Deskripsi:** Mesin pengurai teks cerdas berkemampuan regex canggih untuk mengekstrak ribuan kunci privat atau seed phrase milik pengguna dari data acak.
* **Fungsi Teknis:** Mampu membaca Mnemonic (12/24 kata), Hex Private Key, Solana Base58 Secret Key, dan Byte Array `[1,2,3...]` dari clipboard teks bebas, berkas `.txt`, `.csv`, `.json`, `.log`, hingga pemindaian rekursif 1 folder direktori lokal berisi ribuan file.

#### 8. Anti-Duplicate Guard (Deduplikasi Kriptografi)
* **Deskripsi:** Mesin pencegah data ganda yang menghitung sidik jari unik (*SHA-256 fingerprint*) dari setiap kunci sebelum disimpan, menjamin integritas brankas bebas duplikasi.

#### 9. Zero-Cloud SQLite Encrypted Vault
* **Deskripsi:** Penyimpanan brankas data lokal berstandar perbankan menggunakan SQLite lokal yang dienkripsi penuh dengan *Argon2id Key Derivation* dan *AES-256-GCM Encryption*. Bebas server cloud, aman tersimpan di perangkat pengguna.

#### 10. Mnemonic Typo Repair Tool (Penyelamat Frasa Sandi Rusak)
* **Deskripsi:** Fitur pemulih seed phrase yang salah eja kata (*typo*) atau kehilangan 1 kata dengan mencocokkannya secara matematis ke 2.048 kamus kata resmi BIP-39 dan menghitung checksum kriptografi yang valid.

#### 11. Deep Sub-Account Derivation Scan (HD Path Explorer)
* **Deskripsi:** Memindai indeks turunan hierarkis (*derivation path* misal `m/44'/60'/0'/0/x`) untuk mencari saldo yang mungkin pernah terpakai di akun turunan anak nomor `#1` sampai `#20` dari 1 seed phrase yang sama.

#### 12. Batch Wallet Generator
* **Deskripsi:** Generator kunci instan berbasis modul kriptografi Rust yang mampu membuat 10 hingga 1.000 pasang dompet baru (EVM + Solana) sekaligus beserta kunci privatnya dalam hitungan detik.

#### 13. Multi-Core Vanity Address Generator (EVM + Solana)
* **Deskripsi:** Pembuat alamat cantik (*vanity address*, misal `0x8888...` atau `Moon...SOL`) langsung di komputer lokal menggunakan seluruh core CPU komputer pengguna (berbasis modul native Rust berkecepatan tinggi) tanpa risiko kebocoran kunci ke internet.

#### 14. Keystore & Password Mutation Recovery Engine `[Forensic Recovery - Authorized Use Only]`
* **Deskripsi:** Alat pemulihan forensik lokal untuk membuka file backup JSON (*Keystore UTC--...*) lama jika pengguna lupa sebagian kata sandinya, menggunakan algoritma mutasi kombinasi lokal secara luring.

#### 15. Offline Air-Gapped Transaction Signer
* **Deskripsi:** Modul penandatanganan transaksi untuk keamanan tingkat tinggi (*Cold Storage Security*). Pengguna menyiapkan payload transaksi di laptop online, memindahkannya ke laptop offline via QR Code / File JSON untuk ditandatangani oleh kunci privat tanpa menyentuh internet sama sekali, lalu menyiarkannya kembali ke blockchain.

#### 16. Animated QR Air-Gap Hardware Vault Coordinator (Keystone / SeedSigner / Tangem)
* **Deskripsi:** Protokol komunikasi standar internasional BC-UR (*Blockchain Commons Uniform Resources*) berbasis QR animasi dinamis untuk bertransaksi dengan hardware wallet air-gap tanpa perlu kabel USB, memberikan standar keamanan institusi.

#### 17. Vitalik's ERC-5564 Stealth Address Privacy Shield (Alamat Bayangan Sekali Pakai)
* **Deskripsi:** Mengimplementasikan standar alamat bayangan (*stealth addresses*) resmi. Pengguna membagikan satu meta-address publik; setiap kali ada kiriman dana, sistem menghasilkan alamat unik baru yang acak di blockchain. Hanya kunci privat brankas pengguna yang dapat mendeteksi dan menarik dana tersebut, melindungi privasi saldo dari publik.

---

### 📊 PILAR 3: INSPEKSI SALDO, INTELIJEN ON-CHAIN & ANTI-SCAM (11 FITUR)

#### 18. Multi-Threaded Concurrent RPC Balance Scanner
* **Deskripsi:** Mesin pemeriksa saldo berkecepatan tinggi yang mengirim kueri saldo ribuan dompet ke berbagai node RPC secara paralel melalui *asynchronous runtime* (Tokio di Rust).

#### 19. Native Gas Priority Tracker & Secondary Token Discovery
* **Deskripsi:** Sistem deteksi saldo yang memprioritaskan koin gas utama (ETH, BNB, SOL, POL) untuk kesiapan transaksi, serta otomatis mendeteksi kepemilikan token sekunder (ERC-20 & SPL Token) beserta logonya.

#### 20. Solana Account Type, Owner Program & Rent Analysis
* **Deskripsi:** Audit teknis mendalam terhadap status akun di jaringan Solana: memvalidasi apakah akun merupakan EOA standar (*System Program*), akun program khusus (*Custom Program*), akun *Durable Nonce* (dengan saldo sewa/rent reserve yang terkunci), atau *Associated Token Account* (ATA).

#### 21. Solana Empty Token Account Rent Reclaimer (Klaim Balik Modal Sewa SOL)
* **Deskripsi:** Mesin penutup akun token kosong di jaringan Solana. Menelusuri seluruh akun token SPL yang bersaldo 0, menutup akunnya via instruksi `closeAccount`, dan mengembalikan dana sewa (*rent reserve* sebesar ~0.002039 SOL per akun) langsung ke dompet penampung utama dalam 1 kali klik.

#### 22. Staking & Delegated Rent Deactivator (Solana / EVM LST)
* **Deskripsi:** Mendeteksi saldo SOL yang terlupakan di akun *Stake Delegated* atau *Validator Vote Account* di Solana, membatalkan delegasi (*deactivate stake*), dan mengembalikan modal SOL sewa akun ke saldo aktif.

#### 23. Token Revoke Guard (Anti-Drainer)
* **Deskripsi:** Pemindai izin pengeluaran token (*token approval/allowance*) pada smart contract yang pernah disetujui dompet, serta menyediakan antarmuka eksekusi untuk mencabut izin (*revoke*) kontrak yang berisiko atau mencurigakan.

#### 24. Honeypot & Malicious Tax Pre-Flight Guard
* **Deskripsi:** Sebelum transaksi swap DEX massal dikirim, Plurivex melakukan simulasi lokal: mencoba mengeksekusi *Buy* mikro lalu langsung mencoba *Sell*. Jika token tidak bisa dijual atau pajaknya di atas 10%, transaksi massal langsung dicegah otomatis dengan peringatan *HONEYPOT DETECTED*.

#### 25. Scam Token & Phishing Dust Cleaner (Zero-Value Purge)
* **Deskripsi:** Filter cerdas yang mendeteksi token penipuan / airdrop spam berbahaya (tanpa likuiditas nyata). Menyediakan fungsi 1-klik untuk menyembunyikan (*hide*) atau memusnahkan (*burn / send to dead address*) seluruh token sampah agar portofolio bersih dan terhindar dari jebakan *drainer*.

#### 26. Multi-Chain Pre-Flight Simulation Engine (EVM: `eth_call` & Solana: `simulateTransaction`)
* **Deskripsi:** Mesin simulasi pra-eksekusi multi-chain yang mengeksekusi dry-run via `eth_call` & `eth_estimateGas` di jaringan EVM serta `simulateTransaction` RPC di jaringan Solana untuk memverifikasi apakah transaksi transfer, swap, atau sweeper akan berhasil atau gagal (*revert*) serta memastikan kecukupan rent reserve dan batas gas sebelum biaya riil dikeluarkan di jaringan.

#### 27. ERC-4337 Smart Account & Paymaster Gas Sponsor Detector
* **Deskripsi:** Mendeteksi akun dompet kontrak pintar (*Smart Contract Wallets / Account Abstraction*) seperti Gnosis Safe, Biconomy, dan ZeroDev yang terhubung ke kunci privat EOA pengguna, lengkap dengan deteksi saldo subsidi gas sponsor Paymaster.

#### 28. On-Chain Intelligence & Explorer Hub
* **Deskripsi:** Pusat integrasi 1-klik langsung ke platform analisis on-chain terkemuka: DeBank (portofolio multi-chain), Arkham Intelligence (pelacakan entitas), Etherscan, BscScan, BaseScan, Arbiscan, Solscan, dan SolanaFM.

---

### ⚡ PILAR 4: MESIN EKSEKUSI TRANSAKSI, SWEEPER & NFT (13 FITUR)

#### 29. Batch Sweeper Core (Penyapu Saldo Otomatis)
* **Deskripsi:** Mesin konsolidasi saldo dari ratusan dompet ke 1 dompet penampung utama dengan fitur: pengurangan biaya gas otomatis dari saldo dompet, pilihan kecepatan gas (*Standard, Fast, Turbo*, Custom Gwei), peringatan saldo debu (*dust balance*), dan tautan bukti Tx Hash.

#### 30. DEX Batch Trader (Swap Massal Paralel)
* **Deskripsi:** Mesin eksekusi beli massal (*Batch Buy*) atau jual massal (*Batch Sell*) token di Uniswap (ETH/Base/Arb), PancakeSwap (BSC), dan Raydium (Solana) dari ratusan dompet secara bersamaan dengan pengaturan slippage dan alokasi modal per dompet.

#### 31. Batch Disperser (Distributor Gas & Token Massal)
* **Deskripsi:** Membagikan saldo gas (ETH/BNB/SOL) atau token dari 1 dompet modal induk ke puluhan hingga ratusan dompet anak baru dalam 1 kali eksekusi (sangat krusial untuk persiapan operasi airdrop farming).

#### 32. Auto-Refuel Gas Tank (Pengisi Gas Otomatis untuk Sweeper)
* **Deskripsi:** Dompet modal utama (*Gas Tank*) otomatis mendeteksi dompet yang memiliki token tetapi kekurangan gas, mengirimkan saldo gas dengan nominal presisi secukupnya, mengeksekusi sweeping token, lalu menyapu kembali sisa saldo gas ke dompet modal secara otomatis.

#### 33. Gasless "Permit" Token Sweeper (EIP-2612 / EIP-3009 Zero-ETH Rescue)
* **Deskripsi:** Menyelamatkan token (USDC, DAI, UNI) dari dompet yang memiliki 0 ETH (tanpa gas) menggunakan tanda tangan luring (*permit signature*). Dompet induk membayar biaya gas dari luar dan menarik seluruh token keluar tanpa perlu mengisi ETH ke dompet target.

#### 34. Custom Smart Contract ABI Interactor (Universal Batch Caller)
* **Deskripsi:** Eksekutor kontrak pintar universal. Pengguna memasukkan alamat kontrak apa saja + kode ABI, memilih fungsi yang diinginkan (misal `stake()`, `vote()`, `deposit()`, atau `mint()`), lalu mengeksekusinya di puluhan/ratusan dompet sekaligus dengan 1 kali klik.

#### 35. NFT Batch Sweeper & Vault Transfer (ERC-721 / 1155 & Metaplex Solana)
* **Deskripsi:** Memindai seluruh koleksi NFT yang ada di puluhan/ratusan dompet burner, lalu memindahkannya secara massal ke dompet dingin (*cold storage*) penyimpanan utama dalam 1 antrean transfer.

#### 36. Mass Airdrop Claimer
* **Deskripsi:** Mesin pemanggil fungsi cerdas (*contract method caller*) untuk melakukan klaim reward token atau *minting* di ratusan dompet yang lolos kualifikasi airdrop secara serentak.

#### 37. Tax-Loss Harvesting & Dead Token Burner
* **Deskripsi:** Membakar koin-koin mati/rugpull ke alamat `0x...dEaD` secara massal dari ratusan dompet, serta menghasilkan laporan CSV kerugian modal (*capital loss*) yang siap diimpor ke software akuntansi pajak kripto (Koinly/CoinTracker).

#### 38. Automated Testnet Faucet & Gas Drip Dispenser
* **Deskripsi:** Pusat manajemen saldo koin testnet (Sepolia, Holesky, Berachain bArtio, Monad) yang memantau saldo testnet dan mendistribusikan koin gas testnet secara merata ke ratusan dompet garapan testnet.

#### 39. Radar Gas & Auto-Schedule
* **Deskripsi:** Penjadwal transaksi otomatis yang menahan eksekusi antrean transaksi massal dan baru mengeksekusinya ketika biaya gas jaringan (Gwei) turun di bawah ambang batas yang ditentukan pengguna.

#### 40. QR Code Generator & Mobile Deposit Hub
* **Deskripsi:** Generator kode QR instan untuk setiap alamat dompet, mempermudah pengisian saldo gas langsung dari aplikasi bursa/dompet ponsel (Binance, OKX, Bitget, Phantom Mobile) tanpa mengetik manual.

#### 41. Emergency Vault Purge (Reset All Data)
* **Deskripsi:** Prosedur pembersihan darurat untuk melakukan *best-effort cryptographic erasure* dan pemusnahan basis data lokal SQLite (termasuk berkas utama `.db`, `-wal`, dan `-shm`) dengan otorisasi Master Password.

---

### 🛡️ PILAR 5: OTOMASI AIRDROP, POINTS & ANTI-SYBIL (8 FITUR)

#### 42. Anti-Sybil Cluster & On-Chain Taint Graph Visualizer `[Privacy & Anti-Clustering]`
* **Deskripsi:** Memindai riwayat transaksi antar-dompet di dalam brankas secara lokal untuk mendeteksi apakah ada transfer langsung antar-dompet yang menyebabkan mereka terhubung dalam satu klaster (*cluster*), mencegah diskualifikasi airdrop oleh algoritma pelacakan Sybil.

#### 43. CEX Deposit Address Guard & Anti-Contamination Matrix `[Operational Privacy]`
* **Deskripsi:** Sistem proteksi pencairan saldo massal ke bursa terpusat (Binance, OKX, Bybit) dengan dua mode operasi fleksibel:
  * **Mode Airdrop Sybil-Shield (Proteksi Anti-Ban):** Memetakan dompet ke sub-akun bursa multi-address (seperti OKX 20–100 alamat / Bybit sub-accounts) atau menggunakan **Privacy Swap Bridge Router (ChangeNOW/FixedFloat)** jika bursa hanya memiliki 1 alamat (seperti Binance), memutus jejak antar-dompet di blockchain.
  * **Mode Standard Direct Consolidation (Untuk Dompet Non-Airdrop):** Jika dompet bukan dompet airdrop (trading pribadi, kas, recovery), pengguna bebas menyapu seluruh saldo ratusan dompet langsung ke **SATU alamat deposit Binance yang sama** secara sah dan aman di sisi bursa.

#### 44. Multi-Chain Airdrop Eligibility Radar (Merkle Proof Auto-Checker)
* **Deskripsi:** Mengunduh basis data pembuktian klaim (*Merkle Trees / API snapshot publik*) dari protokol airdrop terbaru secara langsung untuk memindai ratusan dompet dalam hitungan detik dan melaporkan dompet mana saja yang berhak mengklaim alokasi token.

#### 45. Multi-Protocol Airdrop Points & XP Radar
* **Deskripsi:** Memindai perolehan poin dan XP off-chain dari 20+ protokol populer (seperti EigenLayer, Scroll Marks, Linea XP, Hyperliquid, Symbiotic) di ratusan dompet secara instan dan menampilkan papan rekapitulasi poin vault.

#### 46. Scheduled Activity Warm-Up Engine `[Automated Wallet Maintenance]`
* **Deskripsi:** Penjadwal interaksi berkala otomatis yang mengeksekusi transaksi mikro berbiaya rendah (misal: *wrap/unwrap WETH*, check-in harian, interaksi smart contract terverifikasi) dengan interval acak mingguan agar skor reputasi dompet tetap berstatus organik.

#### 47. Anti-Sybil Randomizer Engine `[Timing Jitter & Behavioral Privacy]`
* **Deskripsi:** Algoritma pengacak transaksi yang menyisipkan jeda waktu dinamis (*random delay 5–60 detik*) dan variasi nominal transaksi acak otomatis agar riwayat aktivitas dompet terlihat organik dan meminimalisir pola robotik.

#### 48. Solana Dynamic Priority Fee & Jito Bundle Tip Optimizer
* **Deskripsi:** Algoritma cerdas yang menghitung Compute Unit (CU) secara dinamis dan menyisipkan tip bundle Jito validator untuk memaksimalkan probabilitas eksekusi di blok pertama validator dan meminimalisir kegagalan transaksi saat terjadi kongesti jaringan ekstrem.

#### 49. User-Configurable Auto-Lock Security Timer
* **Deskripsi:** Pengunci brankas otomatis yang dapat dikonfigurasi pengguna (`Off`, `30s`, `1m`, `5m`, `15m`, `30m`, `1h`) jika komputer tidak disentuh, memusnahkan kredensial dari memori dan mewajibkan Master Password untuk membuka kembali.

---

### 🌐 PILAR 6: PRIVASI JARINGAN, MULTI-PROXY & NODE MANAGER (4 FITUR)

#### 50. Multi-Proxy & IP Rotator Manager `[Network Privacy & Rate-Limit Shield]`
* **Deskripsi:** Pengatur proksi jaringan (HTTP/SOCKS5) yang merotasi alamat IP pengguna saat memindai RPC atau mengeksekusi airdrop claim, mencegah ratusan dompet terdeteksi berasal dari satu alamat IP publik yang sama (*IP clustering blacklist protection*).

#### 51. Custom RPC Node Manager & Auto-Fallback
* **Deskripsi:** Pengelola node jaringan blockchain privat (seperti Alchemy, QuickNode, Helius, Infura). Dilengkapi fitur pemantau latensi (*ping tester*) dan otomatis beralih (*auto-fallback*) ke node cadangan jika node utama mengalami gangguan.

#### 52. Multi-Endpoint RPC Hedging Race Engine
* **Deskripsi:** Mengirim kueri transaksi/saldo ke 3 provider RPC berbeda secara bersamaan, mengambil respons pertama yang tiba dengan latensi terendah, dan membuang respons lainnya, menjamin performa responsif dan meminimalisir kegagalan koneksi.

#### 53. Live Multi-RPC Latency Watcher
* **Deskripsi:** Menguji dan memantau kecepatan respons (ping milidetik) dari endpoint node blockchain EVM, BSC, dan Solana secara berkesinambungan di bilah status aplikasi.

---

### 📁 PILAR 7: PENGORGANISASIAN DATA, VALUASI & PORTABILITAS (7 FITUR)

#### 54. High-Speed Virtualized Engine (10.000+ Wallets @ 60 FPS)
* **Deskripsi:** Komponen rendering tabel virtual yang mampu menampilkan dan mengelola 10.000+ dompet secara instan dan ringan tanpa penurunan frame-rate.

#### 55. Tag, Folder & Smart Filter Taxonomy
* **Deskripsi:** Sistem pengelompokan dompet fleksibel (*Main, Airdrop Linea, Whales, Burner, Farming Project X*) yang dipadukan dengan filter instan berdasarkan status saldo (Funded vs Empty) dan tipe rantai (EVM vs SOL).

#### 56. Flexible Vault Exporter (Multi-Format)
* **Deskripsi:** Mesin pencadangan data dompet dengan filter keamanan berlapis (Full Backup, Safe Mode Alamat Saja, Khusus Bersaldo) ke format Tabel Spreadsheet `.CSV` atau Teks `.TXT`.

#### 57. Realtime Multi-Currency Portfolio Valuation (USD & IDR)
* **Deskripsi:** Menghitung total nilai kekayaan seluruh saldo dompet di brankas ke dalam mata uang Dollar AS ($ USD) dan Rupiah Indonesia (Rp IDR) berdasarkan kurs pasar *real-time*.

#### 58. Local Vault Net Worth Snapshot & Historical PnL Tracker
* **Deskripsi:** Merekam jejak (*snapshot*) total nilai portofolio ke database lokal SQLite secara berkala setiap kali proses pemindaian berjalan, menampilkan grafik pertumbuhan kekayaan, keuntungan (*PnL*), dan riwayat tren portofolio tanpa layanan pelacak online pihak ketiga.

#### 59. Multi-Channel Webhook Notifier (Discord, Slack, & Custom Webhook)
* **Deskripsi:** Mengirimkan kartu notifikasi laporan transaksi (*embed message*) otomatis ke channel Discord, Slack, atau server webhook kustom milik tim/komunitas begitu ada dana baru masuk atau transaksi sweeper selesai.

#### 60. Encrypted Portable Vault Archive (`.plurivex` One-Click Backup & Migration)
* **Deskripsi:** Membuat satu berkas arsip tunggal berformat `.plurivex` yang terenkripsi ganda dengan kata sandi cadangan (*recovery passphrase*). Berkas ini mengemas seluruh database dompet, label/tag, riwayat transaksi, dan pengaturan RPC, memungkinkan migrasi brankas ke PC/laptop baru hanya dalam 1 klik.

---

## 📊 3. Matriks Status 60 Master Fitur Plurivex

Klasifikasi Status:
* 🟢 **Complete & Live:** Sudah diimplementasikan, teruji di kode, dan aktif di aplikasi desktop.
* 🟡 **Partial / UI Complete:** Antarmuka visual sudah siap, integrasi backend on-chain dijadwalkan pada roadmap.
* ⚪ **Architecture Stub / Scaffolding Ready:** Wadah modul domain backend sudah tersedia, logika menunggu fase roadmap.
* ⏳ **Planned (Fase X):** Direncanakan sesuai urutan ketergantungan rekayasa.

| No | Nama Fitur | Pilar Kategori | Status Pengembangan | Label Tata Kelola / Regulasi |
| :---: | :--- | :--- | :---: | :---: |
| **1** | Smart Contract Protokol (`PlurivexSweeper.sol`) | Pilar 1: Smart Contract | ⚪ Architecture Stub / Scaffolding Ready | Standard Protocol |
| **2** | Solana Native Multi-Instruction Engine | Pilar 1: Smart Contract | ⚪ Architecture Stub / Scaffolding Ready | Standard Protocol |
| **3** | MEV / Flashbots Private Mempool Protection | Pilar 1: Smart Contract | ⚪ Architecture Stub / Scaffolding Ready | Whitehat Recovery |
| **4** | Cross-Chain Bridge & Consolidation (Solana ↔ EVM) | Pilar 1: Smart Contract | ⚪ Architecture Stub / Scaffolding Ready | Liquidity Integration |
| **5** | Smart Contract Cryptographic Gatekeeper | Pilar 1: Smart Contract | ⚪ Architecture Stub / Scaffolding Ready | Proprietary Protection |
| **6** | True Dual-Chain Key Derivation (EVM + Solana) | Pilar 2: Manajemen Kunci | 🟢 **Complete & Live** | Core Key Management |
| **7** | Smart Universal Parser & File Extractor | Pilar 2: Manajemen Kunci | 🟢 **Complete & Live** | `[Authorized Use Only]` |
| **8** | Anti-Duplicate Guard (Deduplikasi Hash) | Pilar 2: Manajemen Kunci | 🟢 **Complete & Live** | Integrity Verification |
| **9** | Zero-Cloud SQLite Encrypted Vault | Pilar 2: Manajemen Kunci | 🟢 **Complete & Live** | Data at Rest Security |
| **10** | Mnemonic Typo Repair Tool (Rayon Zero-Disk) | Pilar 2: Manajemen Kunci | 🟢 **Complete & Live** (Fase 1) | Key Recovery |
| **11** | Deep Sub-Account Derivation Scan | Pilar 2: Manajemen Kunci | ⏳ Planned (Fase 1) | HD Account Discovery |
| **12** | Batch Wallet Generator | Pilar 2: Manajemen Kunci | ⏳ Planned (Fase 1) | Key Generation |
| **13** | Multi-Core Vanity Address Generator | Pilar 2: Manajemen Kunci | ⏳ Planned (Fase 5) | Vanity Address |
| **14** | Keystore & Password Mutation Recovery Engine | Pilar 2: Manajemen Kunci | ⏳ Planned (Fase 5) | `[Forensic Recovery]` |
| **15** | Offline Air-Gapped Network Interceptor | Pilar 2: Manajemen Kunci | 🟢 **Complete & Live** (Fase 0) | Cold Storage Guard |
| **16** | Animated QR Air-Gap Hardware Vault Coordinator | Pilar 2: Manajemen Kunci | ⏳ Planned (Fase 5) | BC-UR Protocol |
| **17** | Vitalik's ERC-5564 Stealth Address Shield | Pilar 2: Manajemen Kunci | ⏳ Planned (Fase 5) | Privacy Standard |
| **18** | Multi-Threaded Concurrent Balance Scanner | Pilar 3: Inspeksi & Audit | 🟢 **Complete & Live** | Read-Only Audit |
| **19** | Native Gas Tracker & Secondary Token Discovery | Pilar 3: Inspeksi & Audit | 🟢 **Complete & Live** | Read-Only Audit |
| **20** | Solana Account Type & Rent Analysis | Pilar 3: Inspeksi & Audit | 🟢 **Complete & Live** | Read-Only Audit |
| **21** | Solana Empty Token Rent Reclaimer | Pilar 3: Inspeksi & Audit | ⏳ Planned (Fase 3) | Asset Recovery |
| **22** | Staking & Delegated Rent Deactivator | Pilar 3: Inspeksi & Audit | ⏳ Planned (Fase 3) | Asset Recovery |
| **23** | Token Revoke Guard (Anti-Drainer) | Pilar 3: Inspeksi & Audit | ⏳ Planned (Fase 2) | Security Inspection |
| **24** | Honeypot & Malicious Tax Pre-Flight Guard | Pilar 3: Inspeksi & Audit | ⏳ Planned (Fase 2) | Pre-Flight Security |
| **25** | Scam Token & Phishing Dust Cleaner | Pilar 3: Inspeksi & Audit | ⏳ Planned (Fase 2) | Portfolio Hygiene |
| **26** | Multi-Chain Pre-Flight Simulation (EVM & Solana) | Pilar 3: Inspeksi & Audit | ⏳ Planned (Fase 2) | Pre-Flight Security |
| **27** | ERC-4337 Smart Account & Paymaster Detector | Pilar 3: Inspeksi & Audit | ⏳ Planned (Fase 5) | Account Abstraction |
| **28** | On-Chain Intelligence & Explorer Hub | Pilar 3: Inspeksi & Audit | 🟢 **Complete & Live** | Public Analytics |
| **29** | Batch Sweeper Execution Engine | Pilar 4: Eksekusi Transaksi | 🟢 **Complete & Live** | Batch Execution |
| **30** | DEX Batch Trader (Multi-Wallet Swap) | Pilar 4: Eksekusi Transaksi | 🟡 **Partial / UI Complete** | DEX Router Integration |
| **31** | Batch Disperser (Distributor Gas & Token) | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 3) | Batch Execution |
| **32** | Auto-Refuel Gas Tank | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 3) | Gas Automation |
| **33** | Gasless "Permit" Token Sweeper (Zero-ETH Rescue) | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 3) | Whitehat Rescue |
| **34** | Custom Smart Contract ABI Interactor | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 5) | Universal Caller |
| **35** | NFT Batch Sweeper & Vault Transfer | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 3) | Batch NFT |
| **36** | Mass Airdrop Claimer | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 4) | Airdrop Automation |
| **37** | Tax-Loss Harvesting & Dead Token Burner | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 5) | Accounting / Tax |
| **38** | Automated Testnet Faucet & Gas Drip Dispenser | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 4) | Testnet Operations |
| **39** | Radar Gas & Auto-Schedule | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 2) | Gas Optimization |
| **40** | QR Code Generator & Mobile Deposit Hub | Pilar 4: Eksekusi Transaksi | ⏳ Planned (Fase 1) | Mobile Interop |
| **41** | Emergency Vault Purge (Reset All Data) | Pilar 4: Eksekusi Transaksi | 🟢 **Complete & Live** | Cryptographic Erasure |
| **42** | Anti-Sybil Cluster & Taint Graph Visualizer | Pilar 5: Otomasi Airdrop | ⏳ Planned (Fase 4) | `[Anti-Clustering]` |
| **43** | CEX Deposit Guard & Anti-Contamination Matrix | Pilar 5: Otomasi Airdrop | ⏳ Planned (Fase 4) | `[Asset Segregation]` |
| **44** | Multi-Chain Airdrop Eligibility Radar | Pilar 5: Otomasi Airdrop | ⏳ Planned (Fase 4) | Eligibility Radar |
| **45** | Multi-Protocol Airdrop Points & XP Radar | Pilar 5: Otomasi Airdrop | ⏳ Planned (Fase 4) | Analytics |
| **46** | Scheduled Activity Warm-Up Engine | Pilar 5: Otomasi Airdrop | ⏳ Planned (Fase 4) | `[Wallet Maintenance]` |
| **47** | Anti-Sybil Randomizer Engine | Pilar 5: Otomasi Airdrop | ⏳ Planned (Fase 4) | `[Behavioral Privacy]` |
| **48** | Solana Priority Fee & Jito Tip Optimizer | Pilar 5: Otomasi Airdrop | ⏳ Planned (Fase 4) | Execution Assurance |
| **49** | User-Configurable Auto-Lock Security Timer | Pilar 5: Otomasi Airdrop | 🟢 **Complete & Live** | Session Security |
| **50** | Multi-Proxy & IP Rotator Manager | Pilar 6: Privasi Jaringan | ⏳ Planned (Fase 2) | `[Network Privacy]` |
| **51** | Custom RPC Node Manager & Auto-Fallback | Pilar 6: Privasi Jaringan | 🟢 **Complete & Live** | Network Reliability |
| **52** | Multi-Endpoint RPC Hedging Race Engine | Pilar 6: Privasi Jaringan | ⏳ Planned (Fase 2) | Latency Hedging |
| **53** | Live Multi-RPC Latency Watcher | Pilar 6: Privasi Jaringan | 🟢 **Complete & Live** | Network Monitoring |
| **54** | High-Speed Virtualized Engine (10.000+ Wallets) | Pilar 7: Data & Portabilitas | 🟢 **Complete & Live** | 60 FPS Virtualization |
| **55** | Tag, Folder & Smart Filter Taxonomy | Pilar 7: Data & Portabilitas | 🟢 **Complete & Live** | Organization |
| **56** | Flexible Vault Exporter (CSV/TXT) | Pilar 7: Data & Portabilitas | 🟢 **Complete & Live** | Backup / Export |
| **57** | Realtime Multi-Currency Valuation (USD/IDR) | Pilar 7: Data & Portabilitas | 🟢 **Complete & Live** | Realtime Pricing |
| **58** | Local Vault Net Worth Snapshot & PnL History | Pilar 7: Data & Portabilitas | ⏳ Planned (Fase 5) | Local Analytics |
| **59** | Multi-Channel Webhook Notifier (Discord / Slack / Custom Webhook) | Pilar 7: Data & Portabilitas | ⏳ Planned (Fase 5) | Broadcast Alerts |
| **60** | Encrypted Portable Vault Archive (`.plurivex`) | Pilar 7: Data & Portabilitas | ⏳ Planned (Fase 5) | Encrypted Migration |

---

## 🚀 4. Urutan Eksekusi Bertahap (The Phased Dependency Roadmap Anti-Rewrite)

Roadmap di bawah dirancang untuk memastikan **Zero Architectural Rewrites**, di mana setiap fase bertindak sebagai fondasi stabil untuk fase berikutnya:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ROADMAP 6 TAHAP PENGEMBANGAN PLURIVEX (60 FITUR)               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟢 FASE 0: FONDASI UTAMA YANG SUDAH JADI & AKTIF (17 Complete + 1 Partial)  │
│ 🧱 FASE 1: FONDASI KUNCI, EKSTRAKSI & PEMULIHAN DATA (4 Fitur)              │
│ 🛡️ FASE 2: INFRASTRUKTUR JARINGAN, SIMULASI & ANTI-SCAM (7 Fitur)           │
│ ⚡ FASE 3: SMART CONTRACT, PENYAPU SALDO & EKSEKUSI TRANSAKSI (9 Fitur)      │
│ 🎯 FASE 4: OTOMASI AIRDROP, RADAR POIN & BENTENG ANTI-SYBIL (9 Fitur)       │
│ 👑 FASE 5: PERALATAN FORENSIK ELIT, HARDWARE AIR-GAP & EKOSISTEM (13 Fitur) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🟢 FASE 0: Fondasi Utama yang Sudah Jadi & Aktif (17 Complete + 1 Partial)
> *Status: Selesai diuji di biner dan tersimpan di repositori GitHub (`3f95668` & `6e6b20f`).*

1. **Fitur #6:** True Dual-Chain Key Derivation (`core/wallets/derivation.rs` sebagai Source of Truth; `src/lib/wallet.ts` sebagai thin IPC wrapper)
2. **Fitur #7:** Smart Universal Parser & File Extractor (`core/wallets/import.rs` sebagai Source of Truth; `src/lib/extract.ts` sebagai thin IPC wrapper)
3. **Fitur #8:** Anti-Duplicate Guard Kriptografi (`core/wallets/fingerprint.rs` sebagai Source of Truth; `src/lib/fingerprint.ts` sebagai thin IPC wrapper)
4. **Fitur #9:** Zero-Cloud SQLite Encrypted Vault (`core/security/crypto.rs` Argon2id sebagai Source of Truth; `db/schema.rs`, `db/migrations.rs`, didukung `src/lib/crypto.ts` sebagai thin IPC wrapper)
5. **Fitur #18:** Multi-Threaded Concurrent Balance Scanner (`core/scanner/mod.rs`)
6. **Fitur #19:** Native Gas Tracker & Secondary Token Discovery (`adapters/evm/tokens.rs`, `adapters/solana/tokens.rs`)
7. **Fitur #20:** Solana Account Type & Rent Analysis (`adapters/solana/client.rs`)
8. **Fitur #28:** On-Chain Intelligence & Explorer Hub (`src/components/WalletActivityExplorer.tsx`)
9. **Fitur #29:** Batch Sweeper Core (`adapters/evm/client.rs` & `adapters/solana/client.rs` sebagai Broadcaster RPC; `src/lib/sweeper.ts` sebagai Execution UI bridge)
10. **Fitur #30:** DEX Batch Trader *(Status: 🟡 Partial / UI Complete di `src/components/DexBatchTrader.tsx`, integrasi router on-chain dijadwalkan)*
11. **Fitur #41:** Emergency Vault Purge / Reset All (`src/components/ResetAllWalletsModal.tsx`)
12. **Fitur #49:** User-Configurable Auto-Lock Security Timer & 4 Core Security Shields (`src/context/AppContext.tsx`, `src/lib/security.ts`, `src-tauri/src/core/security/`)
13. **Fitur #51:** Custom RPC Node Manager Dasar (`src/lib/chains.ts`)
14. **Fitur #53:** Live Multi-RPC Latency Watcher (Header/Footer Status)
15. **Fitur #54:** High-Speed Virtualized Engine 10.000 Dompet (`src/components/Sidebar.tsx`)
16. **Fitur #55:** Tag, Folder & Smart Filter Taxonomy (`src/context/AppContext.tsx`)
17. **Fitur #56:** Flexible Vault Exporter (`src/components/ExportModal.tsx`)
18. **Fitur #57:** Realtime Multi-Currency Valuation USD/IDR (`WalletDetail.tsx`)

---

### 🧱 FASE 1: Fondasi Kunci, Ekstraksi & Pemulihan Data (4 Fitur)
> *Tujuan: Memastikan brankas data lokal mampu mengelola, memperbaiki, dan memperluas dompet sebelum transaksi dikirim ke blockchain.*

* **Urutan 1 (Fitur #10): Mnemonic Typo Repair Tool** — Memulihkan seed phrase yang salah eja atau hilang 1 kata sebelum dimasukkan ke brankas.
* **Urutan 2 (Fitur #11): Deep Sub-Account Derivation Scan** — Menemukan akun-akun turunan anak (`#1` s/d `#20`) yang bersaldo dari seed phrase.
* **Urutan 3 (Fitur #12): Batch Wallet Generator** — Generator massal untuk membuat 100-1.000 dompet baru langsung di brankas.
* **Urutan 4 (Fitur #40): QR Code Generator & Mobile Deposit Hub** — Mempermudah setoran gas fee awal via kamera ponsel.

*(Catatan Arsitektur: Fitur #49 Auto-Lock Timer telah diselesaikan dan diaktifkan lebih awal sebagai fondasi keamanan mutlak).*

---

### 🛡️ FASE 2: Infrastruktur Jaringan, Simulasi & Anti-Scam (7 Fitur)
> *Tujuan: Membangun jalur pipa internet yang aman, cepat, dan terverifikasi sebelum ada saldo gas yang dikirimkan.*

* **Urutan 1 (Fitur #50): Multi-Proxy & IP Rotator Manager** — Jalur proksi agar scanning tidak terkena blacklist IP.
* **Urutan 2 (Fitur #52): Multi-Endpoint RPC Hedging Race Engine** — Mengambil respons tercepat dari 3 RPC secara bersamaan untuk meminimalisir latensi.
* **Urutan 3 (Fitur #24): Honeypot & Malicious Tax Pre-Flight Guard** — Deteksi token jebakan pajak 99% sebelum dibeli.
* **Urutan 4 (Fitur #25): Scam Token & Phishing Dust Cleaner** — Membersihkan token sampah berbahaya dari portofolio.
* **Urutan 5 (Fitur #26): Multi-Chain Pre-Flight Simulation Engine (EVM: `eth_call` & Solana: `simulateTransaction`)** — Mesin uji simulasi pra-eksekusi multi-chain sebelum gas dikeluarkan di jaringan.
* **Urutan 6 (Fitur #23): Token Revoke Guard** — Mencabut izin smart contract yang berisiko.
* **Urutan 7 (Fitur #39): Radar Gas & Auto-Schedule** — Pemantau murahnya gas Gwei jaringan.

---

### ⚡ FASE 3: Smart Contract, Penyapu Saldo & Eksekusi Transaksi (9 Fitur)
> *Tujuan: Mengaktifkan seluruh fungsi penarikan uang, penghemat gas, dan royalti protokol.*

* **Urutan 1 (Fitur #1): Deploy & Integrasi Smart Contract Protokol (`PlurivexSweeper.sol`)** — Sweeping multi-token sekali jalan (hemat gas 70%) dan fee 0.70% ke Treasury.
* **Urutan 2 (Fitur #2): Solana Native Multi-Instruction Atomic Engine** — Sweeping atomik di validator Solana.
* **Urutan 3 (Fitur #21): Solana Empty Token Account Rent Reclaimer** — Klaim modal sewa SOL (~0.002039 SOL/akun) langsung ke dompet penampung.
* **Urutan 4 (Fitur #22): Staking & Delegated Rent Deactivator** — Unstake dan penarikan saldo sewa validator yang terlupakan.
* **Urutan 5 (Fitur #33): Gasless "Permit" Token Sweeper (EIP-2612 / EIP-3009)** — Menyelamatkan token dari dompet 0 ETH tanpa perlu isi gas.
* **Urutan 6 (Fitur #3): MEV / Flashbots Private Mempool Protection** — Jalur pipa penambang privat untuk dompet bocor.
* **Urutan 7 (Fitur #31): Batch Disperser** — Bagi gas/token modal dari 1 dompet ke ratusan dompet anak.
* **Urutan 8 (Fitur #32): Auto-Refuel Gas Tank** — Isi gas otomatis ke dompet yang kekurangan gas saat sweeping.
* **Urutan 9 (Fitur #35): NFT Batch Sweeper & Vault Transfer** — Pindahkan seluruh koleksi NFT ke cold storage.

---

### 🎯 FASE 4: Otomasi Airdrop, Radar Poin & Benteng Anti-Sybil (9 Fitur)
> *Tujuan: Mengotomasi operasi airdrop tingkat lanjut dan melindungi akun dari pemblokiran.*

* **Urutan 1 (Fitur #42): Anti-Sybil Cluster & On-Chain Taint Graph Visualizer** — Mendeteksi hubungan transfer antar-dompet lokal.
* **Urutan 2 (Fitur #43): CEX Deposit Address Guard (Airdrop Shield vs Standard Mode)** — Proteksi pencairan aman ke Binance/OKX.
* **Urutan 3 (Fitur #44): Multi-Chain Airdrop Eligibility Radar (Merkle Proof)** — Cek jatah airdrop ratusan dompet secara instan.
* **Urutan 4 (Fitur #45): Multi-Protocol Airdrop Points & XP Radar** — Rekapitulasi poin off-chain (EigenLayer, Scroll, Hyperliquid).
* **Urutan 5 (Fitur #46): Scheduled Activity Warm-Up Engine** — Interaksi mikro mingguan otomatis agar dompet berstatus organik.
* **Urutan 6 (Fitur #47): Anti-Sybil Randomizer Engine** — Jeda acak 5–60 detik dan variasi angka.
* **Urutan 7 (Fitur #48): Solana Priority Fee & Jito Tip Optimizer** — Tip validator Jito untuk memaksimalkan kepastian eksekusi blok.
* **Urutan 8 (Fitur #36): Mass Airdrop Claimer** — Eksekusi klaim token/NFT massal otomatis.
* **Urutan 9 (Fitur #38): Automated Testnet Faucet & Gas Drip Dispenser** — Distribusi koin testnet (Sepolia, Berachain, Monad).

---

### 👑 FASE 5: Peralatan Forensik Elit, Hardware Air-Gap & Ekosistem (13 Fitur)
> *Tujuan: Menjadikan Plurivex sebagai konsol operasi desktop tak tertandingi untuk Paus, Auditor, dan Tim Treasury.*

* **Urutan 1 (Fitur #4): Cross-Chain Bridge & Consolidation (Solana ↔ EVM)** — Peleburan saldo multi-rantai jadi 1 aset (deBridge/Mayan).
* **Urutan 2 (Fitur #5): Smart Contract Cryptographic Gatekeeper** — Proteksi lisensi biner Rust anti-bajak.
* **Urutan 3 (Fitur #13): Multi-Core Vanity Address Generator** — Generator alamat cantik (`0x8888...` / `Moon...SOL`).
* **Urutan 4 (Fitur #14): Keystore & Password Mutation Recovery Engine** — Alat forensik pembongkar keystore JSON lama.
* **Urutan 5 (Fitur #15): Offline Air-Gapped Transaction Signer** — Penandatangan transaksi luring tanpa internet.
* **Urutan 6 (Fitur #16): Animated QR Air-Gap Hardware Vault Coordinator** — Integrasi QR animasi (BC-UR) untuk Keystone/Tangem.
* **Urutan 7 (Fitur #17): Vitalik's ERC-5564 Stealth Address Privacy Shield** — Generator alamat bayangan sekali pakai.
* **Urutan 8 (Fitur #27): ERC-4337 Smart Account & Paymaster Gas Sponsor Detector** — Deteksi akun pintar Account Abstraction.
* **Urutan 9 (Fitur #34): Custom Smart Contract ABI Interactor** — Pemanggil kontrak pintar universal.
* **Urutan 10 (Fitur #37): Tax-Loss Harvesting & Dead Token Burner** — Pembakar koin rugpull ke `0x...dEaD` + ekspor laporan pajak.
* **Urutan 11 (Fitur #58): Local Vault Net Worth Snapshot & Historical PnL Tracker** — Grafik tren kekayaan lokal di SQLite.
* **Urutan 12 (Fitur #59): Multi-Channel Webhook Notifier (Discord / Slack / Custom Webhook)** — Laporan otomatis ke grup tim Anda.
* **Urutan 13 (Fitur #60): Encrypted Portable Vault Archive (`.plurivex`):** Cadangan dan migrasi 1-klik ke laptop baru.

---

## 🏛️ 5. Arsitektur Domain Backend Rust (Hexagonal / Ports & Adapters)

Backend Rust (`src-tauri/src/`) telah dirombak total dari monolitik (`commands.rs` lama) menjadi **Arsitektur Domain Bersih (*Hexagonal / Ports & Adapters*)** pada commit `3f95668` & `6e6b20f`:

```text
src-tauri/src/
├── app/
│   ├── commands.rs            # Resepsionis tipis Tauri (Input validation & command dispatching)
│   ├── state.rs               # Manajemen state runtime global aplikasi
│   └── mod.rs
├── adapters/
│   ├── evm/
│   │   ├── client.rs          # RPC EVM, gas fee Gwei, nonce, broadcast transaksi
│   │   ├── tokens.rs          # Metadata & kontrak token ERC-20 (ETH, BSC, Base, Arb)
│   │   ├── account_abstraction.rs # Deteksi smart account ERC-4337 & paymaster (#27)
│   │   └── mod.rs
│   ├── solana/
│   │   ├── client.rs          # RPC Solana, durable nonce, rent analysis, broadcast Tx
│   │   ├── tokens.rs          # Metadata token SPL Solana
│   │   ├── jito.rs            # Kalkulasi dinamis compute unit & tip validator Jito (#48)
│   │   └── mod.rs
│   ├── bridge/
│   │   └── mod.rs             # Wadah integrasi deBridge DLN / Mayan Finance / Li.Fi
│   ├── explorers/
│   │   └── mod.rs             # Generator link bukti penjelajah blockchain (Etherscan, Solscan)
│   └── mod.rs
├── core/
│   ├── vault/
│   │   ├── models.rs          # Model entitas database (WalletRecord, BalanceRecord)
│   │   ├── repository.rs      # Akses dan jalur berkas SQLite lokal
│   │   ├── service.rs         # Layanan bisnis brankas
│   │   └── mod.rs
│   ├── security/
│   │   ├── crypto.rs          # Kriptografi Argon2id, hashing, dan verifikasi tanda tangan (Live)
│   │   ├── memory.rs          # Pengaman RAM (SecureBuffer / volatile zeroize) (Live)
│   │   ├── session.rs         # Manajemen timer pengunci otomatis (Auto-lock) (Live)
│   │   ├── gatekeeper.rs      # Proteksi kriptografi lisensi biner Rust anti-bajak (#5)
│   │   ├── airgap.rs          # Penandatanganan transaksi luring air-gapped (#15)
│   │   ├── bcur.rs            # Koordinator hardware vault QR animasi BC-UR 2.0 (#16)
│   │   └── mod.rs
│   ├── wallets/
│   │   ├── import.rs          # Mesin pemindai direktori rekursif berkecepatan tinggi (Live)
│   │   ├── derivation.rs      # Mesin derivasi kunci dual-chain native BIP-39 & SLIP-0010 (Live)
│   │   ├── fingerprint.rs     # Algoritma deduplikasi kunci SHA-256 (Live)
│   │   ├── repair.rs          # Deteksi & koreksi salah ketik kamus BIP-39 (#10)
│   │   ├── subaccounts.rs     # Pemindaian otomatis derivasi sub-akun HD index 0-50 (#11)
│   │   ├── generator.rs       # Generator dompet batch multi-core paralel (#12)
│   │   ├── vanity.rs          # Generator alamat cantik multi-core CPU (#13)
│   │   ├── keystore_recovery.rs # Mesin pemulihan keystore JSON mutasi (#14)
│   │   ├── stealth.rs         # Perisai alamat bayangan ERC-5564 (#17)
│   │   ├── qr.rs              # Generator kode QR & mobile deposit hub (#40)
│   │   ├── export.rs          # Pencadangan & ekspor brankas fleksibel (#56)
│   │   └── mod.rs
│   ├── scanner/
│   │   ├── evm.rs             # Orkestrator kueri paralel batch EVM (Live)
│   │   ├── solana.rs          # Orkestrator kueri paralel Solana (Live)
│   │   ├── pricing.rs         # Layanan konversi harga pasar real-time (Live)
│   │   ├── allowances.rs      # Pemindai izin pengeluaran token anti-drainer (#23)
│   │   ├── scam_filter.rs     # Filter pembersih token scam & debu phishing (#25)
│   │   └── mod.rs             # Eksekusi pemindaian saldo massal (Live)
│   ├── execution/
│   │   ├── queue.rs           # Manajemen antrean transaksi massal (Live)
│   │   ├── simulator.rs       # Mesin simulasi pra-eksekusi multi-chain EVM & Solana (#26)
│   │   ├── honeypot.rs        # Pra-inspeksi simulasi token honeypot & pajak jahat (#24)
│   │   ├── sweeper.rs         # Layanan eksekusi sweeper massal (Live)
│   │   ├── trader.rs          # Layanan eksekusi DEX batch trading (#30)
│   │   ├── solana_batch.rs    # Mesin eksekusi multi-instruksi atomik Solana (#2)
│   │   ├── solana_rent.rs     # Reklamasi modal sewa akun token kosong Solana (#21)
│   │   ├── solana_stake.rs    # Deaktivasi & penarikan sewa staking/validator (#22)
│   │   ├── disperser.rs       # Distributor saldo gas & token massal (#31)
│   │   ├── refuel.rs          # Pengisi gas otomatis untuk sweeper (#32)
│   │   ├── permit.rs          # Gasless permit token sweeper EIP-2612 (#33)
│   │   ├── abi_caller.rs      # Pemanggil fungsi ABI kontrak pintar dinamis (#34)
│   │   ├── nft_sweep.rs       # Penyapu portofolio NFT ERC-721/1155 & Metaplex (#35)
│   │   ├── claimer.rs         # Mesin klaim airdrop massal terotomasi (#36)
│   │   ├── burner.rs          # Pembakar koin rugpull ke dead address (#37)
│   │   ├── scheduler.rs       # Penjadwal transaksi berbasis radar gas (#39)
│   │   ├── warmup.rs          # Mesin pemanasan aktivitas dompet berkala (#46)
│   │   ├── randomizer.rs      # Pengacak jeda waktu & jitter nominal anti-sybil (#47)
│   │   ├── bridge.rs          # Jembatan konsolidasi lintas-rantai deBridge/Mayan (#4)
│   │   └── mod.rs
│   ├── network/
│   │   ├── rpc_manager.rs     # Pengelola endpoint RPC kustom & fallback (Live)
│   │   ├── proxy.rs           # Pengatur rotasi IP proxy (HTTP / SOCKS5) (#50)
│   │   ├── hedging.rs         # Mesin balap latensi multi-node (RPC race engine) (#52)
│   │   ├── flashbots.rs       # Perlindungan mempool privat anti-MEV (#3)
│   │   ├── faucets.rs         # Pusat dispenser koin testnet terotomasi (#38)
│   │   └── mod.rs
│   ├── notifications/
│   │   ├── webhook.rs         # Notifikasi siaran otomatis (Discord / Slack / Webhook) (#59)
│   │   └── mod.rs
│   ├── analytics/
│   │   ├── taint_graph.rs     # Visualizer graf & analitik klaster anti-sybil (#42)
│   │   ├── cex_guard.rs       # Proteksi rute & deposit CEX multi-dompet (#43)
│   │   ├── eligibility.rs     # Radar kelayakan airdrop multi-chain Merkle proof (#44)
│   │   ├── points_radar.rs    # Pemindai perolehan poin & XP protokol off-chain (#45)
│   │   ├── pnl.rs             # Rekam jejak snapshot kekayaan vault & pelacak PnL (#58)
│   │   └── mod.rs
│   ├── archive/
│   │   ├── plurivex.rs        # Enkripsi & migrasi arsip portabel (.plurivex) (#60)
│   │   └── mod.rs
│   └── mod.rs
├── db/
│   ├── schema.rs              # Definisi konstanta nama tabel
│   ├── migrations.rs          # Migrasi skema SQLite resmi (v1 s/d v5)
│   └── mod.rs
├── utils/
│   ├── errors.rs              # Enum kesalahan standar terpadu (AppError)
│   ├── time.rs                # Utilitas stempel waktu (timestamp)
│   └── mod.rs
├── lib.rs                     # Titik masuk modul pustaka Tauri v2
└── main.rs                    # Titik masuk eksekusi biner
```

### 🧩 Core Ports / Trait Interfaces & Aturan Dependensi:
Agar arsitektur benar-benar memenuhi prinsip Hexagonal (Inversion of Control):
1. **Aturan Dependensi Mutlak:**
   * `core/` **DILARANG MENGIMPOR** `adapters/`.
   * `adapters/` mengimplementasikan *traits / ports* yang didefinisikan di dalam `core/`.
   * `app/commands.rs` murni bertindak sebagai *thin controller / dispatcher*, tidak boleh mengandung logika bisnis langsung.
2. **Definisi Formal Port / Trait Inti:**
   * `VaultRepository`: Abstraksi operasi CRUD brankas lokal di SQLite.
   * `RpcProvider`: Abstraksi pembacaan saldo, nonce, gas, dan estimasi biaya (EVM & Solana).
   * `TransactionBroadcaster`: Abstraksi penyiaran transaksi bertanda tangan ke mempool / validator.
   * `PriceOracle`: Abstraksi konversi kurs mata uang pasar real-time.
   * `ClipboardService`: Abstraksi pembersih papan klip level sistem operasi.
   * `ArchiveStore`: Abstraksi ekspor/impor terenkripsi `.plurivex`.

---

## 🎨 6. Arsitektur Frontend React & Batasan Keamanan Kriptografi

### 📂 Struktur Folder Frontend (`src/`):

```text
src/
├── app/
│   ├── layout/                # Shell desktop (Top Header Mode Switcher, Status Bar)
│   ├── providers/             # Theme & Modal Portals
│   └── routes/                # Navigasi tab utama
├── features/
│   ├── vault/                 # Pengelolaan dompet, import/export, typo repair
│   ├── scanner/               # Tabel inspeksi saldo, token secondary, filter
│   ├── execution/             # Batch sweeper, disperser, queue manager
│   ├── dex/                   # DEX batch trader (Uniswap, Pancake, Raydium)
│   ├── analytics/             # PnL tracker, valuasi USD/IDR, explorer hub
│   └── settings/              # Custom RPC, proxy rotator, security timer
├── components/
│   ├── ui/                    # Tombol, badge, input, modal dialog
│   ├── table/                 # Virtualized Table 10.000 Dompet
│   └── modals/                # ExportModal, ResetModal, SimulationModal
├── stores/
│   ├── walletStore.ts         # Zustand: Daftar dompet & metadata (Selector Subscriptions)
│   ├── scanStore.ts           # Zustand: Saldo live & token balances
│   ├── executionStore.ts      # Zustand: Antrean batch execution
│   └── appStore.ts            # Zustand: Mode operasi (Audit / Vault / Execution)
└── lib/
    ├── tauri.ts               # Jembatan komunikasi invoke Tauri
    ├── format.ts              # Formatter saldo & mata uang
    ├── validation.ts          # Validasi alamat, private key, seed phrase
    └── security.ts            # Jembatan clipboard auto-clear
```

---

### 🚀 Status Eksekusi Migrasi Kriptografi ke Rust Core (Zero Secret Persistence Model):
*(Catatan Transisi Frontend: Kredensial rahasia hanya transit sementara di memori input field saat diketik pengguna, lalu segera diteruskan ke Rust Core via IPC. Data tersebut tidak dipersistensikan ke web storage, cache frontend, state jangka panjang, atau log (Zero Secret Persistence Model).*
Migrasi logika sensitif (*secret-bearing logic*) dari TypeScript ke Rust Core kini telah **resmi selesai diimplementasikan, teruji 100%, dan di-push ke GitHub (Commit `b8af254`)**:

1. **Enkripsi & Dekripsi Brankas 100% Rust Native (`core/security/crypto.rs`):**
   * Pustaka Web Crypto PBKDF2 di browser React telah **dihapus total** dan digantikan oleh standar emas **Argon2id + AES-256-GCM** di Rust native.
   * **Kompatibilitas Mundur Sempurna (*100% Backward-Compatible*):** Mesin Rust otomatis mendeteksi dan mendekripsi format database lama berbasis PBKDF2 (120.000 iterasi), menjamin seluruh data dompet lama di SQLite Anda tetap terbuka utuh tanpa risiko rusak.
   * Perintah IPC aktif: `vault_encrypt`, `vault_decrypt`, `vault_create_token`, `vault_verify_token`.

2. **Derivasi Kunci Dual-Chain 100% Rust Native (`core/wallets/derivation.rs`):**
   * **BIP-39 Mnemonic:** Parsing, normalisasi, dan validasi 12/24 kata dijalankan secara native oleh crate Rust `bip39`.
   * **EVM Key Derivation (BIP-44 `m/44'/60'/0'/0/0`):** Diturunkan menggunakan crate kriptografi `k256` (Secp256k1) dan `sha3` (Keccak256 EIP-55 Checksum).
   * **Solana Key Derivation (SLIP-0010 `m/44'/501'/0'/0`):** Diturunkan menggunakan HMAC-SHA512 SLIP-0010 standar Phantom/Ledger, `ed25519-dalek`, dan `bs58`.
   * Perintah IPC aktif: `vault_derive_credentials`, `vault_validate_mnemonic`.

3. **Frontend React Menjadi Thin IPC Bridge (Zero Secret Persistence):**
   * `src/lib/crypto.ts` dan `src/lib/wallet.ts` kini murni mendelegasikan seluruh eksekusi kriptografi ke perintah Rust native.
   * Kredensial rahasia diproses di dalam memori aman Rust (`SecureBuffer` dengan volatile RAM zeroize saat drop).

* **Hasil Uji Unit Resmi Rust (`cargo test --lib`):** Lulus 9 dari 9 pengujian (0 failed).

---

### 🛡️ Batasan Keamanan Kriptografi (*Security Boundaries*):

1. **Nol Rahasia di Webview Storage (*Zero Secrets in Storage*):**  
   Kunci privat dan seed phrase **DILARANG KERAS** disimpan di `localStorage`, `sessionStorage`, atau `IndexedDB` webview browser.  
   *(Klarifikasi Lingkup: `localStorage` hanya diizinkan untuk preferensi UI non-sensitif pengguna, seperti setelan durasi timer auto-lock atau tema antarmuka).*
2. **Pemusnahan Memori RAM (*RAM Memory Zeroize*):**  
   Setiap buffer memori yang memuat kredensial rahasia di Rust diisolasi dalam `SecureBuffer` dan langsung ditimpa angka nol (`std::ptr::write_volatile(0)`) seketika saat dibuang (*Drop*).
3. **Pembersihan Papan Klip Otomatis Level OS (*Windows OS Native Clipboard Auto-Clear 30s*):**  
   Menggunakan API kernel `user32.dll` (`EmptyClipboard`) di thread latar belakang Rust yang kebal dari status jendela tidak aktif (*unfocused window proof*).
4. **Pembersihan Basis Data Bersyarat (*Cryptographic Erasure & WAL/SHM Cleanup*):**  
   Operasi reset darurat (`Emergency Vault Purge`) mengeksekusi penghapusan berkas utama `.db` serta berkas jurnal transaksi `-wal` dan `-shm` secara terpadu.

---

## 📑 7. Lampiran Spesifikasi Rekayasa Institusional (Engineering Appendices)

---

### 📊 APPENDIX A: MATRIKS KLASIFIKASI DATA (DATA CLASSIFICATION MATRIX)

| Kelas Data | Cakupan Kredensial & Informasi | Lokasi Penyimpanan Resmi | Kebijakan Retensi & Pembersihan Memori |
| :--- | :--- | :--- | :--- |
| **Class A: Plaintext Secret Material** | Mnemonic Seed Phrase plaintext, Hex Private Key plaintext, Solana Base58 Secret plaintext, Kunci Sesi Penandatangan di RAM, Master Password Plaintext. | **Rust Secure RAM Only** (Struktur `SecureBuffer`). **Dilarang keras** dipersistensikan ke database SQLite atau webview storage. | Bersifat transien (*ephemeral*). Wajib dimusnahkan via pemusnahan biner (`Zeroize` volatile write) seketika setelah operasi derivasi atau penandatanganan transaksi selesai. |
| **Class B: Encrypted Secret-at-Rest & Sensitive Metadata** | Encrypted Secret Blobs (`PLX1` Argon2id + AES-256-GCM ciphertext), Label/Tag Kustom Dompet, Riwayat Saldo Transaksi, Konfigurasi Endpoint RPC Kustom, Webhook URL. *(Catatan Privasi: Jika endpoint RPC memuat credential provider atau API token seperti Alchemy/QuickNode/Helius, nilainya diperlakukan sebagai konfigurasi sensitif terenkripsi-at-rest dan disamarkan/masked di antarmuka UI)*. | **Encrypted SQLite Database Lokal** (`plurivex_vault.db` di direktori AppData lokal OS). | **Disimpan terenkripsi at-rest setiap saat**, dan hanya didekripsi sementara di memori Rust (`SecureBuffer`) saat otentikasi kata sandi master berhasil diverifikasi. Dihapus total saat prosedur *Emergency Vault Purge*. |
| **Class C: Non-Sensitive UI Preferences** | Preferensi Durasi Auto-Lock (Off/30s/1m/5m), Tema Tampilan (Dark/Light), Status Visibilitas Kolom Tabel Virtual, Preferensi Mata Uang (USD/IDR). | **LocalStorage / SQLite Settings Table**. | Preferensi pengguna non-sensitif. Dikelola bebas oleh frontend UI tanpa pernah memuat kunci privat, saldo sensitif, atau kata sandi brankas. |

---

### 🔌 APPENDIX B: KONTRAK PERINTAH IPC TAURI (FORMAL TAURI COMMAND CONTRACT)

> **🔒 Prinsip Kontrak Keamanan Perintah Sensitif (*Sensitive Command Boundary & Return Contract*):**  
> 1. **Non-Leaking Ingestion & Derivation:** Perintah `vault_derive_credentials` pada alur registrasi/impor standar hanya mengekstraksi alamat publik (`evmAddress`, `solAddress`) dan sidik jari untuk kebutuhan render antarmuka. Struktur `DerivedWalletPreview` pada kontrak ini hanya memuat data publik (evmAddress, solAddress, fingerprint) dan secara ketat diproteksi agar tidak pernah memuat atau mempersistensikan private key plaintext ke state jangka panjang atau media penyimpanan browser.  
> 2. **Gated Plaintext Reveal Command (`vault_decrypt`):** Pengembalian string plaintext rahasia **hanya diizinkan secara ketat** untuk fitur interaktif pengguna (*Reveal Secret*) di `WalletDetail.tsx`. Perintah ini wajib melewati gerbang keamanan: re-autentikasi Master Password, penutup visual otomatis 15 detik (*15s auto-masking*), dan pembersih papan klip Windows kernel 30 detik (*30s OS clipboard purge*). Perintah ini dilarang keras digunakan pada operasi batch.  
> 3. **Just-in-Time Batch Sweeper Execution (Fase 3):** Seluruh eksekusi transaksi massal memproses rahasia secara tertutup di dalam `SecureBuffer` Rust Core tanpa pernah mengembalikan plaintext kunci ke layer React/webview (frontend murni menerima `SessionHandle`, status antrean, dan bukti `TxHash`).

| Nama Perintah IPC | Parameter Input | Tipe Kembalian (Result) | Identifier Izin (Granular Capability) | Fungsi Domain |
| :--- | :--- | :--- | :--- | :--- |
| `rpc_get_balance` | `address: String, rpc: String` | `Result<String, String>` | `allow-rpc-get-balance` | Kueri saldo native EVM |
| `rpc_get_sol_balance` | `address: String, rpc: String` | `Result<String, String>` | `allow-rpc-get-balance` | Kueri saldo SOL native |
| `scan_balances` | `wallet_id: Option<i64>, wallet_ids: Option<Vec<i64>>` | `Result<ScanSummary, String>` | `allow-scan-balances` | Orkestrasi scanning paralel batch |
| `get_chain_fee_data` | `chain_key: String` | `Result<ChainFeeResponse, String>` | `allow-fee-estimate` | Estimasi gas & base fee EVM |
| `get_account_nonce_and_balance` | `address: String, rpc: String` | `Result<NonceBalanceResponse, String>` | `allow-fee-estimate` | Validasi nonce & saldo kirim |
| `get_solana_recent_blockhash` | `rpc: String` | `Result<String, String>` | `allow-fee-estimate` | Kueri blockhash terkini Solana |
| `get_solana_account_details` | `address: String` | `Result<SolanaAccountDetails, String>` | `allow-fee-estimate` | Audit tipe akun & rent reserve Solana |
| `broadcast_raw_tx` | `raw_tx_hex: String, rpc: String` | `Result<String, String>` | `allow-tx-broadcast` | Penyiaran transaksi EVM bertanda tangan |
| `broadcast_solana_tx` | `raw_tx_base64: String, rpc: String` | `Result<String, String>` | `allow-tx-broadcast` | Penyiaran transaksi Solana ke validator |
| `scan_directory_native` | `dir_path: String` | `Result<NativeScanResult, String>` | `allow-directory-scan` | Ekstraksi folder lokal rekursif |
| `schedule_clipboard_clear` | `timeout_secs: u64` | `Result<(), String>` | `allow-clipboard-clear` | Pembersihan OS clipboard Windows native |
| `window_minimize` | *(None)* | `Result<(), String>` | `allow-window-controls` | Kontrol jendela desktop (Minimize) |
| `window_toggle_maximize` | *(None)* | `Result<(), String>` | `allow-window-controls` | Kontrol jendela desktop (Maximize/Restore) |
| `window_close` | *(None)* | `Result<(), String>` | `allow-window-controls` | Kontrol jendela desktop (Close) |
| `vault_encrypt` | `plaintext: String, password: String` | `Result<String, String>` | `allow-vault-crypto` | Enkripsi brankas Argon2id + AES-256-GCM |
| `vault_decrypt` | `blob: String, password: String` | `Result<String, String>` | `allow-vault-crypto` | Dekripsi brankas (Argon2id & PBKDF2 fallback) |
| `vault_create_token` | `password: String` | `Result<String, String>` | `allow-vault-crypto` | Pembuatan token verifikasi kata sandi master |
| `vault_verify_token` | `token: String, password: String` | `Result<bool, String>` | `allow-vault-crypto` | Otentikasi kata sandi master brankas |
| `vault_derive_credentials` | `secret: String, wallet_type: String` | `Result<DerivedWalletPreview, String>` | `allow-vault-derivation` | Derivasi kredensial publik dual-chain EVM & Solana native |
| `vault_validate_mnemonic` | `phrase: String` | `Result<bool, String>` | `allow-vault-derivation` | Validasi kamus kata & checksum BIP-39 |
| `vault_unlock` | `password: String` | `Result<SessionHandle, String>` | `allow-vault-crypto` | Otentikasi & penerbitan handle sesi memori aman |
| `vault_lock` | *(None)* | `Result<(), String>` | `allow-vault-crypto` | Penguncian brankas & pemusnahan biner kunci di RAM |
| `vault_get_session_status` | *(None)* | `Result<SessionState, String>` | `allow-vault-crypto` | Kueri status sesi brankas (Locked / Unlocked) |

---

### ⚙️ APPENDIX C: MESIN STATUS ANTREAN EKSEKUSI (EXECUTION QUEUE STATE MACHINE)

Untuk menjamin kehandalan operasi transaksi massal (*batch execution*) multi-chain tanpa risiko saldo hilang atau tersangkut:

```text
┌─────────┐     Validasi Skema      ┌───────────┐   Simulasi eth_call / simulateTx   ┌───────────┐
│  Draft  │ ──────────────────────> │ Validated │ ─────────────────────────────────> │ Simulated │
└─────────┘                         └───────────┘                                    └───────────┘
                                                                                           │
                                            ┌──────────────────────────────────────────────┘
                                            ▼
                                ┌───────────────────────┐
                                │ Awaiting Password /   │ (Otorisasi Master Password di Execution Mode)
                                │ User Authorization    │
                                └───────────────────────┘
                                            │
                                            │ Konfirmasi Master Password
                                            ▼
                                ┌───────────────────────┐
                                │        Queued         │
                                └───────────────────────┘
                                            │
                                            │ Ambil Nonce, Fee & Just-in-Time Sign
                                            ▼
                                ┌───────────────────────┐
                                │     Broadcasting      │ (JIT Signing di Rust RAM & RPC Broadcast)
                                └───────────────────────┘
                                            │
                      ┌─────────────────────┼─────────────────────┐
                      │ Receipt Sukses      │ Lonjakan Gas/Nonce  │ Revert / RPC Reject
                      ▼                     ▼                     ▼
              ┌───────────────┐     ┌───────────────┐     ┌─────────────────────────────────────┐
               │   Confirmed   │     │   Retrying    │     │               Failed                │
               │  (Tx Sukses)  │     │  (Auto-Bump)  │     │ (Pre-Broadcast / Reverted / Expired)│
               └───────────────┘     └───────┬───────┘     └─────────────────────────────────────┘
                                             │
                                             └─────── (Auto Re-Sign & Bump Fee) ───────┐
                                                                                       │
                                                                                       ▼
                                                                           ┌───────────────────────┐
                                                                           │ Kembali ke Broadcast  │
                                                                           └───────────────────────┘
```

* **Draft:** Pengguna menyusun parameter transfer massal (alamat tujuan, token, batas gas).
* **Validated:** Input format alamat, desimal token, dan kuota saldo lolos pengecekan skema lokal multi-chain.
* **Simulated:** Transaksi lolos uji simulasi pra-eksekusi multi-chain (EVM `eth_call` & Solana `simulateTransaction`) tanpa revert dan kecukupan rent/gas terverifikasi.
* **Awaiting Authorization:** Sistem meminta konfirmasi Master Password di **Execution Mode** untuk membuka kunci penandatangan di memori aman Rust.
* **Queued:** Transaksi masuk ke antrean eksekusi (*FIFO*) sebagai *Transaction Intent* yang telah lolos otorisasi Master Password dan siap dieksekusi dengan jeda acak (*Anti-Sybil timing jitter*). Kunci belum ditandatangani di sini untuk mencegah nonce stale atau lonjakan base fee.
* **Broadcasting (Just-in-Time Signing & Broadcast):** Tepat sebelum disiarkan, eksekutor mengambil nonce dan fee terkini, merakit payload transaksi final, menandatanganinya secara *Just-in-Time* di dalam `SecureBuffer` Rust, menyiarkannya seketika ke node RPC blockchain / validator private relay, dan langsung me-zeroize memori RAM!
* **Confirmed:** Transaksi berhasil difinalisasi/terkonfirmasi pada blockchain target, dengan indikator sukses sesuai karakteristik rantai masing-masing (mis. receipt `status: 1` pada EVM atau `meta.err == null` pada Solana).
* **Retrying:** Terjadi benturan nonce atau lonjakan base fee mendadak (maksimal 3x percobaan dengan *exponential backoff* dan auto-bump fee).
* **Failed:** Transaksi gagal. Sistem mencatat diagnosa kegagalan secara komprehensif.
  * **Analisis Realistis Biaya Gas pada Status Failed:**
    1. *Gagal Sebelum Broadcast (Failed Pre-Broadcast):* Biaya gas = 0 (transaksi dibatalkan sebelum disiarkan).
    2. *Ditolak oleh Node RPC (Rejected by RPC Node):* Biaya gas = 0 (saldo tidak cukup atau format transaksi ditolak mempool sebelum masuk blok).
    3. *Gagal di On-Chain (Reverted On-Chain):* **Biaya gas tetap terpakai dan dibayarkan ke validator jaringan** sesuai unit gas komputasi kontrak yang terkonsumsi sebelum revert.
    4. *Tersangkut / Kadaluarsa (Dropped / Expired):* Biaya bergantung pada status transaksi pengganti (*speed-up* atau pembatalan nonce).

---

### 🛡️ APPENDIX D: MODEL ANCAMAN & ASUMSI KEAMANAN (THREAT MODEL & ASSUMPTIONS)

Dokumen ini mendefinisikan secara jujur batasan apa yang dilindungi oleh Plurivex dan apa yang berada di luar kendali rekayasa software:

#### 1. Yang Berhasil Dilindungi oleh Sistem (*In-Scope Protections*):
* **Pencurian Kunci via Clipboard:** Dicegah oleh pembersih otomatis 30 detik level kernel OS.
* **Pengintipan Layar (*Shoulder-Surfing*):** Dicegah oleh penutup kredensial otomatis 15 detik.
* **Akses Fisik Laptop yang Ditinggal Tanpa Izin:** Dicegah oleh pengunci idle otomatis (*Auto-Lock Timer*) yang menghapus kunci dari memori dan mengunci antarmuka.
* **Pencurian Berkas Basis Data Luring:** Dicegah oleh enkripsi simetris AES-256-GCM yang membutuhkan Master Password pengguna untuk didekripsi.
* **Scam Token & Phishing Dust:** Dicegah oleh filter pemindai nilai riil dan deteksi kontrak jahat.
* **Kegagalan Gas Saldo Konyol:** Dicegah oleh mesin simulasi pra-eksekusi (*Pre-Flight Dry-Run*).

#### 2. Batasan di Luar Kendali Sistem (*Out-of-Scope / Non-Guaranteed Boundaries*):
* **Host OS yang Terinfeksi Malware Aktif:** Jika komputer pengguna telah disusupi Trojan *Kernel-Level Keylogger* atau *Screen Recording Malware*, malware dapat merekam ketukan keyboard saat Master Password diketikkan.
* **Modifikasi Perangkat Keras Fisik (*Hardware Tampering*):** Serangan forensik ekstraksi RAM menggunakan pendingin cair (*Cold Boot Attack*) pada RAM fisik berada di luar batas mitigasi software desktop mana pun.
* **Kegagalan / Manipulasi Node RPC Publik:** Jika pengguna menghubungkan Plurivex ke node RPC palsu/jahat milik pihak ketiga, node tersebut dapat menyajikan data saldo palsu. Pengguna bertanggung jawab memilih RPC terpercaya.

---

> **Catatan Penyimpanan:** Berkas spesifikasi teknis master 60 fitur, roadmap bertahap, arsitektur backend domain, arsitektur frontend, dan 4 lampiran institusional ini tersimpan secara permanen di:  
> 📁 `docs/PLURIVEX_MASTER_FEATURE_SPEC.md`  
> Berkas ini berada dalam daftar `.gitignore` sehingga aman tersimpan secara konfidensial di komputer lokal Anda.


---

## 🏛️ 8. Kerangka Kerja Operasional & Disiplin Eksekusi (Operational Frameworks)

Sebagai bagian dari **Status Dokumen Freeze (Baseline Resmi)**, empat kerangka kerja operasional di bawah wajib dipatuhi oleh seluruh tim pengembang selama eksekusi implementasi:

---

### 📋 8.1 Definition of Done (DoD) per Fase Pengembangan

> *Catatan Lingkungan Pengujian: Seluruh target benchmark kinerja dievaluasi pada kondisi perangkat keras referensi (Reference Hardware: Intel Core i5/Ryzen 5, 16GB RAM, SSD NVMe) koneksi broadband standar, kondisi jaringan blockchain normal / non-congested, serta ketersediaan kuota standar node RPC).*

Setiap fitur pada roadmap dinyatakan **Selesai (Done)** hanya jika memenuhi kriteria gerbang mutu (*Quality Gates*) berikut:

| Fase Roadmap | Kriteria Keberimaan (*Acceptance Criteria*) | Target Kinerja (*Benchmark*) | Checklist Keamanan (*Security Gate*) | Kebijakan Rollback (*Rollback Criteria*) |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 1: Fondasi Kunci & Forensik** | Validasi Mnemonic lolos uji vektor BIP-39 resmi, scanning HD path index 0–20 akurat, generator dompet batch instan. | Pembuatan 1.000 dompet < 2,5 detik di Rust. | Kunci privat dilarang masuk ke webview storage. RAM wajib di-zeroize saat selesai. | Gagal parsing langsung fallback ke pesan error tanpa memutus sesi brankas. |
| **Fase 2: Infrastruktur & Anti-Scam** | Multi-RPC race engine memilih latensi terendah, simulasi dry-run mendeteksi revert sebelum broadcast. | Latensi switching RPC < 150ms. | Proteksi IP proksi dengan mitigasi kebocoran DNS (*DNS Leak Mitigation Required*). | Jika seluruh RPC timeout, transaksi ditahan di status `Validated` agar tidak dibroadcast sebelum simulasi jaringan lolos. |
| **Fase 3: Smart Contract & Sweeper** | Sweeping atomik multi-token EVM & Solana memotong fee 0.70% ke Treasury secara akurat. | Broadcast 100 transaksi < 30 detik. | Penandatanganan `Just-in-Time` di Rust `SecureBuffer`. Tidak ada kebocoran plaintext ke webview. | Revert on-chain memicu auto-pause antrean untuk mencegah pengurasan saldo gas konyol. |
| **Fase 4: Otomasi Airdrop & Anti-Sybil** | Jeda acak 5–60s aktif, taint graph memvalidasi tidak ada klasterisasi transfer antar-dompet lokal. | Render taint graph 1.000 nodes tetap 60 FPS. | Deteksi alamat deposit CEX meminimalisir risiko kontaminasi silang berdasarkan aturan deteksi lokal. | Peringatan resiko Sybil langsung memblokir eksekusi hingga konfirmasi manual user. |
| **Fase 5: Forensik Elit & Ekosistem** | Dekripsi keystore JSON mutasi kata sandi berhasil, arsip `.plurivex` terenkripsi ganda dapat dipulihkan di PC baru. | Dekripsi arsip < 5 detik. | Kata sandi arsip diverifikasi via Argon2id (bukan SHA-256 biasa). | Kerusakan berkas arsip menolak ekstraksi dan menjaga integritas database lokal eksisting. |

---

### 💳 8.2 Architecture Debt Register (Daftar Pelunasan Utang Teknis)

> *Catatan Tata Kelola Rekayasa: Entri dalam daftar utang arsitektur ini **tidak menggugurkan status "Complete & Live"** dari fitur produk yang bersangkutan. Status fitur mencerminkan kesiapan fungsi di aplikasi, sedangkan utang teknis merepresentasikan pemadatan rekayasa (engineering hardening), modularisasi, dan migrasi logika ke Rust native murni sebelum memasuki fase roadmap berikutnya.*

Daftar komponen transisi yang wajib dilunasi (*refactored*) dari wrapper TypeScript ke implementasi Rust murni:

| Kode Utang | Berkas Frontend Saat Ini | Komponen Target Final di Rust Core | Tenggat Pelunasan (*Deadline*) | Alasan Kritis (*Rationale*) |
| :---: | :--- | :--- | :---: | :--- |
| **DEBT-01** | `src/lib/sweeper.ts` (Perakitan Payload Tx) | `src-tauri/src/core/execution/sweeper.rs` | **Sebelum Memulai Fase 3** | Menjamin private key tidak pernah didekripsi di memori JavaScript saat batch sweep. |
| **DEBT-02** | `src/components/DexBatchTrader.tsx` | `src-tauri/src/core/execution/trader.rs` | **Sebelum Memulai Fase 3** | Menghilangkan ketergantungan library Web3 browser saat interaksi router Uniswap/Raydium. |
| **DEBT-03** | `src/lib/extract.ts` (Regex Parser Parsial) | `src-tauri/src/core/wallets/import.rs` | **Fase 1 (Selesai Penuh)** | Memindahkan pemindaian file teks/log 100% ke memori Rust untuk peningkatan performa signifikan di bawah reference benchmark. |
| **DEBT-04** | `src/lib/chains.ts` (RPC State) | `src-tauri/src/core/network/rpc_manager.rs` | **Fase 2** | Pengelolaan kredensial API key RPC dan failover otomatis wajib dikendalikan oleh backend Rust. |

---

### 🛡️ 8.3 Test & Security Gate Matrix (Matriks Gerbang Pengujian)

Sebelum kode baru di-*merge* ke branch `main`, seluruh gerbang berikut wajib bernilai hijau (*Passed*):

1. **Unit Test Coverage Mandate:**
   * Modul Kriptografi (`core/security/`): **Wajib 100% Unit Test Pass** (Argon2id, PBKDF2 compatibility, AES-GCM, Zeroize).
   * Modul Derivasi (`core/wallets/derivation.rs`): **Wajib Lulus Uji Vektor BIP-39 / BIP-44 Resmi** (Ethereum Foundation & Solana standard vectors).
2. **Capability Access Control List (ACL) Audit:**
   * Setiap perintah IPC baru di Rust wajib dideklarasikan secara spesifik pada berkas kapabilitas `src-tauri/permissions/*.toml`. Dilarang menggunakan izin *wildcard* (`*`).
3. **Memory Sanitization Verification:**
   * Seluruh alokasi RAM yang memegang kredensial rahasia wajib dibungkus dalam `SecureBuffer` dengan implementasi trait `Drop` yang mengeksekusi `std::ptr::write_volatile(0)`.
4. **CI/CD Build Cleanliness:**
   * `cargo check` dan `cargo test --lib` wajib menghasilkan **0 Errors dan 0 Warnings**.
   * `npm run build` wajib lulus uji tipe TypeScript (**0 Type Errors**).

---

### ⚖️ 8.4 Release Risk Register & Compliance Gate (Manajemen Risiko Rilis)

Protokol kepatuhan dan mitigasi risiko operasional sebelum distribusi versi publik:

| Kategori Risiko | Fitur yang Terdampak | Potensi Dampak / Bahaya | Protokol Mitigasi & Governance Gate |
| :--- | :--- | :--- | :--- |
| **Operasional & Privasi** | #42 Taint Graph, #43 CEX Deposit Guard, #50 Proxy Rotator | Klasterisasi alamat oleh analitik on-chain (Nansen/Chainalysis) menyebabkan diskualifikasi airdrop. | Kebijakan berbasis mode: Pada *Airdrop Sybil-Shield Mode*, sistem memblokir transfer ke alamat deposit CEX yang sama dari multi-dompet lokal. Pada *Standard Direct Consolidation Mode*, reuse alamat diizinkan dengan konfirmasi peringatan risiko eksplisit (*opt-in warning*). |
| **Keandalan Eksekusi** | #29 Batch Sweeper, #30 DEX Batch Trader, #31 Disperser | Revert massal menghabiskan modal gas pengguna tanpa hasil transaksi. | **Pre-Flight Dry-Run Mandatory:** Eksekusi dibatalkan otomatis jika simulasi `eth_call` / `simulateTransaction` gagal. |
| **Forensik & Etika Kunci** | #7 Smart Universal Parser & Recursive Directory Extractor, #14 Keystore Recovery | Penyalahgunaan alat untuk mengekstrak kredensial yang bukan milik pengguna sah. | Label tata kelola wajib: `[Authorized Use Only - User-Owned Assets]`. Log audit forensik hanya disimpan secara lokal di mesin pengguna. |
| **Penyimpanan Kunci Offline** | #15 Offline Air-Gap Signer, #16 Animated QR Coordinator | Kesalahan penandatanganan payload transaksi saat perangkat luring. | Standardisasi protokol BC-UR (Blockchain Commons Uniform Resources) untuk verifikasi visual hash sebelum transmisi QR. |
