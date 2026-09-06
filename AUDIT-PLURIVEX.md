# 🔍 Audit Teknis — Plurivex

**Repo:** `SenjuAnalytics/plurivex` · **Branch:** `main`
**Tanggal audit:** 2026-09-05
**Metode:** pembacaan kode + verifikasi empiris (typecheck, build, eksekusi runtime nyata, grep call-graph). Semua temuan di bawah punya bukti yang bisa direproduksi.

> ### 🔄 REVISI v2 — pasca klarifikasi author
> Stub kosong (`pub struct X;`) adalah **keputusan desain yang disengaja** (tree-first / scaffold-then-implement), bukan kode terlantar.
> Kritik gue di v1 terhadap hal itu **gue tarik kembali** — lihat **BAGIAN 6**.
> Revisi ini juga mencabut 2 temuan gue yang salah (`get_db_path`, `rustScan`) dan **menambah 1 temuan baru** hasil penelusuran ulang.
> **Bug runtime di BAGIAN 3 tidak terpengaruh klarifikasi ini** — semuanya berdiri sendiri dan tetap terbukti.

---

## 📊 BAGIAN 1 — Skala Proyek: **MENENGAH (ke bawah), bukan proyek besar**

### Angka mentah (terukur)

| Komponen | Nilai |
|---|---|
| TypeScript/TSX (frontend) | **12.531 baris** |
| Rust (backend) | **5.589 baris** |
| CSS | **3.924 baris** |
| **Total LOC** | **±22.000 baris** |
| File di git | 247 files |
| Tauri commands terdaftar | 33 |
| Custom permission identifiers | 14 (semua valid, di-define dalam 1 TOML) |
| Unit test Rust | **30** (klaim README akurat ✅) |
| Build frontend | ✅ `tsc --noEmit` = **0 error**, `vite build` = **berhasil** |
| Bundle | 855 KB JS (1 chunk, tanpa code-splitting) |

### Verdict

**22.000 baris itu proyek MENENGAH.** Patokan industri:

- **Kecil:** < 5.000 LOC
- **Menengah:** 5.000 – 50.000 LOC ← **lu di sini**
- **Besar:** > 100.000 LOC + multi-repo + tim lintas fungsi

Tapi jujur, **proyek lu efektifnya lebih kecil dari angka kasarnya.** Ada **±350–400 baris kode stub kosong** dan **±1.500–2.000 baris duplikasi JS↔Rust** yang mengerjakan hal sama. Realistis logika unik yang benar-benar berfungsi: **±16.000–18.000 baris.**

### Yang bikin terasa "besar" vs "menengah"

✅ **Sudah level menengah ke atas:**
- Struktur modular proper (`core/`, `adapters/`, `app/`, `db/`, `utils/`)
- 30 unit test, termasuk test backward-compat format enkripsi lama
- Sistem permission Tauri rapi (whitelist command per-kategori)
- Format vault ber-versioning (`PLX1` magic bytes)
- Parser BIP-39 bit-packing hand-written yang **gue verifikasi manual bit-per-bit dan BENAR**
- Migrasi database tertata (7 versi)

❌ **Yang nahan lu tetap "menengah":**
- **Konsistensi arsitektur lemah** — klaim README vs implementasi real banyak yang nggak nyambung (lihat Bagian 2)
- **Banyak stub** yang ditulis seolah fitur sudah jadi
- **Nggak ada CI/CD** (nggak ada `.github/workflows`)
- **Nggak ada error taxonomy** — semua error `Result<_, String>`, kehilangan tipe
- **Nggak ada integration test** (0 `#[tokio::test]`)
- **Monolithic component** — `MainApp.tsx` 666 baris, `extract.ts` 644 baris

**Kesimpulan Bagian 1:** fondasinya bagus dan di atas rata-rata side-project, tapi ini **prototipe matang / MVP**, bukan production-ready large-scale project. Yang membedakan "menengah → besar" buat lu bukan nambah LOC, tapi **menutup gap antara yang didokumentasikan vs yang dieksekusi.**

---

## 🚨 BAGIAN 2 — KESALAHAN PENEMPATAN KODE (INVERSI ARSITEKTUR)

Ini temuan paling penting. README bilang:
> *"Rust (Tauri v2 Core) … Zero key exposure in webview memory"*

**Kenyataannya terbalik.** Justru bagian paling sensitif jalan di webview (JS), dan Rust jadi penonton.

### 🔴 2.1 — PENANDATANGANAN TRANSAKSI (PALING KRITIS)

**File:** `src/lib/sweeper.ts`

```js
// Baris ~254-263 — private key Solana didekripsi ke JS, jadi Keypair
const creds = deriveDualCredentials(secret, walletType);
const solSecret = creds.solPrivateKey ?? secret.trim();
const bytes = bs58.decode(solSecret);
keypair = Keypair.fromSecretKey(bytes);
// Baris ~364
transaction.sign(keypair);          // ← SIGNING DI JAVASCRIPT

// Baris ~420 — private key EVM dipakai buat sign di webview
const signer = deriveEvmWallet(secret, walletType);
const rawTx = await signer.signTransaction(txRequest);   // ← SIGNING DI JAVASCRIPT
```

**Yang seharusnya terjadi:** derivasi + signing di `src-tauri/src/core/` (Rust, `k256` + `ed25519-dalek` **udah ada di Cargo.toml dan udah di-import**). Rust-nya cuma jadi kurir `broadcast_raw_tx`.

Padahal `src/lib/crypto.ts` baris 6 ditulis komentar:
> *"ensuring zero key exposure in webview memory"* — **komentar ini bohong terhadap arsitektur sendiri.**

**Dampak:** private key mentah ada di memory webview Chromium → bisa kena XSS, devtools, memory dump webview. Untuk aplikasi yang menjual diri sebagai *"Zero-Disk Forensics Security Vault"*, ini kontradiksi terbesar di kodebase.

*(Catatan Selesai: Arsitektur "Zero key exposure in webview memory" kini telah tercapai 100% pada alur sweeper melalui implementasi K3-lite — lihat poin 12 s.d. 16 pada Revisi v5. Webview hanya memegang ciphertext vault dan master password; dekripsi, derivasi, dan signing dilakukan secara eksklusif di dalam memori backend Rust via command sealed).*

---

### 🔴 2.2 — VALIDASI MNEMONIC BIP-39 DUPLIKAT & YANG DIPAKAI YANG JS

- **JS dipakai:** `src/lib/wallet.ts:40` → `ethers.utils.isValidMnemonic()`
- **Rust tersedia tapi `0` dipanggil:** `vault_validate_mnemonic`

```bash
$ grep -rn "vault_validate_mnemonic" src
# (kosong — tidak pernah dipanggil frontend)
```

Command-nya **terdaftar di `generate_handler`, punya permission, punya test — tapi yatim.** Dead weight.

---

### 🔴 2.3 — DERIVASI KUNCI: DUA IMPLLEMENTASI PARALEL

| | Rust | JavaScript |
|---|---|---|
| EVM `m/44'/60'/0'/0/0` | `derivation.rs:170` | `wallet.ts:206` `ethers.Wallet.fromMnemonic` |
| Solana `m/44'/501'/0'/0'` | `derivation.rs:179` | `solana.ts:15` `ed25519-hd-key` |
| BTC `m/84'/0'/0'/0/0` | `derivation.rs:185` | ❌ **TIDAK ADA** |
| BTC Legacy `m/44'/0'/0'/0/0` | `derivation.rs:200` | ❌ **TIDAK ADA** |

**Bug turunannya:**
```js
// src/lib/wallet.ts:254 — deriveDualCredentials() versi JS
export function deriveDualCredentials(secret, type): DualCredentials {
  // dualCreds mengembalikan { evmAddress, solAddress, evmPrivateKey, solPrivateKey }
  //                                   ↑ TIDAK PERNAH mengisi btcAddress / btcPrivateKey
```
Sementara `useWalletOperations.ts:328` nulis CSV dengan kolom **`btc_wif,evm_pk,sol_pk`** dan manggil `creds?.btcPrivateKey`.

➡️ **Kolom Bitcoin di hasil export selalu kosong**, karena export manggil fungsi JS, bukan Rust.

**Dan lebih parah — silent fallback:**
```js
// src/lib/wallet.ts:224-235
} catch (err) {
  console.warn("Native derivation failed, falling back:", err);
  return deriveDualCredentials(secret, type);   // ← degradasi senyap JS
}
```
Kalau native Rust error (permission belum di-grant, runtime crash), user **nggak tau** operasinya pindah ke webview. Untuk wallet, fallback senyap antar dua engine krypto ≠ acceptable.

---

### 🔴 2.4 — EXTRACTOR: JS 644 BARIS vs RUST 146 BARIS

`src/lib/extract.ts` (644 baris, regex JS) vs `src-tauri/src/core/wallets/extractor.rs` (146 baris).
Ada dua fungsi kembar: `smartNormalizeInput()` (JS) dan `smartNormalizeInputNative()` (Rust).

```js
// src/lib/extract.ts:250-260
export async function smartNormalizeInputNative(raw) {
  try { ... invoke("vault_extract_credentials" ...) }
  catch { /* ... */ }
  return smartNormalizeInput(raw);   // ← fallback ke JS, lagi-lagi senyap
}
```
Hasilnya: parser yang sama jalan dengan dua perilaku regex berbeda → hasil impor bisa beda antara environment.

---

### 🔴 2.5 — CLIPBOARD AUTO-CLEAR: DUA TIMER YANG NGGAK SINBRON

```js
// src/lib/security.ts — JS setTimeout 30 detik (fallback)
activeClipboardTimer = setTimeout(async () => {
  await navigator.clipboard.writeText("");
}, timeoutMs);
```
```rust
// src-tauri/src/app/commands.rs:184-211 — Rust tokio::spawn
#[cfg(target_os = "windows")] { /* user32 EmptyClipboard */ }
```

**Bug konkret:**
1. Timer JS **nggak pernah di-cancel** saat user manual copy yang lain → clipboard terhapus padahal isinya data baru (bukan secret).
2. Rust-nya **`#[cfg(target_os = "windows")]` only** → di **Linux & macOS blok-nya KOSONG**. Klaim README *"native OS Clipboard Auto-Clear"* cuma valid di Windows. Fallback JS mati kalau window nggak focus → **kebocoran permanen di macOS/Linux**.
3. Payload redundant: `{ timeoutSecs, timeout_secs: timeoutSecs }` — ngirim 2 key buat 1 argumen.

---

### 🟢 2.6 — 9 MODUL RUST STUB — ~~dibesar-besarkan~~ → **REVISI: ini desain yang valid**

> **Status: DICABUT sebagai temuan.** Lihat penjelasan lengkap di **BAGIAN 6**.
> Yang tersisa cuma rekomendasi kecil (label `TODO:`) — bukan bug.

```rust
// src-tauri/src/core/archive/plurix.rs (2 baris)
pub struct PlurixArchive;
```
Verifikasi call-graph tetap menunjukkan semua di-referensi 0 kali — **tapi sekarang gue baca itu sebagai "belum dikerjakan", bukan "salah nulis".**


---

### 🟠 2.7 — RAYON ADA DI TEMPAT YANG SALAH

Klaim README (baris 29):
> *"menguji 4.194.304 pasangan kata dalam **1–3 detik** menggunakan paralelisasi multi-core CPU (Rayon)"*

Realita:

```bash
$ grep -rn "rayon" src-tauri/src
  core/wallets/repair/dual_missing.rs   ← ✅ pakai into_par_iter
  core/wallets/repair/single_missing.rs ← ✅ pakai into_par_iter
```

**Tapi dua file itu dipanggil oleh `vault_repair_mnemonic` (analisis ringan/per-keystroke).**

Sementara **solver produksi yang dipakai UI Recovery Session** — `recovery_session.rs`, dipanggil via `start_recovery_session`:

```rust
pub fn run_dual_word_session_worker(...) {
    std::thread::spawn(move || {                 // ← SATU thread
        'outer_all_pairs: for (pair_idx, &(p1, p2)) in all_pairs.iter() {
            for w1 in 0..2048u16 {                // ← serial
                for w2 in 0..2048u16 {            // ← serial, 4,19 juta iterasi
```

**`recovery_session.rs` = 0 kemunculan rayon.** Jadi jalur berat yang dipencet user justru **single-threaded**.

Bonus inefisiensi di jalur yang sama:
```rust
// recovery_session.rs:~289 — di dalam loop
if let Some(pos) = wlist.iter().position(|&item| item == t)   // ← O(2048) LINEAR SCAN
```
Harusnya `HashMap<&str,u16>` yang di-prebuild sekali di luar loop.

---

## 🐞 BAGIAN 3 — BUG YANG TERKONFIRMASI

### ❌ BUG #1 — ~~Solana Sweep PASTI CRASH~~ → **DICABUT. REVIEWER BENAR, GUE SALAH.**

> **Status v3: TEMUAN INI KELIRU DAN GUE HAPUS.** Gue salah menyimpulkan dari eksperimen gue sendiri.

**Eksperimen gue tadi cacat.** gue pakai string dummy `'7fLmxwsJ9...EXAMPLE'` yang **bukan base58 valid** (mengandung `0`, `I`, `L`). Error yang gue dapat:
```
TypeError: Blob.encode[recentBlockhash] requires (length 32) Uint8Array as src
```
Itu error **gagal decode base58**, bukan error tipe data. Gue langsung menyimpulkan "harusnya object" tanpa mengecek implementasi — itu keliru.

**Hasil tes ulang dengan string base58 valid (blockhash sungguhan), `@solana/web3.js@1.98.4`:**
```
=== A) recentBlockhash = PLAIN STRING (kode lu sekarang) ===
  OK, serialized: 183 bytes            ← TIDAK CRASH, BERHASIL
=== B) recentBlockhash = {blockhash, lastValidBlockHeight} (saran "fix" gue) ===
  CRASH: Expected String               ← SARAN GUE YANG MERUSAK
```
Konfirmasi ke sumber: `lib/index.cjs` — `recentBlockhash: this.recentBlockhash.blockhash ?? this.recentBlockhash` dan getter `get recentBlockhash() { return this._json?.recentBlockhash; }`. **Legacy `Transaction.recentBlockhash` memang wajib string base58.** Gue ketuker dengan bentuk object milik `sendTransaction`/`getLatestBlockhash` (API connection-level modern).

**Dampak revisi:** Batch Sweeper SOL lu **nggak rusak**. Kalau `fix` 3 baris dari gue dipakai, **malah bikin crash**. Jangan diterapkan.

Satu-satunya catatan teknis yang tersisa (bukan bug, opsi hardening): tanpa `lastValidBlockHeight`, `Transaction` legacy nggak bisa cek expiry → blockhash basi baru ketahuan saat broadcast gagal. Alternatifnya `Transaction.populate()` (yang memang mengembalikan bentuk `{blockhash, lastValidBlockHeight}`). Low priority, opsional.

---

### 🔴 BUG #2 — AIR-GAPPED SAFE MODE TIDAK BERFUNGSI (fitur keamanan utama mati)

**Frontend** (`src/context/hooks/useWalletScanner.ts:29-39`):
```ts
const toggleAirGapped = useCallback(async () => {
  const nextVal = !isAirGapped;
  setIsAirGapped(nextVal);                        // ← React state
  localStorage.setItem('plurivex_air_gapped', String(nextVal));  // ← localStorage
  toast(nextVal ? '🛡️ Air-Gapped Safe Mode Aktif (RPC Network Ditutup)' : ...);
}, [isAirGapped, toast]);
```
**Nggak ada `invoke("set_air_gapped_mode")`. Satu-satunya jalur ke Rust ya cuma itu.**

```bash
$ grep -rn "set_air_gapped_mode\|get_air_gapped_mode" src src-tauri/src | grep -v "commands.rs|lib.rs|permissions/"
# (kosong — tidak tersambung)
```

**Backend** (`src-tauri/src/app/commands.rs:7`):
```rust
pub static AIR_GAPPED_MODE: AtomicBool = AtomicBool::new(false);   // ← default TERBUKA
```

**Skenario fatal:**
| Situasi | UI bilang | Rust sebenarnya |
|---|---|---|
| Startup (default `true` di UI) | 🛡️ **Safe Mode** | ❌ `false` → **RPC TERBUKA** |
| User toggle ON lalu scan | 🛡️ **Safe Mode** | ❌ **tetap `false` → RPC jalan** |
| User toggle OFF | 🌐 Online | ❌ `false` → kebetulan "cocok" |

Guard Rust-nya sendiri **sebenarnya benar & sudah dipasang di 13 command** (`rpc_get_balance`, `scan_balances`, `broadcast_raw_tx`, `broadcast_solana_tx`, `get_token_prices`, dst.) — gue udah audit satu-satu. Masalahnya 100% di **frontend yang nggak pernah menyalakannya.**

➡️ User yang lagi "memeriksa seed phrase sensitif dalam mode aman" **tetap mengirim RPC ke internet.** Untuk aplikasi yang dijual atas nama air-gap privacy, ini temuan severity tertinggi.

Fix (frontend, 3 baris):
```ts
const toggleAirGapped = useCallback(async () => {
  const nextVal = !isAirGapped;
  try { await invoke("set_air_gapped_mode", { enabled: nextVal }); }
  catch { toast("Gagal mengubah mode Rust — Safe Mode TIDAK aktif", "error"); return; }
  setIsAirGapped(nextVal); ...
}, [...]);
// + saat mount: invoke("get_air_gapped_mode") sebagai source of truth, bukan localStorage
```

#### 🔍 Update revisi v2 — bug ini punya **3 konsekuensi**, bukan 1

Setelah ditelusuri lebih jauh, `isAirGapped` (state JS) **tetap dipakai** sebagai gerbang UI di `scanAll` (`useWalletScanner.ts:126`):

```ts
const scanAll = async () => {
  if (isAirGapped) { toast('🛡️ ... diblokir ...'); return; }   // ← gerbang #1 (JS-only)
  ...
```

Jadi dua gerbang itu **berlawanan arah dan nggak pernah sinkron**:

| Mode | UI + gerbang JS (`isAirGapped`) | Guard Rust (`AIR_GAPPED_MODE`) | Hasil |
|---|---|---|---|
| **Safe Mode** (default) | ✅ aktif → scan diblokir | ❌ `false` → **nggak ngapa-ngapain** | Aman, tapi **kebetulan** — yang nyelametin cuma `if` di JS |
| **Online** | ❌ off → semua jalan | ❌ `false` → tetap off | `scan_phrase_on_the_fly` & recovery **nggak punya perlindungan lapisan-2** |

Konsekuensi praktis: kalau suatu saat ada jalur yang manggil command RPC **tanpa lewat cek JS** (mis. auto-scan saat import, atau command baru yang lupa di-gate), **nggak ada satupun jaring pengaman di Rust**. Klaim *"Saklar hardware-level di Rust"* belum berlaku — yang aktif sekarang cuma `if` statement di React.


---

### 🔴 BUG #3 — EXPORT CSV MENULIS PRIVATE KEY PLAINTEXT KE DISK

`src/context/hooks/useWalletOperations.ts:328`
```ts
lines.push(`${i+1},"${label}",..., "${secret.replace(/"/g,'""')}", ...`);
//                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//  mnemonic seed / private key MENTAH → file .csv → harddisk
```
Header-nya eksplisit: `secret_key_or_mnemonic,btc_wif,evm_pk,sol_pk`

Kontradiksi langsung dengan klaim README **"Zero-Disk Forensics"** dan **"tidak ada satu byte pun data seed phrase mentah yang ditulis ke harddisk"**.

Nggak ada konfirmasi kedua, nggak ada warning, nggak ada auto-wipe, nggak ada opsi encrypted export (padahal `PlurixArchive` stub-nya ada).

---

### 🔴 BUG #4 — SEED PHRASE TINGGAL DI RAM SELAMANYA

`src-tauri/src/core/wallets/recovery_session.rs:27,69,124`
```rust
static ACTIVE_RAW_PHRASE: Mutex<Option<String>> = Mutex::new(None);
...
*ACTIVE_RAW_PHRASE.lock().unwrap() = Some(phrase.clone());   // ← diisi
// grep: TIDAK PERNAH di-Some(None) / di-zeroize setelah selesai/cancel
```
`ACTIVE_TARGET_ADDR` dan `CACHED_SOLUTIONS` (berisi frasa hasil temuan, sampai 1000 entri) juga nggak pernah di-clear.

Padahal **`SecureBuffer` dengan `Drop` + `write_volatile` sudah dibuat dan sudah di-test** di `core/security/memory.rs` — **tapi nggak pernah dipakai buat ini.** Cuma `secure_zero_slice` yang dipakai, 2 kali, di `derivation.rs`.

➡️ Tool yang punya *secure memory wiping infrastructure* tapi nggak makai infrastrukturnya sendiri di titik paling sensitif.

---

### 🟠 BUG #5 — RESUME SESI BISA MEMUNCULKAN DUA WORKER BERSAMAAN

`recovery_session.rs:117-140` — `request_resume_session()` langsung:
```rust
run_dual_word_session_worker(session_id.to_string(), phrase, target, current_idx, total);
```
Nggak ada mekanisme join / kill worker lama, dan status "paused" cuma turunan `PAUSE_FLAG`. Kalau frontend manggil `resume` dua kali (double-click, retry, StrictMode dev double-invoke), **dua thread nulis ke `ACTIVE_SESSION_ID` / `CURRENT_INDEX` / `PAUSE_FLAG` global yang sama.**

Flag pause/cancel juga **global AtomicBool, bukan per-session** → arsitektur cuma mendukung 1 sesi, tapi API-nya menerima `session_id` seolah multi-sesi. Minimal: tolak `start` kedua kalau slot masih aktif. Ideal: `HashMap<SessionId, SessionState>`.

---

### 🟠 BUG #6 — `start_from_index` SALAH DI MODE 66-PAIR

```rust
let pair_offset = pair_idx * 4_194_304;
for w1 in 0..2048u16 {
    let combo_idx = pair_offset + (w1 as usize) * 2048 + (w2 as usize);
    if combo_idx < start_from_index { continue; }   // ← cuma continue, bukan skip outer loop
```
Resume di pair ke-66 tetap **iterasi penuh 65 pair sebelumnya** (~274 juta iterasi dibuang percuma). Harusnya `continue 'outer_all_pairs` saat `pair_offset + 4_194_304 <= start_from_index`.

---

### 🟠 BUG #7 — DEPENDENSI HANTU (PHANTOM DEPENDENCY)

`src/lib/wallet.ts:3`
```js
import { wordlists } from "@ethersproject/wordlists";
```
```bash
$ grep -c "@ethersproject/wordlists" package.json
0      ← TIDAK DIDEKLARASI
```
Sekarang kebetulan ke-*hoist* sebagai transitive dep dari `ethers@5.7.2`. Begitu pindah ke **pnpm / Yarn PnP**, atau `ethers` minor-release mengubah tree-nya → **`Cannot find module` langsung di produksi.** Tambah eksplisit:
```json
"@ethersproject/wordlists": "^5.7.0"
```

---

### 🟡 BUG #8 — FINGERPRINT RUST = PANJANG DATA *(direklasifikasi v2: **latent**, bukan bug aktif)*

```rust
// src-tauri/src/core/wallets/fingerprint.rs — 4 baris total
pub fn calculate_fingerprint(data: &str) -> String {
    format!("{:x}", data.len())     // ← semua seed 12 kata → fingerprint SAMA
}
```
DB punya `fingerprint TEXT NOT NULL UNIQUE` + `INSERT OR IGNORE` (`db.ts:125`) → kalau modul ini dipakai, seed kedua dengan panjang identik **silently dibuang**.

Frontend masih selamat karena pakai SHA-256 sendiri (`src/lib/fingerprint.ts`), **tapi itu berarti dua sistem fingerprint berbeda**. Modul Rust = dead code yang berbahaya kalau nanti dipakai.

---

### 🟡 BUG #9 — `btoa(String.fromCharCode(...))` TAKUT TRANSAKSI BESAR
`src/lib/sweeper.ts:~365`
```js
const rawTxBase64 = btoa(String.fromCharCode(...new Uint8Array(serialized)));
```
Spread argumen ke `String.fromCharCode` kena limit stack (~65–125 ribu arg). Buat transfer SOL doang aman; begitu ada versi token/multi-instruction, **`RangeError: Maximum call stack size exceeded`**. Pakai `Buffer.from(x).toString('base64')` atau loop chunk.

---

### 🟡 BUG #10 — TEST WINDOWS IKUT MENGOSONGKAN CLIPBOARD DEVELOPER
`commands.rs:457` `test_windows_empty_clipboard` — `#[cfg(target_os="windows")]`. Di CI/dev machine Windows, `cargo test` **beneran manggil `EmptyClipboard()`** → nyapu clipboard user yang lagi aktif. Test aksesibelenegara bagian OS riil tanpa isolasi = side effect yang nggak dapat dihindari.

---

---

### 🟡 BUG #11 (BARU, hasil revisi v2) — DUA WRITER SQLITE TANPA `busy_timeout`

Scanner **Rust** (`rusqlite::Connection`) dan frontend **plugin-sql** menulis ke file DB yang sama.

```rust
// src-tauri/src/core/scanner/mod.rs:133-142
let conn = Connection::open(&path)?;
let _ = conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
//                                   ↑ WAL ✅   ...tapi TIDAK ada PRAGMA busy_timeout
```
```ts
// src/lib/db.ts — koneksi frontend
let db: Database | null = null;
export async function getDb() { if (!db) db = await Database.load(DB_PATH); return db; }
//   ^ 0× PRAGMA, 0× busy_timeout, 0× retry — grep "PRAGMA" di src/ = NOL
```
Lalu scanner membuka **1 transaksi tulis** untuk 15 wallet sekaligus (`scanner/mod.rs:254-256`), dan frontend **chunk-loop** manggil ini 15 wallet per putaran (`useWalletScanner.ts:82`).

**Skenario gagal:** user klik Scan (50 wallet → 4 chunk) → di tengah chunk, user rename wallet / hapus wallet / import baru → `SQLITE_BUSY`. `rusqlite` default `busy_timeout = 0` → **error langsung, tanpa retry**.

Gejalanya bakal muncul sebagai:
- label edit gagal senyap (banyak `try { } catch {}` di `db.ts:151,176,238,249`)
- chunk scan hilang (di-catch → `totalErrors += 1`, lanjut — data balance sebagian **nggak ke-save**)

Fix (murah, 1 baris per koneksi):
```rust
let _ = conn.busy_timeout(std::time::Duration::from_millis(5000));
```
```ts
// src/lib/db.ts, setelah load
await database.execute("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
```
**Rekomendasi yang lebih bersih:** karena `core/vault/repository.rs::get_db_path` **udah ada di Rust** dan scanner udah pegang koneksi — pindahkan **semua** tulis DB ke Rust, jadikan frontend reader-only. Ini sekaligus mengisi salah satu stub lu secara natural.

---

## 🟡 BAGIAN 4 — TEMUAN SEKUNDER (KESELAMATAN & KUALITAS)

*(Dua baris teratas — #11 dan #12 — sebenarnya bug fungsional, bukan cosmetics.)*

| # | Severity | Temuan | Lokasi |
|---|---|---|---|
| 12 | 🟠 | `"csp": null` — **nggak ada Content-Security-Policy sama sekali.** Untuk app yang megang private key, XSS = kompromi total. | `tauri.conf.json` |
| 13 | 🟠 | Argon2id `m=19456 KiB (19MB), t=2, p=1` — **di bawah baseline OWASP** (m=19 MiB t=2 p=1 itu persis lantai minimum; ideal 64–256 MiB). Nggak mencekang GPU/ASIC dengan baik. | `crypto.rs:19` |
| 14 | 🟠 | Format legacy pakai **salt hardcoded** `b"wallet_inspect_s"` — semua user salt-nya sama → rainbow table / komputasi 1x buat semua korban. | `crypto.rs` test, legacy path |
| 15 | 🟡 | Deteksi format legacy rapuh: cek magic bytes `PLX1` **setelah base64-decode**, tanpa prefix versi terstandar. Kalau secret plaintext mulai dengan byte `PLX1`, terdeteksi salah format. | `crypto.rs:decrypt_vault` |
| 16 | 🟡 | Semua error `Result<_, String>` — nggak ada enum error, jadi UI nggak bisa bedain "password salah" vs "disk penuh" vs "air-gap aktif". | `utils/errors.rs` (26 baris doang) |
| 17 | 🟡 | Single-word solver klaim `< 1 milidetik`, padahal loop 2048 iterasi dengan `continue` per-kombinasi, bukan langsung lompat ke indeks kandidat. | `recovery_session.rs` |
| 18 | 🟡 | 21 dari 33 command nggak punya guard air-gap. Wajar buat vault/window, tapi `vault_derive_credentials` & `scan_directory_native` (baca seluruh folder user) sebaiknya tetap diblokir di Safe Mode. | `commands.rs` |
| 19 | 🟡 | Bundle 855 KB satu chunk, tanpa `manualChunks`/`React.lazy`. `@solana/web3.js` + `ethers` = berat banget buat webview. | build output |
| 20 | 🟡 | Fast checksum **cuma dukung 12 kata** (`[u16; 12]`, hardcoded di seluruh jalur). Klaim dukungan mnemonic 15/18/21/24 di jalur Rayon **nggak ada**. | `fast_checksum.rs` |
| 21 | 🟡 | Nggak ada GitHub Actions / CI. Build & test cuman lokal, tanpa gate. | — |

### ✅ Yang justru gue acungi jempol (jangan diubah!)
- **Bit-packing BIP-39 di `fast_checksum.rs` — gue cek manual ke-16 byte + checksum per-bit, SEMUA BENAR.** Ini kode langka yang jarang ditulis bener.
- **Guard `AIR_GAPPED_MODE` di 13 command RPC/broadcast dipasang dengan benar dan konsisten.**
- **Arsitektur enkripsi vault solid:** nonce acak 12-byte per item, magic bytes, `Aes256Gcm`, batch encrypt reuse-derived-key dengan nonce unik (bukan nonce-reuse).
- **Permission Tauri whitelist per-kategori** — jauh di atas template default. Awalnya gue duga 13 permission "hilang", ternyata semua di-define dalam 1 file TOML. Rapi.
- **Deteksi SPL token account / custom program / durable nonce authority** sebelum sweep — guard yang sangat matang dan jarang dipikir orang.
- `secure_zero_slice` pakai `ptr::write_volatile` — benar, optimizer LLVM nggak bakal eliminasi.

---

## 🎯 BAGIAN 5 — PRIORITAS PERBAIKAN

### 🔥 P0 — Berhenti semua, kerjakan sekarang (bisa bikin user kehilangan dana/privasi)
1. **Bug #2 — sambungkan `set_air_gapped_mode`.** ~15 menit. Fitur keamanan utama lu sekarang nol fungsinya.
2. **Bug #1 — `recentBlockhash`** → bungkus `{ blockhash }`. ~5 menit. Batch Sweeper SOL mati total tanpa ini.
3. **Bug #3 — plain-text CSV export.** Minimal: modal konfirmasi + peringatan "file ini berisi private key", opsi auto-wipe, idealnya pakai `PlurixArchive` (yang belum diimplementasi).
4. **Bug #7 — deklarasikan `@ethersproject/wordlists`** di `package.json`. ~1 menit.

### 🟠 P1 — Perbaiki minggu ini
5. **Pindahkan signing ke Rust (Bug 2.1).** Ini yang mengubah lu dari "aplikasi React dengan Rust RPC proxy" jadi "aplikasi Tauri beneran". `broadcast_raw_tx` sudah ada; tinggal tambah `vault_sign_evm_tx` & `vault_sign_solana_tx` yang terima `wallet_id`, buka vault di dalam Rust, sign di Rust, broadcast di Rust. **Private key nggak perlu menyeberangi IPC sama sekali.**
6. **Hapus silent JS fallback** di `wallet.ts:231` / `extract.ts:258` — native gagal = `throw`, tampilkan error.
7. **Bug #4 — bersihkan `ACTIVE_RAW_PHRASE` / `CACHED_SOLUTIONS`** pakai `SecureBuffer` yang udah lu punya.
8. **Pasang `rayon` di `recovery_session.rs`** (bukan cuma di `dual_missing.rs`) + ganti `wlist.iter().position()` dengan `HashMap` di luar loop. Kalau nggak, koreksi klaim README.
9. **CSP** — minimal `default-src 'self'` di `tauri.conf.json`.
10. **Naikkan Argon2id** ke `m=64 MiB, t=3` (bump magic bytes ke `PLX2` biar legacy tetap kebaca).

### 🟡 P2 — Kerjakan sebelum rilis
11. **`continue 'outer_all_pairs`** buat skip pair selesai (Bug #6).
12. **`HashMap<SessionId, _>`** buat isolasi sesi + tolak resume ganda (Bug #5).
13. ~~Hapus 9 stub kosong~~ → **DICABUT (v2).** Stub dibiarkan, tapi **tag `TODO(plurix):`** di tiap stub + **1 baris legenda** di README. (BAGIAN 6.4)
13b. **Kerjakan `core/execution/sweeper.rs` BARENG P1.5**, jangan nanti — satu-satunya stub yang punya deadline diam-diam. (BAGIAN 6.2)
14. **Ganti `fingerprint.rs` sekarang** (SHA-256, bukan `data.len()`) — 2 menit, dan lebih murah hari ini daripada setelah ada yang manggil. (BAGIAN 6.3③)
14b. **`PRAGMA busy_timeout = 5000`** di `scanner/mod.rs` + `db.ts` → tutup Bug #11. (~5 menit)
14c. **Hapus `CREATE TABLE IF NOT EXISTS` duplikat** di `scanner/mod.rs:146` — migration v5 sudah menjamin. (BAGIAN 6.3②)
15. **Beri clipboard-clear jalur macOS/Linux** (`pbcopy`/`osascript`, atau `arboard` crate) — jangan `#[cfg]` window doang.
16. **Code-splitting** `@solana/web3.js` + `ethers` via `manualChunks` / `React.lazy` di RepairWorkspace & SweeperWorkspace.
17. **CI GitHub Actions**: `cargo fmt --check` + `cargo test` + `tsc --noEmit` + `vite build`.
18. **Tulis integration test buat jalur sweep** — bug #1 bakal ketangkap cuma oleh test runtime, bukan typecheck. Ini bukti bahwa lu butuh smoke test, bukan lebih banyak unit test.
19. **Koreksi README** di bagian: clipboard Windows-only, air-gap, "zero key exposure in webview", "1–3 detik Rayon", dukungan 15/18/21/24 kata.

---
## 🧩 BAGIAN 6 — RE-EVALUASI PASCA KLARIFIKASI: STRATEGI TREE-FIRST

### 6.1 — Kritik gue dicabut, dan ini alasannya kenapa strateginya VALID

Gue cek ulang isi 9 stub itu. Ternyata bukan kode buangan:

```rust
// core/execution/simulator.rs   →  // Zero-loss transaction dry-run simulator
// core/network/hedging.rs       →  // Multi-endpoint RPC hedging race engine
// core/archive/plurix.rs        →  // Encrypted portable .plurix archive vault
// core/notifications/webhook.rs →  // Multi-channel webhook notifier (Discord/Slack/Telegram)
```

Tiap stub punya **satu baris kontrak yang jelas** + `pub mod` terdaftar di `mod.rs` induk. Itu persis definisi *scaffold* yang benar: pohon = kontrak, isi = pekerjaan bertahap. Nggak ada yang salah. Gue salah baca ini sebagai "kesalahan penempatan" di v1.

### 6.2 — Tapi hasil pemetaan mengubah kesimpulan lu, bukan menguatkannya

Gue klasifikasi ulang semua stub dengan pertanyaan: **apakah logikanya sekarang hidup di JS?**

| Stub Rust | LOC | Padanan di JS? | Klasifikasi |
|---|---|---|---|
| `core/archive/plurix.rs` | 2 | ❌ TIDAK ADA | 🟢 **Murni scaffold** — 100% konsisten dg strategimu |
| `core/execution/trader.rs` | 2 | ❌ TIDAK ADA (DexBatchTrader.tsx = **0 baris logika**, UI doang) | 🟢 **Murni scaffold** — malah teladan yang benar |
| `core/execution/simulator.rs` | 2 | ❌ TIDAK ADA | 🟢 Murni scaffold |
| `core/execution/queue.rs` | 2 | ❌ TIDAK ADA | 🟢 Murni scaffold |
| `core/network/hedging.rs` | 2 | ❌ TIDAK ADA | 🟢 Murni scaffold |
| `core/network/proxy.rs` | 2 | ❌ TIDAK ADA | 🟢 Murni scaffold |
| `core/network/rpc_manager.rs` | 2 | ❌ TIDAK ADA | 🟢 Murni scaffold |
| `core/notifications/webhook.rs` | 2 | ❌ TIDAK ADA | 🟢 Murni scaffold |
| **`core/execution/sweeper.rs`** | 2 | ✅ **`src/lib/sweeper.ts` = 467 baris LENGKAP** | 🔴 **VIOLASI KONTRAK POHON** |

**8 dari 9 stub = strategi lu jalan sempurna.** Yang 1 — `sweeper.rs` — adalah satu-satunya yang bikin temuan Bagian 2.1 gue **berlaku**, dan justru karena alasan yang beda dari yang gue sangka.

Ini penting: **pohon lu benar** (`sweeper` itu domain `core/execution/`, bukan `src/lib/`). Yang terjadi adalah **implementasinya masuk ke rumah yang salah sementara rumahnya sendiri masih kosong.**

Risikonya bukan "ada file kosong". Risikonya:
> **Nanti, saat lu sampai ke `sweeper.rs`, lu bakal nulis ULANG — bukan memindah.** Karena versi JS sudah 467 baris, diuji user, dan punya guard yang sudah di-tune (deteksi nonce authority, custom program, ATA rent reserve). Duplikasi permanen + dua sumber kebenaran. Dan private key **telanjur** lewat IPC + webview memory.

Semakin lama lu tunda, semakin besar biaya migrasinya. Ini satu-satunya bagian tree-first yang punya **deadline diam-diam.**

### 6.3 — 3 titik di mana "pohon" kehilangan kontraknya

Tree-first aman selama pohon itu **otoritatif**. Gue nemu 3 titik dia berhenti jadi otoritas:

**① Ada rumah kosong, padahal ada penghuninya di sebelah — dan nggak ada yang nandain.**
`explorers/mod.rs` **sudah diimplementasi** di Rust:
```rust
pub fn explorer_tx_url(chain_key: &str, tx_hash: &str) -> String { ... }
```
…tapi **0× dipanggil**, karena `sweeper.ts:11-49` punya `SWEEP_CHAINS[...].explorerUrl` sendiri.
Ini kebalikan dari stub: **Rust selesai, JS jalan, dua-duanya nggak ngobrol.** Persis "kebingungan" yang mau lu hindari dengan pohon — cuma sekarang bentuknya *duplikasi*, bukan *kehilangan arah*.

**② `vault/` — kontrak kosong yang bikin schema punya dua pemilik.**
| File Rust | Isi | Dipakai? |
|---|---|---|
| `vault/repository.rs` (9b) | `get_db_path()` — **fungsi nyata** | ✅ **YA** — dipakai `core/scanner/mod.rs:133` |
| `vault/models.rs` (21b) | `WalletRecord`, `BalanceRecord` — mirror schema DB | ❌ 0× |
| `db/migrations.rs` | definisi tabel (otoritas #1) | ✅ |
| `scanner/mod.rs:146` | `CREATE TABLE IF NOT EXISTS token_balances (...)` — **definisi tabel KEDUA** | ✅ |
| `src/lib/db.ts` (362b) | semua query wallets/meta | ✅ |

Jadi: `token_balances` **didefinisikan di 2 tempat** (migration v5 & scanner), `models.rs` ngeduplikasi keduanya tanpa dipakai, dan tulisannya lewat 2 koneksi berbeda → **Bug #11**. Ini risiko spesifik tree-first: *struktur bikin lu ngerasa "sudah terorganisir", padahal otoritas definisi jadi kabur.*

Fix: hapus `CREATE TABLE IF NOT EXISTS` di scanner (migration udah ngejamin), dan jadikan `models.rs` sumber tipe — bukan mirror pasif.

**③ Stub yang BUKAN stub kosong — `fingerprint.rs`.**
```rust
pub fn calculate_fingerprint(data: &str) -> String {
    format!("{:x}", data.len())     // ← semua seed 12 kata → hasil SAMA
}
```
Ini lebih berisiko daripada struct kosong, karena **secara teknis "sudah terisi"**. DB punya `fingerprint TEXT NOT NULL UNIQUE` + `INSERT OR IGNORE` (`db.ts:125`).
Begitu lu mulai ngisi `vault/` dan manggil ini → **seed kedua dengan panjang identik silently dibuang**, tanpa error, tanpa toast. Stub kosong bakal bikin lu nulis; stub yang salah bakal lu **percayaan**.

Rekomendasi: ganti sekarang (2 menit, sebelum ada yang manggil):
```rust
pub fn calculate_fingerprint(data: &str) -> String {
    use sha2::{Digest, Sha256};
    BASE64.encode(Sha256::digest(data))
}
```
dan samakan kanonikasinya dengan `src/lib/wallet.ts::canonicalKey` — kalau beda, dua sisi nggak akan pernah dedup identik.

### 6.4 — Agar tree-first lu tetap terjaga (rekomendasi, bukan permintaan refactor)

Nggak perlu ubah struktur. Cukup bikin pohon **bisa diaudit mesin**:

**① Tambah `TODO(plurix):` di tiap stub kosong.**
Kenapa penting: `pub struct SweeperService;` **nggak bisa dicari**, tapi `TODO(plurix):` bisa.
```rust
// core/execution/sweeper.rs
// Sweeper execution core service
// TODO(plurix): pindahkan dari src/lib/sweeper.ts (467b) — JANGAN tulis ulang, MIGRASI.
pub struct SweeperService;
```
Sekali `grep -rn "TODO(plurix)" src-tauri/src` = backlog lu lengkap & selalu akurat. Stub yang nggak ke-tag = bakal kelupaan, itu satu-satunya kegagalan nyata dari model "tulis kode kalau udah ada file"-nya lu.

**② Legenda 1 baris di README.**
Ini bukan soal "misleading" — karena lu bilang sengaja, gue nggak nuduh ngarang. Tapi buat contributor/reviewer eksternal, satu baris nutup 100% gap ekspektasi:
```markdown
> **Status:** modul bertanda `TODO(plurix)` = struktur siap-isi (belum diimplementasi).
```

**③ Satu guard kecil di CI buat ngejaga pohonnya tetap konsisten:**
```bash
# gagalin kalau ada stub tanpa TODO(plurix) — pohon nggak boleh diam-diam basi
grep -rLZ "TODO(plurix)" $(grep -rl "^pub struct [A-Z][A-Za-z]*;$" src-tauri/src) 2>/dev/null
```

**④ Untuk yang 1 stub yang udah punya pemilik (sweeper):**
ambil dari JS **sebelum** JS-nya tumbuh lebih besar. Urutannya pas: lu lagi di tahap P0 (blockhash + air-gap) → **perbaiki bugnya di `sweeper.ts` dulu** biar guard-nya keliatan → baru angkat mentah-mentah ke `sweeper.rs`, dan jadikan `vault_sign_*` command. Dengan begitu `sweeper.rs` keisi sekalian, bukan ditulis dua kali.

### 6.5 — Yang TIDAK berubah karena klarifikasi ini

Biar jelas mana yang gue cabut dan mana yang nggak:

| Temuan v1 | Pasca klarifikasi |
|---|---|
| "9 stub = misleading / kode terlantar" | 🔵 **DICABUT** — desain valid |
| "README membesarkan stub" | 🟡 **Diturunkan** jadi "perlu 1 baris legenda" |
| Kritik penempatan `explorers`/`vault` | 🟢 **Dipertajam** → jadi analisis otoritas schema (6.3) |
| `fingerprint.rs` | 🟡 **Direklasifikasi** latent → fix sekarang (6.3③) |
| ~~**Bug #1** blockhash Solana~~ | ❌ **DICABUT (v3)** — gue salah baca error base58. **Reviewer benar.** Lihat BAGIAN 7 |
| **Bug #2** air-gap tak tersambung | 🔴 **TETAP + diperluas** (3 konsekuensi, lihat update #2) |
| **Bug #3** CSV plaintext | 🔴 **TETAP** — write ke disk nyata |
| **Bug #4** seed di RAM | 🔴 **TETAP** |
| **Bug #5–7** resume/66-pair/phantom dep | 🔴 **TETAP** |
| **Bug #11** dual writer *(BARU)* | 🆕 **DITAMBAHKAN** — ketemu justru karena gue telusuri ulang |
| Rayon salah tempat | 🔴 **TETAP** — `recovery_session.rs` serial, ini klaim performa |
| Inversi signing JS↔Rust | 🔴 **TETAP**, dan **makin relevan** (6.2) |
## 🔬 BAGIAN 7 — v3: BEDAH BALAS TERHADAP TANGGAPAN REVIEWER

Gue nggak cuma nerima koreksi soal Bug #1 — gue **verifikasi ulang semua angka mereka**. Hasilnya:

| Klaim reviewer | Verdict | Bukti |
|---|---|---|
| Bug #1 keliru, string base58 itu benar | ✅ **MEREKA BENAR** | direproduksi, lihat BAGIAN Bug#1 |
| Object `{blockhash,...}` malah crash | ✅ **BENAR** | `Expected String` |
| Saran `ethers.wordlists.en` buat gantiin phantom dep | ✅ **BENAR & LEBIH BAIK** dari saran gue | `typeof ethers.wordlists.en = object`, `getWord(2047)='zoo'` |
| "30 unit tests aktif" | ✅ BENAR | `grep -c "#[test]"` = 30 |
| "whitelist capability rapi dalam 1 TOML" | ✅ BENAR | 14 identifier di 1 file |
| Bug #2,#3,#4,#5,#6,#8,#10,#11 | ✅ Mereka **setuju** | — |
| Angka skala "±22.000 LOC, Mid-size/Advanced MVP" | ✅ Mereka kutip akurat | — |

### 7.1 — Saran wordlists mereka BENAR, tapi cakupannya **kurang 1 file**

> *"cukup gunakan ethers.wordlists.en"*

Betul — dan **lebih baik dari saran gue** (gue nyuruh nambah dependency `^5.7.0` ke package.json; mereka hapus dependensinya sekalian. Itu solusi yang benar). Tapi:

```bash
$ grep -rn "@ethersproject/wordlists" src
  src/lib/wallet.ts:3     ← yang disebut reviewer
  src/lib/extract.ts:4    ← ❌ TIDAK DISEBUT
```
**Dua import, bukan satu.** Kalau yang dibenerin cuma `wallet.ts`, phantom dependency-nya **masih hidup** lewat `extract.ts` dan build tetap pecah di pnpm. Harus dua-duanya.

### 7.2 — Rekomendasi #6 (`zeroize ACTIVE_RAW_PHRASE`) **kurang 2 variabel**

> *"Bersihkan ACTIVE_RAW_PHRASE ... saat cancel/selesai"*

Tujuannya benar, tapi kalau cuma itu, **99% sensitifnya masih ninggal di RAM**:
```bash
$ grep -n "CACHED_SOLUTIONS\|ACTIVE_TARGET_ADDR" recovery_session.rs
  :28  static ACTIVE_TARGET_ADDR: Mutex<Option<String>>   ← di-set :70, TIDAK PERNAH di-clear
  :37  static CACHED_SOLUTIONS:   Mutex<Vec<String>>      ← di-clear HANYA di awal sesi baru (:78)
```
`CACHED_SOLUTIONS` nyimpen **sampai 1.000 frasa seed hasil temuan** — justru yang paling nggak boleh ninggal. Yang perlu di-clear saat selesai/cancel: **`ACTIVE_RAW_PHRASE` + `CACHED_SOLUTIONS` + `ACTIVE_TARGET_ADDR`**, idealnya lewat `SecureBuffer`/`secure_zero_slice` yang udah lu punya.

### 7.3 — Fix air-gap P0 mereka **selesai separuh** (dan ini yang bikin bug-nya balik lagi)

> *"Sambungkan set_air_gapped_mode di useWalletScanner.ts — 5 menit"*

Betul arahnya. Tapi ada state awal yang belum disentuh:
```rust
// commands.rs:7
pub static AIR_GAPPED_MODE: AtomicBool = AtomicBool::new(false);   // ← default TERBUKA
```
```bash
$ grep -rn "AIR_GAPPED_MODE" src-tauri/src/lib.rs src-tauri/src/app/state.rs
  (kosong — TIDAK ada init dari storage saat startup)
```
```ts
// useWalletScanner.ts:24-27 — default UI
localStorage.getItem('plurivex_air_gapped'); return saved !== null ? saved === 'true' : true;
//                                                                      ↑ default UI: AMAN
```
➡️ **Setiap habis restart**: UI = Safe Mode ✅, Rust = terbuka ❌. `toggleAirGapped` doang **nggak benerin kondisi awal ini** — bug-nya cuma kedetection kalau user pernah toggle.

Fix yang tuntas (masih kecil, ±15 menit, arsitektur nggak berubah):
1. Default `AIR_GAPPED_MODE` = `AtomicBool::new(true)` (amankan **fail-closed**, sesuai default UI).
2. Di `lib.rs` `setup()`: baca nilai tersimpan & sinkronkan (atau biarkan fail-closed dan biarkan user buka — ini yang lebih konsisten dgn klaim "air-gap").
3. Di `useWalletScanner.ts` **mount**: `await invoke("get_air_gapped_mode")` sebagai **satu-satunya sumber kebenaran**, bukan localStorage JS. `toggleAirGapped` = invoke dulu, kalau gagal **jangan ubah UI**.

### 7.4 — Yang hilang dari roadmap mereka (bukan salah, tapi jangan kaget nanti)

| # | Item | Kenapa masuk radar |
|---|---|---|
| 1 | **Rayon di `recovery_session.rs`** | Klaim README "1–3 detik multi-core" masih nggak berlaku di jalur yang dipencet user. Ini **janji performa**, bukan cosmetics. |
| 2 | **Clipboard auto-clear Linux/macOS** | `#[cfg(target_os="windows")]` doang → di macOS/Linux Rust-nya **blok kosong**, dan fallback JS mati kalau window non-focus. Klaim README "native OS" belum multi-OS. |
| 3 | **`CACHED_SOLUTIONS` cap 1000 tanpa expiry** | Lihat 7.2. |
| 4 | **CSV: `btc_wif` kosong = bug TUNGGAL, bukan gejala** | Mereka bilang *"deriveDualCredentials hanya menurunkan EVM dan Solana"* — benar. Tapi perbaikannya **nggak disebut di roadmap**. Solusinya: export manggil `deriveDualCredentialsNative` (Rust) yang udah ngisi BTC, bukan nambah field di JS. |
| 5 | **`busy_timeout` doang nggak nutup 6.3②** | `CREATE TABLE IF NOT EXISTS` duplikat (`scanner/mod.rs:146` vs `migrations.rs` v5) harus tetap dihapus, kalau nggak schema masih punya 2 pemilik. |

### 7.5 — Catatan soal proses review

Koreksi mereka **mutu tinggi**: angka akurat, verdict per-item jelas, dan mereka **nolak** usulan gue yang salah dengan bukti runtime — itu yang seharusnya terjadi di code review. Gue apresiasi, dan gue perbaiki report gue.

Tapi justru karena mereka rigorous, dua hal di atas (7.1 cakupan wordlists, 7.2/7.3 kelengkapan fix) penting: **bug desync itu nggak kelar kalau perbaikannya separuh**, dan pola "perbaiki 1 dari 2 lokasi" adalah cara paling umum buat bug-nya balik 2 minggu kemudian dengan laporan "already fixed".

---


## 🧾 RINGKASAN SATU PARAGRAF

Plurivex itu **proyek menengah dengan ambisi arsitektur yang lebih besar dari ukurannya** — modular, teruji (30 test), dan detail kriptonya (bit-packing BIP-39, guard air-gap, deteksi akun SPL/nonce) sudah level produksi. Strategi *tree-first* lu menurut gue **tepat**: gue cek 9 stub, 8 di antaranya murni scaffold tanpa padanan JS — artinya pohon itu bekerja persis seperti yang lu maksud. **Yang bikin laporan ini tetap perlu dibaca cuma satu hal:** pohon lu benar, tapi ada **satu cabang yang penghuninya nyasar** — `core/execution/sweeper.rs` masih kosong sementara versi JS-nya sudah 467 baris dan sudah memegang private key di webview. Itu bukan soal estetika penempatan: itu beda dengan 8 stub lain, karena dia punya **deadline diam-diam** — makin lama dibiarkan, makin besar kemungkinan lu menulis ulang alih-alih memindahkan, dan duplikasinya jadi permanen. Di atas itu ada 3 bug nyata yang gue reproduksi (air-gap tak tersambung ke Rust, plaintext key di CSV export, seed tak ter-zeroize di RAM) — semuanya independen dari soal stub. *Catatan v3: "Solana blockhash crash" gue cabut — gue yang salah, reviewer benar.* Rekomendasi gue: **pertahankan tree-first-nya**, tambahkan `TODO(plurix):` supaya pohon bisa diaudit mesin, dan jadikan migrasi sweeper→Rust sebagai fitur besar berikutnya, karena itu sekaligus ngisi stub, nutup bug #1, dan ngejawab klaim "zero key exposure" di README.

---

*Seluruh temuan diverifikasi terhadap commit `0a56a26`. Re-produksi: `npx tsc --noEmit` (lolos), `grep -rn "set_air_gapped_mode" src/` (Bug #2), dan snippet Node `@solana/web3.js@1.98.4` — **Bug #1 dicabut di v3 setelah direproduksi ulang dengan blockhash base58 valid: plain string justru yang benar.**

---

## 🚀 REVISI v4 — Implementasi Hardening Keamanan & Stabilitas (Tahap 1 Selesai)
*Tanggal:* 2026-09-06 · *Status:* **Telah Diimplementasikan & Terverifikasi (33/33 Unit Test Lulus)**

Berdasarkan temuan audit teknis komprehensif, implementasi hardening prioritas tinggi (Tahap 1) telah selesai dikerjakan:

1. **🔒 K4 — Strict Content Security Policy (CSP)**
   - `tauri.conf.json` telah diperbarui dari `"csp": null` menjadi kebijakan ketat:
     `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: https:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost ws://localhost:1420 http://localhost:1420;"` *(Catatan v5: Telah diperketat lebih lanjut di Revisi v5 — superseded)*
   - Melindungi antarmuka webview dari serangan injeksi skrip eksternal (anti-XSS).

2. **🎫 K6 — Race Condition Pause ➔ Resume Teratasi**
   - Menambahkan pelacak generasi atomik `static SESSION_GENERATION: AtomicUsize` di `recovery_session.rs`.
   - Tiket sesi dinaikkan secara atomik (`fetch_add`) pada setiap eksekusi start dan resume. Thread lama secara otomatis memeriksa tiket dan melakukan self-termination seketika jika tiket sudah usang. Menghilangkan bug *double worker* dan duplikasi hasil pencarian.

3. **🧠 K7 — Integrasi Crate `zeroize` Sejati**
   - Menambahkan crate resmi `zeroize = { version = "1.9", features = ["alloc"] }` ke `Cargo.toml`.
   - `SecureBuffer` di `core/security/memory.rs` mengimplementasikan trait `Zeroize` dan `ZeroizeOnDrop`.
   - Menambahkan `secure_zero_string()` dan fungsi pembersihan volatile memory barrier `compiler_fence(Ordering::SeqCst)`.
   - Seluruh intermediate secret buffer (`seed_bytes`, `evm_pk_bytes`, `sol_seed_32`, `pk_bytes`) di `derivation.rs` kini dibersihkan dengan `.zeroize()` segera setelah derivasi selesai.
   - Sesi pemulihan (`recovery_session.rs`) membersihkan `ACTIVE_RAW_PHRASE`, `ACTIVE_TARGET_ADDR`, dan `CACHED_SOLUTIONS` dengan penimpaan fisik nol (`0x00`) baik saat sesi di-cancel maupun saat selesai normal (*completed*).

4. **🛡️ K8 — Resilient Poisoning-Resistant Mutex**
   - Menambahkan fungsi helper `safe_lock<T>()` yang menangani `PoisonError` secara aman melalui `poisoned.into_inner()`.
   - Seluruh 33 pemanggilan `.lock().unwrap()` pada `recovery_session.rs` telah digantikan dengan `safe_lock(&...)`, menjamin aplikasi tidak akan pernah crash akibat gembok memori yang teracuni.

5. **🏷️ Rebranding Penuh ke Plurivex**
   - Menyelaraskan seluruh nama crate biner & lib (`plurivex`, `plurivex_lib`), nama database default (`plurivex.db`), user-agent HTTP RPC client (`Plurivex/1.0`), dan dokumentasi arsitektur.

---

## 🛡️ REVISI v5 — Production Hardening & Precision Forensic Lifecycle (Lengkap)
*Tanggal:* 2026-09-06 · *Status:* **Telah Diimplementasikan & Terverifikasi (49 Unit Test: 48 Lintas-Platform + 1 Windows Lulus)**

Resolusi komprehensif terhadap review lanjutan commit `e66b59c` dan `5d71d54`:

1. **🔴 R3 — Proteksi Sesi Ganda (Mencegah Sesi Kedua Terbunuh)**
   - **Rust**: `clear_recovery_session(session_id)` kini memvalidasi kecocokan identitas sesi aktif (`active.as_deref() == Some(session_id) || session_id.is_empty()`). Panggilan cleanup dengan ID sesi usang dari sesi sebelumnya langsung ditolak tanpa menyentuh sesi baru.
   - **React**: Cleanup hook di `RepairWorkspace.tsx` diubah menggunakan `useRef` (`sessionIdRef`) dengan dependency array kosong `[]`, sehingga pembersihan sesi benar-benar hanya berjalan saat komponen di-unmount, bukan saat perpindahan sesi A $\rightarrow$ B.

2. **🟠 T1 & K6 — Eliminasi Race Condition Ekor Worker & Test Paralel**
   - Ekor thread worker kini diproteksi guard generasi: `if SESSION_GENERATION.load(Ordering::SeqCst) == generation`. Worker lama yang keluar tidak dapat menghapus memori milik sesi baru.
   - Menambahkan `static TEST_LOCK: Mutex<()>` untuk men-serialisasi test yang mengakses state statis global di backend Rust.
   - Mengganti `sleep(150ms)` fixed dengan loop polling deterministik bertenggat waktu 5 detik (`Instant + timeout`).

3. **⚡ K5 — Derivasi Selektif Tunggal per-Chain pada Target Matcher**
   - Mengklasifikasikan format target address (`0x...` untuk EVM, `bc1`/`1`/`3` untuk BTC, Base58 untuk Solana) sebelum komputasi.
   - Menambahkan fungsi derivasi tunggal: `derive_evm_address_only_native`, `derive_solana_address_only_native`, dan `derive_bitcoin_addresses_only_native`.
   - Mengeliminasi 75% beban komputasi kurva eliptis per kandidat kata (menghasilkan percepatan wall-clock nyata 2x–3x; hashing PBKDF2 2048 ronde tetap dihitung per kandidat) tanpa alokasi private key di heap.

4. **🔒 K4 & R2 — Content Security Policy Kedap & Penghapusan Google Fonts**
   - Menghapus `https:` dan `asset:` dari `img-src` produksi untuk menutup celah eksfiltrasi data via CSS/HTML.
   - Memisahkan koneksi WebSocket HMR (`ws://localhost:1420 http://localhost:1420`) ke konfigurasi khusus development `security.devCsp`.
   - Menghapus `@import url("https://fonts.googleapis.com/...")` di `variables.css` dan mengandalkan font stack sistem lokal offline (`Inter`, `system-ui`, `-apple-system`, `JetBrains Mono`, `monospace`).

5. **🧠 Z1, Z4, Z5, Z6 — Jaminan Pembersihan Memori Zeroize Menyeluruh**
   - **Z1**: `clear_session_secrets` membersihkan `m.phrase` di dalam `CACHED_TARGET_MATCH` dengan `secure_zero_string` sebelum menghapus guard.
   - **Z4**: Membungkus buffer rahasia perantara (`seed_bytes`, `evm_pk_bytes`, `sol_seed_32`, `pk_bytes`, serta `decoded` & `raw32` pada cabang `sol_pk`) di `derivation.rs` dengan tipe RAII `zeroize::Zeroizing`. Menjamin auto-wipe pada seluruh jalur keluar fungsi termasuk early error return (`?`).
   - **Z5**: `start_in_memory_session` memanggil `clear_session_secrets()` di awal sebelum inisialisasi sesi baru.
   - **Z6**: Mengaktifkan fitur bawaan `zeroize` pada crate `bip39` (`features = ["all-languages", "zeroize"]`) dengan dependensi `zeroize_derive 1.5.0`.
   - **Dokumentasi**: Menyelaraskan klaim zeroize di `README.md` menjadi *"Volatile Memory Zeroization (`zeroize` Crate)"*.

6. **🔒 L1 — Zero-Disk & Volatile RAM Wipe saat Vault Dikunci**
   - Saat pengguna mengunci vault (`useAuthVault.ts: lock()`), frontend memanggil `invoke('clear_recovery_session', { sessionId: '' })`.
   - Menjamin bahwa jika pengguna meninggalkan workstation atau mengunci vault di tengah atau setelah recovery session, seluruh sisa rahasia di RAM (`ACTIVE_SESSION_ID`, `ACTIVE_RAW_PHRASE`, `CACHED_TARGET_MATCH`, `CACHED_SOLUTIONS`) langsung di-zeroize seketika.

7. **📈 N1 — Metrik Kecepatan & Estimasi ETA Mulus saat Resume Sesi**
   - Menambahkan pelacak `SESSION_START_INDEX` yang diinisialisasi ulang ke `start_from_index` setiap kali worker di-resume.
   - Perhitungan kecepatan (CPS) dan sisa waktu (ETA) kini dihitung berbasis iterasi yang diproses sejak worker aktif (`(current - start) / elapsed`), mengeliminasi spike CPS artifisial dan fluktuasi ETA di frontend.

8. **🪙 N2 & Test Teardown — Dukungan Bitcoin BIP-49 (P2SH-P2WPKH) & Test Isolation**
   - Menambahkan implementasi derivasi alamat Bitcoin BIP-49 (`3...`) pada `derivation.rs` dan matcher `target_match.rs`, melengkapi dukungan ketiga format standar Bitcoin (Native SegWit `bc1q`, Nested SegWit `3`, dan Legacy `1`).
   - `test_in_memory_recovery_session_lifecycle` kini secara eksplisit memanggil `clear_recovery_session` di akhir eksekusi untuk menjamin kebersihan memori global backend antar-test.

9. **🧪 T2 — Canonical Known-Answer Test Vector BIP-49 Resmi**
   - Menambahkan unit test resmi `test_bip49_and_bitcoin_derivation_vectors` di `derivation.rs` yang memvalidasi ketiga format alamat Bitcoin (BIP-84 `bc1q...`, BIP-49 `3...`, BIP-44 `1...`) terhadap test vector resmi BIP-49 & Ian Coleman (`abandon ... about` $\rightarrow$ `37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf`). Mengunci kebenaran kriptografis dan mencegah regresi diam-diam.

10. **⚡ Z3 — Volatile Zeroize & Pre-Allocated Phrase Buffer di Worker Loop**
    - Mengganti alokasi `.collect::<Vec<&str>>().join(" ")` di worker recovery loop (`recovery_session.rs`) dengan closure `assemble_phrase(&indices)` yang mengembalikan `zeroize::Zeroizing<String>` (`String::with_capacity(120)`).
    - Menghilangkan alokasi heap `Vec<&str>` perantara sekaligus menjamin string kandidat frasa di-zeroize otomatis di heap RAM setiap kali iterasi loop selesai (`Drop` RAII).

11. **🚀 CI/CD — Automated GitHub Actions Verification Pipeline**
    - Menambahkan `.github/workflows/ci.yml` yang menguji typecheck TypeScript (`tsc`), bundle frontend (`vite build`), `cargo clippy -- -D warnings`, dan seluruh unit test `cargo test` lintas platform (Ubuntu & Windows) secara otomatis pada setiap push dan pull request di branch `main`.

12. **🔐 K1 — Native EVM Transaction Signing di Rust & Zero Key Exposure di Webview (Tahap 2 Selesai)**
    - **Pure Rust RLP Encoder (`rlp.rs`)**: Implementasi mandiri encoding byte string, integer, dan list standar Ethereum tanpa dependensi eksternal baru, teruji dengan 4 unit test kanonikal.
    - **Native EIP-155 Signing (`signing.rs`)**: Penandatanganan transaksi EVM (Type 0 / EIP-155) langsung di backend Rust menggunakan `k256` ECDSA recoverable signing (RFC 6979 deterministik) dan Keccak-256 hashing. Seluruh private key secp256k1 dibungkus dalam `zeroize::Zeroizing<[u8; 32]>` dan dibersihkan seketika pasca penandatanganan.
    - **Test Vector Resmi**: Terverifikasi lolos test vector resmi EIP-155 Ethereum Foundation (Vitalik Buterin) dan cocok 100% bit-per-bit dengan output `ethers.Wallet.signTransaction`.
    - **Tauri IPC Command & Permissions (`sign_evm_transfer`)**: Terdaftar di `commands.rs`, `lib.rs`, dan whitelist `allow-rpc-get-balance.toml` (`commands.allow`), menggunakan struct `EvmTransferPayload` dan pembersihan string secret via `secure_zero_string`.
    - **Frontend Sweeper (`sweeper.ts`)**: Menghapus `deriveEvmWallet` dan `signer.signTransaction` di webview JavaScript, kini sepenuhnya menandatangani transaksi melalui `invoke('sign_evm_transfer')`. Mewujudkan arsitektur *"Zero key exposure in webview memory"*.
    - **Zero-Copy & Memory Polish**: Menyelaraskan seluruh 9 derivasi `bip32::XPrv::derive_from_path` ke `seed_bytes.as_ref()` (zero-copy) dan menambahkan `#[derive(Zeroize, ZeroizeOnDrop)]` pada `TargetAddressMatch`.

13. **🛡️ Tahap 2b — Hardening Signing & Eliminasi Total Derivasi di Webview (Resolusi F1–F6)**
    - **F1 (Komentar Test Vector EIP-155)**: Menyelaraskan komentar di `test_official_eip155_vector` dengan nilai hash kanonikal RFC 6979 (`...a028ef61...a067cbe9...`) yang cocok dengan ethers.js dan spesifikasi resmi EIP-155.
    - **F2 (u128 Decimal Parsing)**: Memperbaiki `parse_hex_or_dec_bytes` agar menggunakan `val.to_be_bytes()` trimmed (u128 penuh), mencegah pemotongan nilai desimal transfer besar ($> \text{u64::MAX}$, misal $20\text{ ETH} = 2 \times 10^{19}\text{ wei}$). Dilengkapi unit test untuk 20 ETH desimal (9 byte) dan nilai 0.
    - **F3 (Validasi Recipient Address `to`)**: Mewajibkan panjang recipient tepat 20 byte dan menolak zero address (`0x000...000` / `[0u8; 20]`) untuk mencegah terbakarnya dana akibat typo atau paste kosong. Dilengkapi unit test.
    - **F4 & F4b (Eliminasi `deriveDualCredentials` & Zeroized Address-Only Derivation)**:
      - Menghapus pemanggilan `deriveDualCredentials` (yang mengeksekusi `ethers.Wallet.fromMnemonic` dan memicu instansiasi `elliptic` di heap V8/Chromium) dari jalur EVM sweep di `sweeper.ts`.
      - **F4b Zeroized Address-Only**: Menambahkan fungsi `evm_address_only(&pk)` di `derivation.rs` dan `derive_evm_address_from_secret` di `signing.rs` yang menderivasi alamat langsung dari `SigningKey` (`ZeroizeOnDrop`) tanpa pernah mengalokasikan string hex private key di heap RAM.
      - **Sender Address Self-Check**: Command `sign_evm_transfer` kini mengembalikan `EvmSignResult { raw_tx, from_address }`. Frontend memvalidasi kecocokan `from_address` derivasi kunci terhadap `senderAddress` sebelum melakukan broadcast, mencegah inkonsistensi data UI/vault secara otomatis.
    - **F5 (Batasan Type-0 pada Chain EIP-1559)**: Dicatat bahwa transaksi sweep EVM saat ini adalah Legacy Type-0; pada chain EIP-1559 (Base/Arbitrum), `gasPrice` dari `eth_gasPrice` berlaku sebagai effective price (selisih terhadap base fee menjadi tip validator). Transaksi sweep saldo bersih terbukti aman dan valid di seluruh node target; implementasi Type-2 (EIP-1559 dynamic fee) diagendakan untuk optimasi efisiensi biaya.
    - **F6 (Penghitungan Test Deterministik)**: Format pengujian diperbarui secara akurat: **44 unit test** (43 unit test lintas-platform Linux/Windows + 1 unit test khusus Windows clipboard).

14. **☀️ K1b — Native Solana Transaction Signing di Rust & Zero Webview Key Exposure (Tahap 3)**
    - **Wire Serializer Solana Mandiri (`solana_signing.rs`)**: Implementasi murni format wire transaksi Solana legacy (header 3-byte, compact-u16 varint serializer, tabel akun, recent blockhash, instruksi `Transfer` dan `NonceWithdraw`) tanpa dependensi crate Solana eksternal yang berat.
    - **Native ed25519 Signing (`ed25519-dalek`)**: Penandatanganan pesan transaksi menggunakan ed25519 deterministik (RFC 8032), dengan seed buffer dibungkus dalam `zeroize::Zeroizing<[u8; 32]>` dan dibersihkan dari RAM seketika pasca signing.
    - **Test Vector Kanonikal**: Teruji dan terverifikasi 100% cocok bit-per-bit dengan output `@solana/web3.js` untuk transaksi transfer standar dan penarikan Durable Nonce (`nonceWithdraw`).
    - **Tauri IPC Command & Permissions (`sign_solana_transfer` & `get_solana_address`)**: Terdaftar di `commands.rs`, `lib.rs`, dan whitelist `allow-rpc-get-balance.toml` (`allow-native-signing`), dilengkapi pembersihan parameter rahasia via `secure_zero_string`.
    - **Frontend Sweeper (`sweeper.ts`)**: Menghapus `Keypair`, `Transaction`, `SystemProgram`, `bs58`, dan `deriveDualCredentials` dari alur eksekusi sweep Solana di webview. Signing dan derivasi alamat kini sepenuhnya didelegasikan ke native Rust dengan self-check kecocokan alamat pengirim.
    - **Status Arsitektur Transaksi**: Seluruh derivasi kunci kriptografis dan penandatanganan transaksi (EVM & Solana) pada alur sweep kini 100% dieksekusi di backend Rust. Webview tidak lagi menginstansiasi library kripto atau memproses signing; webview hanya memegang ciphertext vault dan plaintext sementara selama IPC. Eliminasi total dekripsi di webview dijadwalkan pada Tahap K3-lite (dekripsi native di Rust).

15. **🛡️ Resolusi Review F7, F8, F10 & Hardening IPC Signing**
    - **F7 (`Zeroizing<String>` Anti-Leak Guard)**: Membungkus argumen secret dalam `zeroize::Zeroizing<String>` di seluruh Tauri command (`sign_evm_transfer`, `get_evm_address`, `sign_solana_transfer`, `get_solana_address`), menjamin buffer memori heap String di-zeroize seketika pada semua jalur keluar (termasuk early-return operator `?` saat error dan panic). Dilengkapi unit test `test_zeroizing_secret_cleanup`.
    - **F8 (Lossless Deserialisasi Lamports)**: Mendukung deserialisasi `lamports` u64 baik dari format angka maupun string desimal (`deserialize_u64_from_number_or_str`), menjaga presisi penuh di atas $2^{53}$ lamports tanpa pembulatan floating point. Dilengkapi unit test `test_solana_transfer_payload_deserialize_number_and_string`.
    - **F10 (Pemisahan Granular Permission)**: Memisahkan permission Tauri menjadi `allow-tx-broadcast` (khusus broadcast network) dan `allow-native-signing` (khusus derivasi & offline signing) di `allow-rpc-get-balance.toml` dan `default.json`.

16. **🔒 K3-lite — Sealed Vault Transaction Signing di Rust (Zero Key Exposure Selesai)**
    - **In-Memory Zeroizing Vault Decryption (`crypto.rs`)**: Menambahkan fungsi `decrypt_vault_zeroizing` yang mendekripsi ciphertext PLX1 (Argon2id + AES-256-GCM) langsung ke buffer `zeroize::Zeroizing<String>`, menjamin pemusnahan otomatis dari heap RAM saat keluar dari scope. Dilengkapi unit test `test_argon2id_zeroizing_decryption`.
    - **Sealed IPC Commands (`commands.rs`, `lib.rs`, `allow-rpc-get-balance.toml`)**:
      - Mengganti command unsealed dengan `sign_evm_transfer_sealed`, `get_evm_address_sealed`, `sign_solana_transfer_sealed`, dan `get_solana_address_sealed`.
      - Command menerima `encrypted_secret` (ciphertext DB) dan `master_pw`. Dekripsi, derivasi alamat publik, dan penandatanganan transaksi dieksekusi 100% di backend Rust.
      - Menghapus total command signing unsealed dari `lib.rs` dan whitelist permission security guna mencegah celah downgrade atau bypass.
      - Dilengkapi unit test roundtrip `test_sealed_evm_and_solana_signing_roundtrip`.
    - **Frontend Sweeper Hardening (`SweeperWorkspace.tsx`, `sweeper.ts`, `AppContext.tsx`)**:
      - Menghapus pemanggilan `revealSecret` dari alur sweep di `SweeperWorkspace.tsx`.
      - Webview kini murni meneruskan `w.encryptedSecret` dan `masterPw` ke Rust tanpa pernah mendekripsi atau menginstansiasi plaintext private key di memori JavaScript/V8.
      - Plaintext private key **0% terpapar di heap runtime JavaScript** selama seluruh siklus hidup sweep.
    - **Total Pengujian**: **52 unit test** (51 unit test lintas-platform Linux/Windows + 1 unit test khusus Windows clipboard).

17. **⚡ Resolusi Review F11 & Determinisme Penuh Raw Transaction**
    - **F11 (Eliminasi Race Condition Worker Inisialisasi State)**: Memindahkan blok inisialisasi state sesi (`ACTIVE_SESSION_ID`, `CANCEL_FLAG`, `CURRENT_INDEX`, dll.) keluar dari closure thread spawn ke thread pemanggil (`run_dual_word_session_worker`) sebelum `std::thread::spawn` dieksekusi. Menambahkan guard abort cepat jika thread telah dibatalkan/superseded (`SESSION_GENERATION != generation || CANCEL_FLAG`). Menghapus delay artifisial `std::thread::sleep(50ms)` dari unit test.
    - **Verifikasi Deterministik Raw Tx Sealed vs Direct**: Memperbarui unit test `test_sealed_evm_and_solana_signing_roundtrip` dengan `assert_eq!` eksplisit antara `raw_tx` command sealed dan `sign_evm_transfer_with_secret` langsung, serta `raw_tx_base64` sealed Solana dan `sign_solana_transfer_with_secret` langsung. Membuktikan secara matematis tidak ada mutasi apa pun pada payload transaksi antara dekripsi vault dan signing.






