import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import {
  parseAssemblyCsv,
  getDefaultSemesterTitle,
  calculateSemesterOrder,
  renderAssemblyTableHtml,
  sortAssemblyTables,
} from "../src/libs/content/assemblyUtils";
import type { AssemblyColumn, AssemblyRow } from "../src/libs/content/schemas";

interface AssemblyDocument {
  id: string;
  title: string;
  semester: string;
  order: number;
  isUpcoming: boolean;
  columns: AssemblyColumn[];
  rows: AssemblyRow[];
  body: string;
  bodyHtml: string;
  bodyJson: any;
  referencedAssets: string[];
  status: "published";
  language: "zh";
  version: number;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
}

async function exportAssemblyPackage() {
  console.log("📦 [Package Generator] Exporting Assembly Schedule Package...");

  const baseDir = process.cwd();
  const assemblyCsvDir = path.join(baseDir, "src/content/csv/assembly");
  const outputZipPath = path.join(baseDir, "packages/assembly-package.zip");

  fs.mkdirSync(path.join(baseDir, "packages"), { recursive: true });

  const zip = new JSZip();
  const documents: AssemblyDocument[] = [];

  const files = fs.readdirSync(assemblyCsvDir).filter((f) => f.endsWith(".csv"));
  console.log(`Found ${files.length} assembly CSV files.`);

  for (const file of files) {
    const filePath = path.join(assemblyCsvDir, file);
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const filename = path.parse(file).name;
    const isUpcoming = filename.toLowerCase() === "upcoming";

    const { columns, rows } = parseAssemblyCsv(rawContent);
    const title = getDefaultSemesterTitle(filename, isUpcoming);
    const order = calculateSemesterOrder(filename, isUpcoming);
    const bodyHtml = renderAssemblyTableHtml(columns, rows);

    const doc: AssemblyDocument = {
      id: filename,
      title,
      semester: filename,
      order,
      isUpcoming,
      columns,
      rows,
      body: rawContent,
      bodyHtml,
      bodyJson: { columns, rows },
      referencedAssets: [],
      status: "published",
      language: "zh",
      version: 1,
      publishedVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    documents.push(doc);
  }

  // Sort descending by order (upcoming on top, then newest past to oldest)
  const sortedDocuments = sortAssemblyTables(documents);

  // 1. Write manifest.json
  const manifest = {
    format: "cwts-cms-package",
    version: "1.0",
    collection: "assembly",
    exportedAt: new Date().toISOString(),
    documentsCount: documents.length,
    assetsCount: 0,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 2. Write documents.json
  zip.file("documents.json", JSON.stringify(sortedDocuments, null, 2));

  // 3. Generate and save ZIP file
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, zipBuffer);

  console.log(`✅ [Package Generator] Assembly Package generated successfully!`);
  console.log(`   - Output: ${outputZipPath}`);
  console.log(`   - Documents: ${documents.length}`);
}

exportAssemblyPackage().catch((err) => {
  console.error("❌ Failed to export assembly package:", err);
  process.exit(1);
});
