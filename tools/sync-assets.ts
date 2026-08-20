import "./loadEnv";
import fs from "fs";
import path from "path";
import { ref, getMetadata, getBytes } from "firebase/storage";
import { terminate } from "firebase/firestore";
import { storage, db } from "../src/admin/config/firebase";
import { FirebaseContentClient, resolveActiveDraftId } from "../src/libs/content/firebaseClient";

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
 * Normalizes a raw URL or path into a canonical relative storage path (e.g. images/... or docs/...).
 */
function normalizeStoragePath(rawUrlOrPath: string): string | null {
  if (!rawUrlOrPath || typeof rawUrlOrPath !== "string") return null;

  const trimmed = rawUrlOrPath.trim();

  // 1. Direct site-relative paths e.g. /images/... or /docs/...
  if (trimmed.startsWith("/images/") || trimmed.startsWith("/docs/")) {
    return trimmed.replace(/^\/+/, "");
  }

  // 2. Relative paths without leading slash e.g. images/... or docs/...
  if (trimmed.startsWith("images/") || trimmed.startsWith("docs/")) {
    return trimmed;
  }

  // 3. Firebase Storage URLs
  if (trimmed.includes("firebasestorage.googleapis.com")) {
    try {
      const match = trimmed.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.startsWith("images/") || decoded.startsWith("docs/")) {
          return decoded;
        }
      }
    } catch {}
  }

  return null;
}

function scanTextForStoragePaths(text: string, outputSet: Set<string>) {
  if (!text) return;
  // Match markdown images: ![...](/images/...)
  const mdMatches = text.matchAll(/!\[.*?\]\(([^)]+)\)/g);
  for (const m of mdMatches) {
    const sp = normalizeStoragePath(m[1]);
    if (sp) outputSet.add(sp);
  }

  // Match HTML src and href
  const htmlMatches = text.matchAll(/(?:src|href)=["']([^"']+)["']/g);
  for (const m of htmlMatches) {
    const sp = normalizeStoragePath(m[1]);
    if (sp) outputSet.add(sp);
  }

  // Match frontmatter fields: thumbnail: ..., file: ..., photo: ..., coverImage: ...
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(?:thumbnail|file|photo|coverImage)\s*:\s*["']?([^"'\r\n]+)["']?/);
    if (match && match[1]) {
      const sp = normalizeStoragePath(match[1]);
      if (sp) outputSet.add(sp);
    }
  }
}

/**
 * Discovers referenced media assets directly using the FirebaseContentClient API.
 * This guarantees 100% parity between what Astro renders and what sync-assets downloads.
 */
async function collectReferencedMediaAssets(): Promise<Set<string>> {
  const referenced = new Set<string>();

  const activeDraftId = resolveActiveDraftId();
  if (activeDraftId) {
    console.log(`✨ [Sync Assets] Draft overlay ACTIVE: '${activeDraftId}' (Syncing draft media references)`);
  } else {
    console.log(`🚀 [Sync Assets] Production build: syncing published canonical media references`);
  }

  const client = new FirebaseContentClient({
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "cwts-cms",
    draftId: activeDraftId,
  });

  try {
    // 1. Query news collection and enforce maximum 4 news articles rule
    const allNews = await client.getCollection("news");
    if (allNews.length > 4) {
      console.error(
        `\n💥 [NEWS LIMIT EXCEEDED] Found ${allNews.length} active news articles (maximum allowed is 4).\n` +
        `   The homepage only displays the 4 latest news articles.\n` +
        `   Older news articles must be soft-deleted in the Admin CMS (/admin/news) or removed from content/news/.\n` +
        `   Active articles found:\n` +
        allNews.map((n, i) => `     ${i + 1}. "${n.data?.title || n.id}" (ID: ${n.id})`).join("\n") +
        `\n`
      );
      throw new Error(
        `News collection limit exceeded: found ${allNews.length} articles (max 4). ` +
        `The homepage only displays 4 news articles; older ones should be deleted.`
      );
    }

    console.log(`📰 Loaded ${allNews.length} active news entries from Firebase content client.`);
    for (const entry of allNews) {
      if (entry.data?.referencedAssets && Array.isArray(entry.data.referencedAssets)) {
        for (const assetPath of entry.data.referencedAssets) {
          const sp = normalizeStoragePath(assetPath);
          if (sp) referenced.add(sp);
        }
      } else {
        if (entry.data?.thumbnail) {
          const sp = normalizeStoragePath(entry.data.thumbnail);
          if (sp) referenced.add(sp);
        }
        if (entry.body) {
          scanTextForStoragePaths(entry.body, referenced);
        }
      }
    }

    // 2. Query jobs collection using content client
    const jobEntries = await client.getCollection("jobs");
    console.log(`💼 Loaded ${jobEntries.length} job entries from Firebase content client.`);
    for (const entry of jobEntries) {
      if (entry.data?.referencedAssets && Array.isArray(entry.data.referencedAssets)) {
        for (const assetPath of entry.data.referencedAssets) {
          const sp = normalizeStoragePath(assetPath);
          if (sp) referenced.add(sp);
        }
      } else {
        if (entry.data?.file) {
          const sp = normalizeStoragePath(entry.data.file);
          if (sp) referenced.add(sp);
        }
        if (entry.body) {
          scanTextForStoragePaths(entry.body, referenced);
        }
      }
    }
  } catch (err: any) {
    console.error("❌ Error querying collections via Firebase content client:", err.message || err);
    throw err;
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
  const referencedPaths = await collectReferencedMediaAssets();

  console.log(`📋 Found ${referencedPaths.size} referenced media assets:`);
  for (const p of referencedPaths) {
    console.log(`   - ${p}`);
  }

  const isDummyMode =
    process.env.DUMMY_ASSETS === "true" ||
    process.env.SYNC_ASSETS_MODE === "dummy" ||
    process.env.MOCK_ASSETS === "true";

  if (isDummyMode) {
    console.log(
      `⚡ [Dummy Assets Mode] Creating placeholder files for ${referencedPaths.size} referenced assets (0 network egress / 0 storage downloads)...`
    );
    let createdCount = 0;
    for (const storagePath of referencedPaths) {
      const distPath = path.join(DIST_DIR, storagePath);
      if (!fs.existsSync(distPath)) {
        ensureDirectoryExistence(distPath);
        fs.writeFileSync(distPath, "");
        createdCount++;
      }
    }
    // Gracefully terminate Firestore connection channel
    await terminate(db).catch(() => {});
    console.log(
      `✅ [Dummy Assets Mode] Successfully ensured ${referencedPaths.size} placeholder assets in dist/ (${createdCount} created, 0 downloads).\n`
    );
    return;
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
