import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

// Un seul pool partagé, y compris entre les rechargements à chaud en développement.
// En serverless, chaque instance garde peu de connexions et les rend vite au pooler.
const pool = (globalForDb.pool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 5_000,
}));

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { schema };
