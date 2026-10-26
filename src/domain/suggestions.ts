import { detectConflicts, hasBlockingConflict, type Conflict } from "./conflicts";
import { addDays, dayOf, overlaps } from "./time";
import type { AssignmentRole, Equipment, PlanningContext, Room, Session, Trainer } from "./types";

export interface Suggestion<T> {
  item: T;
  /** Plus le score est haut, meilleure est la proposition. Les propositions bloquées ont un score négatif. */
  score: number;
  available: boolean;
  reasons: string[];
  conflicts: Conflict[];
}

const byScore = <T>(a: Suggestion<T>, b: Suggestion<T>) => b.score - a.score;

/** Conflits causés par la ressource testée, et non ceux que la session avait déjà. */
function newConflicts(before: Conflict[], after: Conflict[]): Conflict[] {
  const key = (c: Conflict) => `${c.code}|${c.resource?.id}|${c.otherSessionId}|${c.day}`;
  const existing = new Set(before.map(key));
  return after.filter((c) => !existing.has(key(c)));
}

/** Demi-journées déjà planifiées pour un formateur dans les 7 jours autour de la session. */
function weeklyLoad(trainer: Trainer, session: Session, ctx: PlanningContext): number {
  const first = session.slots[0];
  if (!first) return 0;
  const window = { start: `${addDays(first.start, -3)}T00:00:00`, end: `${addDays(first.start, 4)}T00:00:00` };
  let count = 0;
  for (const s of ctx.sessions) {
    if (s.id === session.id || s.status === "cancelled") continue;
    if (!s.assignments.some((a) => a.trainerId === trainer.id)) continue;
    count += s.slots.filter((slot) => overlaps({ start: dayOf(slot.start), end: dayOf(slot.end) + "T23:59:59" }, window)).length;
  }
  return count;
}

/** Classe les formateurs pour un rôle donné sur une session. */
export function suggestTrainers(session: Session, role: AssignmentRole, ctx: PlanningContext): Suggestion<Trainer>[] {
  const base = detectConflicts(session, ctx);
  const alreadyAssigned = new Set(session.assignments.map((a) => a.trainerId));
  return ctx.trainers
    .filter((t) => !alreadyAssigned.has(t.id))
    .filter((t) => role !== "tester" || (t.testUnitsPerDay ?? 0) > 0)
    .map((trainer) => {
      const candidate: Session = { ...session, assignments: [...session.assignments, { role, trainerId: trainer.id }] };
      const conflicts = newConflicts(base, detectConflicts(candidate, ctx));
      const reasons: string[] = [];
      let score = 100;
      if (hasBlockingConflict(conflicts)) score -= 1000;
      if (trainer.siteId === session.siteId) {
        score += 15;
        reasons.push("Rattaché au site de la session");
      }
      if (!trainer.external) {
        score += 10;
        reasons.push("Formateur interne");
      }
      const load = weeklyLoad(trainer, session, ctx);
      score -= load * 3;
      reasons.push(load === 0 ? "Aucune autre intervention cette semaine" : `${load} demi-journée(s) déjà planifiée(s) cette semaine`);
      return { item: trainer, score, available: !hasBlockingConflict(conflicts), reasons, conflicts };
    })
    .sort(byScore);
}

export function suggestRooms(session: Session, ctx: PlanningContext): Suggestion<Room>[] {
  const withoutRoom: Session = { ...session, roomId: undefined };
  const base = detectConflicts(withoutRoom, ctx);
  return ctx.rooms
    .map((room) => {
      const conflicts = newConflicts(base, detectConflicts({ ...session, roomId: room.id }, ctx));
      const reasons: string[] = [];
      let score = 100;
      if (hasBlockingConflict(conflicts)) score -= 1000;
      if (room.siteId === session.siteId) {
        score += 20;
        reasons.push("Sur le site de la session");
      }
      // Préférer la plus petite salle suffisante, pour garder les grandes salles libres.
      const spare = room.capacity - session.traineeIds.length;
      if (spare >= 0) {
        score -= Math.min(spare, 20);
        reasons.push(`${room.capacity} places`);
      }
      return { item: room, score, available: !hasBlockingConflict(conflicts), reasons, conflicts };
    })
    .sort(byScore);
}

export function suggestEquipment(session: Session, kind: string, ctx: PlanningContext): Suggestion<Equipment>[] {
  const base = detectConflicts(session, ctx);
  return ctx.equipment
    .filter((e) => e.kind === kind && !session.equipmentIds.includes(e.id))
    .map((item) => {
      const conflicts = newConflicts(base, detectConflicts({ ...session, equipmentIds: [...session.equipmentIds, item.id] }, ctx));
      const reasons: string[] = [];
      let score = 100;
      if (hasBlockingConflict(conflicts)) score -= 1000;
      if (item.siteId === session.siteId) {
        score += 20;
        reasons.push("Sur le site de la session");
      }
      return { item, score, available: !hasBlockingConflict(conflicts), reasons, conflicts };
    })
    .sort(byScore);
}
