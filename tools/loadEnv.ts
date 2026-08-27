import fs from "fs";
import path from "path";

export function loadEnv() {
  const envFiles = [".env", ".env.local", ".env.production"];
  for (const file of envFiles) {
    const envPath = path.resolve(file);
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf("=");
          if (idx > 0) {
            const k = trimmed.slice(0, idx).trim();
            let v = trimmed.slice(idx + 1).trim();
            if (
              (v.startsWith('"') && v.endsWith('"')) ||
              (v.startsWith("'") && v.endsWith("'"))
            ) {
              v = v.slice(1, -1);
            }
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      } catch (err) {
        console.warn(`Could not read ${file}:`, err);
      }
    }
  }
}

loadEnv();
