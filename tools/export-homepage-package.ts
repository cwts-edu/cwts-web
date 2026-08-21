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
 * Helper to parse degree widget MD/MDX files into structured programs and markdown/HTML
 */
function parseDegreeWidgetFile(filePath: string): {
  frontmatter: any;
  programs: Array<{ title: string; body: string; bodyJson: any; bodyHtml: string; open?: boolean }>;
  cleanBody: string;
  cleanBodyJson: any;
  cleanBodyHtml: string;
} {
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  const frontmatter = match ? ((yaml.load(match[1]) as any) || {}) : {};
  const rawBody = match ? match[2].trim() : content.trim();

  // 1. If file uses <AccordionItem ...>
  if (rawBody.includes("<AccordionItem")) {
    const accordionRegex = /<AccordionItem([^>]*)>([\s\S]*?)<\/AccordionItem>/gi;
    const programs: Array<{ title: string; body: string; bodyJson: any; bodyHtml: string; open?: boolean }> = [];
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = accordionRegex.exec(rawBody)) !== null) {
      const attributes = itemMatch[1];
      const innerContent = itemMatch[2];
      const isOpen = /\bopen\b/i.test(attributes);

      let title = "";
      let programBody = innerContent;

      const summaryMatch = innerContent.match(/<h[1-6][^>]*slot=["']summary["'][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      if (summaryMatch) {
        title = summaryMatch[1].trim();
        programBody = innerContent.replace(summaryMatch[0], "").trim();
      }

      if (!title) {
        const hMatch = innerContent.match(/^#+\s*(.*)$/m);
        if (hMatch) {
          title = hMatch[1].trim();
          programBody = innerContent.replace(hMatch[0], "").trim();
        } else {
          title = "Program Details";
        }
      }

      const cleanedProgramBody = programBody.replace(/^import\s+.*?;?\s*$/gm, "").trim();
      const bodyJson = marked.lexer(cleanedProgramBody);
      const bodyHtml = marked.parse(cleanedProgramBody) as string;

      programs.push({
        title,
        body: cleanedProgramBody,
        bodyJson,
        bodyHtml,
        open: isOpen || undefined,
      });
    }

    const cleanBody = rawBody
      .replace(/<AccordionItem[\s\S]*?<\/AccordionItem>/gi, "")
      .replace(/^import\s+.*?;?\s*$/gm, "")
      .trim();
    const cleanBodyJson = cleanBody ? marked.lexer(cleanBody) : null;
    const cleanBodyHtml = cleanBody ? (marked.parse(cleanBody) as string) : "";

    return { frontmatter, programs, cleanBody, cleanBodyJson, cleanBodyHtml };
  }

  // 2. Standard markdown file (e.g. doctor.md, certificate.md)
  const cleanBody = rawBody.replace(/^import\s+.*?;?\s*$/gm, "").trim();
  const cleanBodyJson = cleanBody ? marked.lexer(cleanBody) : null;
  const cleanBodyHtml = cleanBody ? (marked.parse(cleanBody) as string) : "";

  return { frontmatter, programs: [], cleanBody, cleanBodyJson, cleanBodyHtml };
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
      const parsed = parseDegreeWidgetFile(path.join(langDir, f));

      documents.push({
        id: `${lang}_${type}`,
        language: lang,
        type,
        title: parsed.frontmatter.title || type,
        order: Number(parsed.frontmatter.order) || 0,
        url: parsed.frontmatter.url || "",
        programs: parsed.programs,
        body: parsed.cleanBody,
        bodyJson: parsed.cleanBodyJson,
        bodyHtml: parsed.cleanBodyHtml,
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
