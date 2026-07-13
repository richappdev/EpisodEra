import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.production");
const requiredKeys = [
  "VITE_API_BASE_URL",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

if (!fs.existsSync(envPath)) {
  console.error("Missing web/.env.production. Copy web/.env.production.example and fill production values before deploying.");
  process.exit(1);
}

const envText = fs.readFileSync(envPath, "utf8");
const values = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const missing = requiredKeys.filter((key) => {
  const value = values[key]?.trim();
  return !value || value.startsWith("replace-with-");
});

if (missing.length > 0) {
  console.error(`web/.env.production is missing or still has placeholder values for: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Production web env validated.");
