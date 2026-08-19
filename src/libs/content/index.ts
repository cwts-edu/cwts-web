import { FirebaseContentClient } from "./firebaseClient";
import { AstroContentClient } from "./astroClient";
import { HybridContentClient } from "./hybridClient";
import type { IContentClient } from "./types";

export * from "./types";
export * from "./schemas";
export * from "./constants";
export { FirebaseContentClient } from "./firebaseClient";
export { AstroContentClient } from "./astroClient";
export { HybridContentClient } from "./hybridClient";

const CONTENT_BACKEND =
  (typeof process !== "undefined" && process.env?.CONTENT_BACKEND) ||
  import.meta.env?.CONTENT_BACKEND ||
  "astro";

const FIREBASE_PROJECT_ID =
  (typeof process !== "undefined" && process.env?.FIREBASE_PROJECT_ID) ||
  import.meta.env?.FIREBASE_PROJECT_ID ||
  "cwts-web-production";

const astroClient = new AstroContentClient();

function createContentClient(): IContentClient {
  if (CONTENT_BACKEND === "firebase") {
    return new FirebaseContentClient({ projectId: FIREBASE_PROJECT_ID });
  }

  if (CONTENT_BACKEND === "hybrid") {
    return new HybridContentClient({
      firebase: new FirebaseContentClient({ projectId: FIREBASE_PROJECT_ID }),
      astro: astroClient,
      migrated: [], // Empty by default until collections are migrated
    });
  }

  return astroClient;
}

export const content: IContentClient = createContentClient();
export default content;
