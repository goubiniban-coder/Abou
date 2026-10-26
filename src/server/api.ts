import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as t } from "@/db";

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** Crée une clé d'API. La clé en clair n'est renvoyée qu'ici : seule son empreinte est stockée. */
export async function createApiKey(name: string) {
  const key = `abou_${randomBytes(24).toString("base64url")}`;
  await db.insert(t.apiKeys).values({ name, hash: hash(key), prefix: key.slice(0, 10) });
  return key;
}

export async function authenticate(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : req.headers.get("x-api-key");
  if (!key) return false;
  const [row] = await db.select().from(t.apiKeys).where(eq(t.apiKeys.hash, hash(key)));
  if (!row) return false;
  await db.update(t.apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(t.apiKeys.id, row.id));
  return true;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const problem = (status: number, title: string, extra: Record<string, unknown> = {}) =>
  Response.json({ title, status, ...extra }, { status, headers: { "Content-Type": "application/problem+json" } });

/** Enveloppe une route : vérifie la clé d'API et convertit les erreurs en réponses JSON. */
export function withApiKey<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    if (!(await authenticate(req))) return problem(401, "Clé d'API manquante ou invalide");
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof z.ZodError) return problem(400, "Données invalides", { errors: e.issues });
      console.error(e);
      return problem(500, "Erreur interne");
    }
  };
}

const isoDate = z.iso.datetime({ offset: true });

export const sessionInput = z.object({
  id: z.string().optional(),
  courseId: z.string(),
  siteId: z.string(),
  mode: z.enum(["inter", "intra"]).default("inter"),
  clientId: z.string().optional(),
  roomId: z.string().optional(),
  status: z.enum(["draft", "confirmed", "cancelled"]).default("draft"),
  slots: z.array(z.object({ start: isoDate, end: isoDate, kind: z.enum(["theory", "practice", "test"]).default("theory") })).min(1),
  assignments: z.array(z.object({ role: z.enum(["theory", "practice", "tester"]), trainerId: z.string() })).default([]),
  equipmentIds: z.array(z.string()).default([]),
  traineeIds: z.array(z.string()).default([]),
});
