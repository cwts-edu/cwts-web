import "../../tools/loadEnv";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AstroIntegration } from "astro";
import { ref, getMetadata, getBytes } from "firebase/storage";
import { terminate } from "firebase/firestore";
import { storage, db } from "../admin/config/firebase";
import { FirebaseContentClient, resolveActiveDraftId } from "../libs/content/firebaseClient";
import { downloadMediaAsset } from "../admin/services/storageService";

// --- Cache & Storage Constants ---

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
const PUBLIC_DIR = path.resolve("public");

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
    // 1. Query news collection
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

    // 2. Query jobs collection
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

    // 3. Query faculty collection
    const facultyEntries = await client.getCollection("faculty");
    console.log(`🎓 Loaded ${facultyEntries.length} faculty entries from Firebase content client.`);
    for (const entry of facultyEntries) {
      if (entry.data?.referencedAssets && Array.isArray(entry.data.referencedAssets)) {
        for (const assetPath of entry.data.referencedAssets) {
          const sp = normalizeStoragePath(assetPath);
          if (sp) referenced.add(sp);
        }
      } else {
        if (entry.data?.photo) {
          const sp = normalizeStoragePath(entry.data.photo);
          if (sp) referenced.add(sp);
        }
        if (entry.body) {
          scanTextForStoragePaths(entry.body, referenced);
        }
        if (entry.html) {
          scanTextForStoragePaths(entry.html, referenced);
        }
      }
    }

    // 4. Query carousel collection
    try {
      const carouselEntries = await client.getCollection("carousel");
      console.log(`🎠 Loaded ${carouselEntries.length} carousel entries from Firebase content client.`);
      for (const entry of carouselEntries) {
        if (entry.data?.referencedAssets && Array.isArray(entry.data.referencedAssets)) {
          for (const assetPath of entry.data.referencedAssets) {
            const sp = normalizeStoragePath(assetPath);
            if (sp) referenced.add(sp);
          }
        } else if (entry.data?.image) {
          const sp = normalizeStoragePath(entry.data.image);
          if (sp) referenced.add(sp);
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not query carousel entries during asset sync:", e);
    }

    // 5. Query degrees-programs collection
    try {
      const degreeEntries = await client.getCollection("degrees-programs");
      console.log(`🎓 Loaded ${degreeEntries.length} degree entries from Firebase content client.`);
      for (const entry of degreeEntries) {
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
          if (entry.html) {
            scanTextForStoragePaths(entry.html, referenced);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not query degrees-programs entries during asset sync:", e);
    }

    // 6. Query newsletter collection
    try {
      const newsletterEntries = await client.getCollection("newsletter");
      console.log(`📰 Loaded ${newsletterEntries.length} newsletter entries from Firebase content client.`);
      for (const entry of newsletterEntries) {
        if (entry.data?.referencedAssets && Array.isArray(entry.data.referencedAssets)) {
          for (const assetPath of entry.data.referencedAssets) {
            const sp = normalizeStoragePath(assetPath);
            if (sp) referenced.add(sp);
          }
        } else {
          if (entry.data?.pdfPath) {
            const sp = normalizeStoragePath(entry.data.pdfPath);
            if (sp) referenced.add(sp);
          }
          if (entry.data?.coverImage) {
            const sp = normalizeStoragePath(entry.data.coverImage);
            if (sp) referenced.add(sp);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not query newsletter entries during asset sync:", e);
    }

    // 7. Query pages collection
    try {
      const pageEntries = await client.getCollection("pages");
      console.log(`📄 Loaded ${pageEntries.length} page entries from Firebase content client.`);
      for (const entry of pageEntries) {
        if (entry.data?.referencedAssets && Array.isArray(entry.data.referencedAssets)) {
          for (const assetPath of entry.data.referencedAssets) {
            const sp = normalizeStoragePath(assetPath);
            if (sp) referenced.add(sp);
          }
        } else {
          if (entry.data?.coverImage) {
            const sp = normalizeStoragePath(entry.data.coverImage);
            if (sp) referenced.add(sp);
          }
          if (entry.data?.thumbnail) {
            const sp = normalizeStoragePath(entry.data.thumbnail);
            if (sp) referenced.add(sp);
          }
          if (entry.body) {
            scanTextForStoragePaths(entry.body, referenced);
          }
          if (entry.bodyHtml) {
            scanTextForStoragePaths(entry.bodyHtml, referenced);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not query pages entries during asset sync:", e);
    }
  } catch (err: any) {
    console.error("❌ Error querying collections via Firebase content client:", err.message || err);
    throw err;
  }

  return referenced;
}

/**
 * Main Asset Synchronization Pipeline:
 * Strictly syncs referenced media assets from Firebase Storage to dist/.
 */
export async function syncAssets() {
  const bucketName = storage.app.options.storageBucket || "unknown-bucket";
  console.log(`⚡ Starting Firebase Storage Media Sync [Bucket: ${bucketName}]...`);

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
  await terminate(db).catch(() => {});

  console.log("\n📊 Firebase Media Sync Summary:");
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

/**
 * Dev Server Asset Middleware:
 * Serves media assets on-demand during development via storageService with disk caching.
 */
export function createAssetDevMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url?.split("?")[0] || "";
    const cleanPath = decodeURIComponent(rawUrl.replace(/^\/+/, ""));

    // Only intercept paths targeting media assets (e.g. images/... or docs/...)
    if (!cleanPath.startsWith("images/") && !cleanPath.startsWith("docs/")) {
      return next();
    }

    // 1. Local filesystem check: if present in public/, let Vite serve it
    const localPublicPath = path.join(PUBLIC_DIR, cleanPath);
    if (fs.existsSync(localPublicPath)) {
      console.log(`📁 [Dev Asset] Serving from local public/ directory: ${cleanPath}`);
      return next();
    }

    const cachedFilePath = path.join(CACHE_DIR, cleanPath);

    // 2. Cache hit: serve directly from .cache/cwts-assets/
    if (fs.existsSync(cachedFilePath)) {
      console.log(`⚡ [Dev Asset] Serving from persistent disk cache (.cache/cwts-assets/): ${cleanPath}`);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return fs.createReadStream(cachedFilePath).pipe(res);
    }

    // 3. Cache miss: fetch on-demand via Storage Service
    console.log(`☁️ [Dev Asset] Missing locally. Fetching on-demand via StorageService: ${cleanPath}...`);
    try {
      const asset = await downloadMediaAsset(cleanPath);
      if (!asset) {
        console.warn(`⚠️ [Dev Asset] Asset not found in Cloud Storage: ${cleanPath}`);
        return next();
      }

      // Save to disk cache for future dev reloads and production builds
      fs.mkdirSync(path.dirname(cachedFilePath), { recursive: true });
      fs.writeFileSync(cachedFilePath, asset.buffer);

      console.log(`✅ [Dev Asset] Downloaded and cached to .cache/cwts-assets/: ${cleanPath} (${asset.buffer.length} bytes)`);

      res.setHeader("Content-Type", asset.contentType);
      res.setHeader("Content-Length", asset.buffer.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.end(asset.buffer);
    } catch (err: any) {
      console.error(`❌ [Dev Asset] Error downloading asset '${cleanPath}':`, err?.message || err);
      next();
    }
  };
}

/**
 * Astro Integration: syncFirebaseAssetsIntegration
 * Provides development server on-demand asset streaming and build-time asset synchronization.
 */
export function syncFirebaseAssetsIntegration(): AstroIntegration {
  return {
    name: "sync-firebase-assets",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(createAssetDevMiddleware());
      },
      "astro:build:done": async () => {
        await syncAssets();
      },
    },
  };
}

export default syncFirebaseAssetsIntegration;
