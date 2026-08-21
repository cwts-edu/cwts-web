import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { marked } from "marked";
import JSZip from "jszip";
import { textLinesToHtml, markdownToTextLines } from "../src/libs/content/textUtils";

interface PackageManifest {
  format: "cwts-cms-package";
  version: string;
  collection: string;
  exportedAt: string;
  documentsCount: number;
  assetsCount: number;
  referencedAssets: string[];
}

function parseMarkdownFile(filePath: string): { frontmatter: any; rawBody: string; bodyHtml: string } {
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    const rawBody = content.trim();
    const bodyHtml = marked.parse(rawBody) as string;
    return { frontmatter: {}, rawBody, bodyHtml };
  }

  const frontmatter = (yaml.load(match[1]) as any) || {};
  const rawBody = match[2].trim();
  const bodyHtml = marked.parse(rawBody) as string;

  return { frontmatter, rawBody, bodyHtml };
}

function parseNewsMarkdownFile(filePath: string): { frontmatter: any; rawBody: string; textLines: string; bodyHtml: string } {
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    const rawBody = content.trim();
    const textLines = markdownToTextLines(rawBody);
    const bodyHtml = textLinesToHtml(textLines);
    return { frontmatter: {}, rawBody, textLines, bodyHtml };
  }

  const frontmatter = (yaml.load(match[1]) as any) || {};
  const rawBody = match[2].trim();
  const textLines = markdownToTextLines(rawBody);
  const bodyHtml = textLinesToHtml(textLines);

  return { frontmatter, rawBody, textLines, bodyHtml };
}

/**
 * 1. Export News Package
 */
async function exportNewsPackage(baseDir: string, publicDir: string) {
  console.log("📦 [News] Exporting News Package...");
  const newsDir = path.join(baseDir, "src/content/news");
  const outputZipPath = path.join(baseDir, "packages/news-package.zip");

  if (!fs.existsSync(newsDir)) {
    console.warn("⚠️  src/content/news not found, skipping.");
    return;
  }

  const zip = new JSZip();
  const documents: any[] = [];
  const referencedAssetPaths = new Set<string>();

  const files = fs.readdirSync(newsDir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));

  for (const file of files) {
    const filePath = path.join(newsDir, file);
    const { frontmatter, rawBody, textLines, bodyHtml } = parseNewsMarkdownFile(filePath);

    const slug = path.parse(file).name;
    const docAssets: string[] = [];

    // Thumbnail asset
    let cleanThumbnail: string | undefined = undefined;
    if (frontmatter.thumbnail) {
      cleanThumbnail = frontmatter.thumbnail.replace(/^\/+/, "");
      docAssets.push(cleanThumbnail);
      referencedAssetPaths.add(cleanThumbnail);
    }

    // Extract any inline image assets from markdown/html
    const imgMatches = (rawBody + " " + bodyHtml).matchAll(/(?:images|docs)\/[^"'\s)]+/g);
    for (const match of imgMatches) {
      const assetPath = match[0].replace(/^\/+/, "");
      docAssets.push(assetPath);
      referencedAssetPaths.add(assetPath);
    }

    const dateStr = frontmatter.date
      ? (frontmatter.date instanceof Date ? frontmatter.date.toISOString().slice(0, 10) : String(frontmatter.date).slice(0, 10))
      : new Date().toISOString().slice(0, 10);

    const doc = {
      id: slug,
      title: frontmatter.title || slug,
      date: dateStr,
      ...(cleanThumbnail ? { thumbnail: `/${cleanThumbnail}` } : {}),
      ...(frontmatter.url ? { url: frontmatter.url } : {}),
      body: textLines,
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

  const bundledAssets: string[] = [];
  for (const assetRelPath of referencedAssetPaths) {
    const localAssetPath = path.join(publicDir, assetRelPath);
    if (fs.existsSync(localAssetPath)) {
      const fileBuffer = fs.readFileSync(localAssetPath);
      zip.file(`assets/${assetRelPath}`, fileBuffer);
      bundledAssets.push(assetRelPath);
    } else {
      console.warn(`   ⚠️ [Missing Asset] public/${assetRelPath} not found`);
    }
  }

  const manifest: PackageManifest = {
    format: "cwts-cms-package",
    version: "1.0.0",
    collection: "news",
    exportedAt: new Date().toISOString(),
    documentsCount: documents.length,
    assetsCount: bundledAssets.length,
    referencedAssets: bundledAssets,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ [News] Created ${outputZipPath} (${documents.length} articles, ${bundledAssets.length} assets, ${(zipBuffer.length / 1024).toFixed(1)} KB)`);
}

/**
 * 1. Export Carousel Package
 */
async function exportCarouselPackage(baseDir: string, publicDir: string) {
  console.log("📦 [Carousel] Exporting Hero Carousel package...");
  const carouselYmlPath = path.join(baseDir, "src/content/homepage/carousel.yml");
  const outputZipPath = path.join(baseDir, "packages/carousel-package.zip");

  if (!fs.existsSync(carouselYmlPath)) {
    console.warn("⚠️  carousel.yml not found, skipping.");
    return;
  }

  const rawList = yaml.load(fs.readFileSync(carouselYmlPath, "utf-8")) as any[];
  const zip = new JSZip();
  const documents: any[] = [];
  const referencedAssetPaths = new Set<string>();

  const now = new Date().toISOString();

  rawList.forEach((item, index) => {
    const id = `slide-${String(index + 1).padStart(2, "0")}`;
    const imagePath = (item.image || "").replace(/^\/+/, "");
    const assets: string[] = [];

    if (imagePath) {
      assets.push(imagePath);
      referencedAssetPaths.add(imagePath);
    }

    documents.push({
      id,
      order: index + 1,
      link: item.link || "",
      image: item.image ? (item.image.startsWith("/") ? item.image : `/${item.image}`) : "",
      newWindow: Boolean(item.newWindow),
      referencedAssets: assets,
      status: "published",
      version: 1,
      publishedVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  // Bundle media assets
  const bundledAssets: string[] = [];
  for (const assetRelPath of referencedAssetPaths) {
    const diskPath = path.join(publicDir, assetRelPath);
    if (fs.existsSync(diskPath)) {
      const fileData = fs.readFileSync(diskPath);
      zip.file(`assets/${assetRelPath}`, fileData);
      bundledAssets.push(assetRelPath);
      console.log(`   ➕ [Asset] Bundled: ${assetRelPath}`);
    } else {
      console.warn(`   ⚠️ [Missing Asset] public/${assetRelPath} not found`);
    }
  }

  const manifest: PackageManifest = {
    format: "cwts-cms-package",
    version: "1.0.0",
    collection: "carousel",
    exportedAt: now,
    documentsCount: documents.length,
    assetsCount: bundledAssets.length,
    referencedAssets: bundledAssets,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ [Carousel] Created ${outputZipPath} (${documents.length} slides, ${bundledAssets.length} assets, ${(zipBuffer.length / 1024).toFixed(1)} KB)`);
}

/**
 * 2. Export Shortcuts Package
 */
async function exportShortcutsPackage(baseDir: string) {
  console.log("📦 [Shortcuts] Exporting Shortcuts package...");
  const shortcutsYmlPath = path.join(baseDir, "src/content/homepage/shortcuts.yml");
  const outputZipPath = path.join(baseDir, "packages/shortcuts-package.zip");

  if (!fs.existsSync(shortcutsYmlPath)) {
    console.warn("⚠️  shortcuts.yml not found, skipping.");
    return;
  }

  const shortcutsData = yaml.load(fs.readFileSync(shortcutsYmlPath, "utf-8")) as any;
  const zip = new JSZip();
  const now = new Date().toISOString();

  const documents = [
    {
      id: "zh",
      language: "zh",
      items: shortcutsData.zh || [],
      status: "published",
      version: 1,
      publishedVersion: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "en",
      language: "en",
      items: shortcutsData.en || [],
      status: "published",
      version: 1,
      publishedVersion: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const manifest: PackageManifest = {
    format: "cwts-cms-package",
    version: "1.0.0",
    collection: "shortcuts",
    exportedAt: now,
    documentsCount: documents.length,
    assetsCount: 0,
    referencedAssets: [],
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ [Shortcuts] Created ${outputZipPath} (${documents.length} locales, ${(zipBuffer.length / 1024).toFixed(1)} KB)`);
}

/**
 * 3. Export Degrees Widget Package
 */
async function exportDegreesWidgetPackage(baseDir: string) {
  console.log("📦 [DegreesWidget] Exporting Degrees Widget package...");
  const widgetDir = path.join(baseDir, "src/content/degrees-widget");
  const outputZipPath = path.join(baseDir, "packages/degrees-widget-package.zip");

  if (!fs.existsSync(widgetDir)) {
    console.warn("⚠️  degrees-widget directory not found, skipping.");
    return;
  }

  const zip = new JSZip();
  const documents: any[] = [];
  const now = new Date().toISOString();

  for (const lang of ["zh", "en"]) {
    const langDir = path.join(widgetDir, lang);
    if (!fs.existsSync(langDir)) continue;

    const files = fs.readdirSync(langDir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
    for (const f of files) {
      const type = path.basename(f, path.extname(f));
      const parsed = parseMarkdownFile(path.join(langDir, f));

      documents.push({
        id: `${lang}_${type}`,
        language: lang,
        type,
        title: parsed.frontmatter.title || type,
        shortTitle: parsed.frontmatter.shortTitle || "",
        order: Number(parsed.frontmatter.order) || 0,
        url: parsed.frontmatter.url || "",
        body: parsed.rawBody,
        bodyHtml: parsed.bodyHtml,
        status: "published",
        version: 1,
        publishedVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const manifest: PackageManifest = {
    format: "cwts-cms-package",
    version: "1.0.0",
    collection: "degrees-widget",
    exportedAt: now,
    documentsCount: documents.length,
    assetsCount: 0,
    referencedAssets: [],
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ [DegreesWidget] Created ${outputZipPath} (${documents.length} cards, ${(zipBuffer.length / 1024).toFixed(1)} KB)`);
}

/**
 * 4. Export Study Mode Widget Package
 */
async function exportStudyModeWidgetPackage(baseDir: string) {
  console.log("📦 [StudyModeWidget] Exporting Study Mode Widget package...");
  const widgetDir = path.join(baseDir, "src/content/study-mode-widget");
  const outputZipPath = path.join(baseDir, "packages/study-mode-widget-package.zip");

  if (!fs.existsSync(widgetDir)) {
    console.warn("⚠️  study-mode-widget directory not found, skipping.");
    return;
  }

  const zip = new JSZip();
  const documents: any[] = [];
  const now = new Date().toISOString();

  const langDirs = fs.existsSync(widgetDir)
    ? fs.readdirSync(widgetDir).filter((d) => fs.statSync(path.join(widgetDir, d)).isDirectory())
    : [];

  for (const lang of langDirs) {
    const langDir = path.join(widgetDir, lang);
    const files = fs.readdirSync(langDir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
    for (const f of files) {
      const type = path.basename(f, path.extname(f));
      const parsed = parseMarkdownFile(path.join(langDir, f));

      documents.push({
        id: `${lang}_${type}`,
        language: lang,
        type,
        title: parsed.frontmatter.title || type,
        order: Number(parsed.frontmatter.order) || 0,
        url: parsed.frontmatter.url || "",
        body: parsed.rawBody,
        bodyHtml: parsed.bodyHtml,
        status: "published",
        version: 1,
        publishedVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const manifest: PackageManifest = {
    format: "cwts-cms-package",
    version: "1.0.0",
    collection: "study-mode-widget",
    exportedAt: now,
    documentsCount: documents.length,
    assetsCount: 0,
    referencedAssets: [],
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ [StudyModeWidget] Created ${outputZipPath} (${documents.length} formats, ${(zipBuffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  const baseDir = process.cwd();
  const publicDir = path.join(baseDir, "public");
  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  console.log("🚀 Starting Homepage Data Packages Export...");
  await exportNewsPackage(baseDir, publicDir);
  await exportCarouselPackage(baseDir, publicDir);
  await exportShortcutsPackage(baseDir);
  await exportDegreesWidgetPackage(baseDir);
  await exportStudyModeWidgetPackage(baseDir);
  console.log("🎉 All Homepage Data packages exported successfully!");
}

main().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
