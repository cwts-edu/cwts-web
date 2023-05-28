import pdf2img from "pdf-img-convert";
import fs from "fs";
import path from "path";

function isPdfFile(file: string): boolean {
  const ext = path.extname(file);
  return ["pdf"].includes(ext.slice(1));
}

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(entry);
    else if (d.isFile()) yield entry;
  }
}

async function* walkPdfFiles(dir: string): AsyncGenerator<string> {
  for await (const f of walk(dir)) {
    if (isPdfFile(f)) yield f;
  }
}

async function extractPdfCover(pdfFilePath: string, coverFilePath: string) {
  const pages = await pdf2img.convert(pdfFilePath, {
    // width: 408,
    height: 528,
    page_numbers: [1],
  });
  if (pages.length > 0) {
    await fs.promises.writeFile(coverFilePath, pages[0]);
    console.log("Converted", pdfFilePath, "to", coverFilePath);
  } else {
    throw new Error(`Unable to extract page from ${pdfFilePath}`);
  }
}

async function convertDirectory(dir: string) {
  for await (const pdfFilePath of walkPdfFiles(dir)) {
    const coverFilePath = `${pdfFilePath}.cover.png`;
    await extractPdfCover(pdfFilePath, coverFilePath);
  }
}

async function main() {
  convertDirectory("public/docs/newsletter");
}

await main();
