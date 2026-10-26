import { db, schema as t } from "@/db";
import { parisDay, recyclingsDue } from "@/domain";
import { json, withApiKey } from "@/server/api";
import { listSessions } from "@/server/planning";

/** GET /api/v1/recyclings?horizon=90 : certificats qui expirent dans l'horizon donné (jours). */
export const GET = withApiKey(async (req) => {
  const horizon = Number(new URL(req.url).searchParams.get("horizon") ?? 90);
  const [certs, sessions] = await Promise.all([db.select().from(t.certifications), listSessions()]);
  return json({ data: recyclingsDue(certs, sessions, parisDay(new Date().toISOString()), horizon) });
});
