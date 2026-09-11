import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import JSZip from "jszip";
import type { MenuItem } from "../src/libs/content/schemas";

interface MenuDocument {
  id: "zh" | "en";
  language: "zh" | "en";
  items: MenuItem[];
  status: "published";
  version: number;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
}

async function exportMenuPackage() {
  console.log("📦 [Package Generator] Exporting Navigation Menu Package...");

  const baseDir = process.cwd();
  const menuDir = path.join(baseDir, "src/content/menu");
  const outputZipPath = path.join(baseDir, "packages/menu-package.zip");

  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  const zip = new JSZip();
  const documents: MenuDocument[] = [];
  const now = new Date().toISOString();

  const langs: Array<"zh" | "en"> = ["zh", "en"];

  for (const lang of langs) {
    const yamlPath = path.join(menuDir, `${lang}.yml`);
    let items: MenuItem[] = [];

    if (fs.existsSync(yamlPath)) {
      try {
        const rawContent = fs.readFileSync(yamlPath, "utf-8");
        const parsed = yaml.load(rawContent);
        if (Array.isArray(parsed)) {
          items = parsed as MenuItem[];
        }
      } catch (e) {
        console.error(`Error reading ${yamlPath}:`, e);
      }
    } else {
      console.warn(`⚠️ Warning: ${yamlPath} does not exist.`);
    }

    const doc: MenuDocument = {
      id: lang,
      language: lang,
      items,
      status: "published",
      version: 1,
      publishedVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    documents.push(doc);
    console.log(`  ➕ Loaded ${items.length} top-level menu items for [${lang.toUpperCase()}]`);
  }

  // 1. Write manifest.json
  const manifest = {
    format: "cwts-cms-package",
    version: "1.0.0",
    collection: "menu",
    exportedAt: now,
    documentsCount: documents.length,
    assetsCount: 0,
    referencedAssets: [],
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 2. Write documents.json
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  // 3. Generate and save ZIP
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ [Menu] Created ${outputZipPath} (${documents.length} documents, ${(zipBuffer.length / 1024).toFixed(1)} KB)`);
}

exportMenuPackage().catch((err) => {
  console.error("❌ Failed to export menu package:", err);
  process.exit(1);
});
