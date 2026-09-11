import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { marked } from "marked";
import JSZip from "jszip";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    heading: {
      levels: [2, 3, 4],
    },
  }),
  Image,
];

interface LocalizedFacultyData {
  name: string;
  positions?: string[];
  courses?: string[];
  degrees?: string[];
  moreDegrees?: string[];
  former?: string[];
  bodyHtml?: string;
  bodyJson?: Record<string, any>;
}

interface UnifiedFacultyDoc {
  id: string;
  category: "faculty" | "senior-adjunct" | "adjunct";
  photo?: string;
  email?: string;
  order: number;
  inCategoryOrder: number;
  referencedAssets: string[];
  zh: LocalizedFacultyData;
  en: LocalizedFacultyData;
  status: "published";
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

function createTipTapJson(html: string): Record<string, any> {
  if (!html || !html.trim()) {
    return {
      type: "doc",
      content: [],
    };
  }
  try {
    return generateJSON(html, TIPTAP_EXTENSIONS);
  } catch (err) {
    console.warn("Failed to generate TipTap JSON from HTML, fallback to empty doc:", err);
    return {
      type: "doc",
      content: [],
    };
  }
}

async function exportFacultyPackage() {
  console.log("📦 [Package Generator] Exporting Faculty Package...");

  const baseDir = process.cwd();
  const zhFacultyDir = path.join(baseDir, "src/content/faculty/zh");
  const enFacultyDir = path.join(baseDir, "src/content/faculty/en");
  const publicDir = path.join(baseDir, "public");
  const outputZipPath = path.join(baseDir, "packages/faculty-package.zip");

  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  const zip = new JSZip();
  const documents: UnifiedFacultyDoc[] = [];
  const referencedAssetPaths = new Set<string>();

  // 1. Process Core Faculty & Senior Adjunct MD files
  const zhFiles = fs.readdirSync(zhFacultyDir).filter((f) => f.endsWith(".md"));

  const coreAndSeniorList: Array<{
    slug: string;
    zhData: any;
    enData: any;
    category: "faculty" | "senior-adjunct";
    order: number;
  }> = [];

  for (const file of zhFiles) {
    const slug = file.replace(/\.md$/, "");
    const zhPath = path.join(zhFacultyDir, file);
    const enPath = path.join(enFacultyDir, file);

    const zhParsed = parseMarkdownFile(zhPath);
    const enParsed = fs.existsSync(enPath) ? parseMarkdownFile(enPath) : { frontmatter: {}, body: "", bodyHtml: "" };

    const category = (zhParsed.frontmatter.category || "faculty") as "faculty" | "senior-adjunct";
    const rawOrder = Number(zhParsed.frontmatter.order) || 999;

    coreAndSeniorList.push({
      slug,
      zhData: zhParsed,
      enData: enParsed,
      category,
      order: rawOrder,
    });
  }

  // Sort within core/senior categories
  const coreFaculty = coreAndSeniorList.filter((f) => f.category === "faculty").sort((a, b) => a.order - b.order);
  const seniorAdjunct = coreAndSeniorList.filter((f) => f.category === "senior-adjunct").sort((a, b) => a.order - b.order);

  // Index Core Faculty (Base 100)
  coreFaculty.forEach((item, index) => {
    const inCategoryOrder = index + 1;
    const computedOrder = 100 + inCategoryOrder;
    const photo = item.zhData.frontmatter.photo || item.enData.frontmatter.photo;
    const email = item.zhData.frontmatter.email || item.enData.frontmatter.email;

    const referencedAssets: string[] = [];
    if (photo && typeof photo === "string") {
      const cleanPhoto = photo.replace(/^\/+/, "");
      referencedAssets.push(cleanPhoto);
      referencedAssetPaths.add(cleanPhoto);
    }

    documents.push({
      id: item.slug,
      category: "faculty",
      photo: photo || undefined,
      email: email || undefined,
      order: computedOrder,
      inCategoryOrder,
      referencedAssets,
      zh: {
        name: item.zhData.frontmatter.name || item.slug,
        positions: item.zhData.frontmatter.positions || [],
        courses: item.zhData.frontmatter.courses || [],
        degrees: item.zhData.frontmatter.degrees || [],
        moreDegrees: item.zhData.frontmatter.moreDegrees || [],
        former: item.zhData.frontmatter.former || [],
        bodyHtml: item.zhData.bodyHtml,
      },
      en: {
        name: item.enData.frontmatter.name || item.slug,
        positions: item.enData.frontmatter.positions || [],
        courses: item.enData.frontmatter.courses || [],
        degrees: item.enData.frontmatter.degrees || [],
        moreDegrees: item.enData.frontmatter.moreDegrees || [],
        former: item.enData.frontmatter.former || [],
        bodyHtml: item.enData.bodyHtml,
      },
      status: "published",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  });

  // Index Senior Adjunct (Base 200)
  seniorAdjunct.forEach((item, index) => {
    const inCategoryOrder = index + 1;
    const computedOrder = 200 + inCategoryOrder;
    const photo = item.zhData.frontmatter.photo || item.enData.frontmatter.photo;
    const email = item.zhData.frontmatter.email || item.enData.frontmatter.email;

    const referencedAssets: string[] = [];
    if (photo && typeof photo === "string") {
      const cleanPhoto = photo.replace(/^\/+/, "");
      referencedAssets.push(cleanPhoto);
      referencedAssetPaths.add(cleanPhoto);
    }

    documents.push({
      id: item.slug,
      category: "senior-adjunct",
      photo: photo || undefined,
      email: email || undefined,
      order: computedOrder,
      inCategoryOrder,
      referencedAssets,
      zh: {
        name: item.zhData.frontmatter.name || item.slug,
        positions: item.zhData.frontmatter.positions || [],
        courses: item.zhData.frontmatter.courses || [],
        degrees: item.zhData.frontmatter.degrees || [],
        moreDegrees: item.zhData.frontmatter.moreDegrees || [],
        former: item.zhData.frontmatter.former || [],
        bodyHtml: item.zhData.bodyHtml,
      },
      en: {
        name: item.enData.frontmatter.name || item.slug,
        positions: item.enData.frontmatter.positions || [],
        courses: item.enData.frontmatter.courses || [],
        degrees: item.enData.frontmatter.degrees || [],
        moreDegrees: item.enData.frontmatter.moreDegrees || [],
        former: item.enData.frontmatter.former || [],
        bodyHtml: item.enData.bodyHtml,
      },
      status: "published",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  });

  // 2. Process Adjunct Professors from adjunct-prof.yml (Base 300)
  const zhAdjunctPath = path.join(zhFacultyDir, "adjunct-prof.yml");
  const enAdjunctPath = path.join(enFacultyDir, "adjunct-prof.yml");

  if (fs.existsSync(zhAdjunctPath)) {
    const zhAdjunctList = (yaml.load(fs.readFileSync(zhAdjunctPath, "utf-8")) as any[]) || [];
    const enAdjunctList = fs.existsSync(enAdjunctPath)
      ? (yaml.load(fs.readFileSync(enAdjunctPath, "utf-8")) as any[]) || []
      : [];

    zhAdjunctList.forEach((zhItem, index) => {
      const enItem = enAdjunctList[index] || {};
      const inCategoryOrder = index + 1;
      const computedOrder = 300 + inCategoryOrder;

      // Generate a clean slug id from english name or index
      const rawName = enItem.name || zhItem.name || `adjunct-${inCategoryOrder}`;
      const slugId =
        "adjunct-" +
        rawName
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");

      const photo = zhItem.photo || enItem.photo;
      const referencedAssets: string[] = [];
      if (photo && typeof photo === "string") {
        const cleanPhoto = photo.replace(/^\/+/, "");
        referencedAssets.push(cleanPhoto);
        referencedAssetPaths.add(cleanPhoto);
      }

      documents.push({
        id: slugId,
        category: "adjunct",
        photo: photo || undefined,
        email: zhItem.email || enItem.email || undefined,
        order: computedOrder,
        inCategoryOrder,
        referencedAssets,
        zh: {
          name: zhItem.name || "",
          positions: zhItem.positions || [],
          courses: zhItem.courses || [],
          degrees: zhItem.degrees || [],
          moreDegrees: zhItem.moreDegrees || [],
          former: zhItem.former || [],
          bodyHtml: "",
        },
        en: {
          name: enItem.name || "",
          positions: enItem.positions || [],
          courses: enItem.courses || [],
          degrees: enItem.degrees || [],
          moreDegrees: enItem.moreDegrees || [],
          former: enItem.former || [],
          bodyHtml: "",
        },
        status: "published",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      });
    });
  }

  // 3. Assemble Zip Package
  // manifest.json
  const manifest = {
    format: "cwts-cms-package",
    version: "1.0",
    collection: "faculty",
    exportedAt: new Date().toISOString(),
    documentsCount: documents.length,
    assetsCount: referencedAssetPaths.size,
    assetBaseFolder: "images/faculty",
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("documents.json", JSON.stringify(documents, null, 2));

  // assets folder
  const assetsFolder = zip.folder("assets");
  let packagedAssetsCount = 0;

  for (const assetRelPath of referencedAssetPaths) {
    const localAssetFile = path.join(publicDir, assetRelPath);
    if (fs.existsSync(localAssetFile)) {
      const fileData = fs.readFileSync(localAssetFile);
      assetsFolder?.file(assetRelPath, fileData);
      packagedAssetsCount++;
    } else {
      console.warn(`⚠️ [Asset Warning] Photo file not found locally: ${localAssetFile}`);
    }
  }

  // Write ZIP file to packages/
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(outputZipPath, zipBuffer);

  console.log(`\n🎉 [Package Created Successfully]`);
  console.log(`   File: ${outputZipPath}`);
  console.log(`   Documents: ${documents.length} unified faculty profiles`);
  console.log(`   Assets Packaged: ${packagedAssetsCount} photos`);
}

exportFacultyPackage().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
