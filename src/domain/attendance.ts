import { addMonths, parisDay } from "./time";
import type { Course, Id, Session, Slot } from "./types";

// Émargement par demi-journée, résultats des tests et certificats qui en découlent.

export type Presence = "present" | "absent";

/** Ligne de la feuille d'émargement : un stagiaire sur un créneau. */
export interface AttendanceRecord {
  slotStart: string;
  traineeId: Id;
  presence: Presence;
}

/** Signature du formateur au bas d'un créneau. */
export interface TrainerSignature {
  slotStart: string;
  trainerId: Id;
}

export type Outcome = "passed" | "failed";

/** Résultats saisis par le testeur pour un stagiaire. */
export interface TestResult {
  traineeId: Id;
  theory?: Outcome;
  theoryScore?: number;
  practice?: Outcome;
  /** Catégories obtenues, par exemple « 3, 5 » pour un CACES R489. */
  categories?: string;
  comment?: string;
}

export type Decision = Outcome | "pending";

/**
 * Les résultats se saisissent, et les certificats se créent, à partir du premier créneau de test
 * (ou du dernier créneau si la session n'a pas de test).
 */
export function evaluationOpen(session: Session, now: Date): boolean {
  const starts = session.slots.map((s) => s.start).sort();
  const firstTest = session.slots.filter((s) => s.kind === "test").map((s) => s.start).sort()[0];
  const opens = firstTest ?? starts.at(-1);
  return opens !== undefined && Date.parse(opens) <= now.getTime();
}

/** Les créneaux sont repérés par leur instant de début, normalisé en UTC. */
export const slotKey = (iso: string) => new Date(iso).toISOString();

/** L'émargement d'un créneau ouvre un quart d'heure avant son début. */
export const signingOpen = (slotStart: string, now: Date) => Date.parse(slotStart) - 15 * 60_000 <= now.getTime();

const hours = (slot: Slot) => (Date.parse(slot.end) - Date.parse(slot.start)) / 3_600_000;

export function plannedHours(session: Pick<Session, "slots">): number {
  return session.slots.reduce((sum, s) => sum + hours(s), 0);
}

/** Heures où le stagiaire a signé présent. */
export function attendedHours(session: Session, records: AttendanceRecord[], traineeId: Id): number {
  const present = new Set(records.filter((r) => r.traineeId === traineeId && r.presence === "present").map((r) => slotKey(r.slotStart)));
  return session.slots.filter((s) => present.has(slotKey(s.start))).reduce((sum, s) => sum + hours(s), 0);
}

export interface SlotSheet {
  slot: Slot;
  present: Id[];
  absent: Id[];
  /** Stagiaires inscrits qui n'ont ni signé ni été déclarés absents. */
  missing: Id[];
  /** Formateurs affectés à la session qui ont signé ce créneau. */
  trainerSigned: Id[];
}

/** État de la feuille d'émargement, créneau par créneau. */
export function attendanceSheet(session: Session, records: AttendanceRecord[], trainerSignatures: TrainerSignature[] = []): SlotSheet[] {
  return session.slots.map((slot) => {
    const key = slotKey(slot.start);
    const mine = records.filter((r) => slotKey(r.slotStart) === key && session.traineeIds.includes(r.traineeId));
    const present = mine.filter((r) => r.presence === "present").map((r) => r.traineeId);
    const absent = mine.filter((r) => r.presence === "absent").map((r) => r.traineeId);
    return {
      slot,
      present,
      absent,
      missing: session.traineeIds.filter((id) => !present.includes(id) && !absent.includes(id)),
      trainerSigned: trainerSignatures.filter((t) => slotKey(t.slotStart) === key).map((t) => t.trainerId),
    };
  });
}

/** Une feuille est complète quand chaque stagiaire a signé ou été déclaré absent, et qu'un formateur a signé. */
export const sheetComplete = (sheet: SlotSheet) => sheet.missing.length === 0 && sheet.trainerSigned.length > 0;

/**
 * Décision pour un stagiaire. Formation avec test CACES : théorie et pratique doivent être réussies.
 * Autre formation : au moins une évaluation saisie et aucune échouée.
 */
export function decision(course: { testUnitsPerTrainee?: number | null }, result: TestResult | undefined): Decision {
  if (!result) return "pending";
  const parts = [result.theory, result.practice];
  if (parts.includes("failed")) return "failed";
  if (course.testUnitsPerTrainee) return result.theory && result.practice ? "passed" : "pending";
  return parts.some(Boolean) ? "passed" : "pending";
}

export interface CertificateToIssue {
  traineeId: Id;
  obtainedOn: string;
  validUntil: string;
}

/**
 * Certificats à créer à l'issue de la session : un par stagiaire reçu qui n'en a pas déjà
 * pour cette session. Date d'obtention : dernier jour de la session.
 */
export function certificatesToIssue(
  session: Session,
  course: Course,
  results: TestResult[],
  alreadyIssued: Id[],
): CertificateToIssue[] {
  if (!course.validityMonths || session.slots.length === 0) return [];
  const obtainedOn = parisDay(session.slots.map((s) => s.start).sort().at(-1)!);
  const validUntil = addMonths(obtainedOn, course.validityMonths);
  return results
    .filter((r) => session.traineeIds.includes(r.traineeId) && !alreadyIssued.includes(r.traineeId))
    .filter((r) => decision(course, r) === "passed")
    .map((r) => ({ traineeId: r.traineeId, obtainedOn, validUntil }));
}

/**
 * Tracé de signature : commandes SVG M et L uniquement, dans un cadre de 300 × 100.
 * Tout le reste est refusé, pour pouvoir l'afficher sans risque.
 */
export const SIGNATURE_VIEWBOX = "0 0 300 100";
export function isValidSignature(path: string): boolean {
  return path.length > 0 && path.length <= 30_000 && /^[ML][ML0-9 .-]*$/.test(path) && /L/.test(path);
}
