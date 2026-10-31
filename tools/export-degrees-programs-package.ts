import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { marked } from "marked";
import JSZip from "jszip";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    heading: {
      levels: [2, 3, 4],
    },
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Image,
];

interface DegreeProgramDocument {
  id: string;
  slug: string;
  language: "zh" | "en";
  title: string;
  subTitle?: string;
  order: number;
  inCategoryOrder: number;
  thumbnail?: string;
  length?: string;
  credits: number;
  category: "doctor" | "master" | "diploma" | "certificate";
  redirect?: string;
  body: string;
  bodyHtml: string;
  bodyJson?: Record<string, any>;
  referencedAssets: string[];
  status: "published";
  version: number;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_BASE_ORDER: Record<string, number> = {
  doctor: 100,
  master: 200,
  diploma: 300,
  certificate: 400,
};

import { parse as parseHtml } from "node-html-parser";

function processExtendedTables(html: string): string {
  if (!html.includes("^")) return html;
  const root = parseHtml(html);
  const tables = root.querySelectorAll("table");

  for (const table of tables) {
    const rows = table.querySelectorAll("tr");
    const columnActiveCell: Map<number, any> = new Map();

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const cells = Array.from(row.childNodes).filter((n: any) => n.tagName === "TD" || n.tagName === "TH");

      let colIdx = 0;
      for (const cell of cells) {
        const text = (cell as any).text.trim();
        if (text === "^") {
          const targetCell = columnActiveCell.get(colIdx);
          if (targetCell) {
            const currentSpan = parseInt(targetCell.getAttribute("rowspan") || "1", 10);
            targetCell.setAttribute("rowspan", String(currentSpan + 1));
            (cell as any).remove();
          }
        } else {
          columnActiveCell.set(colIdx, cell);
        }
        colIdx++;
      }
    }
  }
  return root.toString();
}

function parseMarkdownFile(filePath: string): { frontmatter: any; body: string; bodyHtml: string; bodyJson: any } {
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    const rawBody = content.trim();
    let bodyHtml = rawBody ? (marked.parse(rawBody) as string) : "";
    bodyHtml = processExtendedTables(bodyHtml);
    let bodyJson: any = null;
    try {
      if (bodyHtml) bodyJson = generateJSON(bodyHtml, TIPTAP_EXTENSIONS);
    } catch {
      bodyJson = marked.lexer(rawBody);
    }
    return { frontmatter: {}, body: rawBody, bodyHtml, bodyJson };
  }

  const frontmatter = (yaml.load(match[1]) as any) || {};
  const body = match[2].trim();
  let bodyHtml = body ? (marked.parse(body) as string) : "";
  bodyHtml = processExtendedTables(bodyHtml);
  let bodyJson: any = null;
  try {
    if (bodyHtml) bodyJson = generateJSON(bodyHtml, TIPTAP_EXTENSIONS);
  } catch {
    bodyJson = marked.lexer(body);
  }

  return { frontmatter, body, bodyHtml, bodyJson };
}

async function exportDegreesProgramsPackage() {
  console.log("📦 [Package Generator] Exporting Degrees & Programs Package...");

  const baseDir = process.cwd();
  const degreesProgramsDir = path.join(baseDir, "src/content/degrees-programs");
  const publicDir = path.join(baseDir, "public");
  const outputZipPath = path.join(baseDir, "packages/degrees-programs-package.zip");

  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  const zip = new JSZip();
  const documents: DegreeProgramDocument[] = [];
  const referencedAssetPaths = new Set<string>();

  // Check language folders (e.g. zh, en)
  const langDirs = fs.existsSync(degreesProgramsDir)
    ? fs.readdirSync(degreesProgramsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
    : [];

  const now = new Date().toISOString();

  for (const langDir of langDirs) {
    const lang = langDir.name as "zh" | "en";
    const dirPath = path.join(degreesProgramsDir, langDir.name);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const { frontmatter, body, bodyHtml, bodyJson } = parseMarkdownFile(filePath);

      const slug = path.parse(file).name;
      const docAssets: string[] = [];

      // Thumbnail asset
      let cleanThumbnail: string | undefined = undefined;
      if (frontmatter.thumbnail) {
        cleanThumbnail = frontmatter.thumbnail.replace(/^\/+/, "");
        docAssets.push(cleanThumbnail);
        referencedAssetPaths.add(cleanThumbnail);
      }

      // Extract any inline image/doc assets from markdown/html
      const assetMatches = (body + " " + bodyHtml).matchAll(/(?:images|docs)\/[^"'\s)]+/g);
      for (const match of assetMatches) {
        const assetPath = match[0].replace(/^\/+/, "");
        docAssets.push(assetPath);
        referencedAssetPaths.add(assetPath);
      }

      const rawCategory = frontmatter.category || "master";
      const rawOrder = Number(frontmatter.order || 0);

      const doc: DegreeProgramDocument = {
        id: slug,
        slug,
        language: lang,
        title: frontmatter.title || slug,
        ...(frontmatter.subTitle ? { subTitle: frontmatter.subTitle } : {}),
        order: rawOrder,
        inCategoryOrder: 1,
        ...(cleanThumbnail ? { thumbnail: `/${cleanThumbnail}` } : {}),
        ...(frontmatter.length ? { length: frontmatter.length } : {}),
        credits: Number(frontmatter.credits || 0),
        category: rawCategory,
        ...(frontmatter.redirect ? { redirect: frontmatter.redirect } : {}),
        body,
        bodyHtml,
        ...(bodyJson ? { bodyJson } : {}),
        referencedAssets: Array.from(new Set(docAssets)),
        status: "published",
        version: 1,
        publishedVersion: 1,
        createdAt: now,
        updatedAt: now,
      };

      documents.push(doc);
    }
  }

  // Calculate inCategoryOrder and order = baseOrder + inCategoryOrder for each category
  const categories = ["doctor", "master", "diploma", "certificate"];
  for (const cat of categories) {
    const catDocs = documents.filter((d) => d.category === cat);
    // Sort existing docs by their initial order
    catDocs.sort((a, b) => a.order - b.order);
    const baseOrder = CATEGORY_BASE_ORDER[cat] || 200;
    catDocs.forEach((doc, idx) => {
      doc.inCategoryOrder = idx + 1;
      doc.order = baseOrder + (idx + 1);
    });
  }

  // Sort overall by order ascending
  documents.sort((a, b) => a.order - b.order);

  // 1. Write manifest.json
  const manifest = {
    format: "cwts-cms-package",
    version: "1.0",
    collection: "degrees-programs",
    exportedAt: now,
    documentsCount: documents.length,
    assetsCount: referencedAssetPaths.size,
    assetBaseFolder: "images/covers",
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

  console.log(`✅ [Package Generator] Degrees & Programs Package generated successfully!`);
  console.log(`   - Output: ${outputZipPath}`);
  console.log(`   - Documents: ${documents.length}`);
  console.log(`   - Assets bundled: ${assetBundledCount} / ${referencedAssetPaths.size}`);
}

exportDegreesProgramsPackage().catch((err) => {
  console.error("❌ Failed to export degrees-programs package:", err);
  process.exit(1);
});
