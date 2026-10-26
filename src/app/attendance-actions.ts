"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema as t } from "@/db";
import { certificatesToIssue, evaluationOpen, isValidSignature, signingOpen, slotKey, type Outcome } from "@/domain";
import { requireAdmin } from "@/server/guard";
import { getSession, loadContext } from "@/server/planning";
import { loadSessionRecords } from "@/server/attendance";

/**
 * Depuis l'espace formateur, le jeton personnel tient lieu de connexion : on vérifie en plus
 * que le formateur est affecté à la session et que le créneau existe et a commencé.
 */
async function trainerOnSession(token: string, sessionId: string) {
  const [trainer] = await db.select().from(t.trainers).where(eq(t.trainers.calendarToken, token));
  if (!trainer) throw new Error("Non autorisé");
  const session = await getSession(sessionId);
  if (!session || !session.assignments.some((a) => a.trainerId === trainer.id)) throw new Error("Non autorisé");
  return { trainer, session };
}

async function startedSlot(token: string, sessionId: string, slotStart: string) {
  const ctx = await trainerOnSession(token, sessionId);
  const slot = ctx.session.slots.find((s) => slotKey(s.start) === slotKey(slotStart));
  if (!slot || !signingOpen(slot.start, new Date())) throw new Error("Créneau non commencé");
  return { ...ctx, slot };
}

const refresh = (token: string, sessionId: string) => {
  revalidatePath(`/formateur/${token}`, "layout");
  revalidatePath(`/sessions/${sessionId}`);
};

export async function signAttendance(token: string, sessionId: string, slotStart: string, traineeId: string, signature: string) {
  const { trainer, session, slot } = await startedSlot(token, sessionId, slotStart);
  if (!session.traineeIds.includes(traineeId)) throw new Error("Stagiaire non inscrit");
  if (!isValidSignature(signature)) throw new Error("Signature invalide");
  const values = { presence: "present" as const, signature, recordedBy: trainer.id, recordedAt: new Date().toISOString() };
  await db
    .insert(t.attendance)
    .values({ sessionId, slotStart: slotKey(slot.start), traineeId, ...values })
    .onConflictDoUpdate({ target: [t.attendance.sessionId, t.attendance.slotStart, t.attendance.traineeId], set: values });
  refresh(token, sessionId);
}

export async function markAbsent(token: string, sessionId: string, slotStart: string, traineeId: string) {
  const { trainer, session, slot } = await startedSlot(token, sessionId, slotStart);
  if (!session.traineeIds.includes(traineeId)) throw new Error("Stagiaire non inscrit");
  const values = { presence: "absent" as const, signature: null, recordedBy: trainer.id, recordedAt: new Date().toISOString() };
  await db
    .insert(t.attendance)
    .values({ sessionId, slotStart: slotKey(slot.start), traineeId, ...values })
    .onConflictDoUpdate({ target: [t.attendance.sessionId, t.attendance.slotStart, t.attendance.traineeId], set: values });
  refresh(token, sessionId);
}

/** Annule une saisie faite par erreur, tant que le formateur n'a pas signé le créneau. */
export async function clearAttendance(token: string, sessionId: string, slotStart: string, traineeId: string) {
  const { slot } = await startedSlot(token, sessionId, slotStart);
  const key = slotKey(slot.start);
  const [closed] = await db
    .select()
    .from(t.trainerSignatures)
    .where(and(eq(t.trainerSignatures.sessionId, sessionId), eq(t.trainerSignatures.slotStart, key)));
  if (closed) throw new Error("Créneau déjà signé par le formateur");
  await db
    .delete(t.attendance)
    .where(and(eq(t.attendance.sessionId, sessionId), eq(t.attendance.slotStart, key), eq(t.attendance.traineeId, traineeId)));
  refresh(token, sessionId);
}

export async function signAsTrainer(token: string, sessionId: string, slotStart: string, signature: string) {
  const { trainer, slot } = await startedSlot(token, sessionId, slotStart);
  if (!isValidSignature(signature)) throw new Error("Signature invalide");
  const values = { signature, signedAt: new Date().toISOString() };
  await db
    .insert(t.trainerSignatures)
    .values({ sessionId, slotStart: slotKey(slot.start), trainerId: trainer.id, ...values })
    .onConflictDoUpdate({ target: [t.trainerSignatures.sessionId, t.trainerSignatures.slotStart, t.trainerSignatures.trainerId], set: values });
  refresh(token, sessionId);
}

const outcomeOf = (v: FormDataEntryValue | null): Outcome | null => (v === "passed" || v === "failed" ? v : null);
const textOf = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 500) : null);

/** Résultats des tests, saisis par le testeur (ou, hors CACES, par un formateur de la session). */
export async function saveResults(token: string, sessionId: string, f: FormData) {
  const { trainer, session } = await trainerOnSession(token, sessionId);
  const ctx = await loadContext();
  const course = ctx.courses.find((c) => c.id === session.courseId);
  const isTester = session.assignments.some((a) => a.trainerId === trainer.id && a.role === "tester");
  if (course?.testUnitsPerTrainee && !isTester) throw new Error("Réservé au testeur");
  if (!evaluationOpen(session, new Date())) throw new Error("Évaluation pas encore commencée");
  const { certified } = await loadSessionRecords(sessionId);
  for (const traineeId of session.traineeIds) {
    // Un certificat déjà délivré fige les résultats du stagiaire.
    if (certified.includes(traineeId)) continue;
    const score = textOf(f.get(`${traineeId}.theoryScore`));
    const values = {
      theory: outcomeOf(f.get(`${traineeId}.theory`)),
      theoryScore: score === null ? null : Math.max(0, Math.min(100, Number.parseInt(score, 10) || 0)),
      practice: outcomeOf(f.get(`${traineeId}.practice`)),
      categories: textOf(f.get(`${traineeId}.categories`)),
      comment: textOf(f.get(`${traineeId}.comment`)),
      testerId: trainer.id,
      recordedAt: new Date().toISOString(),
    };
    if (!values.theory && !values.practice && values.theoryScore === null && !values.categories && !values.comment) continue;
    await db
      .insert(t.testResults)
      .values({ sessionId, traineeId, ...values })
      .onConflictDoUpdate({ target: [t.testResults.sessionId, t.testResults.traineeId], set: values });
  }
  refresh(token, sessionId);
  redirect(`/formateur/${token}/resultats/${sessionId}?ok=1`);
}

/** Back-office : crée les certificats des stagiaires reçus ; ils alimentent ensuite les recyclages. */
export async function issueCertificates(sessionId: string) {
  await requireAdmin();
  const ctx = await loadContext();
  const session = ctx.sessions.find((s) => s.id === sessionId);
  const course = ctx.courses.find((c) => c.id === session?.courseId);
  if (!session || !course) throw new Error("Session introuvable");
  if (!evaluationOpen(session, new Date())) throw new Error("Évaluation pas encore commencée");
  const records = await loadSessionRecords(sessionId);
  const toIssue = certificatesToIssue(session, course, records.results, records.certified);
  if (toIssue.length) await db.insert(t.certifications).values(toIssue.map((c) => ({ ...c, courseId: course.id, sessionId })));
  revalidatePath("/", "layout");
}

export async function saveOrganization(f: FormData) {
  await requireAdmin();
  const values = {
    name: textOf(f.get("name")) ?? "Organisme de formation",
    address: textOf(f.get("address")),
    siret: textOf(f.get("siret")),
    nda: textOf(f.get("nda")),
    phone: textOf(f.get("phone")),
    email: textOf(f.get("email")),
    signatory: textOf(f.get("signatory")),
    vatRate: Math.max(0, Math.min(100, Number.parseInt(textOf(f.get("vatRate")) ?? "20", 10) || 0)),
  };
  await db.insert(t.organization).values({ id: "main", ...values }).onConflictDoUpdate({ target: t.organization.id, set: values });
  revalidatePath("/", "layout");
  redirect("/parametres?ok=1");
}
