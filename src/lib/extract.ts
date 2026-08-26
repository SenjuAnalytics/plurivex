import bs58 from "bs58";
import { ethers } from "ethers";
import { wordlists } from "@ethersproject/wordlists";
import { isBase58Line, normalizeSolSecret } from "./solana";
import { walletFingerprint } from "./fingerprint";
import { canonicalKey, classify, isSolanaKeyStr, isValidWalletEntry, normalizeInput } from "./wallet";

const MNEMONIC_LENGTHS = [24, 21, 18, 15, 12];
const HASH_CONTEXT =
  /\b(tx[_\s-]?hash|transaction[_\s-]?hash|block[_\s-]?hash|merkle|sha256|keccak|signature|checksum)\b/i;
const LABELED_PK =
  /(?:private\s*key|priv(?:ate)?[\s_-]*key|secret\s*key|wallet\s*key)\s*[:=\s"'(]*(?:0x)?([0-9a-fA-F]{64})\b/gi;

let bip39Set: Set<string> | null = null;

function getBip39Set(): Set<string> {
  if (!bip39Set) {
    bip39Set = new Set();
    const wl = wordlists.en;
    for (let i = 0; i < 2048; i++) bip39Set.add(wl.getWord(i));
  }
  return bip39Set;
}

function isBip39Word(word: string): boolean {
  return getBip39Set().has(word.toLowerCase());
}

function isValidSeed(phrase: string): boolean {
  try {
    return ethers.utils.isValidMnemonic(phrase.trim());
  } catch {
    return false;
  }
}

function tokenizeWords(text: string): string[] {
  const words: string[] = [];
  const re = /[a-zA-Z]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    words.push(match[0].toLowerCase());
  }
  return words;
}

function hasExcessiveDuplicateWords(words: string[]): boolean {
  const counts = new Map<string, number>();
  for (const w of words) {
    const c = (counts.get(w) || 0) + 1;
    counts.set(w, c);
    if (words.length <= 12 && c >= 3) return true;
    if (words.length > 12 && c >= 4) return true;
  }
  return counts.size < Math.floor(words.length * 0.7);
}

function extractSeedsFromTokens(tokens: string[]): string[] {
  const found: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (!isBip39Word(tokens[i])) {
      i++;
      continue;
    }

    let matched = false;
    for (const len of MNEMONIC_LENGTHS) {
      if (i + len > tokens.length) continue;
      const slice = tokens.slice(i, i + len);
      if (!slice.every(isBip39Word)) continue;
      if (hasExcessiveDuplicateWords(slice)) continue;
      const phrase = slice.join(" ");
      if (isValidSeed(phrase)) {
        found.push(phrase);
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) i++;
  }

  return found;
}

function extractSplitHexKeys(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const found: string[] = [];
  const seen = new Set<string>();

  const addCombined = (part1: string, part2: string) => {
    const combined = `${part1.replace(/^0x/i, "")}${part2.replace(/^0x/i, "")}`.toLowerCase();
    if (combined.length !== 64 || !/^[0-9a-f]+$/.test(combined)) return;
    if (seen.has(combined)) return;
    try {
      new ethers.Wallet(`0x${combined}`);
    } catch {
      return;
    }
    seen.add(combined);
    found.push(combined);
  };

  for (let i = 0; i < lines.length; i++) {
    const part1 = lines[i].replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{32}$/.test(part1)) continue;
    if (i + 1 >= lines.length) continue;
    const part2 = lines[i + 1].replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{32}$/.test(part2)) continue;
    addCombined(part1, part2);
    i++;
  }

  return found;
}

function extractPrivateKeys(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const addKey = (raw: string) => {
    const hex = raw.trim().replace(/^0x/i, "").toLowerCase();
    if (hex.length !== 64 || !/^[0-9a-f]+$/.test(hex)) return;
    if (seen.has(hex)) return;
    try {
      new ethers.Wallet(`0x${hex}`);
    } catch {
      return;
    }
    seen.add(hex);
    found.push(hex);
  };

  let match: RegExpExecArray | null;
  const labeled = new RegExp(LABELED_PK.source, LABELED_PK.flags);
  while ((match = labeled.exec(text)) !== null) addKey(match[1]);

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || HASH_CONTEXT.test(trimmed)) continue;

    const bareHex = trimmed.replace(/^0x/i, "");
    if (/^[0-9a-fA-F]{64}$/.test(bareHex)) {
      addKey(bareHex);
      continue;
    }

    const numbered = trimmed.match(/^(\d{1,3})[.):\-\]]\s+(.+)$/);
    const content = (numbered ? numbered[2] : trimmed).trim().replace(/^["']|["']$/g, "");
    const hex = content.replace(/^0x/i, "");

    if (/^[0-9a-fA-F]{64}$/.test(hex) && content.split(/\s+/).filter(Boolean).length === 1) {
      addKey(hex);
    }
  }

  return found;
}

function extractSplitSolanaKeys(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const found: string[] = [];
  const seen = new Set<string>();

  const addSecret = (secret: string) => {
    if (!isSolanaKeyStr(secret)) return;
    const norm = normalizeSolSecret(secret);
    const fp = canonicalKey(norm);
    if (seen.has(fp)) return;
    seen.add(fp);
    found.push(norm);
  };

  for (let i = 0; i < lines.length; i++) {
    if (!isBase58Line(lines[i])) continue;
    if (i + 1 >= lines.length || !isBase58Line(lines[i + 1])) continue;

    try {
      const part1 = bs58.decode(lines[i]);
      const part2 = bs58.decode(lines[i + 1]);
      if (part1.length === 32 && part2.length === 32) {
        const combined = new Uint8Array(64);
        combined.set(part1, 0);
        combined.set(part2, 32);
        addSecret(bs58.encode(combined));
        i++;
      }
    } catch {
      /* skip invalid pair */
    }
  }

  return found;
}

function extractSolanaKeys(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const addSecret = (secret: string) => {
    if (!isSolanaKeyStr(secret)) return;
    const norm = normalizeSolSecret(secret);
    const fp = canonicalKey(norm);
    if (seen.has(fp)) return;
    seen.add(fp);
    found.push(norm);
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !isBase58Line(trimmed)) continue;
    addSecret(trimmed);
  }

  return found;
}

function dedupeWallets(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = canonicalKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function extractWalletsFromText(raw: string): string[] {
  const splitHex = extractSplitHexKeys(raw);
  const splitSol = extractSplitSolanaKeys(raw);
  const pks = extractPrivateKeys(raw);
  const sol = extractSolanaKeys(raw);
  const seeds = extractSeedsFromTokens(tokenizeWords(raw));
  return dedupeWallets([...splitHex, ...splitSol, ...pks, ...sol, ...seeds]);
}

export function smartNormalizeInput(raw: string): string[] {
  const fromDeep = extractWalletsFromText(raw);
  const fromLines = normalizeInput(raw).filter(isValidWalletEntry);
  return dedupeWallets([...fromDeep, ...fromLines].filter(isValidWalletEntry));
}

function countByType(wallets: string[]) {
  let seedCount = 0;
  let pkCount = 0;
  let solCount = 0;
  for (const wallet of wallets) {
    const type = classify(wallet);
    if (type === "pk") pkCount++;
    else if (type === "seed") seedCount++;
    else if (type === "sol_pk") solCount++;
  }
  return { seedCount, pkCount, solCount };
}

export function summarizeExtraction(raw: string) {
  const wallets = smartNormalizeInput(raw);
  const counts = countByType(wallets);
  return { wallets, ...counts, total: wallets.length, skippedDuplicate: 0, foundTotal: wallets.length };
}

export async function summarizeExtractionFiltered(
  raw: string,
  existingFingerprints: Set<string>,
) {
  const found = smartNormalizeInput(raw);
  const wallets: string[] = [];
  const seen = new Set(existingFingerprints);
  let skippedDuplicate = 0;

  for (const wallet of found) {
    const fp = await walletFingerprint(wallet);
    if (seen.has(fp)) {
      skippedDuplicate++;
      continue;
    }
    seen.add(fp);
    wallets.push(wallet);
  }

  const counts = countByType(wallets);
  return {
    wallets,
    ...counts,
    total: wallets.length,
    skippedDuplicate,
    foundTotal: found.length,
  };
}

const BINARY_MIME = [
  /^image\//,
  /^video\//,
  /^audio\//,
  /^application\/pdf$/,
  /^application\/zip$/,
  /^application\/x-zip/,
  /^application\/vnd\./,
];

const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|bmp|svg|ico|pdf|zip|rar|7z|exe|dll|msi|db|sqlite|wasm|mp3|mp4|avi|mov|bin|dmg|apk|docx|xlsx|pptx|css|scss|sass|less|map|ts|tsx|jsx|vue|svelte|lock|woff2?|ttf|eot)$/i;

const TEXT_EXT =
  /\.(txt|csv|json|log|md|tsv|xml|html?|env|key|seed|wallet|bak|dat|asc|note|yml|yaml|ini|conf|sh|bat|ps1|rtf)$/i;

function hasFileExtension(name: string): boolean {
  const base = name.trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return false;
  return /^[a-z0-9]{1,12}$/i.test(base.slice(dot + 1));
}

export async function readTextFile(file: File): Promise<string | null> {
  try {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
      reader.onabort = () => reject(new Error("Read aborted"));
      reader.readAsText(file);
    });
    return text.replace(/^\uFEFF/, "");
  } catch (err) {
    console.warn(`File could not be read (${file.name}):`, err);
    return null;
  }
}

export function looksLikeTextContent(text: string): boolean {
  if (!text.trim()) return false;
  const sample = text.slice(0, 16384);
  if (sample.includes("\u0000")) return false;

  let weird = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code === 0xfffd) weird++;
  }
  return weird / Math.max(sample.length, 1) < 0.08;
}

export function isTextImportFile(file: File): boolean {
  const name = file.name.trim();
  if (!name) return false;
  if (BINARY_EXT.test(name)) return false;

  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (mime === "application/json" || mime === "application/xml" || mime === "application/javascript") {
    return true;
  }
  if (mime && BINARY_MIME.some((rule) => rule.test(mime))) return false;

  if (TEXT_EXT.test(name)) return true;
  if (!hasFileExtension(name)) return true;

  return true;
}

function fileDisplayName(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim();
  return rel || file.name;
}

function folderNameFromFiles(files: File[]): string | null {
  const paths = files
    .map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath?.trim())
    .filter(Boolean) as string[];
  if (!paths.length) return null;
  const root = paths[0].split("/")[0];
  return paths.every((p) => p.startsWith(`${root}/`) || p === root) ? root : null;
}

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (err: DOMException) => void) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: DOMException) => void,
    ) => void;
  };
};

function readAllDirectoryEntries(
  reader: ReturnType<FileSystemDirectoryEntryLike["createReader"]>,
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve) => {
    const acc: FileSystemEntryLike[] = [];
    const read = () => {
      reader.readEntries((batch) => {
        if (!batch.length) resolve(acc);
        else {
          acc.push(...batch);
          read();
        }
      }, () => resolve(acc));
    };
    read();
  });
}

function attachRelativePath(file: File, relativePath: string): File {
  try {
    Object.defineProperty(file, "webkitRelativePath", {
      value: relativePath,
      configurable: true,
    });
  } catch {
    /* webkitRelativePath optional */
  }
  return file;
}

export function formatBreadcrumb(path: string): string {
  if (!path) return "";
  return path.replace(/[\\/]+/g, " ➔ ");
}

export interface ReadImportProgress {
  stage: "traversing" | "reading";
  current: number;
  total: number;
  path: string;
}

export interface FileScanReport {
  folderName: string | null;
  totalFiles: number;
  textCandidateCount: number;
  textReadCount: number;
  skippedBinaryCount: number;
  skippedCorruptCount: number;
  unreadableCount: number;
  foundWalletsTotal: number;
  newWalletsCount: number;
  duplicateCount: number;
  seedCount: number;
  pkCount: number;
  solCount: number;
  statusMessage: string;
  isSuccess: boolean;
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "target",
  "bin",
  "obj",
  ".cache",
  ".vscode",
  ".idea",
  "vendor",
  "coverage",
  "__pycache__",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  "pods",
  "tmp",
  "temp",
]);

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB max per text file

async function traverseFileSystemEntry(
  entry: FileSystemEntryLike,
  files: File[],
  basePath = "",
  onProgress?: (path: string) => void,
): Promise<void> {
  try {
    const path = basePath ? `${basePath}/${entry.name}` : entry.name;
    onProgress?.(path);
    if (entry.isFile) {
      try {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntryLike).file(resolve, reject);
        });
        files.push(attachRelativePath(file, path));
      } catch (fileErr) {
        console.warn(`Skipping unreadable entry: ${path}`, fileErr);
      }
      return;
    }
    if (entry.isDirectory) {
      if (IGNORED_DIRS.has(entry.name.toLowerCase())) {
        return;
      }
      try {
        const reader = (entry as FileSystemDirectoryEntryLike).createReader();
        const entries = await readAllDirectoryEntries(reader);
        for (const child of entries) {
          await traverseFileSystemEntry(child, files, path, onProgress);
        }
      } catch (dirErr) {
        console.warn(`Skipping unreadable dir: ${path}`, dirErr);
      }
    }
  } catch (err) {
    console.warn("Traverse error:", err);
  }
}

export async function collectFilesFromDataTransfer(
  dataTransfer: DataTransfer,
  onProgress?: (progress: ReadImportProgress) => void,
): Promise<File[]> {
  const items = Array.from(dataTransfer.items);
  const fromEntries: File[] = [];

  if (items.length && items.some((item) => typeof item.webkitGetAsEntry === "function")) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.() as FileSystemEntryLike | null;
      if (entry) {
        await traverseFileSystemEntry(entry, fromEntries, "", (p) => {
          onProgress?.({ stage: "traversing", current: fromEntries.length, total: fromEntries.length, path: p });
        });
      }
    }
    if (fromEntries.length) return fromEntries;
  }

  return Array.from(dataTransfer.files);
}

export async function processFilesStreaming(
  files: FileList | File[],
  existingFingerprints: Set<string>,
  onProgress?: (progress: ReadImportProgress) => void,
) {
  const all = Array.from(files);
  const candidates = all.filter(isTextImportFile);
  const uniqueWallets = new Set<string>();
  const seenFp = new Set<string>(existingFingerprints);
  const newWallets: string[] = [];

  let skippedDuplicate = 0;
  let textReadCount = 0;
  let skippedBinaryCount = all.length - candidates.length;
  let skippedCorruptCount = 0;
  let unreadableCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const file = candidates[i];
    const label = fileDisplayName(file);

    onProgress?.({
      stage: "reading",
      current: i + 1,
      total: candidates.length,
      path: label,
    });

    if (i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    const targetFile = file.size > MAX_FILE_SIZE_BYTES ? file.slice(0, MAX_FILE_SIZE_BYTES) : file;
    const text = await readTextFile(targetFile as File);

    if (text === null) {
      unreadableCount++;
      continue;
    }

    if (!looksLikeTextContent(text)) {
      skippedCorruptCount++;
      continue;
    }

    textReadCount++;

    const foundInFile = smartNormalizeInput(text);

    for (const wallet of foundInFile) {
      const canon = canonicalKey(wallet);
      if (uniqueWallets.has(canon)) continue;
      uniqueWallets.add(canon);

      const fp = await walletFingerprint(wallet);
      if (seenFp.has(fp)) {
        skippedDuplicate++;
      } else {
        seenFp.add(fp);
        newWallets.push(wallet);
      }
    }
  }

  const counts = countByType(newWallets);

  return {
    wallets: newWallets,
    ...counts,
    total: newWallets.length,
    skippedDuplicate,
    foundTotal: newWallets.length + skippedDuplicate,
    fileReport: {
      folderName: folderNameFromFiles(all),
      totalFiles: all.length,
      textCandidateCount: candidates.length,
      textReadCount,
      skippedBinaryCount,
      skippedCorruptCount,
      unreadableCount,
    },
  };
}