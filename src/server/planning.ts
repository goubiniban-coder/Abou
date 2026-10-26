import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { detectConflicts, hasBlockingConflict, type Conflict, type PlanningContext, type Session, type Slot } from "@/domain";

const iso = (s: string) => new Date(s).toISOString();

type SessionRow = typeof t.sessions.$inferSelect & {
  slots: (typeof t.slots.$inferSelect)[];
  assignments: (typeof t.assignments.$inferSelect)[];
  equipment: (typeof t.sessionEquipment.$inferSelect)[];
  enrollments: (typeof t.enrollments.$inferSelect)[];
};

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    courseId: row.courseId,
    siteId: row.siteId,
    mode: row.mode,
    clientId: row.clientId ?? undefined,
    roomId: row.roomId ?? undefined,
    status: row.status,
    slots: row.slots
      .map((s) => ({ start: iso(s.start), end: iso(s.end), kind: s.kind }))
      .sort((a, b) => a.start.localeCompare(b.start)),
    assignments: row.assignments.map((a) => ({ role: a.role, trainerId: a.trainerId })),
    equipmentIds: row.equipment.map((e) => e.equipmentId),
    traineeIds: row.enrollments.map((e) => e.traineeId),
  };
}

const withChildren = { slots: true, assignments: true, equipment: true, enrollments: true } as const;

export async function listSessions(): Promise<Session[]> {
  const rows = await db.query.sessions.findMany({ with: withChildren });
  return rows.map(toSession);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const row = await db.query.sessions.findFirst({ where: eq(t.sessions.id, id), with: withChildren });
  return row ? toSession(row) : undefined;
}

/** Charge tout ce dont le moteur de règles a besoin. */
export async function loadContext(): Promise<PlanningContext> {
  const [sites, rooms, trainers, equipment, courses, sessions, unavailabilities] = await Promise.all([
    db.select().from(t.sites),
    db.select().from(t.rooms),
    db.select().from(t.trainers),
    db.select().from(t.equipment),
    db.select().from(t.courses),
    listSessions(),
    db.select().from(t.unavailabilities),
  ]);
  return {
    sites: sites.map((s) => ({ id: s.id, name: s.name, city: s.city ?? undefined })),
    rooms,
    trainers: trainers.map((tr) => ({
      id: tr.id,
      firstName: tr.firstName,
      lastName: tr.lastName,
      email: tr.email ?? undefined,
      external: tr.external,
      siteId: tr.siteId ?? undefined,
      competences: tr.competences,
      testUnitsPerDay: tr.testUnitsPerDay ?? undefined,
    })),
    equipment: equipment.map((e) => ({ ...e, siteId: e.siteId ?? undefined })),
    courses: courses.map((c) => ({
      ...c,
      testUnitsPerTrainee: c.testUnitsPerTrainee ?? undefined,
      validityMonths: c.validityMonths ?? undefined,
      color: c.color ?? undefined,
    })),
    sessions,
    unavailabilities: unavailabilities.map((u) => ({ ...u, start: iso(u.start), end: iso(u.end), reason: u.reason ?? undefined })),
  };
}

export class BlockingConflictError extends Error {
  constructor(public conflicts: Conflict[]) {
    super("La session présente des conflits bloquants.");
  }
}

export interface SaveResult {
  session: Session;
  conflicts: Conflict[];
}

/**
 * Crée ou remplace une session. Une session confirmée ne peut pas être enregistrée
 * avec un conflit bloquant ; un brouillon, si, pour être corrigé ensuite.
 */
export async function saveSession(input: Session, opts: { force?: boolean } = {}): Promise<SaveResult> {
  const ctx = await loadContext();
  const conflicts = detectConflicts(input, ctx);
  if (input.status === "confirmed" && hasBlockingConflict(conflicts) && !opts.force) {
    throw new BlockingConflictError(conflicts);
  }
  await db.transaction(async (tx) => {
    const values = {
      courseId: input.courseId,
      siteId: input.siteId,
      mode: input.mode,
      clientId: input.clientId ?? null,
      roomId: input.roomId ?? null,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };
    await tx.insert(t.sessions).values({ id: input.id, ...values }).onConflictDoUpdate({ target: t.sessions.id, set: values });
    await tx.delete(t.slots).where(eq(t.slots.sessionId, input.id));
    await tx.delete(t.assignments).where(eq(t.assignments.sessionId, input.id));
    await tx.delete(t.sessionEquipment).where(eq(t.sessionEquipment.sessionId, input.id));
    await tx.delete(t.enrollments).where(eq(t.enrollments.sessionId, input.id));
    if (input.slots.length) await tx.insert(t.slots).values(input.slots.map((s) => ({ sessionId: input.id, ...s })));
    if (input.assignments.length) await tx.insert(t.assignments).values(input.assignments.map((a) => ({ sessionId: input.id, ...a })));
    if (input.equipmentIds.length) await tx.insert(t.sessionEquipment).values(input.equipmentIds.map((equipmentId) => ({ sessionId: input.id, equipmentId })));
    if (input.traineeIds.length) await tx.insert(t.enrollments).values(input.traineeIds.map((traineeId) => ({ sessionId: input.id, traineeId })));
  });
  return { session: input, conflicts };
}

export async function deleteSession(id: string) {
  await db.delete(t.sessions).where(eq(t.sessions.id, id));
}

/** Décale tous les créneaux d'une session (glisser-déposer sur le planning). */
export function shiftSlots(slots: Slot[], deltaMs: number): Slot[] {
  return slots.map((s) => ({
    ...s,
    start: new Date(Date.parse(s.start) + deltaMs).toISOString(),
    end: new Date(Date.parse(s.end) + deltaMs).toISOString(),
  }));
}

export async function trainersByIds(ids: string[]) {
  return ids.length ? db.select().from(t.trainers).where(inArray(t.trainers.id, ids)) : [];
}
