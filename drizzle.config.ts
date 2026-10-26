import { defineConfig } from "drizzle-kit";

// Charge .env s'il existe (Node 22+), sans dépendance supplémentaire.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
