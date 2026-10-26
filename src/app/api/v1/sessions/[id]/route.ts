import { detectConflicts } from "@/domain";
import { json, problem, sessionInput, withApiKey } from "@/server/api";
import { BlockingConflictError, deleteSession, getSession, loadContext, saveSession } from "@/server/planning";

type Ctx = RouteContext<"/api/v1/sessions/[id]">;

export const GET = withApiKey(async (_req, { params }: Ctx) => {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return problem(404, "Session introuvable");
  return json({ data: session, conflicts: detectConflicts(session, await loadContext()) });
});

export const PUT = withApiKey(async (req, { params }: Ctx) => {
  const { id } = await params;
  if (!(await getSession(id))) return problem(404, "Session introuvable");
  const input = sessionInput.parse(await req.json());
  const force = new URL(req.url).searchParams.get("force") === "true";
  try {
    const { session, conflicts } = await saveSession({ ...input, id }, { force });
    return json({ data: session, conflicts });
  } catch (e) {
    if (e instanceof BlockingConflictError) return problem(409, e.message, { conflicts: e.conflicts });
    throw e;
  }
});

export const DELETE = withApiKey(async (_req, { params }: Ctx) => {
  const { id } = await params;
  await deleteSession(id);
  return new Response(null, { status: 204 });
});
