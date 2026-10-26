import { detectAllConflicts } from "@/domain";
import { json, problem, sessionInput, withApiKey } from "@/server/api";
import { BlockingConflictError, loadContext, saveSession } from "@/server/planning";

/** GET /api/v1/sessions?from=2026-11-01&to=2026-11-30 */
export const GET = withApiKey(async (req) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const ctx = await loadContext();
  const conflicts = detectAllConflicts(ctx);
  const sessions = ctx.sessions
    .filter((s) => s.slots.some((sl) => (!from || sl.end >= from) && (!to || sl.start <= `${to}T23:59:59Z`)))
    .map((s) => ({ ...s, conflicts: conflicts.filter((c) => c.sessionId === s.id || c.otherSessionId === s.id) }));
  return json({ data: sessions });
});

/** POST /api/v1/sessions : crée une session. Répond 409 si une session confirmée a des conflits bloquants. */
export const POST = withApiKey(async (req) => {
  const input = sessionInput.parse(await req.json());
  const force = new URL(req.url).searchParams.get("force") === "true";
  try {
    const { session, conflicts } = await saveSession({ ...input, id: input.id ?? crypto.randomUUID() }, { force });
    return json({ data: session, conflicts }, 201);
  } catch (e) {
    if (e instanceof BlockingConflictError) return problem(409, e.message, { conflicts: e.conflicts });
    throw e;
  }
});
