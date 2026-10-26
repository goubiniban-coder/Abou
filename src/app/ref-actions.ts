"use server";

import { requireAdmin } from "@/server/guard";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema as t } from "@/db";
import { addMonths, parisTime, type Competence } from "@/domain";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const int = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === null ? null : Number.parseInt(v, 10);
};
const list = (f: FormData, k: string) =>
  (str(f, k) ?? "")
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
const newId = (f: FormData) => str(f, "id") ?? crypto.randomUUID();

/** Une compétence par ligne : « R489 » ou « SST;2027-06-30 » (date de fin de validité). */
function parseCompetences(text: string | null): Competence[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [code, validUntil] = l.split(/[;\s]+/);
      return validUntil ? { code: code.toUpperCase(), validUntil } : { code: code.toUpperCase() };
    });
}

function done(path: string): never {
  revalidatePath("/", "layout");
  redirect(path);
}

export async function saveTrainer(f: FormData) {
  await requireAdmin();
  const id = newId(f);
  const values = {
    firstName: str(f, "firstName") ?? "",
    lastName: str(f, "lastName") ?? "",
    email: str(f, "email"),
    external: f.get("external") === "on",
    siteId: str(f, "siteId"),
    competences: parseCompetences(str(f, "competences")),
    testUnitsPerDay: int(f, "testUnitsPerDay"),
  };
  await db.insert(t.trainers).values({ id, ...values }).onConflictDoUpdate({ target: t.trainers.id, set: values });
  done(`/formateurs/${id}`);
}

export async function saveRoom(f: FormData) {
  await requireAdmin();
  const id = newId(f);
  const values = { name: str(f, "name") ?? "", siteId: str(f, "siteId") ?? "", capacity: int(f, "capacity") ?? 0, equipment: list(f, "equipment") };
  await db.insert(t.rooms).values({ id, ...values }).onConflictDoUpdate({ target: t.rooms.id, set: values });
  done(`/salles/${id}`);
}

export async function saveEquipment(f: FormData) {
  await requireAdmin();
  const id = newId(f);
  const values = { name: str(f, "name") ?? "", kind: (str(f, "kind") ?? "").toUpperCase(), siteId: str(f, "siteId") };
  await db.insert(t.equipment).values({ id, ...values }).onConflictDoUpdate({ target: t.equipment.id, set: values });
  done(`/materiel/${id}`);
}

export async function saveCourse(f: FormData) {
  await requireAdmin();
  const id = newId(f);
  const values = {
    code: (str(f, "code") ?? "").toUpperCase(),
    title: str(f, "title") ?? "",
    durationHalfDays: int(f, "durationHalfDays") ?? 2,
    maxTrainees: int(f, "maxTrainees") ?? 10,
    requiredCompetences: list(f, "requiredCompetences").map((x) => x.toUpperCase()),
    requiredEquipmentKinds: list(f, "requiredEquipmentKinds").map((x) => x.toUpperCase()),
    testUnitsPerTrainee: int(f, "testUnitsPerTrainee"),
    validityMonths: int(f, "validityMonths"),
    color: str(f, "color"),
  };
  await db.insert(t.courses).values({ id, ...values }).onConflictDoUpdate({ target: t.courses.id, set: values });
  done("/formations");
}

export async function saveTrainee(f: FormData) {
  await requireAdmin();
  const id = newId(f);
  const values = { firstName: str(f, "firstName") ?? "", lastName: str(f, "lastName") ?? "", email: str(f, "email"), clientId: str(f, "clientId") };
  await db.insert(t.trainees).values({ id, ...values }).onConflictDoUpdate({ target: t.trainees.id, set: values });
  done(`/stagiaires/${id}`);
}

export async function saveClient(f: FormData) {
  await requireAdmin();
  await db.insert(t.clients).values({ name: str(f, "name") ?? "", city: str(f, "city") });
  done("/stagiaires");
}

export async function addCertification(f: FormData) {
  await requireAdmin();
  const traineeId = str(f, "traineeId")!;
  const courseId = str(f, "courseId")!;
  const obtainedOn = str(f, "obtainedOn")!;
  const [course] = await db.select().from(t.courses).where(eq(t.courses.id, courseId));
  const validUntil = str(f, "validUntil") ?? (course?.validityMonths ? addMonths(obtainedOn, course.validityMonths) : undefined);
  if (!validUntil) throw new Error("Date de fin de validité manquante.");
  await db.insert(t.certifications).values({ traineeId, courseId, obtainedOn, validUntil });
  done(`/stagiaires/${traineeId}`);
}

export async function deleteCertification(f: FormData) {
  await requireAdmin();
  await db.delete(t.certifications).where(eq(t.certifications.id, str(f, "id")!));
  done(str(f, "back") ?? "/stagiaires");
}

/** Indisponibilité du jour `from` au jour `to` inclus, ou sur une demi-journée. */
export async function addUnavailability(f: FormData) {
  await requireAdmin();
  await insertUnavailability(f);
}

async function insertUnavailability(f: FormData) {
  const from = str(f, "from")!;
  const to = str(f, "to") ?? from;
  const period = str(f, "period") ?? "day";
  const start = parisTime(from, period === "afternoon" ? "12:00" : "00:00");
  const endDay = new Date(`${to}T12:00:00Z`);
  endDay.setUTCDate(endDay.getUTCDate() + (period === "morning" ? 0 : 1));
  const end = period === "morning" ? parisTime(to, "12:00") : parisTime(endDay.toISOString().slice(0, 10), "00:00");
  await db.insert(t.unavailabilities).values({
    resourceType: str(f, "resourceType") as "trainer" | "room" | "equipment",
    resourceId: str(f, "resourceId")!,
    start,
    end,
    reason: str(f, "reason"),
  });
  done(str(f, "back")!);
}

export async function deleteUnavailability(f: FormData) {
  await requireAdmin();
  await db.delete(t.unavailabilities).where(eq(t.unavailabilities.id, str(f, "id")!));
  done(str(f, "back")!);
}

export async function deleteEntity(f: FormData) {
  await requireAdmin();
  const kind = str(f, "kind");
  const id = str(f, "id")!;
  const table = { trainer: t.trainers, room: t.rooms, equipment: t.equipment, course: t.courses, trainee: t.trainees }[kind ?? ""];
  if (!table) return;
  try {
    await db.delete(table).where(eq(table.id, id));
  } catch {
    // Encore utilisé par une session : on ne supprime pas.
    redirect(`${str(f, "back")}?error=used`);
  }
  done(str(f, "list")!);
}

/** Depuis l'espace formateur : le jeton personnel tient lieu de connexion. */
async function trainerFromToken(token: string) {
  const [trainer] = await db.select().from(t.trainers).where(eq(t.trainers.calendarToken, token));
  if (!trainer) throw new Error("Non autorisé");
  return trainer;
}

export async function trainerAddUnavailability(token: string, f: FormData) {
  const trainer = await trainerFromToken(token);
  f.set("resourceType", "trainer");
  f.set("resourceId", trainer.id);
  f.set("back", `/formateur/${token}`);
  await insertUnavailability(f);
}

export async function trainerDeleteUnavailability(token: string, id: string) {
  const trainer = await trainerFromToken(token);
  await db.delete(t.unavailabilities).where(and(eq(t.unavailabilities.id, id), eq(t.unavailabilities.resourceId, trainer.id)));
  done(`/formateur/${token}`);
}
