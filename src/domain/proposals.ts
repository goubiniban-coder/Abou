import { detectConflicts, hasBlockingConflict } from "./conflicts";
import { suggestEquipment, suggestRooms, suggestTrainers } from "./suggestions";
import { addDays, daysBetween, parisTime } from "./time";
import type { Assignment, Course, Id, PlanningContext, Session, Slot, SlotKind } from "./types";

// Propositions de dates pour un recyclage : des créneaux réellement tenables, ressources comprises.

/** Créneaux par défaut d'une formation à partir d'un jour : journées ouvrées successives, matin 8h30-12h et après-midi 13h30-17h. */
export function defaultSlots(course: Course, start: string): Slot[] {
  const dayCount = Math.ceil(course.durationHalfDays / 2);
  // Théorie d'abord, puis pratique ; le dernier jour est consacré aux tests s'il y en a.
  const theoryDays = Math.ceil((dayCount - (course.testUnitsPerTrainee ? 1 : 0)) / 2);
  const slots: Slot[] = [];
  let date = start;
  let i = 0;
  while (i < dayCount) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const last = i === dayCount - 1;
      const kind: SlotKind = last && course.testUnitsPerTrainee ? "test" : i < theoryDays ? "theory" : "practice";
      slots.push({ start: parisTime(date, "08:30"), end: parisTime(date, "12:00"), kind });
      if (!(last && course.durationHalfDays % 2 === 1)) slots.push({ start: parisTime(date, "13:30"), end: parisTime(date, "17:00"), kind });
      i++;
    }
    date = addDays(date, 1);
  }
  return slots;
}

/** Une date proposée, avec les ressources retenues pour la tenir. */
export interface DateOption {
  slots: Slot[];
  roomId?: Id;
  assignments: Assignment[];
  equipmentIds: Id[];
}

export interface ProposalRequest {
  course: Course;
  siteId: Id;
  traineeIds: Id[];
  /** Premier jour possible. */
  from: string;
  /** Dernier jour de début possible. */
  until: string;
  count?: number;
  /** Écart minimal entre deux propositions, pour offrir un vrai choix. */
  spacingDays?: number;
}

const best = <T extends { available: boolean }>(list: T[]) => list.find((s) => s.available);

/** Essaie de tenir la session à partir de `start` : salle, formateur, testeur et matériel libres et compatibles. */
export function resolveOption(request: Omit<ProposalRequest, "from" | "until">, start: string, ctx: PlanningContext): DateOption | undefined {
  const { course } = request;
  let session: Session = {
    id: "proposition",
    courseId: course.id,
    siteId: request.siteId,
    mode: "inter",
    slots: defaultSlots(course, start),
    assignments: [],
    equipmentIds: [],
    traineeIds: request.traineeIds,
    status: "draft",
  };

  const room = best(suggestRooms(session, ctx));
  if (!room) return undefined;
  session = { ...session, roomId: room.item.id };

  // Un formateur assure la théorie et la pratique ; un testeur fait passer les tests.
  const trainer = best(suggestTrainers(session, "theory", ctx));
  if (!trainer) return undefined;
  session = { ...session, assignments: [{ role: "theory", trainerId: trainer.item.id }] };
  if (session.slots.some((s) => s.kind === "test")) {
    const tester =
      best(suggestTrainers(session, "tester", ctx))?.item.id ??
      // Le formateur peut aussi être testeur s'il en a la capacité.
      ((trainer.item.testUnitsPerDay ?? 0) > 0 ? trainer.item.id : undefined);
    if (!tester) return undefined;
    session = { ...session, assignments: [...session.assignments, { role: "tester", trainerId: tester }] };
  }

  for (const kind of course.requiredEquipmentKinds ?? []) {
    const item = best(suggestEquipment(session, kind, ctx));
    if (!item) return undefined;
    session = { ...session, equipmentIds: [...session.equipmentIds, item.item.id] };
  }

  if (hasBlockingConflict(detectConflicts(session, ctx))) return undefined;
  return { slots: session.slots, roomId: session.roomId, assignments: session.assignments, equipmentIds: session.equipmentIds };
}

/** Jusqu'à `count` dates tenables entre `from` et `until`, espacées d'au moins `spacingDays` jours. */
export function proposeDates(request: ProposalRequest, ctx: PlanningContext): DateOption[] {
  const { count = 3, spacingDays = 7 } = request;
  const options: DateOption[] = [];
  let lastStart: string | undefined;
  for (let day = request.from; day <= request.until && options.length < count; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (lastStart && daysBetween(lastStart, day) < spacingDays) continue;
    const option = resolveOption(request, day, ctx);
    if (option) {
      options.push(option);
      lastStart = day;
    }
  }
  return options;
}

/** Une date dont le premier créneau est passé ne peut plus être choisie. */
export const optionStarted = (option: DateOption, now: Date) => option.slots.some((s) => Date.parse(s.start) <= now.getTime());

/** Une option encore tenable au moment où le client la choisit ? */
export function optionStillFree(option: DateOption, course: Course, siteId: Id, traineeIds: Id[], ctx: PlanningContext): boolean {
  const session: Session = { id: "proposition", courseId: course.id, siteId, mode: "inter", status: "draft", traineeIds, ...option };
  return !hasBlockingConflict(detectConflicts(session, ctx));
}

/**
 * Fenêtre de recherche : au plus tôt dans `leadDays` jours, au plus tard avant la première échéance
 * des stagiaires ; si elle est trop proche ou dépassée, on cherche sur les deux mois suivants.
 */
export function searchWindow(today: string, firstExpiry: string, leadDays = 7): { from: string; until: string } {
  const from = addDays(today, leadDays);
  const beforeExpiry = addDays(firstExpiry, -1);
  return { from, until: daysBetween(from, beforeExpiry) >= 14 ? beforeExpiry : addDays(from, 60) };
}
