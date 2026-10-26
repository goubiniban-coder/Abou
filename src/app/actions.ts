"use server";

import { revalidatePath } from "next/cache";
import { detectConflicts, shiftParisDays, suggestEquipment, suggestRooms, suggestTrainers, type AssignmentRole, type Conflict, type Session } from "@/domain";
import { BlockingConflictError, deleteSession, getSession, loadContext, saveSession } from "@/server/planning";

export type ActionResult = { ok: true; conflicts: Conflict[]; id: string } | { ok: false; blocked: true; conflicts: Conflict[] } | { ok: false; blocked: false; error: string };

async function persist(session: Session, force: boolean): Promise<ActionResult> {
  try {
    const { conflicts } = await saveSession(session, { force });
    revalidatePath("/", "layout");
    return { ok: true, conflicts, id: session.id };
  } catch (e) {
    if (e instanceof BlockingConflictError) return { ok: false, blocked: true, conflicts: e.conflicts };
    console.error(e);
    return { ok: false, blocked: false, error: "L'enregistrement a échoué." };
  }
}

export type PlanningView = "trainer" | "room" | "equipment";

/** Glisser-déposer : décale la session de `deltaDays` et, si besoin, change la ressource de la ligne. */
export async function moveSessionAction(input: {
  sessionId: string;
  deltaDays: number;
  view: PlanningView;
  fromResourceId: string | null;
  toResourceId: string | null;
  force?: boolean;
}): Promise<ActionResult> {
  const session = await getSession(input.sessionId);
  if (!session) return { ok: false, blocked: false, error: "Session introuvable." };
  const moved: Session = {
    ...session,
    slots: session.slots.map((s) => ({ ...s, start: shiftParisDays(s.start, input.deltaDays), end: shiftParisDays(s.end, input.deltaDays) })),
  };
  const { fromResourceId: from, toResourceId: to } = input;
  if (from !== to) {
    if (input.view === "room") {
      moved.roomId = to ?? undefined;
    } else if (input.view === "trainer" && from && to) {
      moved.assignments = moved.assignments.map((a) => (a.trainerId === from ? { ...a, trainerId: to } : a));
    } else if (input.view === "equipment" && from && to) {
      moved.equipmentIds = moved.equipmentIds.map((id) => (id === from ? to : id));
    }
  }
  return persist(moved, input.force ?? false);
}

export async function saveSessionAction(session: Session, force = false): Promise<ActionResult> {
  return persist(session, force);
}

/** Vérification à la volée pendant la saisie d'une session, sans rien enregistrer. */
export async function checkSessionAction(session: Session) {
  const ctx = await loadContext();
  const conflicts = detectConflicts(session, ctx);
  const course = ctx.courses.find((c) => c.id === session.courseId);
  const roles: AssignmentRole[] = ["theory", "practice", "tester"];
  const pack = <T extends { id: string }>(list: { item: T; score: number; available: boolean; reasons: string[]; conflicts: Conflict[] }[]) =>
    list.map((s) => ({ id: s.item.id, score: s.score, available: s.available, reasons: s.reasons, conflicts: s.conflicts.map((c) => c.message) }));
  return {
    conflicts,
    suggestions: {
      rooms: pack(suggestRooms(session, ctx)),
      trainers: Object.fromEntries(roles.map((r) => [r, pack(suggestTrainers(session, r, ctx))])) as Record<AssignmentRole, ReturnType<typeof pack>>,
      equipment: Object.fromEntries((course?.requiredEquipmentKinds ?? []).map((k) => [k, pack(suggestEquipment(session, k, ctx))])),
    },
  };
}

export async function deleteSessionAction(id: string) {
  await deleteSession(id);
  revalidatePath("/", "layout");
}
