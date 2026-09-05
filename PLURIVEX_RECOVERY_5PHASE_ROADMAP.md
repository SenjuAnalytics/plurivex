# 🚀 PLURIVEX: ADVANCED SEED PHRASE RECOVERY SPECIFICATION
## Master 5-Phase Technical Roadmap & Dominance Blueprint

> **Status:** Live & Tracking  
> **Target:** Surpassing BTCRecover (Python) and Coin98 Mobile Recovery  
> **Core Stack:** Rust (Tauri Backend) • React / TypeScript (Frontend) • SQLite (Encrypted Local Storage)  
> **Security Mandate:** 100% Client-Side Local Execution • Zero Telemetry • Zero Knowledge  

---

## 🧭 Executive Summary & Value Proposition

Sebagian besar alat pemulihan frasa pemulihan kripto (BIP-39 mnemonic recovery) saat ini memiliki kelemahan fundamental:
1. **BTCRecover**: Berbasis skrip terminal Python yang lambat (terhambat Python GIL), membutuhkan keahlian teknis terminal tinggi, tidak memiliki GUI interaktif, dan jika sesi terhenti harus diulang dari awal.
2. **Coin98 / Mobile Tools**: Terbatas pada daya komputasi perangkat ponsel, tidak mampu melakukan pencarian kombinasi masif (*heavy brute-forcing*), dan berisiko kebocoran privasi jika tersambung internet.

**Plurivex** memanfaatkan arsitektur tingkat rendah **Rust & Tauri** untuk menghadirkan pemulihan tercepat, tercerdas, dan teraman di industri dengan antarmuka grafis yang ramah pengguna.

---

## 🗺️ Master Progress Matrix (5 Phases)

| Phase | Modul & Kemampuan Teknis | Status | Target Keunggulan |
| :---: | :--- | :---: | :--- |
| **1** | **🛡️ Zero-Knowledge UI & Air-Gapped Safe Mode** | `[x] COMPLETED` | Jaminan keamanan offline 100% lokal & reputasi privasi. |
| **2** | **⚡ Multi-Core Rayon & SIMD Parallelism (2-Word Solver)** | `[x] COMPLETED` | Kecepatan brute-force jutaan kombinasi mengalahkan Python 10x-50x. |
| **3** | **🧠 Smart Fault-Tolerance: Permutasi & 9 Kamus Bahasa** | `[x] COMPLETED` | Memulihkan seed dengan kata tertukar & seed non-Inggris. |
| **4** | **🛡️ 100% In-Memory Execution Engine (Zero-Disk Shield)** | `[x] COMPLETED` | Sesi pencarian murni di RAM (Atomics & Mutex) dengan jaminan privasi forensik zero-disk. |
| **5** | **🌐 Real-Time On-The-Fly Balance Scan (Jackpot Alert)** | `[x] COMPLETED` | Scan saldo langsung di RAM tanpa mengotori database dengan dompet kosong. |

---

## 📋 Detail Spesifikasi Tiap Fase & Checklist Implementasi

---

### FASE 1: 🛡️ Zero-Knowledge UI & Air-Gapped Safe Mode (Pondasi Kepercayaan)
**Tujuan:** Memberikan ketenangan psikologis mutlak bagi pengguna dengan bukti visual bahwa tidak ada data frasa atau kunci privat yang dapat bocor ke internet.

- [x] **1.1 Global Air-Gapped Toggle Bar (UI)**:
  - Tombol saklar di header: `[ 🛡️ Safe Mode / 🌐 Online ]`.
  - Indikator status visual (hijau zamrud berkilau dengan efek denyut/pulse saat aktif, kuning peringatan saat online).
- [x] **1.2 Rust Network Interceptor (Backend)**:
  - Atomic flag `AIR_GAPPED_MODE` di Rust backend memblokir 100% panggilan RPC, estimasi fee, dan scan balance saat Safe Mode aktif.
  - Perintah Tauri `set_air_gapped_mode` dan `get_air_gapped_mode` sinkron dengan AppContext frontend.
- [x] **1.3 Zero-Knowledge Mnemonic Repair Banner**:
  - Banner edukatif & penjaminan privasi di bagian atas Mnemonic Repair Tool: 100% kalkulasi BIP-39 SHA-256 Checksum berjalan murni di RAM lokal tanpa telemetri atau jaringan outbound.

---

### FASE 2: ⚡ Kecepatan Ekstrim: Multi-Core Rayon & 2-Word Solver
**Tujuan:** Melompati batas komputasi Python single-thread dengan memproses jutaan kombinasi kata hilang dalam hitungan detik.

- [x] **2.1 Single-Word Missing Solver (11 / 23 Words)**:
  - *Status: SUDAH SELESAI (2.048 iterasi dalam <1ms dengan bitwise SHA-256).*
- [x] **2.2 Rayon Parallel Iteration Engine**:
  - Diintegrasikan `rayon = "1.10"` di `src-tauri/Cargo.toml` dan `repair.rs`.
  - Membagi beban komputasi kombinasi ke seluruh logical core CPU (8–16 threads) via `par_iter()`.
- [x] **2.3 Dual-Word Missing Solver (10 Words / 2 Words Missing)**:
  - $2.048 \times 2.048 = 4.194.304$ kombinasi pasangan kata diuji secara paralel.
  - Selesai dalam hitungan detik di RAM murni, otomatis mendeteksi kata yang hilang dan mencocokkan target address instan.
- [x] **2.4 Ultra-Fast Bitwise Zero-Allocation BIP-39 Validator**:
  - Fungsi `fast_pack_12_entropy` dan `fast_validate_12_words` mengevaluasi SHA-256 dalam ~15ns tanpa string allocation.
- [x] **2.5 Rayon Metrics Banner & Dynamic Word Highlighting (UI)**:
  - Banner metrik performa amber keemasan: `Diuji 4.194.304 kombinasi pasangan kata · Ditemukan X frasa checksum valid`.
  - Penyorotan multi-kata dinamis pada kartu solusi: `[Slot #11 & #12]`.

---

### FASE 3: 🧠 Smart Fault-Tolerance: Permutasi & Multi-Language Suite
**Tujuan:** Memulihkan catatan seed phrase yang rusak susunannya atau ditulis dalam bahasa asing.

- [x] **3.1 Fuzzy Levenshtein Distance Typo Detector**:
  - *Status: SUDAH SELESAI (Sugesti 5 kata terdekat otomatis saat typo terdeteksi).*
- [x] **3.2 Transposition Unscrambler (Kata Tertukar / Swapped Words)**:
  - Otomatis mendeteksi jika ada pasangan kata bersebelahan (adjacent) maupun sembarang (arbitrary) dari 66 pasangan yang posisinya tertukar saat dicatat di kertas.
  - Menampilkan banner pintar: `🔁 Kata Tertukar Terdeteksi: Menukar Slot #X dengan Slot #Y memulihkan validitas BIP-39 Checksum!`.
  - Tombol aksi instan: `[Terapkan Penukaran Ini]`.
- [x] **3.3 Dukungan 10 Kamus Resmi BIP-39 (Multi-Language)**:
  - English, Spanish (Spanyol), French (Prancis), Italian (Italia), Portuguese (Portugis), Czech (Ceko), Japanese (Jepang), Korean (Korea), Chinese Traditional & Simplified.
  - Auto-Language Detection: Sistem otomatis mengenali bahasa dari kata-kata yang diinputkan pengguna dan menyesuaikan kamus pemulihan secara dinamis.
  - Lencana visual bahasa pada header: `[ 🌐 SPANISH ]`, `[ 🌐 JAPANESE ]`, dll.

---

### FASE 4: 🛡️ Sesi Pemulihan Murni 100% In-Memory (Zero-Disk Forensic Shield)
**Tujuan:** Menjamin privasi forensik absolut dengan meniadakan penulisan data frasa sensitif ke disk/SQLite, sekaligus membuka performa komputasi maksimal Rayon multi-threading tanpa hambatan I/O harddisk.

- [x] **4.1 Zero-Disk Forensic Architecture (RAM-Only Execution)**:
  - Persistensi SQLite untuk recovery session sepenuhnya ditiadakan dan ditransisikan ke *atomic variables* (`AtomicUsize`, `AtomicBool`) dan *RAM mutex cache* di backend Rust.
  - Tidak ada 1 byte pun data frasa mentah atau checkpoint yang ditulis ke sektor harddisk. Jika aplikasi ditutup, jejak data sensitif di RAM langsung musnah tanpa jejak forensik.
- [x] **4.2 Siklus Hidup Sesi Real-Time di Memori (In-Memory Lifecycle)**:
  - Rust backend mengendalikan status sesi secara instan di RAM: `start_recovery_session`, `pause_recovery_session`, `resume_recovery_session`, `cancel_recovery_session`, dan `get_recovery_session_status`.
- [x] **4.3 UI Kontrol Sesi & Live Progress Tracker**:
  - Progress bar persentase real-time gradien, indikator kecepatan (*combinations/detik*), hitung mundur sisa waktu (*ETA*), dan lencana status **`Zero-Disk RAM Shield`**.
  - Tombol aksi: **`⏸ Jeda (Pause)`**, **`▶ Lanjutkan (Resume)`**, dan **`✕ Batalkan`**.

---

### FASE 5: 🌐 Real-Time On-The-Fly Balance Scan (Jackpot Alert)
**Tujuan:** Menguji saldo langsung dari memori tanpa harus mengotori database lokal dengan ratusan ribu dompet kosong bernilai $0.

- [x] **5.1 Tri-Chain Native Derivation (BTC, EVM, Solana)**:
  - *Status: SUDAH SELESAI (Derivasi serentak ke Bitcoin Bech32/Legacy, EVM 0x, dan Solana).*
- [x] **5.2 Multi-Chain Scanner via Vault Import**:
  - *Status: SUDAH SELESAI (Scanner batch Mempool, Blockstream, EVM RPC, dan Solana RPC).*
- [x] **5.3 In-Memory Filter (On-The-Fly Auto-Scan)**:
  - Kandidat kombinasi valid diuji saldonya secara on-the-fly di RAM via `scan_phrase_on_the_fly`.
  - Jika saldo = $0: Data langsung dibuang dari memori (RAM), database Vault tetap bersih dari dompet sampah kosong.
- [x] **5.4 Jackpot Guardrail & Audio-Visual Notification**:
  - Jika terdeteksi saldo $\ge \$0.01$: Antrean scan otomatis dijeda (*paused*) dan synthesizer Web Audio API memainkan melodi kemenangan harmonik `playSuccessChime()`.
  - Menampilkan modal perayaan `FundedWalletModal` interaktif yang diproteksi **Interactive Guardrail** untuk mencegah *silent auto-import* yang tidak diinginkan.
  - Pengguna diberikan kendali penuh dengan 4 pilihan tindakan: **`🔐 Simpan ke Vault`**, **`⚡ Simpan & Sweep`**, **`📋 Salin Saja (Tanpa Simpan)`**, atau **`Abaikan`** sebelum data ditulis ke basis data SQLite lokal.

---

## 🛠️ Rekam Jejak Modul yang Sudah Berhasil Diselesaikan (Foundation)

1. **BTC Native SegWit (BIP-84 `bc1q...`), Legacy (BIP-44 `1...`), & WIF Generator**.
2. **Forensic Target Address Matcher** (Pencocokan instan otomatis jika alamat publik diketahui).
3. **Smart Mnemonic Repair & Single-Word Solver** (Default `🌐 Semua Posisi` dengan 1.536 kombinasi teruji).
4. **Hardware-Accelerated Virtual List** (Precomputed strings, 1-span rendering, zero scroll lag pada 60-120 FPS).
5. **Clean 2-Row Stacked Card Layout** (Desain kartu modern dengan tombol ringkas `Apply`).
6. **Encrypted Vault Storage** (SQLite terenkripsi dengan AES-256-GCM).

---

*Dokumen ini akan terus diperbarui seiring berjalannya eksekusi tiap fase.*
