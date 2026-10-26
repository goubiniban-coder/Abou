import { suggestEquipment, suggestRooms, suggestTrainers, type AssignmentRole } from "@/domain";
import { json, problem, withApiKey } from "@/server/api";
import { getSession, loadContext } from "@/server/planning";

/** GET /api/v1/sessions/{id}/suggestions?role=tester : ressources compatibles, classées. */
export const GET = withApiKey(async (req, { params }: RouteContext<"/api/v1/sessions/[id]/suggestions">) => {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return problem(404, "Session introuvable");
  const ctx = await loadContext();
  const role = (new URL(req.url).searchParams.get("role") ?? "theory") as AssignmentRole;
  const course = ctx.courses.find((c) => c.id === session.courseId);
  const flat = <T extends { id: string }>(list: { item: T; score: number; available: boolean; reasons: string[]; conflicts: { message: string }[] }[]) =>
    list.map((s) => ({ id: s.item.id, score: s.score, available: s.available, reasons: s.reasons, conflicts: s.conflicts.map((c) => c.message) }));
  return json({
    trainers: flat(suggestTrainers(session, role, ctx)),
    rooms: flat(suggestRooms(session, ctx)),
    equipment: Object.fromEntries((course?.requiredEquipmentKinds ?? []).map((k) => [k, flat(suggestEquipment(session, k, ctx))])),
  });
});
