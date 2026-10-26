/**
 * Données de démonstration : un centre fictif avec deux sites, sur les quatre
 * semaines à partir de la semaine en cours. Tous les noms sont inventés.
 * Usage : npm run db:seed (efface les données existantes).
 */
import { sql } from "drizzle-orm";
import { addDays, addMonths, mondayOf, parisTime } from "../domain/time";
import { db, schema as t } from "./index";

type SlotKind = "theory" | "practice" | "test";

const today = new Date().toISOString().slice(0, 10);
const monday = mondayOf(today);
const d = (offset: number) => addDays(monday, offset);

/** Journées complètes (matin + après-midi) ; `kinds` donne le type de chaque journée. */
function days(start: number, kinds: SlotKind[]) {
  return kinds.flatMap((kind, i) => [
    { start: parisTime(d(start + i), "08:30"), end: parisTime(d(start + i), "12:00"), kind },
    { start: parisTime(d(start + i), "13:30"), end: parisTime(d(start + i), "17:00"), kind },
  ]);
}

const firstNames = ["Camille", "Lucas", "Manon", "Hugo", "Inès", "Louis", "Chloé", "Nathan", "Sarah", "Jules", "Emma", "Théo", "Jade", "Adam", "Lina", "Raphaël", "Zoé", "Tom", "Alice", "Noah"];
const lastNames = ["Lefèvre", "Moreau", "Girard", "Roux", "Fournier", "Bonnet", "Lambert", "Fontaine", "Rousseau", "Vincent", "Muller", "Faure", "André", "Mercier", "Blanc", "Guérin"];

async function main() {
  await db.execute(sql`TRUNCATE sites, rooms, trainers, equipment, courses, clients, trainees, sessions, slots, assignments, session_equipment, enrollments, unavailabilities, certifications, api_keys, attendance, trainer_signatures, test_results, organization, proposals CASCADE`);

  await db.insert(t.organization).values({
    id: "main",
    name: "Centre de formation Pyrénées Sécurité",
    address: "12 avenue des Lilas, 64000 Pau",
    siret: "000 000 000 00000",
    nda: "75 64 00000 64",
    phone: "05 00 00 00 00",
    email: "contact@example.com",
    signatory: "Anne Dupuis, directrice",
  });
  await db.insert(t.sites).values([
    { id: "pau", name: "Centre de Pau", city: "Pau" },
    { id: "bayonne", name: "Agence de Bayonne", city: "Bayonne" },
  ]);
  await db.insert(t.rooms).values([
    { id: "pau-a", name: "Salle Aspe", siteId: "pau", capacity: 12, equipment: ["vidéoprojecteur"] },
    { id: "pau-b", name: "Salle Ossau", siteId: "pau", capacity: 8, equipment: ["vidéoprojecteur", "mannequins SST"] },
    { id: "pau-c", name: "Atelier électrique", siteId: "pau", capacity: 6, equipment: ["armoires pédagogiques"] },
    { id: "bay-a", name: "Salle Adour", siteId: "bayonne", capacity: 10, equipment: ["vidéoprojecteur"] },
    { id: "bay-b", name: "Salle Nive", siteId: "bayonne", capacity: 6 },
  ]);
  const inTwoWeeks = addDays(today, 14);
  await db.insert(t.trainers).values([
    { id: "marc", firstName: "Marc", lastName: "Durand", email: "marc.durand@example.com", siteId: "pau", competences: [{ code: "R489" }, { code: "R486" }, { code: "SST", validUntil: inTwoWeeks }], testUnitsPerDay: 20 },
    { id: "lea", firstName: "Léa", lastName: "Martin", email: "lea.martin@example.com", siteId: "pau", competences: [{ code: "R489" }, { code: "SST" }] },
    { id: "paul", firstName: "Paul", lastName: "Bernard", email: "paul.bernard@example.com", external: true, competences: [{ code: "R489" }, { code: "R486" }], testUnitsPerDay: 12 },
    { id: "nina", firstName: "Nina", lastName: "Petit", email: "nina.petit@example.com", siteId: "bayonne", competences: [{ code: "HABELEC" }, { code: "SST" }] },
    { id: "karim", firstName: "Karim", lastName: "Robert", email: "karim.robert@example.com", siteId: "pau", competences: [{ code: "HABELEC" }] },
    { id: "julie", firstName: "Julie", lastName: "Richard", email: "julie.richard@example.com", siteId: "bayonne", competences: [{ code: "R489" }, { code: "R486" }], testUnitsPerDay: 16 },
  ]);
  await db.insert(t.equipment).values([
    { id: "cf-1", name: "Chariot frontal n°1", kind: "R489-3", siteId: "pau" },
    { id: "cf-2", name: "Chariot frontal n°2", kind: "R489-3", siteId: "pau" },
    { id: "cf-3", name: "Chariot frontal n°3", kind: "R489-3", siteId: "bayonne" },
    { id: "pemp-1", name: "Nacelle PEMP 3B", kind: "R486-B", siteId: "pau" },
    { id: "pemp-2", name: "Nacelle PEMP 3B (Bayonne)", kind: "R486-B", siteId: "bayonne" },
  ]);
  await db.insert(t.courses).values([
    { id: "r489", code: "R489", title: "CACES chariots élévateurs cat. 3", durationHalfDays: 6, maxTrainees: 6, requiredCompetences: ["R489"], requiredEquipmentKinds: ["R489-3"], testUnitsPerTrainee: 2, validityMonths: 60, color: "#d97706", pricePerTrainee: 690 },
    { id: "r486", code: "R486", title: "CACES nacelles PEMP cat. B", durationHalfDays: 4, maxTrainees: 6, requiredCompetences: ["R486"], requiredEquipmentKinds: ["R486-B"], testUnitsPerTrainee: 2, validityMonths: 60, color: "#7c3aed", pricePerTrainee: 590 },
    { id: "sst", code: "SST", title: "Sauveteur secouriste du travail", durationHalfDays: 4, maxTrainees: 10, requiredCompetences: ["SST"], validityMonths: 24, color: "#dc2626", pricePerTrainee: 280 },
    { id: "habelec", code: "HABELEC", title: "Habilitation électrique B1V-BR", durationHalfDays: 6, maxTrainees: 8, requiredCompetences: ["HABELEC"], validityMonths: 36, color: "#2563eb", pricePerTrainee: 450 },
  ]);
  await db.insert(t.clients).values([
    { id: "logisud", name: "Logisud Entrepôts", city: "Lescar" },
    { id: "btp64", name: "Bâtiments du Béarn", city: "Pau" },
    { id: "adour-agro", name: "Adour Agroalimentaire", city: "Bayonne" },
  ]);
  const clientIds = ["logisud", "btp64", "adour-agro"];
  const traineeRows = Array.from({ length: 48 }, (_, i) => ({
    id: `st-${i + 1}`,
    firstName: firstNames[i % firstNames.length],
    lastName: lastNames[(i * 7) % lastNames.length],
    clientId: clientIds[i % clientIds.length],
  }));
  await db.insert(t.trainees).values(traineeRows);
  const pick = (from: number, n: number) => traineeRows.slice(from, from + n).map((r) => r.id);

  type SessionSeed = {
    id: string; courseId: string; siteId: string; mode?: "inter" | "intra"; clientId?: string; roomId?: string;
    status?: "draft" | "confirmed"; slots: { start: string; end: string; kind: SlotKind }[];
    assignments: { role: "theory" | "practice" | "tester"; trainerId: string }[]; equipmentIds?: string[]; traineeIds: string[];
  };
  const sessions: SessionSeed[] = [
    // Semaine en cours
    { id: "s-r489-1", courseId: "r489", siteId: "pau", roomId: "pau-a", slots: days(0, ["theory", "practice", "test"]), assignments: [{ role: "theory", trainerId: "lea" }, { role: "practice", trainerId: "lea" }, { role: "tester", trainerId: "marc" }], equipmentIds: ["cf-1", "cf-2"], traineeIds: pick(0, 6) },
    { id: "s-sst-1", courseId: "sst", siteId: "pau", roomId: "pau-b", slots: days(1, ["theory", "practice"]), assignments: [{ role: "theory", trainerId: "marc" }], traineeIds: pick(6, 8) },
    { id: "s-hab-1", courseId: "habelec", siteId: "bayonne", roomId: "bay-a", slots: days(0, ["theory", "theory", "practice"]), assignments: [{ role: "theory", trainerId: "nina" }], traineeIds: pick(14, 7) },
    { id: "s-r486-intra", courseId: "r486", siteId: "pau", mode: "intra", clientId: "btp64", slots: days(3, ["practice", "test"]), assignments: [{ role: "practice", trainerId: "paul" }, { role: "tester", trainerId: "paul" }], equipmentIds: ["pemp-1"], traineeIds: pick(21, 5) },
    // Semaine prochaine : quelques conflits volontaires pour la démo
    { id: "s-r489-2", courseId: "r489", siteId: "pau", roomId: "pau-a", slots: days(7, ["theory", "practice", "test"]), assignments: [{ role: "theory", trainerId: "lea" }, { role: "practice", trainerId: "lea" }, { role: "tester", trainerId: "paul" }], equipmentIds: ["cf-1"], traineeIds: pick(26, 6) },
    { id: "s-r489-3", courseId: "r489", siteId: "bayonne", roomId: "bay-b", status: "draft", slots: days(9, ["test"]), assignments: [{ role: "tester", trainerId: "paul" }], equipmentIds: ["cf-3"], traineeIds: pick(32, 4) },
    { id: "s-sst-2", courseId: "sst", siteId: "pau", roomId: "pau-a", status: "draft", slots: days(8, ["theory", "practice"]), assignments: [{ role: "theory", trainerId: "marc" }], traineeIds: pick(36, 9) },
    { id: "s-hab-2", courseId: "habelec", siteId: "pau", roomId: "pau-c", slots: days(10, ["theory", "practice"]), assignments: [{ role: "theory", trainerId: "karim" }], traineeIds: pick(40, 6) },
    // Dans deux et trois semaines
    { id: "s-r486-1", courseId: "r486", siteId: "bayonne", roomId: "bay-a", slots: days(14, ["practice", "test"]), assignments: [{ role: "practice", trainerId: "julie" }, { role: "tester", trainerId: "julie" }], equipmentIds: ["pemp-2"], traineeIds: pick(0, 5) },
    { id: "s-sst-3", courseId: "sst", siteId: "bayonne", roomId: "bay-a", slots: days(16, ["theory", "practice"]), assignments: [{ role: "theory", trainerId: "nina" }], traineeIds: pick(10, 10) },
    { id: "s-r489-4", courseId: "r489", siteId: "pau", roomId: "pau-b", status: "draft", slots: days(21, ["theory", "practice", "test"]), assignments: [{ role: "practice", trainerId: "marc" }], equipmentIds: ["cf-2"], traineeIds: pick(20, 4) },
  ];
  for (const s of sessions) {
    await db.insert(t.sessions).values({ id: s.id, courseId: s.courseId, siteId: s.siteId, mode: s.mode ?? "inter", clientId: s.clientId, roomId: s.roomId, status: s.status ?? "confirmed" });
    await db.insert(t.slots).values(s.slots.map((slot) => ({ sessionId: s.id, ...slot })));
    if (s.assignments.length) await db.insert(t.assignments).values(s.assignments.map((a) => ({ sessionId: s.id, ...a })));
    if (s.equipmentIds?.length) await db.insert(t.sessionEquipment).values(s.equipmentIds.map((equipmentId) => ({ sessionId: s.id, equipmentId })));
    await db.insert(t.enrollments).values(s.traineeIds.map((traineeId) => ({ sessionId: s.id, traineeId })));
  }

  await db.insert(t.unavailabilities).values([
    { resourceType: "trainer", resourceId: "karim", start: parisTime(d(10), "00:00"), end: parisTime(d(11), "00:00"), reason: "Congés" },
    { resourceType: "trainer", resourceId: "julie", start: parisTime(d(2), "00:00"), end: parisTime(d(5), "00:00"), reason: "Formation de formateurs" },
    { resourceType: "room", resourceId: "pau-c", start: parisTime(d(17), "00:00"), end: parisTime(d(19), "00:00"), reason: "Travaux" },
    { resourceType: "equipment", resourceId: "cf-2", start: parisTime(d(4), "00:00"), end: parisTime(d(6), "00:00"), reason: "Révision annuelle" },
  ]);

  // Certificats obtenus il y a plusieurs années : certains arrivent à échéance.
  const certs = traineeRows.slice(0, 24).map((r, i) => {
    const course = ["r489", "sst", "habelec", "r486"][i % 4];
    const months = { r489: 60, r486: 60, sst: 24, habelec: 36 }[course]!;
    const validUntil = addDays(today, -20 + i * 9);
    return { traineeId: r.id, courseId: course, obtainedOn: addMonths(validUntil, -months), validUntil };
  });
  await db.insert(t.certifications).values(certs);

  console.log(`Données de démo créées : ${sessions.length} sessions à partir du ${monday}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
