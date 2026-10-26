import { frenchDay, isBefore, overlaps, parisDay, span } from "./time";
import type { Course, Id, PlanningContext, ResourceType, Session, Slot, Trainer } from "./types";

export type ConflictCode =
  | "room_double_booked"
  | "trainer_double_booked"
  | "equipment_double_booked"
  | "resource_unavailable"
  | "room_too_small"
  | "too_many_trainees"
  | "missing_competence"
  | "competence_expired"
  | "tester_over_capacity"
  | "missing_tester"
  | "missing_equipment"
  | "room_other_site"
  | "missing_room";

/** error : la session ne peut pas être confirmée en l'état. warning : à vérifier. */
export type Severity = "error" | "warning";

export interface Conflict {
  code: ConflictCode;
  severity: Severity;
  message: string;
  sessionId: Id;
  resource?: { type: ResourceType; id: Id };
  /** Autre session impliquée (double réservation, capacité testeur). */
  otherSessionId?: Id;
  day?: string;
}

const trainerName = (t: Trainer) => `${t.firstName} ${t.lastName}`;

/** Sessions actives qui partagent au moins un créneau avec `session`. */
function overlappingSessions(session: Session, ctx: PlanningContext): { other: Session; slot: Slot }[] {
  const out: { other: Session; slot: Slot }[] = [];
  for (const other of ctx.sessions) {
    if (other.id === session.id || other.status === "cancelled") continue;
    const slot = session.slots.find((s) => other.slots.some((o) => overlaps(s, o)));
    if (slot) out.push({ other, slot });
  }
  return out;
}

/** Unités de test qu'une session impose à chaque jour où elle a un créneau de test. */
export function testUnitsByDay(session: Session, course: Course | undefined): Map<string, number> {
  const result = new Map<string, number>();
  const perTrainee = course?.testUnitsPerTrainee ?? 0;
  if (!perTrainee) return result;
  const testDays = [...new Set(session.slots.filter((s) => s.kind === "test").map((s) => parisDay(s.start)))];
  if (testDays.length === 0) return result;
  const total = perTrainee * session.traineeIds.length;
  for (const day of testDays) result.set(day, total / testDays.length);
  return result;
}

/** Unités de test déjà planifiées pour un testeur sur une journée, toutes sessions confondues. */
export function testerLoad(trainerId: Id, day: string, ctx: PlanningContext, sessions = ctx.sessions): number {
  let load = 0;
  for (const s of sessions) {
    if (s.status === "cancelled") continue;
    if (!s.assignments.some((a) => a.role === "tester" && a.trainerId === trainerId)) continue;
    const testers = s.assignments.filter((a) => a.role === "tester").length;
    const course = ctx.courses.find((c) => c.id === s.courseId);
    load += (testUnitsByDay(s, course).get(day) ?? 0) / testers;
  }
  return load;
}

/**
 * Vérifie une session (nouvelle ou modifiée) contre le reste du planning.
 * `ctx.sessions` peut contenir l'ancienne version de la session : elle est ignorée.
 */
export function detectConflicts(session: Session, ctx: PlanningContext): Conflict[] {
  if (session.status === "cancelled") return [];
  const conflicts: Conflict[] = [];
  const add = (c: Omit<Conflict, "sessionId">) => conflicts.push({ sessionId: session.id, ...c });
  const course = ctx.courses.find((c) => c.id === session.courseId);
  const room = ctx.rooms.find((r) => r.id === session.roomId);
  const period = span(session.slots);
  const others = overlappingSessions(session, ctx);

  // Salle
  if (session.mode === "inter" && !session.roomId) {
    add({ code: "missing_room", severity: "warning", message: "Aucune salle n'est réservée pour cette session." });
  }
  if (room) {
    if (room.capacity < session.traineeIds.length) {
      add({
        code: "room_too_small",
        severity: "error",
        message: `La salle ${room.name} accueille ${room.capacity} personnes pour ${session.traineeIds.length} inscrits.`,
        resource: { type: "room", id: room.id },
      });
    }
    if (room.siteId !== session.siteId) {
      add({
        code: "room_other_site",
        severity: "warning",
        message: `La salle ${room.name} n'est pas sur le site de la session.`,
        resource: { type: "room", id: room.id },
      });
    }
    for (const { other, slot } of others) {
      if (other.roomId === room.id) {
        add({
          code: "room_double_booked",
          severity: "error",
          message: `La salle ${room.name} est déjà réservée le ${frenchDay(parisDay(slot.start))}.`,
          resource: { type: "room", id: room.id },
          otherSessionId: other.id,
          day: parisDay(slot.start),
        });
      }
    }
  }

  if (course && session.traineeIds.length > course.maxTrainees) {
    add({
      code: "too_many_trainees",
      severity: "warning",
      message: `${session.traineeIds.length} inscrits pour un maximum de ${course.maxTrainees}.`,
    });
  }

  // Formateurs
  const trainerIds = [...new Set(session.assignments.map((a) => a.trainerId))];
  for (const trainerId of trainerIds) {
    const trainer = ctx.trainers.find((t) => t.id === trainerId);
    if (!trainer) continue;
    const name = trainerName(trainer);
    for (const { other, slot } of others) {
      if (other.assignments.some((a) => a.trainerId === trainerId)) {
        add({
          code: "trainer_double_booked",
          severity: "error",
          message: `${name} intervient déjà sur une autre session le ${frenchDay(parisDay(slot.start))}.`,
          resource: { type: "trainer", id: trainerId },
          otherSessionId: other.id,
          day: parisDay(slot.start),
        });
      }
    }
    for (const code of course?.requiredCompetences ?? []) {
      const competence = trainer.competences.find((c) => c.code === code);
      if (!competence) {
        add({
          code: "missing_competence",
          severity: "error",
          message: `${name} n'a pas la compétence ${code}.`,
          resource: { type: "trainer", id: trainerId },
        });
      } else if (competence.validUntil && period && isBefore(competence.validUntil, period.end)) {
        add({
          code: "competence_expired",
          severity: "error",
          message: `L'habilitation ${code} de ${name} expire le ${frenchDay(competence.validUntil)}, avant la fin de la session.`,
          resource: { type: "trainer", id: trainerId },
        });
      }
    }
  }

  // Testeurs CACES
  const testers = session.assignments.filter((a) => a.role === "tester");
  const ownUnits = testUnitsByDay(session, course);
  if (ownUnits.size > 0 && testers.length === 0) {
    add({ code: "missing_tester", severity: "error", message: "La session comporte des tests mais aucun testeur." });
  }
  const otherSessions = ctx.sessions.filter((s) => s.id !== session.id);
  for (const { trainerId } of testers) {
    const trainer = ctx.trainers.find((t) => t.id === trainerId);
    if (!trainer?.testUnitsPerDay) continue;
    for (const [day, units] of ownUnits) {
      const load = testerLoad(trainerId, day, ctx, otherSessions) + units / testers.length;
      if (load > trainer.testUnitsPerDay) {
        add({
          code: "tester_over_capacity",
          severity: "error",
          message: `${trainerName(trainer)} aurait ${round(load)} unités de test le ${frenchDay(day)} pour une capacité de ${trainer.testUnitsPerDay}.`,
          resource: { type: "trainer", id: trainerId },
          day,
        });
      }
    }
  }

  // Matériel
  const equipment = session.equipmentIds
    .map((id) => ctx.equipment.find((e) => e.id === id))
    .filter((e) => e !== undefined);
  for (const kind of course?.requiredEquipmentKinds ?? []) {
    if (!equipment.some((e) => e.kind === kind)) {
      add({ code: "missing_equipment", severity: "warning", message: `Aucun matériel de type ${kind} n'est réservé.` });
    }
  }
  for (const item of equipment) {
    for (const { other, slot } of others) {
      if (other.equipmentIds.includes(item.id)) {
        add({
          code: "equipment_double_booked",
          severity: "error",
          message: `${item.name} est déjà réservé le ${frenchDay(parisDay(slot.start))}.`,
          resource: { type: "equipment", id: item.id },
          otherSessionId: other.id,
          day: parisDay(slot.start),
        });
      }
    }
  }

  // Indisponibilités
  const used: { type: ResourceType; id: Id; label: string }[] = [
    ...(room ? [{ type: "room" as const, id: room.id, label: `La salle ${room.name}` }] : []),
    ...trainerIds.flatMap((id) => {
      const t = ctx.trainers.find((x) => x.id === id);
      return t ? [{ type: "trainer" as const, id, label: trainerName(t) }] : [];
    }),
    ...equipment.map((e) => ({ type: "equipment" as const, id: e.id, label: e.name })),
  ];
  for (const r of used) {
    for (const u of ctx.unavailabilities) {
      if (u.resourceType !== r.type || u.resourceId !== r.id) continue;
      const slot = session.slots.find((s) => overlaps(s, u));
      if (slot) {
        add({
          code: "resource_unavailable",
          severity: "error",
          message: `${r.label} est indisponible le ${frenchDay(parisDay(slot.start))}${u.reason ? ` (${u.reason})` : ""}.`,
          resource: { type: r.type, id: r.id },
          day: parisDay(slot.start),
        });
      }
    }
  }

  return dedupe(conflicts);
}

/** Tous les conflits du planning, chaque double réservation n'étant signalée qu'une fois. */
export function detectAllConflicts(ctx: PlanningContext): Conflict[] {
  const seen = new Set<string>();
  const out: Conflict[] = [];
  for (const s of ctx.sessions) {
    for (const c of detectConflicts(s, ctx)) {
      const pair = c.otherSessionId ? [c.sessionId, c.otherSessionId].sort().join("|") : c.sessionId;
      const key = `${c.code}|${pair}|${c.resource?.id ?? ""}|${c.day ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

export const hasBlockingConflict = (conflicts: Conflict[]) => conflicts.some((c) => c.severity === "error");

function dedupe(conflicts: Conflict[]): Conflict[] {
  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const key = `${c.code}|${c.resource?.id ?? ""}|${c.otherSessionId ?? ""}|${c.day ?? ""}|${c.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const round = (n: number) => Math.round(n * 10) / 10;
