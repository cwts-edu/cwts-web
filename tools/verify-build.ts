import fs from "fs";
import path from "path";
import { parse } from "node-html-parser";

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

function loadExceptions(): Exceptions {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      return {
        ignoredLinks: (data.ignoredLinks || []).map((l: any) => 
          typeof l === "string" 
            ? { source: "*", target: toSlash(l) } 
            : { source: toSlash(l.source), target: toSlash(l.target) }
        ),
        ignoredAssets: (data.ignoredAssets || []).map(toSlash)
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

function normalizePath(sourceFile: string, target: string): string {
  const cleanTarget = target.split("#")[0].split("?")[0];
  if (cleanTarget.startsWith("/")) {
    return path.join(DIST_DIR, cleanTarget);
  }
  const dir = path.dirname(sourceFile);
  return path.resolve(dir, cleanTarget);
}

async function verify() {
  const args = process.argv.slice(2);
  const updateExceptions = args.includes("--update-exceptions");
  const exceptions = loadExceptions();

  console.log("🚀 Starting build verification...");
  if (updateExceptions) console.log("📝 Update mode: findings will be saved to exceptions list.");

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ ${DIST_DIR} directory not found. Please run 'npm run build' first.`);
    process.exit(1);
  }

  const htmlFiles: string[] = [];
  const cssFiles: string[] = [];
  const allImages = new Set<string>();
  const referencedAssets = new Set<string>();
  const brokenLinks: LinkInfo[] = [];

  // 1. Collect all files
  for await (const file of walk(DIST_DIR)) {
    if (file.endsWith(".html")) {
      htmlFiles.push(file);
    } else if (file.endsWith(".css")) {
      cssFiles.push(file);
    }
    
    const ext = path.extname(file).toLowerCase();
    if (ASSET_EXTENSIONS.includes(ext)) {
      const relPath = path.relative(DIST_DIR, file);
      allImages.add(toSlash(relPath));
    }
  }

  console.log(`🔍 Found ${htmlFiles.length} HTML files, ${cssFiles.length} CSS files, and ${allImages.size} assets.`);

  const checkLink = (sourceFile: string, target: string, type: LinkInfo["type"]) => {
    if (!isInternal(target)) return;

    const fullPath = normalizePath(sourceFile, target);
    const isExternalResource = target.startsWith("http");
    const relSource = toSlash(path.relative(DIST_DIR, sourceFile));

    if (!isExternalResource) {
      let exists = fs.existsSync(fullPath);
      let finalPath = fullPath;
      
      // If it's a directory link (no extension), check for index.html
      if (!exists && !path.extname(fullPath)) {
        const indexPath = path.join(fullPath, "index.html");
        if (fs.existsSync(indexPath)) {
          exists = true;
          finalPath = indexPath;
        }
      }

      if (exists) {
        const relAsset = path.relative(DIST_DIR, finalPath);
        referencedAssets.add(toSlash(relAsset));
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
    !exceptions.ignoredLinks.some(e => (e.source === "*" || e.source === link.source) && e.target === link.target)
  );
  const unusedImages = Array.from(allImages).filter(img => !referencedAssets.has(img));
  const filteredUnusedImages = unusedImages.filter(img => !exceptions.ignoredAssets.includes(img));

  if (updateExceptions) {
    const linkKeys = new Set<string>();
    const uniqueLinks: Array<{ source: string, target: string }> = [];
    
    for (const l of brokenLinks) {
      const key = `${l.source}|${l.target}`;
      if (!linkKeys.has(key)) {
        linkKeys.add(key);
        uniqueLinks.push({ source: l.source, target: l.target });
      }
    }

    const newExceptions: Exceptions = {
      ignoredLinks: uniqueLinks.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
      ignoredAssets: unusedImages.sort()
    };
    saveExceptions(newExceptions);
    process.exit(0);
  }

  // 4. Report Results
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
    process.exit(1);
  }
}

verify().catch(err => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
