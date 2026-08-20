import { db, storage } from "../config/firebase";
import { doc, writeBatch } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import type { AuditUser } from "../../libs/content/types";
import { INITIAL_NEWS_FIXTURES, INITIAL_JOBS_FIXTURES } from "../fixtures/initialContent";
import { extractReferencedMediaForCollection } from "../utils/extractMedia";

export interface SeedResult {
  success: boolean;
  newsCount: number;
  jobsCount: number;
  assetsCount: number;
  message: string;
}

/**
 * Seeds initial content documents to Cloud Firestore and upload initial
 * news thumbnails and job PDF assets to Firebase Storage.
 */
export async function seedFirestoreDatabase(
  author: AuditUser,
  onProgress?: (status: string) => void
): Promise<SeedResult> {
  try {
    const batch = writeBatch(db);

    // 1. Seed News Documents
    if (onProgress) onProgress("Writing news articles to Firestore...");
    for (const item of INITIAL_NEWS_FIXTURES) {
      const referencedAssets = extractReferencedMediaForCollection(
        "news",
        item.data,
        undefined,
        item.bodyHtml || item.body
      );

      const docRef = doc(db, "news", item.id);
      batch.set(docRef, {
        ...item.data,
        date: item.data.date,
        body: item.body,
        bodyHtml: item.bodyHtml,
        referencedAssets,
        status: "published",
        version: 1,
        publishedVersion: 1,
        language: item.language,
        publishedBy: author,
        updatedBy: author,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
      });

      // Version Snapshot 1
      const verRef = doc(db, "news", item.id, "versions", "1");
      batch.set(verRef, {
        version: 1,
        status: "published",
        data: { ...item.data, referencedAssets },
        body: item.body,
        bodyHtml: item.bodyHtml,
        publishedBy: author,
        createdAt: item.createdAt,
      });
    }

    // 2. Seed Jobs Documents
    if (onProgress) onProgress("Writing job postings to Firestore...");
    for (const item of INITIAL_JOBS_FIXTURES) {
      const referencedAssets = extractReferencedMediaForCollection(
        "jobs",
        item.data,
        undefined,
        item.bodyHtml || item.body
      );

      const docRef = doc(db, "jobs", item.id);
      batch.set(docRef, {
        ...item.data,
        date: item.data.date,
        body: item.body,
        bodyHtml: item.bodyHtml,
        referencedAssets,
        status: "published",
        version: 1,
        publishedVersion: 1,
        language: item.language,
        publishedBy: author,
        updatedBy: author,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
      });

      // Version Snapshot 1
      const verRef = doc(db, "jobs", item.id, "versions", "1");
      batch.set(verRef, {
        version: 1,
        status: "published",
        data: { ...item.data, referencedAssets },
        body: item.body,
        bodyHtml: item.bodyHtml,
        publishedBy: author,
        createdAt: item.createdAt,
      });
    }

    await batch.commit();

    // 3. Seed Media Assets into Firebase Storage
    if (onProgress) onProgress("Seeding media assets to Firebase Storage...");
    let assetsCount = 0;

    const assetsToSeed: Array<{ path: string; collectionId: string; contentType: string }> = [];

    for (const n of INITIAL_NEWS_FIXTURES) {
      if (n.data.thumbnail && n.data.thumbnail.startsWith("/images/news/")) {
        assetsToSeed.push({
          path: n.data.thumbnail,
          collectionId: "news-thumbnails",
          contentType: "image/jpeg",
        });
      }
    }

    for (const j of INITIAL_JOBS_FIXTURES) {
      if (j.data.file && j.data.file.startsWith("/docs/jobs/")) {
        assetsToSeed.push({
          path: j.data.file,
          collectionId: "job-docs",
          contentType: "application/pdf",
        });
      }
    }

    for (const asset of assetsToSeed) {
      try {
        const response = await fetch(asset.path);
        if (response.ok) {
          const blob = await response.blob();
          const storagePath = asset.path.replace(/^\/+/, "");
          const fileRef = ref(storage, storagePath);
          await uploadBytes(fileRef, blob, {
            contentType: asset.contentType,
            customMetadata: {
              collectionId: asset.collectionId,
              seededBy: author.email,
              uploadedAt: new Date().toISOString(),
            },
          });
          assetsCount++;
        }
      } catch (assetErr) {
        console.warn(`Could not seed asset ${asset.path} to storage:`, assetErr);
      }
    }

    return {
      success: true,
      newsCount: INITIAL_NEWS_FIXTURES.length,
      jobsCount: INITIAL_JOBS_FIXTURES.length,
      assetsCount,
      message: `Successfully seeded ${INITIAL_NEWS_FIXTURES.length} news articles, ${INITIAL_JOBS_FIXTURES.length} job postings, and ${assetsCount} media assets into Firebase!`,
    };
  } catch (err: any) {
    console.error("Failed to seed database from Admin UI:", err);
    return {
      success: false,
      newsCount: 0,
      jobsCount: 0,
      assetsCount: 0,
      message: err.message || "Failed to seed Firestore database and Storage",
    };
  }
}
