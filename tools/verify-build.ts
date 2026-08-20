import "./loadEnv";
import fs from "fs";
import path from "path";
import { parse } from "node-html-parser";
import { FirebaseContentClient, resolveActiveDraftId } from "../src/libs/content/firebaseClient";

const DIST_DIR = path.resolve("dist");
const ASSET_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".pdf"];
const CONFIG_FILE = path.resolve("verify-exceptions.json");

const toSlash = (p: string) => p.replace(/\\/g, "/");

interface Exceptions {
  ignoredLinks: Array<{ source: string, target: string }>;
  ignoredAssets: string[];
}

interface LinkInfo {
  source: string;
  target: string;
  type: "a" | "img" | "script" | "link" | "meta" | "source";
}

function matchesPattern(value: string, pattern: string): boolean {
  if (pattern.startsWith("regex:")) {
    try {
      let regexStr = pattern.slice("regex:".length);
      if (!regexStr.startsWith("^") && !regexStr.endsWith("$")) {
        regexStr = `^${regexStr}$`;
      }
      const regex = new RegExp(regexStr, "i");
      return regex.test(value);
    } catch {
      return false;
    }
  }
  return value.toLowerCase() === pattern.toLowerCase();
}

function loadExceptions(): Exceptions {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      return {
        ignoredLinks: (data.ignoredLinks || []).map((l: any) => 
          typeof l === "string" 
            ? { source: "*", target: l } 
            : { source: l.source, target: l.target }
        ),
        ignoredAssets: (data.ignoredAssets || []).map((a: string) => a)
      };
    } catch (e) {
      console.warn(`⚠️ Failed to parse ${CONFIG_FILE}, ignoring.`);
    }
  }
  return { ignoredLinks: [], ignoredAssets: [] };
}

function saveExceptions(exceptions: Exceptions) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(exceptions, null, 2));
  console.log(`✅ Updated ${CONFIG_FILE} with current findings.`);
}

async function* walk(dir: string): AsyncGenerator<string> {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const res = path.join(dir, file.name);
    if (file.isDirectory()) {
      yield* walk(res);
    } else {
      yield res;
    }
  }
}

function isInternal(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) return false;
  if (url.startsWith("mailto:") || url.startsWith("tel:")) return false;
  if (url.startsWith("#")) return false; 
  if (url.startsWith("javascript:")) return false;
  if (url.startsWith("data:")) return false; // Ignore base64 images
  return true;
}

function extractFirebaseStorageRelativePath(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  if (url.includes("firebasestorage.googleapis.com")) {
    try {
      const match = url.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    } catch {}
  }
  return null;
}

/**
 * Resolves a target link to a file inside DIST_DIR in a case-insensitive manner.
 */
function resolveDistFile(
  sourceFile: string,
  target: string,
  distFilesMap: Map<string, string>
): { exists: boolean; actualRelPath?: string } {
  let cleanTarget = target.split("#")[0].split("?")[0];
  try {
    cleanTarget = decodeURIComponent(cleanTarget);
  } catch {}

  let targetRel: string;
  if (cleanTarget.startsWith("/")) {
    targetRel = cleanTarget.replace(/^\/+/, "");
  } else {
    const sourceDir = path.dirname(path.relative(DIST_DIR, sourceFile));
    targetRel = path.join(sourceDir, cleanTarget);
  }
  targetRel = toSlash(path.normalize(targetRel));

  // 1. Direct match (case-insensitive)
  const directMatch = distFilesMap.get(targetRel.toLowerCase());
  if (directMatch) {
    return { exists: true, actualRelPath: directMatch };
  }

  // 2. Directory match -> check for index.html (e.g. "zh/about" -> "zh/about/index.html")
  const indexTarget = toSlash(path.join(targetRel, "index.html")).toLowerCase();
  const indexMatch = distFilesMap.get(indexTarget);
  if (indexMatch) {
    return { exists: true, actualRelPath: indexMatch };
  }

  return { exists: false };
}

async function verify() {
  const args = process.argv.slice(2);
  const updateExceptions = args.includes("--update-exceptions");
  const exceptions = loadExceptions();

  console.log("🚀 Starting build verification (case-insensitive path matching enabled)...");
  if (updateExceptions) console.log("📝 Update mode: findings will be saved to exceptions list.");

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ ${DIST_DIR} directory not found. Please run 'npm run build' first.`);
    process.exit(1);
  }

  // 1. Enforce Maximum 4 News Articles Constraint
  const client = new FirebaseContentClient({
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "cwts-cms",
    draftId: resolveActiveDraftId(),
  });

  try {
    const allNews = await client.getCollection("news");
    if (allNews.length > 4) {
      console.error(
        `\n💥 [VERIFY FAILED] Found ${allNews.length} active news articles (maximum allowed is 4).\n` +
        `   The homepage only displays the 4 latest news articles.\n` +
        `   Older news articles must be soft-deleted in the Admin CMS (/admin/news) or removed from content/news/.\n` +
        `   Active articles found:\n` +
        allNews.map((n, i) => `     ${i + 1}. "${n.data?.title || n.id}" (ID: ${n.id})`).join("\n") +
        `\n`
      );
      process.exit(1);
    }
  } catch (err: any) {
    console.warn("⚠️ Could not verify news collection limit:", err.message || err);
  }

  const htmlFiles: string[] = [];
  const cssFiles: string[] = [];
  const allImages = new Set<string>();
  const distFilesMap = new Map<string, string>(); // lowercase relative path -> actual disk relative path
  const referencedAssets = new Set<string>();
  const brokenLinks: LinkInfo[] = [];

  // 1. Collect all files and build case-insensitive dist lookup map
  for await (const file of walk(DIST_DIR)) {
    const relPath = toSlash(path.relative(DIST_DIR, file));
    distFilesMap.set(relPath.toLowerCase(), relPath);

    if (file.endsWith(".html")) {
      htmlFiles.push(file);
    } else if (file.endsWith(".css")) {
      cssFiles.push(file);
    }
    
    const ext = path.extname(file).toLowerCase();
    if (ASSET_EXTENSIONS.includes(ext)) {
      allImages.add(relPath);
    }
  }

  console.log(`🔍 Found ${htmlFiles.length} HTML files, ${cssFiles.length} CSS files, and ${allImages.size} assets.`);

  const checkLink = (sourceFile: string, target: string, type: LinkInfo["type"]) => {
    if (!target) return;

    // Check if target is a Firebase Storage URL referencing our synced assets
    const fbStoragePath = extractFirebaseStorageRelativePath(target);
    if (fbStoragePath) {
      const match = distFilesMap.get(toSlash(fbStoragePath).toLowerCase());
      if (match) {
        referencedAssets.add(match.toLowerCase());
      }
      return;
    }

    if (!isInternal(target)) return;

    const isExternalResource = target.startsWith("http://") || target.startsWith("https://");
    const relSource = toSlash(path.relative(DIST_DIR, sourceFile));

    if (!isExternalResource) {
      const resolved = resolveDistFile(sourceFile, target, distFilesMap);
      if (resolved.exists && resolved.actualRelPath) {
        referencedAssets.add(resolved.actualRelPath.toLowerCase());
      } else {
        brokenLinks.push({ source: relSource, target: toSlash(target), type });
      }
    }
  };

  // 2. Parse HTML files
  for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(htmlFile, "utf-8");
    const root = parse(content);

    // Extract links
    root.querySelectorAll("a").forEach(el => checkLink(htmlFile, el.getAttribute("href") || "", "a"));
    root.querySelectorAll("img").forEach(el => {
      checkLink(htmlFile, el.getAttribute("src") || "", "img");
      const srcset = el.getAttribute("srcset");
      if (srcset) {
        srcset.split(",").forEach(s => {
          const url = s.trim().split(" ")[0];
          checkLink(htmlFile, url, "img");
        });
      }
    });
    root.querySelectorAll("link").forEach(el => checkLink(htmlFile, el.getAttribute("href") || "", "link"));
    root.querySelectorAll("script").forEach(el => checkLink(htmlFile, el.getAttribute("src") || "", "script"));
    root.querySelectorAll("source").forEach(el => {
      checkLink(htmlFile, el.getAttribute("src") || "", "source");
      const srcset = el.getAttribute("srcset");
      if (srcset) {
        srcset.split(",").forEach(s => {
          const url = s.trim().split(" ")[0];
          checkLink(htmlFile, url, "source");
        });
      }
    });
    root.querySelectorAll("meta").forEach(el => {
      const property = el.getAttribute("property") || el.getAttribute("name");
      if (property?.includes("image")) {
        checkLink(htmlFile, el.getAttribute("content") || "", "meta");
      }
    });
  }

  // 3. Parse CSS files
  const urlRegex = /url\(['"]?([^'"\)]+)['"]?\)/g;
  for (const cssFile of cssFiles) {
    const content = fs.readFileSync(cssFile, "utf-8");
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      const target = match[1];
      checkLink(cssFile, target, "link");
    }
  }

  // 4. Filter findings based on exceptions
  const filteredBrokenLinks = brokenLinks.filter(link => 
    !exceptions.ignoredLinks.some(e => 
      (e.source === "*" || matchesPattern(link.source, e.source)) && 
      (e.target === "*" || matchesPattern(link.target, e.target))
    )
  );
  const unusedImages = Array.from(allImages).filter(img => !referencedAssets.has(img.toLowerCase()));
  const filteredUnusedImages = unusedImages.filter(img => 
    !exceptions.ignoredAssets.some(pattern => matchesPattern(img, pattern))
  );

  if (updateExceptions) {
    const linkKeys = new Set<string>();
    const uniqueLinks: Array<{ source: string, target: string }> = [];
    
    // Preserve existing ignored links
    for (const e of exceptions.ignoredLinks) {
      const key = `${e.source}|${e.target}`;
      if (!linkKeys.has(key)) {
        linkKeys.add(key);
        uniqueLinks.push({ source: e.source, target: e.target });
      }
    }

    // Add newly found unignored broken links
    for (const l of filteredBrokenLinks) {
      const key = `${l.source}|${l.target}`;
      if (!linkKeys.has(key)) {
        linkKeys.add(key);
        uniqueLinks.push({ source: l.source, target: l.target });
      }
    }

    // Preserve existing ignored assets (including regex patterns) and add new unignored assets
    const assetSet = new Set<string>(exceptions.ignoredAssets);
    for (const img of filteredUnusedImages) {
      assetSet.add(img);
    }

    const newExceptions: Exceptions = {
      ignoredLinks: uniqueLinks.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
      ignoredAssets: Array.from(assetSet).sort()
    };
    saveExceptions(newExceptions);
    process.exit(0);
  }

  // 5. Report Results
  console.log("\n--- Build Integrity Report ---");

  if (filteredBrokenLinks.length > 0) {
    console.error(`❌ Found ${filteredBrokenLinks.length} broken internal links (after exceptions):`);
    const grouped = filteredBrokenLinks.reduce((acc, link) => {
      if (!acc[link.source]) acc[link.source] = [];
      acc[link.source].push(`${link.type.toUpperCase()}: ${link.target}`);
      return acc;
    }, {} as Record<string, string[]>);

    for (const [source, targets] of Object.entries(grouped)) {
      console.error(`  📄 ${source}`);
      targets.forEach(t => console.error(`    🔴 ${t}`));
    }
  } else {
    console.log("✅ No broken internal links found.");
  }

  if (filteredUnusedImages.length > 0) {
    console.warn(`\n⚠️ Found ${filteredUnusedImages.length} unreferenced assets in dist (after exceptions):`);
    filteredUnusedImages.slice(0, 20).forEach(img => {
      console.warn(`  ⚪ ${img}`);
    });
    if (filteredUnusedImages.length > 20) {
      console.warn(`  ... and ${filteredUnusedImages.length - 20} more.`);
    }
  } else {
    console.log("✅ All assets in dist are referenced (or ignored).");
  }

  const ignoredCount = (brokenLinks.length - filteredBrokenLinks.length) + (unusedImages.length - filteredUnusedImages.length);
  if (ignoredCount > 0) {
    console.log(`\nℹ️  Ignored ${ignoredCount} findings based on ${CONFIG_FILE}.`);
  }

  if (filteredBrokenLinks.length > 0 || filteredUnusedImages.length > 0) {
    const configName = path.basename(CONFIG_FILE);
    console.error("\n" + "=".repeat(60));
    console.error("❌ BUILD INTEGRITY VERIFICATION FAILED");
    console.error("=".repeat(60));
    console.error("\nHow to verify and resolve:");
    console.error("  1. Check and fix broken links or missing assets in source files.");
    console.error("  2. If the findings are intentional, add exceptions:");
    console.error(`     • Automatically add current findings to ${configName}:`);
    console.error("       $ npm run verify-build:update");
    console.error(`     • Or manually add exceptions or regular expressions (prefixed with 'regex:') to ${configName}:`);
    console.error("       Example in ignoredAssets (regex supported):");
    console.error('         "regex:_astro/newsletter-.*\\.pdf"');
    console.error("       Example in ignoredLinks:");
    console.error('         { "source": "*", "target": "/en/about/president-message/" }');
    console.error("  3. Re-run verification:");
    console.error("       $ npm run verify-build");
    console.error("=".repeat(60) + "\n");
    process.exit(1);
  }
}

verify().catch(err => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
