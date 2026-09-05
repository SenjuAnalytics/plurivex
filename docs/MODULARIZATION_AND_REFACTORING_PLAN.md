# PLURIVEX ARSITEKTUR & MODULARISASI CODEBASE
**Status Dokumen:** Master Refactoring Blueprint (100% SUDAH DIEKSEKUSI & LIVE)  
**Lokasi Dokumen:** `docs/MODULARIZATION_AND_REFACTORING_PLAN.md`  
**Prinsip Utama:** *Clean Code, Zero Duplication, High Performance Native Rust, Modular Components, Full-Page Workspace UX.*

> **Status Eksekusi:** Seluruh 4 Fase Modularisasi (Pilar A, B, C, D) telah sukses diimplementasikan dan diverifikasi:
> - ✅ **Pilar A (Frontend):** `MnemonicRepairModal.tsx` telah ditransformasikan menjadi `src/components/repair-workspace/` dengan arsitektur modular (Left, Center, Right, SessionTracker, hooks terisolasi).
> - ✅ **Pilar B (Backend Rust):** `repair.rs` (1.005 baris) telah dipecah menjadi folder modular `src-tauri/src/core/wallets/repair/` (`types.rs`, `fast_checksum.rs`, `typos.rs`, `single_missing.rs`, `dual_missing.rs`, `target_match.rs`, `mod.rs`).
> - ✅ **Pilar C (CSS):** CSS modular dipecah rapi ke `src/styles/repair/` dan `src/styles/theme/`.
> - ✅ **Pilar D (Rust Logic):** Ekstraksi kredensial native dipindahkan ke `core/wallets/extractor.rs` dan recovery session murni in-memory di `core/wallets/recovery_session.rs`.
> - ✅ **Hasil Verifikasi:** 24 dari 24 unit test Rust Lulus 100% (`cargo test --lib`), 0 error kompilasi (`cargo check`), dan 0 error build TypeScript (`npm run build`).

---

## 📑 DAFTAR ISI
1. [Ringkasan Eksekutif & Latar Belakang](#1-ringkasan-eksekutif--latar-belakang)
2. [Audit File Membengkak (> 500 Baris)](#2-audit-file-membengkak--500-baris)
3. [Audit Logika: Fungsi yang Harus Dipindah dari React ke Rust](#3-audit-logika-fungsi-yang-harus-dipindah-dari-react-ke-rust)
4. [Transformasi UX: Dari Modal Pop-up Menjadi Halaman Penuh (Full-Page Workspace)](#4-transformasi-ux-dari-modal-pop-up-menjadi-halaman-penuh-full-page-workspace)
5. [Rencana Modularisasi Rinci (Pilar A, B, C, D)](#5-rencana-modularisasi-rinci-pilar-a-b-c-d)
6. [Struktur Folder & Penamaan File Baru](#6-struktur-folder--penamaan-file-baru)
7. [Urutan & Roadmap Pengerjaan Bertahap](#7-urutan--roadmap-pengerjaan-bertahap)

---

## 1. Ringkasan Eksekutif & Latar Belakang

Aplikasi Plurivex telah berkembang pesat dengan fitur-fitur mutakhir:
- Engine pemulihan frasa BIP-39 dengan Rayon Multi-Core.
- On-The-Fly RAM Balance Scanner & Jackpot Hunter.
- Multi-chain batch transaction sweeper.
- Penyimpanan lokal terenkripsi dengan SQLite & Argon2id.

Namun, pertumbuhan fitur yang cepat menyebabkan beberapa file mengalami **pembengkakan ekstrem (*bloated files*)** hingga ribuan baris, percampuran tanggung jawab (*Single Responsibility Principle violation*), serta **duplikasi logika kriptografi berat di JavaScript/React** yang sebenarnya sudah ada atau jauh lebih cepat jika dijalankan di Rust.

Dokumen ini dibuat agar proses refactoring dan modularisasi berjalan **teratur, aman, terukur, dan tanpa ada bug regresi**.

---

## 2. Audit File Membengkak (> 500 Baris)

| No | File Saat Ini | Baris | Tipe | Masalah Utama |
|---|---|:---:|---|---|
| **1** | `src/styles/global.css` | **2.694** | CSS | Semua style modal, grid, tombol, sweeper, dan sidebar menumpuk di 1 file raksasa. |
| **2** | `src/components/MnemonicRepairModal.tsx` | **1.550** | React | *God Component*. Berisi logika modal, triptych layout, Levenshtein di JS, wordlist set, loop scanner saldo, dan state session. |
| **3** | `src-tauri/src/core/wallets/repair.rs` | **1.005** | Rust | Monolitik. Struct types, entropy packing, typo suggestion, 11-word scan, 10-word Rayon scan, dan target address matcher bercampur. |
| **4** | `src/context/AppContext.tsx` | **974** | React | State vault, auth password, database wrapper, scan orchestrator, dan filter bercampur aduk. |
| **5** | `src/components/Sidebar.tsx` | **770** | React | Virtual scrolling, rate conversion, wallet row, dan checkbox logic dalam 1 file. |
| **6** | `src/lib/extract.ts` | **665** | TS/Regex | Tokenizer dan parser regex 500.000 karakter di thread utama JavaScript browser. |
| **7** | `src/components/WalletDetail.tsx` | **664** | React | Detail kunci, QR code, balance list, dan transfer action bertumpuk. |
| **8** | `src/components/ImportPanel.tsx` | **559** | React | Drag-drop, file reading, paste parsing, dan visual confirmation. |
| **9** | `src-tauri/src/core/wallets/recovery_session.rs` | **504** | Rust | Worker SQLite checkpointing dan session state machine. |

---

## 3. Audit Logika: Fungsi yang Harus Dipindah dari React ke Rust

Saat ini ada beban komputasi dan kriptografi yang salah tempat (dijalankan di React padahal Rust sudah siap):

### A. Ekstraksi Teks / Log Parser (`src/lib/extract.ts` ➔ Rust)
- **Masalah:** Saat mengimpor teks log dump besar (ratusan kilobyte), JavaScript menjalankan regex `tokenizeWords` dan `extractSeedsFromTokens` di UI thread browser. UI sering patah-patah (*freeze*).
- **Solusi:** Buat Tauri command `extract_credentials_from_text(raw_text: String) -> ExtractedBatch` di Rust.
  - Rust menggunakan zero-copy string slicing dan multi-threading.
  - Proses yang tadinya 800ms di JS menjadi **< 10ms di Rust**.

### B. Eliminasi Duplikasi Levenshtein & BIP-39 Set di React (`MnemonicRepairModal.tsx` ➔ Gunakan Rust Penuh)
- **Masalah:** React memiliki fungsi `fastLevenshtein()` dan memuat `wordlists.en` ke memori browser untuk memberikan suggestion kata typo. Padahal Rust (`repair.rs`) sudah memiliki fungsi `levenshtein_distance()` dan BIP-39 wordlist native.
- **Solusi:** Hapus seluruh logika Levenshtein dan dictionary set dari React. React cukup menerima array `suggestions: string[]` yang sudah dihitung oleh Rust.

### C. Derivasi Kunci Kriptografi Solana (`src/lib/solana.ts` ➔ Rust)
- **Masalah:** Frontend mengimpor `@solana/web3.js`, `@noble/ed25519`, dan `ed25519-hd-key` untuk derivasi Solana.
- **Fakta:** Rust (`derivation.rs`) sudah memiliki fungsi `slip10_derive_ed25519` native dengan hardware acceleration.
- **Solusi:** Hapus dependensi crypto Solana di JS. Gunakan 100% Rust `derive_dual_credentials_native`. Memori browser lebih aman, bundle JS berkurang ratusan KB.

### D. Pemindaian Saldo On-The-Fly Stream (`handleStartOnTheFlyScan` ➔ Rust Batch Stream)
- **Masalah:** React menjalankan loop `for (let i = 0; i < total; i++)` dan memanggil Tauri IPC `scan_phrase_on_the_fly` satu per satu ratusan kali.
- **Solusi:** Buat Rust command `scan_phrases_stream(phrases: Vec<String>)` yang menyisir saldo secara paralel di Rust dan mengirim event progres via Tauri Channel / Event.

---

## 4. Transformasi UX: Dari Modal Pop-up Menjadi Halaman Penuh (Full-Page Workspace)

### Mengapa Perlu Berubah Menjadi Halaman Penuh?
1. **Ruang Layar Maksimal (Triptych 3 Panel):**
   - Modal saat ini dibatasi oleh backdrop dialog, membuat teks panjang dan kartu pasangan terasa sempit.
   - Dengan menjadi Halaman Penuh (`Recovery Workspace`), 3 panel (Panel Solusi, Panel Editor Frase, Panel Kandidat) dapat tampil simetris dan lega di layar monitor.
2. **Navigasi Tab Sederhana di Header:**
   Di `MainApp.tsx`, kita tambahkan tab view sejajar dengan Sweeper:
   ```text
   [ 🛡️ Vault Command Center ]  [ ⚡ Typo Repair Workspace ]  [ 🧹 Sweeper Workspace ]
   ```
3. **Bebas Masalah Backdrop:**
   Tidak ada risiko modal tertutup tidak sengaja saat pengguna menggeser scrollbar atau mengeklik di luar batas dialog.
4. **Alur Kerja Persisten:**
   Pengguna bisa berpindah melihat saldo di Vault, lalu kembali lagi ke Typo Repair Workspace tanpa kehilangan status pencarian terakhir.

---

## 5. Rencana Modularisasi Rinci (Pilar A, B, C, D)

### 🏛️ PILAR A: Modularisasi Frontend Typo Repair Workspace
Memecah `MnemonicRepairModal.tsx` (1.550 baris) menjadi modul-modul terfokus di `src/components/repair-workspace/`:

1. **`RepairWorkspace.tsx` (~180 baris):**
   Container utama halaman, layout header, navigasi kembali, dan orchestrator triptych.
2. **`components/LeftSolutionsPanel.tsx` (~160 baris):**
   Panel kiri: Daftar frasa solusi checksum valid, tombol Copy All, Apply All, dan trigger Jackpot Scan.
3. **`components/CenterEditorPanel.tsx` (~200 baris):**
   Panel tengah: Input raw phrase, Target Address box, bilah pemilih posisi slot (#1 s/d #12), dan kartu grid kata.
4. **`components/RightCandidatesPanel.tsx` (~180 baris):**
   Panel kanan: Input pencarian kata, cloud tombol kata kandidat, dan kartu pasangan terpadu (*Unified Pair Cards*).
5. **`components/RayonMetricsBar.tsx` (~100 baris):**
   Kartu metrik Rayon multi-core, progress bar kombinasi, kecepatan CPU, dan estimasi waktu.
6. **`hooks/useMnemonicAnalysis.ts` (~120 baris):**
   Custom hook untuk debounce input, pemanggilan IPC `analyze_and_repair_mnemonic`, dan caching hasil.
7. **`hooks/useOnTheFlyScan.ts` (~110 baris):**
   Custom hook untuk pemindaian saldo RAM lokal, kalkulasi USD, dan sound alert.

---

### 🦀 PILAR B: Modularisasi Rust Backend `repair.rs`
Memecah `src-tauri/src/core/wallets/repair.rs` (1.005 baris) menjadi folder modul `src-tauri/src/core/wallets/repair/`:

1. **`mod.rs` (~150 baris):**
   Fungsi utama `analyze_and_repair_mnemonic()` yang mengoordinasikan sub-modul.
2. **`types.rs` (~90 baris):**
   Semua definisi struct data: `WordAnalysis`, `TargetAddressMatch`, `MnemonicRepairResult`, dll.
3. **`fast_checksum.rs` (~110 baris):**
   Fungsi bitwise packing ultra-cepat `fast_pack_12_entropy()` dan `fast_validate_12_words()`.
4. **`typos.rs` (~130 baris):**
   `levenshtein_distance()`, deteksi bahasa BIP-39 multi-bahasa, dan saran kata typo.
5. **`single_missing.rs` (~180 baris):**
   Penyisiran 11 kata (1 kata hilang di 12 posisi slot) dengan Rayon paralel.
6. **`dual_missing.rs` (~220 baris):**
   Penyisiran 10 kata (66 kemungkinan pasangan posisi) dan Target Address matcher.

---

### 🎨 PILAR C: Pemecahan CSS Global Menjadi CSS Terkelola
Memecah `src/styles/global.css` (2.694 baris) menjadi file-file modular di `src/styles/`:

1. **`global.css` (~400 baris):**
   Token warna CSS variables (`:root`), font typography, CSS reset, dan utility classes.
2. **`layout.css` (~250 baris):**
   Header aplikasi, window controls, mesh background, dan container utama.
3. **`sidebar.css` (~350 baris):**
   Sidebar wallet list, virtual scrolling rows, filter chips, dan status badge.
4. **`wallet-detail.css` (~400 baris):**
   Panel detail wallet, balance card multi-chain, copy key buttons, dan QR viewer.
5. **`repair-workspace.css` (~550 baris):**
   Layout triptych 3 panel, chip kartu kata, baris selector slot, dan candidate pair cards.
6. **`sweeper.css` (~350 baris):**
   Gaya batch transaction sweeper, gas estimation, dan broadcast monitor.

---

### ⚡ PILAR D: Migrasi Logika Berat ke Native Rust
1. **Logika Ekstraksi Teks:**
   Pindahkan tokenizer dan regex parser dari `src/lib/extract.ts` ke modul Rust `src-tauri/src/core/wallets/extractor.rs`.
2. **Derivasi Universal:**
   Arahkan semua pembuatan wallet (EVM, Solana, BTC) ke satu fungsi Rust terpadu `derive_dual_credentials_native`.

---

## 6. Struktur Folder & Penamaan File Baru

```
inspectorwallet/
├── docs/
│   └── MODULARIZATION_AND_REFACTORING_PLAN.md  <-- Dokumen ini
├── src/
│   ├── components/
│   │   ├── MainApp.tsx                          (Mengatur navigasi detail/sweeper/repair)
│   │   ├── repair-workspace/                   (DEDICATED FULL-PAGE WORKSPACE)
│   │   │   ├── RepairWorkspace.tsx
│   │   │   ├── components/
│   │   │   │   ├── LeftSolutionsPanel.tsx
│   │   │   │   ├── CenterEditorPanel.tsx
│   │   │   │   ├── RightCandidatesPanel.tsx
│   │   │   │   └── RayonMetricsBar.tsx
│   │   │   └── hooks/
│   │   │       ├── useMnemonicAnalysis.ts
│   │   │       └── useOnTheFlyScan.ts
│   │   ├── sidebar/                            (Sidebar modular)
│   │   └── sweeper/                            (Sweeper modular)
│   └── styles/
│       ├── global.css                          (Tokens & Reset)
│       ├── layout.css                          (App shell)
│       ├── sidebar.css
│       ├── wallet-detail.css
│       ├── repair-workspace.css                (Triptych workspace styling)
│       └── sweeper.css
└── src-tauri/src/core/wallets/
    ├── derivation.rs
    ├── extractor.rs                            (Baru: Fast text regex extractor)
    ├── recovery_session.rs
    └── repair/                                 (Modul Rust Modular)
        ├── mod.rs
        ├── types.rs
        ├── fast_checksum.rs
        ├── typos.rs
        ├── single_missing.rs
        └── dual_missing.rs
```

---

## 7. Urutan & Roadmap Pengerjaan Bertahap

Untuk menjaga stabilitas aplikasi dan mencegah regresi, pekerjaan akan dijalankan dalam **4 fase berurutan**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 1: Modularisasi Rust Backend (repair.rs ➔ repair/ sub-modul)      │
│ Target: Memecah file Rust tanpa mengubah API interface.                │
│ Verifikasi: 23/23 cargo tests harus lulus 100%.                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 2: Pemisahan CSS (global.css ➔ modular style sheets)              │
│ Target: Memisahkan repair-workspace.css dan sidebar.css.               │
│ Verifikasi: npm run build lulus, tampilan visual tidak berubah.        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 3: Transformasi Halaman Penuh & Modularisasi Frontend UI          │
│ Target: MnemonicRepairModal.tsx ➔ repair-workspace/ (Full Page View).   │
│ Navigasi di MainApp.tsx: mainView "repair".                            │
│ Verifikasi: Triptych 3 panel bekerja lebih lega dan responsif.         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 4: Migrasi Logika Ekstraksi Teks ke Rust (extract.ts ➔ Rust)      │
│ Target: Menghapus regex berat dan Levenshtein duplikat di React.       │
│ Verifikasi: Impor file log besar berjalan instan tanpa lag di UI.      │
└────────────────────────────────────────────────────────────────────────┘
```

---
*Dokumen ini adalah acuan resmi tim pengembangan Plurivex. Setiap langkah implementasi wajib mengacu pada spesifikasi dan urutan di atas.*
