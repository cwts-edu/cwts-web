import { db } from "../config/firebase";
import { doc, writeBatch } from "firebase/firestore";
import type { AuditUser } from "../../libs/content/types";
import { INITIAL_NEWS_FIXTURES, INITIAL_JOBS_FIXTURES } from "../fixtures/initialContent";

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
    for (const item of INITIAL_NEWS_FIXTURES) {
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
    for (const item of INITIAL_JOBS_FIXTURES) {
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
      newsCount: INITIAL_NEWS_FIXTURES.length,
      jobsCount: INITIAL_JOBS_FIXTURES.length,
      message: `Successfully seeded ${INITIAL_NEWS_FIXTURES.length} news articles and ${INITIAL_JOBS_FIXTURES.length} job postings into live Firestore!`,
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
