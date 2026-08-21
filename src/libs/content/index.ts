import { FirebaseContentClient, resolveActiveDraftId } from "./firebaseClient";
import { AstroContentClient } from "./astroClient";
import { HybridContentClient } from "./hybridClient";
import type { IContentClient } from "./types";
import type { ContentSchemaMap } from "./schemas";

export * from "./types";
export * from "./schemas";
export * from "./constants";
export { FirebaseContentClient } from "./firebaseClient";
export { AstroContentClient } from "./astroClient";
export { HybridContentClient } from "./hybridClient";

const activeDraftId = resolveActiveDraftId();

const RAW_CONTENT_BACKEND =
  (typeof process !== "undefined" && (process.env?.CONTENT_SOURCE || process.env?.CONTENT_BACKEND)) ||
  import.meta.env?.CONTENT_SOURCE ||
  import.meta.env?.CONTENT_BACKEND ||
  (activeDraftId ? "hybrid" : "astro");

const FIREBASE_PROJECT_ID =
  (typeof process !== "undefined" &&
    (process.env?.PUBLIC_FIREBASE_PROJECT_ID || process.env?.FIREBASE_PROJECT_ID)) ||
  import.meta.env?.PUBLIC_FIREBASE_PROJECT_ID ||
  import.meta.env?.FIREBASE_PROJECT_ID ||
  "cwts-cms";

const ALL_MIGRATED_COLLECTIONS: Array<keyof ContentSchemaMap> = [
  "news",
  "jobs",
  "faculty",
  "carousel",
  "degrees-widget",
  "study-mode-widget",
  "shortcuts",
];

const MIGRATED_RAW =
  (typeof process !== "undefined" && process.env?.MIGRATED_COLLECTIONS) ||
  import.meta.env?.MIGRATED_COLLECTIONS ||
  "all";

const MIGRATED_COLLECTIONS: Array<keyof ContentSchemaMap> =
  MIGRATED_RAW.trim() === "all"
    ? ALL_MIGRATED_COLLECTIONS
    : (MIGRATED_RAW.split(",").map((s) => s.trim()).filter(Boolean) as Array<keyof ContentSchemaMap>);

const astroClient = new AstroContentClient();

function createContentClient(): IContentClient {
  const firebaseClient = new FirebaseContentClient({
    projectId: FIREBASE_PROJECT_ID,
    draftId: activeDraftId,
  });

  if (activeDraftId) {
    console.log(`🚀 [Preview Build] Initialized with Draft Workspace: "${activeDraftId}"`);
  }

  if (RAW_CONTENT_BACKEND === "firebase") {
    return firebaseClient;
  }

  if (RAW_CONTENT_BACKEND === "hybrid" || activeDraftId) {
    return new HybridContentClient({
      firebase: firebaseClient,
      astro: astroClient,
      migrated: MIGRATED_COLLECTIONS,
    });
  }

  return astroClient;
}

export const content: IContentClient = createContentClient();
export default content;
