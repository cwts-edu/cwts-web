import type { Firestore } from "firebase/firestore";
import type { Migration, PendingMigrationSummary, MigrationProgress, MigrationRunResult } from "./types";
import { extractReferencedAssetsMigration } from "./001_extract_referenced_assets";

export * from "./types";

/**
 * Ordered list of all system migrations.
 */
export const ALL_MIGRATIONS: Migration[] = [
  extractReferencedAssetsMigration,
];

/**
 * Asynchronously checks which migrations are pending in the background.
 * Returns a summary list of pending migrations with document counts.
 */
export async function checkPendingMigrations(db: Firestore): Promise<PendingMigrationSummary[]> {
  const pending: PendingMigrationSummary[] = [];

  for (const migration of ALL_MIGRATIONS) {
    try {
      const result = await migration.checkNeeded(db);
      if (result.needed) {
        pending.push({
          id: migration.id,
          title: migration.title,
          description: migration.description,
          pendingCount: result.pendingCount,
          details: result.details,
        });
      }
    } catch (e) {
      console.warn(`Could not check migration ${migration.id}:`, e);
    }
  }

  return pending;
}

/**
 * Executes a single migration asynchronously with non-blocking progress updates.
 */
export async function runMigration(
  migrationId: string,
  db: Firestore,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationRunResult> {
  const migration = ALL_MIGRATIONS.find((m) => m.id === migrationId);
  if (!migration) {
    return {
      success: false,
      updatedCount: 0,
      message: `Migration "${migrationId}" not found in registry.`,
    };
  }

  return migration.run(db, onProgress);
}

/**
 * Executes all pending migrations sequentially with aggregate progress tracking.
 */
export async function runAllPendingMigrations(
  db: Firestore,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationRunResult> {
  const pendingList = await checkPendingMigrations(db);
  if (pendingList.length === 0) {
    return {
      success: true,
      updatedCount: 0,
      message: "No pending migrations found.",
    };
  }

  let totalUpdated = 0;
  for (let i = 0; i < pendingList.length; i++) {
    const item = pendingList[i];
    const migration = ALL_MIGRATIONS.find((m) => m.id === item.id);
    if (!migration) continue;

    if (onProgress) {
      onProgress({
        current: i,
        total: pendingList.length,
        status: `Running migration [${i + 1}/${pendingList.length}]: ${migration.title}...`,
      });
    }

    const res = await migration.run(db, (p) => {
      if (onProgress) {
        onProgress({
          current: p.current,
          total: p.total,
          status: `[${migration.title}] ${p.status}`,
        });
      }
    });

    if (!res.success) {
      return res;
    }
    totalUpdated += res.updatedCount;
  }

  return {
    success: true,
    updatedCount: totalUpdated,
    message: `All ${pendingList.length} migration(s) completed successfully (${totalUpdated} document(s) updated).`,
  };
}
