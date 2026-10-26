import type { PlanningContext, Session, Slot } from "./types";

/** Créneaux d'une journée : matin 8h30-12h, après-midi 13h30-17h (heure de Paris en hiver). */
export function day(date: string, morning: Slot["kind"] = "theory", afternoon: Slot["kind"] = morning): Slot[] {
  return [
    { start: `${date}T08:30:00+01:00`, end: `${date}T12:00:00+01:00`, kind: morning },
    { start: `${date}T13:30:00+01:00`, end: `${date}T17:00:00+01:00`, kind: afternoon },
  ];
}

export function session(partial: Partial<Session> & Pick<Session, "id" | "courseId" | "slots">): Session {
  return {
    siteId: "pau",
    mode: "inter",
    assignments: [],
    equipmentIds: [],
    traineeIds: [],
    status: "confirmed",
    ...partial,
  };
}

export const trainees = (n: number, prefix = "s") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

/** Petit centre fictif : deux sites, trois salles, quatre formateurs, des chariots CACES. */
export function demoContext(): PlanningContext {
  return {
    sites: [
      { id: "pau", name: "Centre de Pau", city: "Pau" },
      { id: "bayonne", name: "Agence de Bayonne", city: "Bayonne" },
    ],
    rooms: [
      { id: "salle-a", name: "Salle A", siteId: "pau", capacity: 12 },
      { id: "salle-b", name: "Salle B", siteId: "pau", capacity: 6 },
      { id: "salle-c", name: "Salle C", siteId: "bayonne", capacity: 10 },
    ],
    trainers: [
      {
        id: "marc",
        firstName: "Marc",
        lastName: "Durand",
        external: false,
        siteId: "pau",
        competences: [{ code: "R489" }, { code: "SST", validUntil: "2026-11-15" }],
        testUnitsPerDay: 20,
      },
      { id: "lea", firstName: "Léa", lastName: "Martin", external: false, siteId: "pau", competences: [{ code: "R489" }, { code: "SST" }] },
      { id: "paul", firstName: "Paul", lastName: "Bernard", external: true, competences: [{ code: "R489" }], testUnitsPerDay: 12 },
      { id: "nina", firstName: "Nina", lastName: "Petit", external: false, siteId: "bayonne", competences: [{ code: "HABELEC" }] },
    ],
    equipment: [
      { id: "chariot-1", name: "Chariot frontal n°1", kind: "R489-3", siteId: "pau" },
      { id: "chariot-2", name: "Chariot frontal n°2", kind: "R489-3", siteId: "pau" },
    ],
    courses: [
      {
        id: "caces-r489",
        code: "R489",
        title: "CACES chariots élévateurs catégorie 3",
        durationHalfDays: 6,
        maxTrainees: 6,
        requiredCompetences: ["R489"],
        requiredEquipmentKinds: ["R489-3"],
        testUnitsPerTrainee: 2,
        validityMonths: 60,
        color: "#f59e0b",
      },
      { id: "sst", code: "SST", title: "Sauveteur secouriste du travail", durationHalfDays: 4, maxTrainees: 10, requiredCompetences: ["SST"], validityMonths: 24, color: "#ef4444" },
      { id: "habelec", code: "HABELEC", title: "Habilitation électrique B1V", durationHalfDays: 6, maxTrainees: 10, requiredCompetences: ["HABELEC"], validityMonths: 36, color: "#3b82f6" },
    ],
    sessions: [],
    unavailabilities: [],
  };
}
