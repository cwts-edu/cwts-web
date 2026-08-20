import "./loadEnv";
import fs from "fs";
import path from "path";
import { ref, getMetadata, getBytes } from "firebase/storage";
import { collection, getDocs, terminate } from "firebase/firestore";
import { storage, db, isFirebaseConfigured } from "../src/admin/config/firebase";

interface ManifestRecord {
  md5?: string;
  size?: number;
  updatedAt?: string;
}

interface Manifest {
  [storagePath: string]: ManifestRecord;
}

const CACHE_DIR = path.resolve(".cache/cwts-assets");
const MANIFEST_PATH = path.join(CACHE_DIR, "manifest.json");
const DIST_DIR = path.resolve("dist");

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

function loadManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveManifest(manifest: Manifest) {
  ensureDirectoryExistence(MANIFEST_PATH);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}

/**
 * Normalizes a raw URL or path into a storage path strictly within images/news/ or docs/jobs/.
 */
function extractNewsOrJobStoragePath(rawUrlOrPath: string): string | null {
  if (!rawUrlOrPath || typeof rawUrlOrPath !== "string") return null;

  const trimmed = rawUrlOrPath.trim();

  // 1. Direct site-relative paths e.g. /images/news/pic.jpg or /docs/jobs/file.pdf
  if (trimmed.startsWith("/images/news/") || trimmed.startsWith("/docs/jobs/")) {
    return trimmed.replace(/^\/+/, "");
  }

  // 2. Relative paths without leading slash e.g. images/news/pic.jpg or docs/jobs/file.pdf
  if (trimmed.startsWith("images/news/") || trimmed.startsWith("docs/jobs/")) {
    return trimmed;
  }

  // 3. Firebase Storage URLs
  if (trimmed.includes("firebasestorage.googleapis.com")) {
    try {
      const match = trimmed.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.startsWith("images/news/") || decoded.startsWith("docs/jobs/")) {
          return decoded;
        }
      }
    } catch {}
  }

  return null;
}

function scanTextForNewsOrJobPaths(text: string, outputSet: Set<string>) {
  if (!text) return;
  // Match markdown images: ![...](/images/news/...)
  const mdMatches = text.matchAll(/!\[.*?\]\(([^)]+)\)/g);
  for (const m of mdMatches) {
    const sp = extractNewsOrJobStoragePath(m[1]);
    if (sp) outputSet.add(sp);
  }

  // Match HTML src and href
  const htmlMatches = text.matchAll(/(?:src|href)=["']([^"']+)["']/g);
  for (const m of htmlMatches) {
    const sp = extractNewsOrJobStoragePath(m[1]);
    if (sp) outputSet.add(sp);
  }

  // Match frontmatter fields: thumbnail: ... or file: ...
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(?:thumbnail|file)\s*:\s*["']?([^"'\r\n]+)["']?/);
    if (match && match[1]) {
      const sp = extractNewsOrJobStoragePath(match[1]);
      if (sp) outputSet.add(sp);
    }
  }
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  if (!fs.existsSync(dir)) return;
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walkFiles(entry);
    else if (d.isFile()) yield entry;
  }
}

/**
 * Scans active news and jobs entries across local content files, Cloud Firestore,
 * and active Draft overlays to discover all referenced news thumbnails and job PDFs.
 */
async function collectReferencedNewsAndJobsAssets(): Promise<Set<string>> {
  const referenced = new Set<string>();

  // 1. Scan local content files for news and jobs
  const contentDirs = [path.resolve("src/content/news"), path.resolve("src/content/jobs")];
  for (const dir of contentDirs) {
    if (!fs.existsSync(dir)) continue;
    for await (const file of walkFiles(dir)) {
      if (file.endsWith(".md") || file.endsWith(".mdx") || file.endsWith(".json")) {
        try {
          const text = await fs.promises.readFile(file, "utf-8");
          scanTextForNewsOrJobPaths(text, referenced);
        } catch (err) {
          console.warn(`Could not read ${file}:`, err);
        }
      }
    }
  }

  // 2. Scan live Firestore canonical collections (news and jobs)
  try {
    const newsSnap = await getDocs(collection(db, "news")).catch((e) => {
      console.warn("Could not query 'news' collection from Firestore:", e.message);
      return null;
    });
    if (newsSnap && !newsSnap.empty) {
      newsSnap.forEach((d) => {
        const data = d.data();
        if (data.status === "deleted") return;
        if (data.thumbnail) {
          const sp = extractNewsOrJobStoragePath(data.thumbnail);
          if (sp) referenced.add(sp);
        }
        if (data.body) scanTextForNewsOrJobPaths(data.body, referenced);
      });
    }

    const jobsSnap = await getDocs(collection(db, "jobs")).catch((e) => {
      console.warn("Could not query 'jobs' collection from Firestore:", e.message);
      return null;
    });
    if (jobsSnap && !jobsSnap.empty) {
      jobsSnap.forEach((d) => {
        const data = d.data();
        if (data.status === "deleted") return;
        if (data.file) {
          const sp = extractNewsOrJobStoragePath(data.file);
          if (sp) referenced.add(sp);
        }
        if (data.body) scanTextForNewsOrJobPaths(data.body, referenced);
      });
    }

    // 3. Scan Draft overlay changes in Firestore (/drafts/{draftId}/changes) when in draft/staging build mode
    const contentSource = process.env.CONTENT_SOURCE;
    const isDraftMode =
      contentSource === "draft" ||
      contentSource === "hybrid" ||
      Boolean(process.env.DRAFT_ID) ||
      process.env.CONTEXT === "deploy-preview" ||
      process.env.CONTEXT === "branch-deploy";

    if (isDraftMode) {
      const activeDraftId = process.env.DRAFT_ID || "main";
      const draftChangesSnap = await getDocs(collection(db, "drafts", activeDraftId, "changes")).catch(() => null);
      if (draftChangesSnap && !draftChangesSnap.empty) {
        console.log(`📝 [Draft Mode] Scanning ${draftChangesSnap.size} draft changes from draft '${activeDraftId}'...`);
        draftChangesSnap.forEach((d) => {
          const change = d.data();
          if (change.action === "delete") return;
          if (change.data) {
            if (change.data.thumbnail) {
              const sp = extractNewsOrJobStoragePath(change.data.thumbnail);
              if (sp) referenced.add(sp);
            }
            if (change.data.file) {
              const sp = extractNewsOrJobStoragePath(change.data.file);
              if (sp) referenced.add(sp);
            }
          }
          if (change.body) scanTextForNewsOrJobPaths(change.body, referenced);
        });
      }
    }
  } catch (err: any) {
    console.warn("⚠️ Warning during Firestore asset reference scanning:", err.message || err);
  }

  return referenced;
}

/**
 * Main Asset Synchronization Pipeline:
 * Strictly syncs referenced news and jobs media from Firebase Storage.
 * Outputs detailed error diagnostics and fails the build if any referenced asset cannot be fetched.
 */
export async function syncAssets() {
  const bucketName = storage.app.options.storageBucket || "unknown-bucket";
  console.log(`⚡ Starting Firebase Storage Media Sync (News & Jobs Only) [Bucket: ${bucketName}]...`);

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const manifest = loadManifest();
  const referencedPaths = await collectReferencedNewsAndJobsAssets();

  console.log(`📋 Found ${referencedPaths.size} referenced news & job media assets:`);
  for (const p of referencedPaths) {
    console.log(`   - ${p}`);
  }

  let downloadedCount = 0;
  let cachedCount = 0;
  const failedAssets: Array<{ path: string; error: string; code?: string }> = [];

  for (const storagePath of referencedPaths) {
    const distPath = path.join(DIST_DIR, storagePath);
    const cachedFilePath = path.join(CACHE_DIR, storagePath);

    try {
      const fileRef = ref(storage, storagePath);

      // Fetch metadata with explicit error diagnostics
      let meta;
      try {
        meta = await getMetadata(fileRef);
      } catch (metaErr: any) {
        console.error(
          `❌ [Firebase Storage] Failed to fetch metadata for '${storagePath}' from bucket '${bucketName}':\n` +
          `   Error Code: ${metaErr.code || "unknown"}\n` +
          `   Error Message: ${metaErr.message || String(metaErr)}`
        );
        failedAssets.push({
          path: storagePath,
          error: metaErr.message || String(metaErr),
          code: metaErr.code,
        });
        continue;
      }

      const cachedEntry = manifest[storagePath];
      const isCacheValid =
        cachedEntry &&
        fs.existsSync(cachedFilePath) &&
        cachedEntry.md5 === meta.md5Hash &&
        cachedEntry.size === meta.size;

      if (isCacheValid) {
        // Cache Hit: Copy directly from local cache with 0 network egress
        ensureDirectoryExistence(distPath);
        fs.copyFileSync(cachedFilePath, distPath);
        cachedCount++;
      } else {
        // Cache Miss / Outdated: Download directly from Firebase Storage
        console.log(`⬇️ Downloading from Firebase Storage: ${storagePath} (${meta.size} bytes)...`);
        const buffer = await getBytes(fileRef);

        ensureDirectoryExistence(cachedFilePath);
        fs.writeFileSync(cachedFilePath, Buffer.from(buffer));

        ensureDirectoryExistence(distPath);
        fs.writeFileSync(distPath, Buffer.from(buffer));

        manifest[storagePath] = {
          md5: meta.md5Hash,
          size: meta.size,
          updatedAt: meta.updated,
        };

        downloadedCount++;
      }
    } catch (err: any) {
      console.error(
        `❌ [Download Error] Failed to download '${storagePath}' from Firebase Storage:\n` +
        `   Error: ${err.message || String(err)}`
      );
      failedAssets.push({
        path: storagePath,
        error: err.message || String(err),
        code: err.code,
      });
    }
  }

  saveManifest(manifest);

  // Gracefully terminate Firestore connection channel so Node event loop has no dangling timers
  await terminate(db).catch(() => {});

  console.log("\n📊 Firebase Media Sync Summary (News & Jobs):");
  console.log(`   - ⚡ Served from cross-build cache (0 network egress): ${cachedCount}`);
  console.log(`   - ⬇️ Downloaded new/updated from Firebase Storage: ${downloadedCount}`);

  if (failedAssets.length > 0) {
    console.error(`\n💥 [BUILD FAILED] ${failedAssets.length} referenced media asset(s) failed to sync from Firebase Storage:`);
    for (const f of failedAssets) {
      console.error(`   ❌ ${f.path} -> ${f.error} (${f.code || "unknown"})`);
    }
    throw new Error(
      `Firebase Storage media sync failed for ${failedAssets.length} referenced asset(s). ` +
      `Ensure Firebase Storage is seeded and PUBLIC_FIREBASE_STORAGE_BUCKET ('${bucketName}') is accessible.`
    );
  }

  console.log("✅ Media sync complete!\n");
}

// Auto-run if executed directly as a script
if (process.argv[1] && process.argv[1].includes("sync-assets")) {
  await syncAssets();
}
