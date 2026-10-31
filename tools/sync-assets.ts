import "./loadEnv";
import { syncAssets } from "../src/integrations/syncFirebaseAssets";

export { syncAssets };

if (process.argv[1] && process.argv[1].includes("sync-assets")) {
  await syncAssets();
}
