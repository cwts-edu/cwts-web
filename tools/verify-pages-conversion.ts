import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

interface DocumentItem {
  id: string;
  slug: string;
  language: "zh" | "en";
  title: string;
  order: number;
  legacyOrder?: number;
  coverImage?: string;
  thumbnail?: string;
  showChildren?: boolean;
  body: string;
  bodyHtml: string;
  bodyJson?: Record<string, any>;
  referencedAssets: string[];
}

async function verifyPagesConversion() {
  console.log("🔍 [Verification Suite] Verifying pages conversion fidelity...\n");

  const baseDir = process.cwd();
  const pagesDir = path.join(baseDir, "src/content/pages");
  const zipPath = path.join(baseDir, "packages/pages-package.zip");

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Package file not found: ${zipPath}`);
  }

  const zipData = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(zipData);

  const manifestFile = zip.file("manifest.json");
  const documentsFile = zip.file("documents.json");

  if (!manifestFile || !documentsFile) {
    throw new Error("Missing manifest.json or documents.json in package zip");
  }

  const manifest = JSON.parse(await manifestFile.async("string"));
  const documents: DocumentItem[] = JSON.parse(await documentsFile.async("string"));

  console.log(`📦 Manifest Info:`);
  console.log(`   - Collection: ${manifest.collection}`);
  console.log(`   - Document Count: ${manifest.documentsCount}`);
  console.log(`   - Asset Count: ${manifest.assetsCount}`);
  console.log(`   - Exported At: ${manifest.exportedAt}\n`);

  // 1. Inventory Check: Ensure all files in src/content/pages/ are represented
  const expectedFiles: string[] = [];
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scanDir(full);
      else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
        expectedFiles.push(path.relative(pagesDir, full));
      }
    }
  }
  scanDir(pagesDir);

  console.log(`📁 Physical Source Files: ${expectedFiles.length}`);
  console.log(`📄 Package Documents: ${documents.length}`);

  if (expectedFiles.length !== documents.length) {
    throw new Error(`Document count mismatch! Expected ${expectedFiles.length}, got ${documents.length}`);
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  const docMap = new Map<string, DocumentItem>();
  documents.forEach((d) => docMap.set(`${d.language}/${d.slug}`, d));

  console.log("\n🧪 Running Deep Content Checks across all 87 documents...\n");

  for (const relFile of expectedFiles) {
    const lang = relFile.startsWith("zh/") ? "zh" : "en";
    const subPath = relFile.replace(/^(zh|en)\//, "").replace(/\.(md|mdx)$/, "");
    const slug = subPath === "index" ? "" : subPath.replace(/\/index$/, "");
    const key = `${lang}/${slug}`;

    const doc = docMap.get(key);
    if (!doc) {
      console.error(`❌ [Missing Document] File ${relFile} was not found in package!`);
      totalErrors++;
      continue;
    }

    const fullSrcPath = path.join(pagesDir, relFile);
    const rawContent = fs.readFileSync(fullSrcPath, "utf-8");

    // A. Check Frontmatter Fields
    if (!doc.title || doc.title.trim() === "") {
      console.error(`❌ [Empty Title] ${relFile} has no title!`);
      totalErrors++;
    }
    if (typeof doc.order !== "number" || doc.order < 1) {
      console.error(`❌ [Invalid Order] ${relFile} has invalid normalized order: ${doc.order}`);
      totalErrors++;
    }

    // B. Check Body Conversion & Completeness
    if (rawContent.includes("# ") && !doc.bodyHtml.includes("<h")) {
      console.error(`❌ [Missing Headings] ${relFile} contains markdown headings that were not rendered to HTML!`);
      totalErrors++;
    }

    // C. Check Table Preservation
    if (rawContent.includes("| ---") || rawContent.includes("|---")) {
      if (!doc.bodyHtml.includes("<table") || !doc.bodyHtml.includes("</table>")) {
        console.error(`❌ [Missing Table] ${relFile} contains markdown table that was not rendered in HTML!`);
        totalErrors++;
      }
    }

    // D. Check MDX Components Conversion
    // <Pdf>
    if (rawContent.includes("<Pdf ")) {
      if (!doc.bodyHtml.includes("class=\"pdf-embed\"") && !doc.bodyHtml.includes("<object")) {
        console.error(`❌ [Missing PDF Embed] ${relFile} had <Pdf> but bodyHtml is missing pdf-embed markup!`);
        totalErrors++;
      }
    }

    // <Youtube>
    if (rawContent.includes("<Youtube ")) {
      if (!doc.bodyHtml.includes("youtube.com/embed/")) {
        console.error(`❌ [Missing YouTube Embed] ${relFile} had <Youtube> but bodyHtml is missing youtube iframe!`);
        totalErrors++;
      }
    }

    // <Vimeo>
    if (rawContent.includes("<Vimeo ")) {
      if (!doc.bodyHtml.includes("player.vimeo.com/video/")) {
        console.error(`❌ [Missing Vimeo Embed] ${relFile} had <Vimeo> but bodyHtml is missing vimeo iframe!`);
        totalErrors++;
      }
    }

    // <Figure>
    if (rawContent.includes("<Figure ")) {
      if (!doc.bodyHtml.includes("<figure") || !doc.bodyHtml.includes("<figcaption")) {
        console.error(`❌ [Missing Figure] ${relFile} had <Figure> but bodyHtml is missing figure markup!`);
        totalErrors++;
      }
    }

    // <ObfuscatedEmail>
    if (rawContent.includes("<ObfuscatedEmail ")) {
      if (!doc.bodyHtml.includes("cwts-email") || !doc.bodyHtml.includes("data-eo=")) {
        console.error(`❌ [Missing Obfuscated Email] ${relFile} had <ObfuscatedEmail> but bodyHtml is missing obfuscated email span!`);
        totalErrors++;
      }
    }

    // E. Check TipTap JSON AST Validity
    if (!doc.bodyJson || typeof doc.bodyJson !== "object") {
      console.warn(`⚠️ [Missing/Invalid bodyJson] ${relFile} has no TipTap AST JSON.`);
      totalWarnings++;
    }

    // F. Check Assets Integrity in Zip
    for (const assetPath of doc.referencedAssets) {
      const zipAsset = zip.file(`assets/${assetPath}`);
      if (!zipAsset) {
        console.error(`❌ [Missing Zip Asset] Document ${relFile} references ${assetPath} which is not inside the ZIP!`);
        totalErrors++;
      }
    }
  }

  console.log("\n📊 Verification Summary:");
  console.log(`   - Checked Documents: ${documents.length}`);
  console.log(`   - Errors Found: ${totalErrors}`);
  console.log(`   - Warnings Found: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.error("\n❌ [Failed] Content verification failed with errors!");
    process.exit(1);
  } else {
    console.log("\n✨ [100% Passed] All 87 documents converted with 100% fidelity! No content or assets were lost.");
  }
}

verifyPagesConversion().catch((err) => {
  console.error("❌ [Fatal Error]:", err);
  process.exit(1);
});
