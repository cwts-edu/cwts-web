import fs from "fs";
import path from "path";
import { NewsMetadataSchema, JobMetadataSchema } from "../src/libs/content/schemas";

interface ParsedDoc<T = any> {
  id: string;
  collection: string;
  data: T;
  body: string;
  bodyHtml: string;
  status: "published" | "draft";
  language: "zh" | "en";
  createdAt: string;
  updatedAt: string;
}

function parseFrontmatter(content: string): { data: Record<string, any>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: content.trim() };
  }

  const rawYaml = match[1];
  const body = match[2].trim();
  const data: Record<string, any> = {};

  const lines = rawYaml.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Check array item
    if (trimmed.startsWith("- ") && currentKey && currentArray) {
      currentArray.push(trimmed.substring(2).trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.substring(0, colonIdx).trim();
      let value = trimmed.substring(colonIdx + 1).trim();

      if (value === "") {
        // Might be starting an array or object
        currentKey = key;
        currentArray = [];
        data[key] = currentArray;
      } else {
        currentKey = null;
        currentArray = null;

        // Strip quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Parse boolean / number / date
        if (value.toLowerCase() === "true") {
          data[key] = true;
        } else if (value.toLowerCase() === "false") {
          data[key] = false;
        } else if (!isNaN(Number(value)) && value.trim() !== "") {
          data[key] = Number(value);
        } else {
          data[key] = value;
        }
      }
    }
  }

  return { data, body };
}

function markdownToBasicHtml(md: string): string {
  if (!md) return "";
  const lines = md.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  return lines.map((line) => `<p>${line.replace(/\\\s*$/, "<br/>")}</p>`).join("\n");
}

async function loadNews(): Promise<ParsedDoc[]> {
  const newsDir = path.resolve("src/content/news");
  const files = await fs.promises.readdir(newsDir);
  const docs: ParsedDoc[] = [];

  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const filePath = path.join(newsDir, file);
    const content = await fs.promises.readFile(filePath, "utf-8");
    const { data, body } = parseFrontmatter(content);

    const validated = NewsMetadataSchema.parse(data);
    const id = path.parse(file).name;

    docs.push({
      id,
      collection: "news",
      data: {
        title: validated.title,
        date: validated.date.toISOString(),
        thumbnail: validated.thumbnail,
        url: validated.url,
      },
      body,
      bodyHtml: markdownToBasicHtml(body),
      status: "published",
      language: "zh",
      createdAt: validated.date.toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return docs.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
}

async function loadJobs(): Promise<ParsedDoc[]> {
  const jobsDir = path.resolve("src/content/jobs");
  const files = await fs.promises.readdir(jobsDir);
  const docs: ParsedDoc[] = [];

  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const filePath = path.join(jobsDir, file);
    const content = await fs.promises.readFile(filePath, "utf-8");
    const { data, body } = parseFrontmatter(content);

    const validated = JobMetadataSchema.parse(data);
    const id = path.parse(file).name;

    docs.push({
      id,
      collection: "jobs",
      data: {
        title: validated.title,
        location: validated.location,
        date: validated.date.toISOString(),
        ...(validated.file ? { file: validated.file } : {}),
      },
      body,
      bodyHtml: markdownToBasicHtml(body),
      status: "published",
      language: "zh",
      createdAt: validated.date.toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return docs.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
}

async function main() {
  const args = process.argv.slice(2);
  const exportDir = path.resolve("data-fixtures");
  await fs.promises.mkdir(exportDir, { recursive: true });

  console.log("🌱 CWTS Firestore Seeding & Migration Tool");
  console.log("=========================================\n");

  console.log("📦 1. Processing 'news' collection...");
  const newsDocs = await loadNews();
  console.log(`   ✅ Loaded and validated ${newsDocs.length} news documents.`);

  console.log("📦 2. Processing 'jobs' collection...");
  const jobsDocs = await loadJobs();
  console.log(`   ✅ Loaded and validated ${jobsDocs.length} job posting documents.`);

  // Write JSON fixtures
  const newsFixturePath = path.join(exportDir, "news.json");
  const jobsFixturePath = path.join(exportDir, "jobs.json");
  await fs.promises.writeFile(newsFixturePath, JSON.stringify(newsDocs, null, 2), "utf-8");
  await fs.promises.writeFile(jobsFixturePath, JSON.stringify(jobsDocs, null, 2), "utf-8");

  console.log("\n📁 Exported JSON Fixtures:");
  console.log(`   - ${newsFixturePath} (${newsDocs.length} items)`);
  console.log(`   - ${jobsFixturePath} (${jobsDocs.length} items)`);

  console.log("\n📋 Sample News Payload:");
  console.log(JSON.stringify(newsDocs[0], null, 2));

  console.log("\n📋 Sample Job Payload:");
  console.log(JSON.stringify(jobsDocs[0], null, 2));

  console.log("\n✨ Seeding fixtures generated successfully!");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
