import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { marked } from "marked";
import JSZip from "jszip";

interface JobDocument {
  id: string;
  title: string;
  date: string;
  location?: string;
  file?: string;
  body: string;
  bodyHtml: string;
  referencedAssets: string[];
  status: "published";
  language: "zh";
  version: number;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
}

function parseMarkdownFile(filePath: string): { frontmatter: any; body: string; bodyHtml: string } {
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    const rawBody = content.trim();
    return { frontmatter: {}, body: rawBody, bodyHtml: rawBody ? (marked.parse(rawBody) as string) : "" };
  }

  const frontmatter = (yaml.load(match[1]) as any) || {};
  const body = match[2].trim();
  const bodyHtml = body ? (marked.parse(body) as string) : "";

  return { frontmatter, body, bodyHtml };
}

async function exportJobsPackage() {
  console.log("📦 [Package Generator] Exporting Jobs Package...");

  const baseDir = process.cwd();
  const jobsDir = path.join(baseDir, "src/content/jobs");
  const publicDir = path.join(baseDir, "public");
  const outputZipPath = path.join(baseDir, "packages/jobs-package.zip");

  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  const zip = new JSZip();
  const documents: JobDocument[] = [];
  const referencedAssetPaths = new Set<string>();

  const files = fs.readdirSync(jobsDir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));

  for (const file of files) {
    const filePath = path.join(jobsDir, file);
    const { frontmatter, body, bodyHtml } = parseMarkdownFile(filePath);

    const slug = path.parse(file).name;
    const docAssets: string[] = [];

    // PDF / Attachment asset
    let cleanFile: string | undefined = undefined;
    if (frontmatter.file) {
      cleanFile = frontmatter.file.replace(/^\/+/, "");
      docAssets.push(cleanFile);
      referencedAssetPaths.add(cleanFile);
    }

    // Extract any inline image/doc assets from markdown/html
    const assetMatches = (body + " " + bodyHtml).matchAll(/(?:images|docs)\/[^"'\s)]+/g);
    for (const match of assetMatches) {
      const assetPath = match[0].replace(/^\/+/, "");
      docAssets.push(assetPath);
      referencedAssetPaths.add(assetPath);
    }

    const dateStr = frontmatter.date
      ? (frontmatter.date instanceof Date ? frontmatter.date.toISOString().slice(0, 10) : String(frontmatter.date).slice(0, 10))
      : new Date().toISOString().slice(0, 10);

    const doc: JobDocument = {
      id: slug,
      title: frontmatter.title || slug,
      date: dateStr,
      ...(frontmatter.location ? { location: frontmatter.location } : {}),
      ...(cleanFile ? { file: `/${cleanFile}` } : {}),
      body,
      bodyHtml,
      referencedAssets: Array.from(new Set(docAssets)),
      status: "published",
      language: "zh",
      version: 1,
      publishedVersion: 1,
      createdAt: new Date(dateStr).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    documents.push(doc);
  }

  // Sort descending by date
  documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 1. Write manifest.json
  const manifest = {
    format: "cwts-cms-package",
    version: "1.0",
    collection: "jobs",
    exportedAt: new Date().toISOString(),
    documentsCount: documents.length,
    assetsCount: referencedAssetPaths.size,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 2. Write documents.json
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  // 3. Bundle media assets
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

  console.log(`✅ [Package Generator] Jobs Package generated successfully!`);
  console.log(`   - Output: ${outputZipPath}`);
  console.log(`   - Documents: ${documents.length}`);
  console.log(`   - Assets bundled: ${assetBundledCount} / ${referencedAssetPaths.size}`);
}

exportJobsPackage().catch((err) => {
  console.error("❌ Failed to export jobs package:", err);
  process.exit(1);
});
