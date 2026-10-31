import type { Firestore } from "firebase/firestore";

export interface MigrationProgress {
  current: number;
  total: number;
  status: string;
}

export interface MigrationCheckResult {
  needed: boolean;
  pendingCount: number;
  details?: string;
}

export interface MigrationRunResult {
  success: boolean;
  updatedCount: number;
  message: string;
}

export interface Migration {
  id: string;
  title: string;
  description: string;
  checkNeeded: (db: Firestore) => Promise<MigrationCheckResult>;
  run: (
    db: Firestore,
    onProgress?: (progress: MigrationProgress) => void
  ) => Promise<MigrationRunResult>;
}

export interface PendingMigrationSummary {
  id: string;
  title: string;
  description: string;
  pendingCount: number;
  details?: string;
}
