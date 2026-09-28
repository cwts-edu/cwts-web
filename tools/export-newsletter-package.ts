import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import {
  parseNewsletterFilename,
  sortNewsletters,
} from "../src/libs/content/newsletterUtils";
import type { NewsletterMetadata } from "../src/libs/content/schemas";

interface NewsletterDocument extends NewsletterMetadata {
  id: string;
  status: "published";
  language: "zh";
  version: number;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
}

async function exportNewsletterPackage() {
  console.log("📦 [Package Generator] Exporting Newsletter Package...");

  const baseDir = process.cwd();
  const newsletterDir = path.join(baseDir, "public/docs/newsletter");
  const outputZipPath = path.join(baseDir, "packages/newsletter-package.zip");

  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  const zip = new JSZip();
  const documents: NewsletterDocument[] = [];

  const files = fs.readdirSync(newsletterDir).filter((f) => f.endsWith(".pdf"));
  console.log(`Found ${files.length} newsletter PDF files.`);

  for (const file of files) {
    const parsed = parseNewsletterFilename(file);
    if (!parsed) {
      console.warn(`Could not parse newsletter filename: ${file}`);
      continue;
    }

    const doc: NewsletterDocument = {
      id: parsed.id,
      title: parsed.title,
      year: parsed.year,
      issue: parsed.issue,
      issueLetter: parsed.issueLetter,
      pdfPath: parsed.pdfPath,
      coverImage: parsed.coverImage,
      referencedAssets: [
        parsed.pdfPath.replace(/^\/+/, ""),
        parsed.coverImage.replace(/^\/+/, ""),
      ],
      status: "published",
      language: "zh",
      version: 1,
      publishedVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    documents.push(doc);
  }

  // Sort descending by year, then ascending by issue
  const sortedDocuments = sortNewsletters(documents, "asc");

  const referencedAssetPaths = new Set<string>();
  for (const doc of documents) {
    for (const a of doc.referencedAssets) {
      referencedAssetPaths.add(a);
    }
  }

  // 1. Write manifest.json
  const manifest = {
    format: "cwts-cms-package",
    version: "1.0",
    collection: "newsletter",
    exportedAt: new Date().toISOString(),
    documentsCount: sortedDocuments.length,
    assetsCount: referencedAssetPaths.size,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 2. Write documents.json
  zip.file("documents.json", JSON.stringify(sortedDocuments, null, 2));

  // 3. Bundle media assets
  const publicDir = path.join(baseDir, "public");
  const assetsFolder = zip.folder("assets");
  let assetBundledCount = 0;

  for (const assetRelPath of referencedAssetPaths) {
    const localAssetPath = path.join(publicDir, assetRelPath);
    if (fs.existsSync(localAssetPath)) {
      const fileBuffer = fs.readFileSync(localAssetPath);
      assetsFolder?.file(assetRelPath, fileBuffer);
      assetBundledCount++;
    } else {
      console.warn(`  ⚠️ Asset not found in public directory: ${localAssetPath}`);
    }
  }

  // 4. Generate and save ZIP file
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);

  console.log(`✅ [Package Generator] Newsletter Package generated successfully!`);
  console.log(`   - Output: ${outputZipPath}`);
  console.log(`   - Documents: ${sortedDocuments.length}`);
  console.log(`   - Assets bundled: ${assetBundledCount} / ${referencedAssetPaths.size}`);
}

exportNewsletterPackage().catch((err) => {
  console.error("❌ Failed to export newsletter package:", err);
  process.exit(1);
});
