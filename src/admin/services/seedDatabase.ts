import { db } from "../config/firebase";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import type { AuditUser } from "../../libs/content/types";
import newsFixtures from "../../../data-fixtures/news.json";
import jobsFixtures from "../../../data-fixtures/jobs.json";

export interface SeedResult {
  success: boolean;
  newsCount: number;
  jobsCount: number;
  message: string;
}

export async function seedFirestoreDatabase(author: AuditUser): Promise<SeedResult> {
  try {
    const batch = writeBatch(db);

    // 1. Seed News
    for (const item of newsFixtures) {
      const docRef = doc(db, "news", item.id);
      batch.set(docRef, {
        ...item.data,
        date: item.data.date,
        body: item.body,
        bodyHtml: item.bodyHtml,
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
        data: item.data,
        body: item.body,
        bodyHtml: item.bodyHtml,
        publishedBy: author,
        createdAt: item.createdAt,
      });
    }

    // 2. Seed Jobs
    for (const item of jobsFixtures) {
      const docRef = doc(db, "jobs", item.id);
      batch.set(docRef, {
        ...item.data,
        date: item.data.date,
        body: item.body,
        bodyHtml: item.bodyHtml,
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
        data: item.data,
        body: item.body,
        bodyHtml: item.bodyHtml,
        publishedBy: author,
        createdAt: item.createdAt,
      });
    }

    await batch.commit();

    return {
      success: true,
      newsCount: newsFixtures.length,
      jobsCount: jobsFixtures.length,
      message: `Successfully seeded ${newsFixtures.length} news articles and ${jobsFixtures.length} job postings into live Firestore!`,
    };
  } catch (err: any) {
    console.error("Failed to seed database from Admin UI:", err);
    return {
      success: false,
      newsCount: 0,
      jobsCount: 0,
      message: err.message || "Failed to seed Firestore database",
    };
  }
}
