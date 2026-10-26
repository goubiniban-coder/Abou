import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

// Une seule connexion partagée, y compris entre les rechargements à chaud en développement.
const pool = (globalForDb.pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { schema };
