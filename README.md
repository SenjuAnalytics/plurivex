# 🛡️ Plurivex (Inspector Wallet)

> **The Ultimate Multi-Chain Desktop Security Vault, Forensic Seed Phrase Recovery Suite, and Batch Execution Console.**  
> *Built with Rust (Tauri v2 Core) • React 19 • TypeScript • Vite • Rayon Parallel Computing • SQLite Local Encrypted Vault*

---

## 🧭 Gambaran Umum Proyek

**Plurivex** adalah aplikasi desktop *high-performance* non-kustodial berbasis **Rust (Tauri v2 Core) + React 19 + TypeScript** yang dirancang untuk inspeksi, manajemen, dan pemulihan forensik dompet kripto dengan standar privasi tertinggi: **100% Client-Side Local Execution, Zero-Cloud Telemetry, dan Zero-Disk Forensics**.

Aplikasi ini menggabungkan manajemen identitas kunci multi-chain (EVM, Solana, dan Bitcoin), mesin pemulihan frasa pemulihan (*seed phrase recovery*) berkecepatan tinggi dengan Rayon multi-threading, pemindaian saldo multi-jaringan secara real-time, serta konsolidasi saldo (*batch sweeper*) dalam satu antarmuka desktop yang terpadu.

---

## ⚡ Fitur Unggulan (Core Capabilities)

### 1. 🔐 Derivasi Kunci Kriptografi Multi-Chain
- **EVM (BIP-44 `m/44'/60'/0'/0/0`)**: Mendukung Ethereum, BNB Chain (BSC), Base, Arbitrum, Polygon, dan jaringan kompatibel EVM lainnya.
- **Solana (SLIP-0010 `m/44'/501'/0'/0'`)**: Derivasi Ed25519 native lengkap dengan deteksi token SPL dan audit akun program Solana.
- **Bitcoin (Tri-Address Format)**:
  - **Native SegWit (BIP-84 `m/84'/0'/0'/0/0`)**: Format Bech32 (`bc1q...`) dengan fee transaksi paling efisien.
  - **Legacy (BIP-44 `m/44'/0'/0'/0/0`)**: Format Base58Check (`1...`) untuk kompatibilitas dompet lama.
  - **WIF (Wallet Import Format)**: Kunci privat terkompresi Base58 untuk import cepat ke cold wallet.

### 2. 🧠 Mesin Pemulihan Frasa Forensik (Zero-Disk RAM Shield)
- **100% In-Memory (Zero-Disk Privacy)**: Seluruh operasi pencarian kombinasi kata berjalan murni di memori RAM melalui *atomic flags* dan *mutex* di Rust backend. Tidak ada satu byte pun data seed phrase mentah yang ditulis ke harddisk, mencegah kebocoran forensik melalui swap/temporary files.
- **Single-Word Solver**: Menyelesaikan 1 kata hilang (11 kata menjadi 12 kata) dalam < 1 milidetik (2.048 kombinasi teruji).
- **Dual-Word Solver**: Menguji $2.048 \times 2.048 = 4.194.304$ kemungkinan pasangan kata dalam **1–3 detik** menggunakan paralelisasi multi-core CPU (Rayon). Mampu menguji seluruh 66 kemungkinan kombinasi posisi slot (~276 juta frasa) dalam waktu singkat.
- **10 Kamus Resmi BIP-39**: Mendukung Bahasa Inggris, Spanyol, Prancis, Italia, Portugis, Ceko, Jepang, Korea, Mandarin Tradisional, dan Mandarin Sederhana dengan *Auto-Language Detection*.
- **Transposition Unscrambler**: Mendeteksi dan memulihkan kata-kata yang posisinya tertukar (*swapped adjacent or arbitrary words*) secara otomatis.
- **Forensic Target Address Matcher**: Menemukan seed phrase yang tepat secara instan jika pengguna menyertakan alamat publik tujuan (EVM, Solana, atau Bitcoin).
- **Live On-The-Fly Balance Scanner & Jackpot Guardrail**: Memeriksa saldo on-chain langsung di RAM selama pencarian berlangsung tanpa mengotori database dengan dompet kosong. Menyajikan *Jackpot Celebration Chime* (Web Audio API) saat dompet bersaldo ditemukan, dilengkapi **Interactive Confirmation Guardrail** untuk mencegah *silent auto-import*—pengguna dapat memilih *"Simpan ke Vault"*, *"Simpan & Sweep"*, atau *"Salin Saja"* sebelum data ditulis ke database lokal.
- **Kontrol Sesi Real-Time**: Kontrol penuh untuk **Start**, **Pause**, **Resume**, dan **Cancel** sesi pemulihan dengan *ETA countdown* dan indikator kecepatan *combinations/second*.

### 3. 🛡️ Keamanan & Privasi Tingkat Tinggi
- **Enkripsi Brankas Modern**: Menggunakan algoritma **Argon2id (PLX1) + AES-256-GCM** dengan salt unik 16-byte dan nonce 12-byte, serta kompatibilitas mundur (*backward compatibility*) otomatis dengan format PBKDF2 lama.
- **Otentikasi Ganda**: Mendukung Master Password utama dan 6-Digit Quick PIN untuk kenyamanan navigasi harian.
- **Air-Gapped Safe Mode**: Saklar hardware-level di Rust yang secara instan memblokir seluruh koneksi RPC dan jaringan keluar saat memeriksa frasa sensitif.
- **Native OS Clipboard Auto-Clear**: Timer native Windows level User32 yang menghapus clipboard secara otomatis setelah 30 detik, bahkan jika jendela aplikasi diminimalkan atau tidak fokus.
- **Memori Aman (*Zeroize*)**: Buffer sensitif dibersihkan (*securely zeroed*) dari RAM setelah selesai digunakan.

### 4. 📊 Pemindai Saldo Multi-Chain & Realtime Valuation
- **Pemindaian Saldo Paralel**: Multi-threaded Tokio RPC untuk jaringan EVM, Solana, dan Bitcoin.
- **Deteksi Token Sekunder**: Deteksi otomatis token ERC-20 & BEP-20 (USDT, USDC, DAI, WBTC, LINK, UNI, CAKE, dll.) dan token SPL Solana (USDC, USDT, BONK, JUP, RAY, WIF, dll.).
- **Real-Time Multi-Currency Valuation**: Agregasi harga pasar multi-aset dengan dukungan 13 mata uang fiat/kripto (USD, IDR, EUR, GBP, JPY, CAD, AUD, CHF, SGD, CNY, INR, KRW, BRL), dilengkapi penanganan fallback terpusat dan indikator status visual `● Offline` yang bersih saat data berstatus *stale*.
- **Presisi Pembacaan Bitcoin**: Parser saldo native Bitcoin yang akurat membedah respons RPC Mempool dan Blockstream.

### 5. ⚡ Batch Sweeper & Smart File Extractor
- **Batch Sweeper**: Mengonsolidasikan saldo dari banyak dompet ke satu alamat penampung dengan estimasi gas EIP-1559 otomatis dan penandatanganan transaksi secara lokal (*offline signing*).
- **Smart Universal File Extractor**: Memindai folder komputer secara native di Rust untuk mengekstrak dan mengenali private key dan seed phrase dari file dump atau teks log yang berantakan.

---

## 🏗️ Arsitektur Proyek

```
inspectorwallet/
├── src/                                  # Frontend React 19 + TypeScript + Vite
│   ├── components/                       # Komponen Antarmuka Pengguna
│   │   ├── repair-workspace/             # Mnemonic Forensic Repair Workspace
│   │   │   ├── components/               # Sub-komponen (Left, Center, Right, SessionTracker)
│   │   │   ├── hooks/                    # useMnemonicAnalysis, useOnTheFlyScan
│   │   │   └── types.ts                  # Tipe data sesi dan analisis
│   │   ├── sidebar/                      # Navigasi & daftar dompet tervirtualisasi
│   │   ├── AuthScreens.tsx               # Layar kunci PIN & Master Password
│   │   ├── MainApp.tsx                   # Shell utama & router tampilan
│   │   ├── SweeperWorkspace.tsx          # Konsol batch sweep transaksi
│   │   ├── DexBatchTrader.tsx            # Antarmuka multi-wallet swap DEX
│   │   └── FundedWalletModal.tsx         # Modal perayaan Jackpot saldo ditemukan
│   ├── context/                          # State Management Global (AppContext)
│   │   └── hooks/                        # useAuthVault, useWalletScanner, useWalletFilters
│   ├── lib/                              # Utilitas kriptografi & klien blockchain
│   │   ├── crypto.ts                     # WebCrypto & wrapper native vault
│   │   ├── wallet.ts                     # Derivasi kredensial (EVM, Solana, BTC)
│   │   ├── chains.ts                     # Konfigurasi RPC, provider & token list
│   │   ├── sweeper.ts                    # Logika penandatanganan & siar transaksi
│   │   └── db.ts                         # Akses basis data SQLite lokal
│   └── styles/                           # Arsitektur CSS Modular
│
├── src-tauri/                            # Backend Native Rust (Tauri v2)
│   ├── src/
│   │   ├── adapters/                     # Adapter Jaringan Blockchain & Oracle
│   │   │   ├── evm/                      # [Live] Klien RPC EVM & definisi token ERC-20
│   │   │   ├── solana/                   # [Live] Klien RPC Solana & metadata SPL token
│   │   │   ├── pricing/                  # [Live] Oracle agregator harga pasar (CoinGecko provider)
│   │   │   ├── bridge/                   # [Roadmap Stub] Cross-chain bridge adapter
│   │   │   └── explorers/                # [Roadmap Stub] Explorer URL router hub
│   │   ├── app/                          # IPC Application Layer
│   │   │   ├── commands.rs               # [Live] Handler perintah Tauri IPC & Air-Gapped flag
│   │   │   └── state.rs                  # [Roadmap Stub] Application runtime state
│   │   ├── core/                         # Domain Logika Inti
│   │   │   ├── scanner/                  # [Live] Multi-threaded concurrent balance scanner
│   │   │   │   ├── bitcoin.rs            # [Live] Bitcoin Mempool / Blockstream scanner & amount parser
│   │   │   │   ├── evm.rs                # [Live] EVM concurrent scanner
│   │   │   │   ├── solana.rs             # [Live] Solana balance scanner
│   │   │   │   └── pricing.rs            # [Live] Pricing feed service & baseline fallback
│   │   │   ├── security/                 # [Live] Argon2id, PBKDF2, AES-GCM, & memory zeroize
│   │   │   ├── vault/                    # [Live] Manajemen direktori & repository SQLite
│   │   │   │   ├── repository.rs         # [Live] SQLite repository & vault path
│   │   │   │   ├── models.rs             # [Roadmap Stub] Vault domain models
│   │   │   │   └── service.rs            # [Roadmap Stub] Vault high-level service
│   │   │   ├── wallets/                  # [Live] Kriptografi dompet & pemulihan seed
│   │   │   │   ├── derivation.rs         # [Live] Derivasi EVM, Solana, & Bitcoin Native SegWit
│   │   │   │   ├── extractor.rs          # [Live] Parser log & pengekstraksi kredensial
│   │   │   │   ├── fingerprint.rs        # [Roadmap Stub] Hardware fingerprinting
│   │   │   │   ├── import.rs             # [Live] Pemindai folder native ultra-cepat
│   │   │   │   ├── recovery_session.rs   # [Live] In-Memory Recovery Engine (Atomics & RAM cache)
│   │   │   │   └── repair/               # [Live] Modul Rayon Multi-Core Mnemonic Repair
│   │   │   │       ├── fast_checksum.rs  # [Live] Bit-level validator 15ns per kata
│   │   │   │       ├── single_missing.rs # [Live] 1-word missing solver
│   │   │   │       ├── dual_missing.rs   # [Live] 2-word missing Rayon parallel solver
│   │   │   │       ├── target_match.rs   # [Live] Forensic target address matcher
│   │   │   │       └── typos.rs          # [Live] Levenshtein distance & 10 kamus BIP-39
│   │   │   ├── execution/                # [Roadmap Stub] Transaction queue & dry-run simulation
│   │   │   ├── network/                  # [Roadmap Stub] Proxy rotator & RPC latency hedging
│   │   │   ├── notifications/            # [Roadmap Stub] Webhook alerts (Discord/Slack)
│   │   │   └── archive/                  # [Roadmap Stub] Portable encrypted .plurix archive
│   │   ├── db/                           # Migrasi basis data SQLite
│   │   │   ├── migrations.rs             # [Live] Skema migrasi SQLite lokal
│   │   │   └── schema.rs                 # [Live] Konstanta nama tabel
│   │   ├── utils/                        # [Roadmap Stub] Error handling & time utilities
│   │   └── lib.rs                        # Titik masuk runtime aplikasi Tauri
│   ├── permissions/                      # Kontrol akses kapabilitas IPC (ACL)
│   ├── tauri.conf.json                   # Konfigurasi Tauri v2 & metadata jendela
│   └── Cargo.toml                        # Dependensi Rust & optimasi build
│
└── docs/                                 # Dokumentasi Spesifikasi & Rekayasa
    ├── PLURIVEX_MASTER_FEATURE_SPEC.md   # Master spesifikasi 60 fitur ("The Diamond 60")
    ├── PLURIVEX_IMPLEMENTATION_MATRIX.md # Matriks implementasi modul 1:1
    ├── MODULARIZATION_AND_REFACTORING_PLAN.md # Cetak biru modularisasi & status eksekusi
    ├── PLURIVEX_FINAL_APPROVAL_NOTE.md   # Risalah tata kelola & persetujuan baseline
    └── SMART_CONTRACT_PLAN.md            # Spesifikasi smart contract multi-chain on-chain
```

---

## 🚀 Panduan Menjalankan & Membangun

### Prasyarat:
- **Node.js** v18+ & **npm**
- **Rust** v1.75+ (instal melalui [rustup.rs](https://rustup.rs/))
- **Visual Studio C++ Build Tools** (pada Windows)

### 1. Mode Pengembangan (Hot-Reload):
```bash
# Instal dependensi JavaScript
npm install

# Jalankan dalam mode pengembangan desktop
npm run tauri dev
```

### 2. Menjalankan Pengujian Unit Test Rust:
```bash
cd src-tauri
cargo test --lib
```
*Memverifikasi 30 unit test kriptografi, derivasi Bitcoin/EVM/Solana, pricing engine fallback, Bitcoin amount parser, memory zeroize, dan in-memory recovery lifecycle.*

### 3. Membangun Paket Distribusi (.exe / Installer):
```bash
npm run tauri build
```
Hasil installer biner (`.msi` dan `.exe`) akan tersimpan di:
`src-tauri/target/release/bundle/`

---

## 🔒 Jaminan Keamanan & Panduan Pengguna

1. **Kerahasiaan Kata Sandi**: Kata sandi Master Password Anda digunakan secara langsung untuk menurunkan kunci enkripsi Argon2id. Jangan pernah membagikan file database lokal `wallet_inspector.db`.
2. **Zero-Disk Privasi Sesi Pemulihan**: Mesin pemulihan frasa bekerja 100% di memori RAM. Jika komputer dimatikan atau aplikasi ditutup, data frasa yang belum disimpan ke vault akan otomatis musnah dari memori tanpa meninggalkan jejak di harddisk.
3. **Air-Gapped Mode**: Saat memasukkan frasa pemulihan bernilai tinggi, aktifkan tombol **`🛡️ Safe Mode`** pada header bilah atas untuk memutus seluruh akses jaringan ke RPC blockchain.
4. **Perangkat Tepercaya**: Selalu jalankan aplikasi pada komputer pribadi yang bebas dari malware dan keylogger.