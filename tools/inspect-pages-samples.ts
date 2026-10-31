import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

async function inspectSamples() {
  const zipPath = path.join(process.cwd(), "packages/pages-package.zip");
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const docs = JSON.parse(await zip.file("documents.json")!.async("string"));

  const targetIds = [
    "zh_about_history",
    "zh_about_effectiveness-statement",
    "zh_donation",
    "zh_about_administration",
    "zh_news-events_forum_2020_1",
    "zh_academic_regulations",
  ];

  console.log("================ SAMPLE CONVERTED PAGES ================\n");

  for (const id of targetIds) {
    const doc = docs.find((d: any) => d.id === id);
    if (!doc) continue;

    console.log(`\n------------------------------------------------------------`);
    console.log(`📄 ID: ${doc.id} | Slug: ${doc.slug} | Title: ${doc.title} | Order: ${doc.order}`);
    console.log(`🖼️ Assets Count: ${doc.referencedAssets?.length || 0}`);
    console.log(`🧩 Has bodyJson AST: ${Boolean(doc.bodyJson && doc.bodyJson.type === "doc")}`);
    console.log(`\n--- Converted bodyHtml Snippet (first 400 chars) ---`);
    console.log(doc.bodyHtml.slice(0, 400));
    console.log(`\n--- Converted bodyHtml Special Tags Found ---`);
    const tags = [];
    if (doc.bodyHtml.includes("<figure")) tags.push("<figure>");
    if (doc.bodyHtml.includes("<object")) tags.push("<object PDF>");
    if (doc.bodyHtml.includes("<iframe")) tags.push("<iframe>");
    if (doc.bodyHtml.includes("<table")) tags.push("<table>");
    if (doc.bodyHtml.includes("rowspan")) tags.push("rowspan");
    if (doc.bodyHtml.includes("mailto:")) tags.push("mailto:");
    if (doc.bodyHtml.includes("footnote")) tags.push("footnote");
    if (doc.bodyHtml.includes("style=")) tags.push("style=");
    console.log("Tags:", tags.join(", "));
  }
}

inspectSamples().catch(console.error);
