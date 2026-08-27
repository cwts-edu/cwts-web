import "./loadEnv";
import fs from "fs";
import path from "path";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../src/admin/config/firebase";

async function* walkFiles(dir: string): AsyncGenerator<string> {
  if (!fs.existsSync(dir)) return;
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walkFiles(entry);
    else if (d.isFile()) yield entry;
  }
}

async function seedNewsImages() {
  const newsDir = path.resolve("public/images/news");
  if (!fs.existsSync(newsDir)) {
    console.warn("⚠️ Directory 'public/images/news' does not exist. Skipping news images.");
    return;
  }

  console.log("📦 1. Seeding News Thumbnail Images to Firebase Storage (images/news/)...");
  let count = 0;

  for await (const filePath of walkFiles(newsDir)) {
    const fileName = path.basename(filePath);
    if (fileName.startsWith(".")) continue;

    const storagePath = `images/news/${fileName}`;
    const fileRef = ref(storage, storagePath);
    const fileBuffer = await fs.promises.readFile(filePath);

    const ext = path.extname(fileName).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    try {
      await uploadBytes(fileRef, fileBuffer, {
        contentType,
        customMetadata: {
          collectionId: "news-thumbnails",
          uploadedAt: new Date().toISOString(),
          source: "seed-storage",
        },
      });
      const downloadUrl = await getDownloadURL(fileRef).catch(() => "uploaded");
      console.log(`   ✅ Uploaded: ${storagePath}`);
      count++;
    } catch (err: any) {
      console.error(`   ❌ Failed to upload ${storagePath}:`, err.message);
    }
  }

  console.log(`   ✨ Finished seeding ${count} news images.\n`);
}

async function seedJobDocs() {
  const jobsDir = path.resolve("public/docs/jobs");
  if (!fs.existsSync(jobsDir)) {
    console.warn("⚠️ Directory 'public/docs/jobs' does not exist. Skipping job docs.");
    return;
  }

  console.log("📦 2. Seeding Job Description PDF Documents to Firebase Storage (docs/jobs/)...");
  let count = 0;

  for await (const filePath of walkFiles(jobsDir)) {
    const fileName = path.basename(filePath);
    if (!fileName.endsWith(".pdf") || fileName.startsWith(".")) continue;

    const storagePath = `docs/jobs/${fileName}`;
    const fileRef = ref(storage, storagePath);
    const fileBuffer = await fs.promises.readFile(filePath);

    try {
      await uploadBytes(fileRef, fileBuffer, {
        contentType: "application/pdf",
        customMetadata: {
          collectionId: "job-docs",
          uploadedAt: new Date().toISOString(),
          source: "seed-storage",
        },
      });
      console.log(`   ✅ Uploaded: ${storagePath}`);
      count++;
    } catch (err: any) {
      console.error(`   ❌ Failed to upload ${storagePath}:`, err.message);
    }
  }

  console.log(`   ✨ Finished seeding ${count} job PDF documents.\n`);
}

async function main() {
  console.log("🌱 CWTS Firebase Storage Media Seeder");
  console.log("======================================\n");

  await seedNewsImages();
  await seedJobDocs();

  console.log("🎉 Firebase Storage media seeding complete!");
}

try {
  await main();
  process.exit(0);
} catch (err) {
  console.error("❌ Media seeding error:", err);
  process.exit(1);
}
