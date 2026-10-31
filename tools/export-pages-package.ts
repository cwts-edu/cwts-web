import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { marked } from "marked";
import JSZip from "jszip";
import { parse as parseHtml } from "node-html-parser";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Node, Extension, mergeAttributes } from "@tiptap/core";
import { obfuscateMailtoLinks } from "../src/libs/content/emailObfuscator";

// --- Custom TipTap Extensions for Pages ---

const UniversalAttributes = Extension.create({
  name: "universalAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph", "table", "tableCell", "tableHeader", "blockquote", "image"],
        attributes: {
          class: {
            default: null,
            parseHTML: (el) => el.getAttribute("class"),
            renderHTML: (attrs) => (attrs.class ? { class: attrs.class } : {}),
          },
          style: {
            default: null,
            parseHTML: (el) => el.getAttribute("style"),
            renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
          },
        },
      },
    ];
  },
});

const VideoEmbedNode = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      title: { default: "Embedded Video" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div.video-embed",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const iframe = el.querySelector("iframe");
          return {
            src: iframe?.getAttribute("src") || null,
            title: iframe?.getAttribute("title") || "Embedded Video",
          };
        },
      },
      { tag: "iframe" },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        class: "video-embed my-4",
        style:
          "position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);",
      },
      [
        "iframe",
        mergeAttributes(HTMLAttributes, {
          style: "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;",
          allowfullscreen: "true",
        }),
      ],
    ];
  },
});

const PdfEmbedNode = Node.create({
  name: "pdfEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      url: { default: null },
      title: { default: "PDF Document" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure.pdf-embed",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const obj = el.querySelector("object");
          const a = el.querySelector("figcaption a") || el.querySelector("a");
          return {
            url: obj?.getAttribute("data") || a?.getAttribute("href") || null,
            title: a?.textContent || "PDF Document",
          };
        },
      },
      { tag: "object[type='application/pdf']" },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes.url || "";
    const title = HTMLAttributes.title || "PDF Document";
    return [
      "figure",
      { class: "pdf-embed my-6" },
      ["figcaption", { class: "mb-2 font-medium" }, ["a", { href: url }, title]],
      [
        "object",
        {
          data: url,
          type: "application/pdf",
          width: "100%",
          height: "600px",
          style: "width: 100%; height: 600px; border-radius: 0.75rem; border: 1px solid #cbd5e1;",
        },
        ["p", {}, "Download PDF: ", ["a", { href: url }, title]],
      ],
    ];
  },
});

const FigureNode = Node.create({
  name: "figure",
  group: "block",
  content: "image? paragraph?",
  defining: true,
  addAttributes() {
    return {
      class: { default: null },
      style: { default: "margin: 1rem auto; text-align: center;" },
    };
  },
  parseHTML() {
    return [{ tag: "figure" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes), 0];
  },
});

const DetailsNode = Node.create({
  name: "details",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      class: { default: "accordion-item border border-slate-200 rounded-xl p-4 my-3 bg-white" },
    };
  },
  parseHTML() {
    return [{ tag: "details" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes), 0];
  },
});

const RawHtmlNode = Node.create({
  name: "rawHtml",
  group: "block",
  atom: true,
  defining: true,
  addAttributes() {
    return {
      rawHtml: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div.raw-html-embed",
        getAttrs: (el) => (typeof el === "string" ? false : { rawHtml: el.innerHTML }),
      },
      { tag: "script", getAttrs: (el) => (typeof el === "string" ? false : { rawHtml: (el as any).outerHTML }) },
      { tag: "style", getAttrs: (el) => (typeof el === "string" ? false : { rawHtml: (el as any).outerHTML }) },
      { tag: "form", getAttrs: (el) => (typeof el === "string" ? false : { rawHtml: (el as any).outerHTML }) },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", { class: "raw-html-embed" }, HTMLAttributes.rawHtml || ""];
  },
});

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    link: false,
    heading: { levels: [2, 3, 4] },
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Image,
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  UniversalAttributes,
  VideoEmbedNode,
  PdfEmbedNode,
  FigureNode,
  DetailsNode,
  RawHtmlNode,
];

// --- Data Types ---

interface PageDocument {
  id: string;
  slug: string;
  language: "zh" | "en";
  title: string;
  subTitle?: string;
  order: number;
  legacyOrder?: number;
  coverImage?: string;
  thumbnail?: string;
  showChildren?: boolean;
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

// --- Extended Table & MDX Desugaring Helpers ---

function processExtendedTables(html: string): string {
  if (!html.includes("^")) return html;
  const root = parseHtml(html);
  const tables = root.querySelectorAll("table");

  for (const table of tables) {
    const rows = table.querySelectorAll("tr");
    const columnActiveCell: Map<number, any> = new Map();

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const cells = Array.from(row.childNodes).filter(
        (n: any) => n.tagName === "TD" || n.tagName === "TH"
      );

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

/**
 * Converts JSX/MDX components and special markup into standard semantic HTML
 */
function desugarMdxAndCustomTags(content: string): string {
  let result = content;

  // 1. Remove JSX/Astro import statements
  result = result.replace(/^import\s+.*?(?:from\s+['"].*?['"]|['"].*?['"]);?\s*$/gm, "");

  // 2. Desugar <Pdf url="..." title="..." />
  result = result.replace(/<Pdf\s+([^>]*?)\/?>/g, (_match, attrs) => {
    const urlMatch = attrs.match(/url=["']([^"']+)["']/);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/);
    const url = urlMatch ? urlMatch[1] : "";
    const title = titleMatch ? titleMatch[1] : path.basename(url);

    return `\n<figure class="pdf-embed my-6"><figcaption class="mb-2 font-medium"><a href="${url}">${title}</a></figcaption><object data="${url}" type="application/pdf" width="100%" height="600px" style="width: 100%; height: 600px; border-radius: 0.75rem; border: 1px solid #cbd5e1;"><p>Download: <a href="${url}">${title}</a></p></object></figure>\n`;
  });

  // 3. Desugar <Youtube id="..." title="..." />
  result = result.replace(/<Youtube\s+([^>]*?)\/?>/g, (_match, attrs) => {
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/);
    const id = idMatch ? idMatch[1] : "";
    const title = titleMatch ? titleMatch[1] : "YouTube video";

    return `\n<div class="video-embed my-4" style="position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"><iframe src="https://www.youtube.com/embed/${id}" title="${title}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n`;
  });

  // 4. Desugar <Vimeo id="..." title="..." width="..." />
  result = result.replace(/<Vimeo\s+([^>]*?)\/?>/g, (_match, attrs) => {
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/);
    const id = idMatch ? idMatch[1] : "";
    const title = titleMatch ? titleMatch[1] : "Vimeo video";

    return `\n<div class="video-embed my-4" style="position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"><iframe src="https://player.vimeo.com/video/${id}" title="${title}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
  });

  // 5. Desugar <Figure imageUrl="..." title="..." height="..." />
  result = result.replace(/<Figure\s+([^>]*?)\/?>/g, (_match, attrs) => {
    const imgMatch = attrs.match(/imageUrl=["']([^"']+)["']/);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/);
    const heightMatch = attrs.match(/height=["']([^"']+)["']/);
    const imageUrl = imgMatch ? imgMatch[1] : "";
    const title = titleMatch ? titleMatch[1] : "";
    const height = heightMatch ? (heightMatch[1].endsWith("px") ? heightMatch[1] : `${heightMatch[1]}px`) : "400px";

    return `\n<figure style="margin: 1rem auto; text-align: center;"><img src="${imageUrl}" alt="${title}" style="max-height: ${height}; display: block; margin: 0 auto; border-radius: 0.5rem;" /><figcaption style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;">${title}</figcaption></figure>\n`;
  });

  // 6. Desugar <ObfuscatedEmail email="..." />
  result = result.replace(/<ObfuscatedEmail\s+email=["']([^"']+)["']\s*\/?>/g, (_match, email) => {
    return `<a href="mailto:${email}">${email}</a>`;
  });

  // 7. Desugar <NewsletterList /> placeholder
  result = result.replace(/<NewsletterList\s*\/?>/g, `<!-- Newsletter List Component is rendered dynamically by the page template -->`);

  // 8. Convert one-off Tailwind layout classes into standard inline styles
  result = result.replace(/class=["']grid grid-cols-\[auto_auto_auto\] gap-4["']/g, `style="display: grid; grid-template-columns: auto auto auto; gap: 1rem;"`);
  result = result.replace(/class=["']grid grid-cols-1 md:grid-cols-2 gap-4["']/g, `style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;"`);
  result = result.replace(/class=["']flex flex-wrap gap-4["']/g, `style="display: flex; flex-wrap: wrap; gap: 1rem;"`);
  result = result.replace(/class=["']flex flex-wrap gap-6["']/g, `style="display: flex; flex-wrap: wrap; gap: 1.5rem;"`);
  result = result.replace(/class=["']bg-white p-4 mt-6 mb-6 font-semibold["']/g, `style="background-color: #ffffff; padding: 1rem; margin-top: 1.5rem; margin-bottom: 1.5rem; font-weight: 600; border-radius: 0.5rem; border: 1px solid #e2e8f0;"`);
  result = result.replace(/class=["']w-full md:w-3\/5 lg:w-2\/5 m-4 max-lg:mx-auto lg:float-right["']/g, `style="width: 100%; max-width: 420px; margin: 1rem; float: right;"`);
  result = result.replace(/class=["']flex flex-col md:flex-row-reverse gap-4["']/g, `style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;"`);
  result = result.replace(/class=["']text-center["']/g, `style="text-align: center;"`);
  result = result.replace(/class=["']col-span-2["']/g, `style="grid-column: span 2;"`);
  result = result.replace(/className=/g, `class=`);

  // 9. Fix malformed HTML tags like </br>
  result = result.replace(/<\/br>/gi, "<br />");

  return result;
}

/**
 * Compiles markdown footnotes ([^1]) to standard HTML
 */
function processFootnotes(content: string): string {
  const footnoteDefs: Map<string, string> = new Map();

  // Extract footnote definitions: [^1]: Text
  const cleaned = content.replace(/^\[\^([^\]]+)\]:\s*(.*)$/gm, (_match, id, text) => {
    footnoteDefs.set(id, text.trim());
    return "";
  });

  if (footnoteDefs.size === 0) return content;

  // Replace footnote references: [^1]
  let result = cleaned.replace(/\[\^([^\]]+)\]/g, (_match, id) => {
    return `<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}">[${id}]</a></sup>`;
  });

  // Append footnote definitions section at bottom
  let footnotesSection = `\n\n<section class="footnotes" style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; color: #64748b;"><ol style="padding-left: 1.25rem;">`;
  for (const [id, text] of footnoteDefs.entries()) {
    footnotesSection += `<li id="fn-${id}" style="margin-bottom: 0.5rem;">${text} <a href="#fnref-${id}" style="text-decoration: none;">↩</a></li>`;
  }
  footnotesSection += `</ol></section>`;

  return result + footnotesSection;
}

/**
 * Parses a page file into frontmatter and body representations
 */
function parsePageFile(filePath: string): {
  frontmatter: Record<string, any>;
  body: string;
  bodyHtml: string;
  bodyJson: any;
} {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  let frontmatter: Record<string, any> = {};
  let rawBody = rawContent;

  if (match) {
    frontmatter = (yaml.load(match[1]) as any) || {};
    rawBody = match[2].trim();
  }

  // Desugar MDX & process footnotes
  let desugaredBody = desugarMdxAndCustomTags(rawBody);
  desugaredBody = processFootnotes(desugaredBody);

  // Compile to HTML
  let bodyHtml = desugaredBody ? (marked.parse(desugaredBody) as string) : "";
  bodyHtml = processExtendedTables(bodyHtml);

  // Generate TipTap JSON AST
  let bodyJson: any = { type: "doc", content: [] };
  try {
    if (bodyHtml) {
      bodyJson = generateJSON(bodyHtml, TIPTAP_EXTENSIONS);
    }
  } catch (err) {
    console.warn(`⚠️ [AST Parser Fallback] for ${filePath}:`, (err as Error).message);
    bodyJson = marked.lexer(rawBody);
  }

  // Apply build-time email obfuscation to HTML for bot immunity
  if (bodyHtml) {
    bodyHtml = obfuscateMailtoLinks(bodyHtml);
  }

  return { frontmatter, body: rawBody, bodyHtml, bodyJson };
}

/**
 * Extracts referenced assets from frontmatter, body text, and HTML
 */
function extractReferencedAssets(
  doc: { coverImage?: string; thumbnail?: string; body: string; bodyHtml: string },
  publicDir: string
): string[] {
  const assets = new Set<string>();

  const checkAndAdd = (src: string | undefined) => {
    if (!src) return;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("mailto:") || src.startsWith("#")) {
      return;
    }
    const cleanPath = src.split("?")[0].split("#")[0].replace(/^\/+/, "");
    if (cleanPath && fs.existsSync(path.join(publicDir, cleanPath))) {
      assets.add(cleanPath);
    }
  };

  checkAndAdd(doc.coverImage);
  checkAndAdd(doc.thumbnail);

  // Scan markdown and HTML sources for images, documents, and PDFs
  const regexes = [
    /!\[.*?\]\((.*?)\)/g,
    /\[.*?\]\((.*?\.(?:pdf|docx?|xlsx?|png|jpe?g|webp|svg))\)/gi,
    /<img[^>]+src=["']([^"']+)["']/gi,
    /<object[^>]+data=["']([^"']+)["']/gi,
    /<a[^>]+href=["']([^"']+\.(?:pdf|docx?|xlsx?|png|jpe?g|webp|svg))["']/gi,
    /imageUrl=["']([^"']+)["']/gi,
    /url=["']([^"']+\.pdf)["']/gi,
  ];

  const combinedText = `${doc.body}\n${doc.bodyHtml}`;
  for (const regex of regexes) {
    let m;
    while ((m = regex.exec(combinedText)) !== null) {
      checkAndAdd(m[1]);
    }
  }

  return Array.from(assets);
}

// --- Main Export Execution ---

async function exportPagesPackage() {
  console.log("📦 [Package Generator] Exporting Pages Package (Chinese & English)...");

  const baseDir = process.cwd();
  const pagesDir = path.join(baseDir, "src/content/pages");
  const publicDir = path.join(baseDir, "public");
  const outputZipPath = path.join(baseDir, "packages/pages-package.zip");

  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  const zip = new JSZip();
  const allReferencedAssets = new Set<string>();
  const rawDocuments: Array<{
    lang: "zh" | "en";
    slug: string;
    filePath: string;
    frontmatter: Record<string, any>;
    body: string;
    bodyHtml: string;
    bodyJson: any;
  }> = [];

  // 1. Traverse all pages across languages (zh, en)
  function walkDir(dir: string, lang: "zh" | "en", currentSlugParts: string[] = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath, lang, [...currentSlugParts, entry.name]);
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
        const baseName = entry.name.replace(/\.(md|mdx)$/, "");
        const slugParts = baseName === "index" ? currentSlugParts : [...currentSlugParts, baseName];
        const slug = slugParts.join("/");

        const { frontmatter, body, bodyHtml, bodyJson } = parsePageFile(fullPath);

        rawDocuments.push({
          lang,
          slug,
          filePath: fullPath,
          frontmatter,
          body,
          bodyHtml,
          bodyJson,
        });
      }
    }
  }

  if (fs.existsSync(path.join(pagesDir, "zh"))) walkDir(path.join(pagesDir, "zh"), "zh");
  if (fs.existsSync(path.join(pagesDir, "en"))) walkDir(path.join(pagesDir, "en"), "en");

  console.log(`🔍 [Inventory] Found ${rawDocuments.length} total page files across 'zh' and 'en'.`);

  // 2. Normalize Local Sibling Orders
  // Group by (language, parentPath) and sort by legacy order
  const branchMap: Map<string, typeof rawDocuments> = new Map();
  for (const doc of rawDocuments) {
    const parent = doc.slug.includes("/") ? doc.slug.split("/").slice(0, -1).join("/") : "";
    const key = `${doc.lang}::${parent}`;
    if (!branchMap.has(key)) branchMap.set(key, []);
    branchMap.get(key)!.push(doc);
  }

  const normalizedOrderMap: Map<string, number> = new Map();
  for (const [, siblings] of branchMap.entries()) {
    siblings.sort((a, b) => {
      const orderA = typeof a.frontmatter.order === "number" ? a.frontmatter.order : 999;
      const orderB = typeof b.frontmatter.order === "number" ? b.frontmatter.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.slug.localeCompare(b.slug);
    });

    siblings.forEach((doc, idx) => {
      const key = `${doc.lang}::${doc.slug}`;
      normalizedOrderMap.set(key, idx + 1);
    });
  }

  // 3. Build Document Objects & Extract Assets
  const now = new Date().toISOString();
  const documents: PageDocument[] = [];

  for (const raw of rawDocuments) {
    const id = `${raw.lang}_${raw.slug.replace(/\//g, "_")}`;
    const legacyOrder = typeof raw.frontmatter.order === "number" ? raw.frontmatter.order : undefined;
    const localOrder = normalizedOrderMap.get(`${raw.lang}::${raw.slug}`) || 1;

    const assets = extractReferencedAssets(
      {
        coverImage: raw.frontmatter.coverImage,
        thumbnail: raw.frontmatter.thumbnail,
        body: raw.body,
        bodyHtml: raw.bodyHtml,
      },
      publicDir
    );

    assets.forEach((a) => allReferencedAssets.add(a));

    documents.push({
      id,
      slug: raw.slug,
      language: raw.lang,
      title: raw.frontmatter.title || path.basename(raw.slug),
      subTitle: raw.frontmatter.subTitle,
      order: localOrder,
      legacyOrder,
      coverImage: raw.frontmatter.coverImage,
      thumbnail: raw.frontmatter.thumbnail,
      showChildren: raw.frontmatter.showChildren !== undefined ? Boolean(raw.frontmatter.showChildren) : true,
      body: raw.body,
      bodyHtml: raw.bodyHtml,
      bodyJson: raw.bodyJson,
      referencedAssets: assets,
      status: "published",
      version: 1,
      publishedVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 4. Collect & Bundle Assets into Zip
  // 4a. Collect all seminary documents under public/docs/ (excluding jobs & newsletter which are packaged separately)
  function collectAllDocs(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "jobs" || entry.name === "newsletter") continue;
        collectAllDocs(full);
      } else if (!entry.name.startsWith(".")) {
        const rel = path.relative(publicDir, full);
        allReferencedAssets.add(rel);
      }
    }
  }
  collectAllDocs(path.join(publicDir, "docs"));

  // 4b. Collect all site images under public/images/ (covers, babc, about, faculty, why-us, site branding)
  function collectAllImages(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectAllImages(full);
      } else if (!entry.name.startsWith(".")) {
        const rel = path.relative(publicDir, full);
        allReferencedAssets.add(rel);
      }
    }
  }
  collectAllImages(path.join(publicDir, "images"));

  console.log(`🖼️ [Assets] Bundling ${allReferencedAssets.size} unique referenced and collection assets into package...`);
  for (const assetRelPath of allReferencedAssets) {
    const fullAssetPath = path.join(publicDir, assetRelPath);
    if (fs.existsSync(fullAssetPath)) {
      const fileData = fs.readFileSync(fullAssetPath);
      zip.file(`assets/${assetRelPath}`, fileData);
    } else {
      console.warn(`⚠️ [Asset Warning] File not found in public/: ${assetRelPath}`);
    }
  }

  // 5. Build documents.json & manifest.json
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  const manifest = {
    format: "cwts-cms-package",
    version: "1.0.0",
    collection: "pages",
    exportedAt: now,
    documentsCount: documents.length,
    assetsCount: allReferencedAssets.size,
    assetBaseFolder: "assets",
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 6. Generate Zip Archive
  console.log(`💾 [Zip] Writing package archive to ${outputZipPath}...`);
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ [Success] Pages package created successfully! (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

  return { documents, assetsCount: allReferencedAssets.size };
}

// Direct CLI Execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith("export-pages-package.ts")) {
  exportPagesPackage().catch((err) => {
    console.error("❌ [Export Error]:", err);
    process.exit(1);
  });
}

export { exportPagesPackage };
