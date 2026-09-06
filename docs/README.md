# 📁 Plurivex — Document Index

Katalog dokumen arsitektur. **Semua file di folder ini di-track Git** (lihat kebijakan di `.gitignore`).

> ⚠️ **CATATAN STATUS BERKAS.** Keenam dokumen di bawah ini **sebelumnya tidak pernah masuk ke repository** —
> bukan karena lupa di-commit, tapi karena pola `PLURIVEX_*.md`, `*ROADMAP*.md`, dan `docs/` di `.gitignore`
> otomatis mengecualikannya. Struktur + kerangkanya sudah dibuat di sini; **isi naratif aslinya masih perlu
> dipulihkan dari sumber lokal** (file-file itu ada di mesin penulis, belum tersalin ke repo).
> Bagian yang ditandai `[ISI DARI PENULIS]` adalah tempat konten asli masuk.

---

## Daftar dokumen

| Dokumen | Fungsi | Status isi |
|---|---|---|
| [`PLURIVEX_MASTER_FEATURE_SPEC.md`](PLURIVEX_MASTER_FEATURE_SPEC.md) | Kontrak fitur — apa yang wajib ada per modul | 🟡 kerangka |
| [`PLURIVEX_IMPLEMENTATION_MATRIX.md`](PLURIVEX_IMPLEMENTATION_MATRIX.md) | Peta modul: `[Live]` / `[Scaffold]` / `[JS-only]` | 🟢 **data terverifikasi sudah terisi** |
| [`MODULARIZATION_AND_REFACTORING_PLAN.md`](MODULARIZATION_AND_REFACTORING_PLAN.md) | Aturan tree-first + kriteria kepindahan kode JS→Rust | 🟡 kerangka |
| [`PLURIVEX_RECOVERY_5PHASE_ROADMAP.md`](PLURIVEX_RECOVERY_5PHASE_ROADMAP.md) | Tahapan 1–5; fase mana membuka stub yang mana | 🟡 kerangka |
| [`SMART_CONTRACT_PLAN.md`](SMART_CONTRACT_PLAN.md) | Rencana kontrak on-chain (dipetakan ke stub `execution/`) | 🟡 kerangka |
| [`PLURIVEX_FINAL_APPROVAL_NOTE.md`](PLURIVEX_FINAL_APPROVAL_NOTE.md) | Catatan sign-off pasca audit | 🟢 **isi verifikasinya sudah terisi** |
| [`../AUDIT-PLURIVEX.md`](../AUDIT-PLURIVEX.md) | Audit teknis independen (v3) — bukti mentah rujukan matriks | 🟢 lengkap |

## Konvensi yang dipakai repo ini

**1. Tree-first itu kontrak, bukan sekadar pohon.**
Setiap stub wajib membawa penanda yang bisa dicari mesin:
```rust
/// TODO(plurivex): Planned scaffold module for Phase N <nama fase> (tree-first architecture).
pub struct FooService;
```
Alasannya: `pub struct Foo;` tidak bisa di-grep sebagai pekerjaan tertunda; `TODO(plurivex):` bisa.
Audit terkini: **9 dari 10** stub bertanda. Yang belum: `core/vault/service.rs`.

**2. Label `[Live]` / `[Scaffold]` di README wajib sesuai isi pohon.**
Satu baris legenda di README adalah harga dari model tree-first — tanpa itu, pembaca luar tidak bisa
membedakan "belum dikerjakan" dari "seolah sudah jadi".

**3. Sumber kebenaran definisi itu tunggal.**
Skema DB = `db/migrations.rs` (bukan `CREATE TABLE IF NOT EXISTS` sisipan).
Tipe record = `core/vault/models.rs`. Kanonisasi kunci = `canonical_key()` **yang sama** di Rust & JS.

**4. Kalau JS mengerjakan yang harusnya Rust, catat di matriks.**
Stub kosong + implementasi lengkap di JS = duplikasi permanen. Hanya terjadi **1×** saat ini
(`execution/sweeper.rs` vs `src/lib/sweeper.ts`) — lihat matriks, baris bertanda 🔴.

## Dilaruh di sini
`docs/DRAFTS/` dan `docs/EXPORTS/` — sengaja di-gitignore. Jangan taruh ekspor berisi kunci di repo.
