import type { Firestore } from "firebase/firestore";
import { collection, getDocs, getDoc, doc, writeBatch, setDoc } from "firebase/firestore";
import type { Migration, MigrationCheckResult, MigrationRunResult, MigrationProgress } from "./types";
import { extractReferencedMediaForCollection } from "../utils/extractMedia";

const MIGRATION_ID = "20260820_extract_referenced_assets";
const TARGET_COLLECTIONS = ["news", "jobs", "faculty", "pages"];

interface DocToMigrate {
  collectionName: string;
  docId: string;
  expectedAssets: string[];
}

export const extractReferencedAssetsMigration: Migration = {
  id: MIGRATION_ID,
  title: "Extract Referenced Media Manifests",
  description:
    "Scans and indexes all media dependencies (images, PDFs, documents) across content collections and populates explicit referencedAssets manifests for high-speed, deterministic builds.",

  async checkNeeded(db: Firestore): Promise<MigrationCheckResult> {
    try {
      // 1. Check if this migration was already completed
      const migrationDoc = await getDoc(doc(db, "_migrations", MIGRATION_ID));
      if (migrationDoc.exists() && migrationDoc.data()?.status === "completed") {
        return { needed: false, pendingCount: 0 };
      }

      let pendingCount = 0;

      // 2. Scan collections for documents missing referencedAssets
      for (const collName of TARGET_COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, collName));
          snap.forEach((d) => {
            const data = d.data();
            if (data.status === "deleted") return;

            const existingAssets: string[] = Array.isArray(data.referencedAssets) ? data.referencedAssets : [];
            const expectedAssets = extractReferencedMediaForCollection(
              collName,
              data,
              undefined,
              data.bodyHtml || data.body || ""
            );

            const isIdentical =
              Array.isArray(data.referencedAssets) &&
              existingAssets.length === expectedAssets.length &&
              existingAssets.slice().sort().every((val, idx) => val === expectedAssets.slice().sort()[idx]);

            if (!isIdentical) {
              pendingCount++;
            }
          });
        } catch {
          // Collection might not exist yet; continue
        }
      }

      return {
        needed: pendingCount > 0,
        pendingCount,
        details: `${pendingCount} document(s) pending media manifest indexing across ${TARGET_COLLECTIONS.join(", ")}.`,
      };
    } catch (err: any) {
      console.warn("⚠️ Migration check error:", err);
      return { needed: false, pendingCount: 0, details: err.message };
    }
  },

  async run(
    db: Firestore,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationRunResult> {
    const docsToUpdate: DocToMigrate[] = [];

    // 1. Collect all documents needing update (Async)
    if (onProgress) onProgress({ current: 0, total: 100, status: "Analyzing documents..." });

    for (const collName of TARGET_COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, collName));
        snap.forEach((d) => {
          const data = d.data();
          if (data.status === "deleted") return;

          const existingAssets: string[] = Array.isArray(data.referencedAssets) ? data.referencedAssets : [];
          const expectedAssets = extractReferencedMediaForCollection(
            collName,
            data,
            undefined,
            data.bodyHtml || data.body || ""
          );

          const isIdentical =
            Array.isArray(data.referencedAssets) &&
            existingAssets.length === expectedAssets.length &&
            existingAssets.slice().sort().every((val, idx) => val === expectedAssets.slice().sort()[idx]);

          if (!isIdentical) {
            docsToUpdate.push({
              collectionName: collName,
              docId: d.id,
              expectedAssets,
            });
          }
        });
      } catch {
        // Collection might not exist yet; ignore
      }
    }

    const total = docsToUpdate.length;
    if (total === 0) {
      // Mark migration completed
      await setDoc(doc(db, "_migrations", MIGRATION_ID), {
        status: "completed",
        title: extractReferencedAssetsMigration.title,
        updatedCount: 0,
        completedAt: new Date().toISOString(),
      });
      return {
        success: true,
        updatedCount: 0,
        message: "All documents already have up-to-date media manifests.",
      };
    }

    // 2. Process in non-blocking batches of 20
    const BATCH_SIZE = 20;
    let processed = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = docsToUpdate.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const docRef = doc(db, item.collectionName, item.docId);
        batch.update(docRef, {
          referencedAssets: item.expectedAssets,
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();
      processed += chunk.length;

      if (onProgress) {
        onProgress({
          current: processed,
          total,
          status: `Indexed ${processed} / ${total} documents...`,
        });
      }

      // Yield execution to browser event loop so UI thread never locks
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // 3. Mark migration completed in Firestore record
    await setDoc(doc(db, "_migrations", MIGRATION_ID), {
      status: "completed",
      title: extractReferencedAssetsMigration.title,
      updatedCount: total,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      updatedCount: total,
      message: `Successfully indexed referencedAssets across ${total} document(s).`,
    };
  },
};
