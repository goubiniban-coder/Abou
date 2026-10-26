import { describe, expect, it } from "vitest";
import { detectAllConflicts, detectConflicts, trainerSlots } from "./conflicts";
import { day, demoContext, session, trainees } from "./fixtures";

const codes = (cs: { code: string }[]) => cs.map((c) => c.code).sort();

describe("detectConflicts", () => {
  it("ne signale rien pour une session correcte", () => {
    const ctx = demoContext();
    const s = session({
      id: "s1",
      courseId: "sst",
      slots: day("2026-11-03"),
      roomId: "salle-a",
      assignments: [{ role: "theory", trainerId: "lea" }],
      traineeIds: trainees(8),
    });
    expect(detectConflicts(s, ctx)).toEqual([]);
  });

  it("détecte une salle, un formateur et un engin réservés deux fois", () => {
    const ctx = demoContext();
    const existing = session({
      id: "s1",
      courseId: "caces-r489",
      slots: day("2026-11-03", "practice"),
      roomId: "salle-a",
      assignments: [{ role: "practice", trainerId: "lea" }],
      equipmentIds: ["chariot-1"],
      traineeIds: trainees(4),
    });
    ctx.sessions.push(existing);
    const s = { ...existing, id: "s2", slots: [day("2026-11-03")[1]] };
    expect(codes(detectConflicts(s, ctx))).toEqual(["equipment_double_booked", "room_double_booked", "trainer_double_booked"]);
  });

  it("ignore les créneaux qui se touchent sans se chevaucher et les sessions annulées", () => {
    const ctx = demoContext();
    ctx.sessions.push(
      session({ id: "s1", courseId: "sst", slots: [day("2026-11-03")[0]], roomId: "salle-a", assignments: [{ role: "theory", trainerId: "lea" }] }),
      session({ id: "s0", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-a", status: "cancelled" }),
    );
    const s = session({
      id: "s2",
      courseId: "sst",
      slots: [{ start: "2026-11-03T12:00:00+01:00", end: "2026-11-03T13:00:00+01:00", kind: "theory" }],
      roomId: "salle-a",
      assignments: [{ role: "theory", trainerId: "lea" }],
    });
    expect(detectConflicts(s, ctx)).toEqual([]);
  });

  it("signale une salle trop petite et une compétence manquante", () => {
    const ctx = demoContext();
    const s = session({
      id: "s1",
      courseId: "sst",
      slots: day("2026-11-03"),
      roomId: "salle-b",
      assignments: [{ role: "theory", trainerId: "paul" }],
      traineeIds: trainees(8),
    });
    expect(codes(detectConflicts(s, ctx))).toEqual(["missing_competence", "room_too_small"]);
  });

  it("signale une habilitation qui expire avant la fin de la session", () => {
    const ctx = demoContext();
    const s = session({ id: "s1", courseId: "sst", slots: day("2026-11-20"), roomId: "salle-a", assignments: [{ role: "theory", trainerId: "marc" }] });
    const [c] = detectConflicts(s, ctx);
    expect(c.code).toBe("competence_expired");
    expect(c.message).toContain("dimanche 15 novembre 2026");
  });

  it("signale une indisponibilité de formateur", () => {
    const ctx = demoContext();
    ctx.unavailabilities.push({ id: "u1", resourceType: "trainer", resourceId: "lea", start: "2026-11-03T00:00:00+01:00", end: "2026-11-04T00:00:00+01:00", reason: "congés" });
    const s = session({ id: "s1", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-a", assignments: [{ role: "theory", trainerId: "lea" }] });
    const [c] = detectConflicts(s, ctx);
    expect(c.code).toBe("resource_unavailable");
    expect(c.message).toContain("congés");
  });

  it("additionne les unités de test d'un testeur sur plusieurs sessions du même jour", () => {
    const ctx = demoContext();
    // Paul : 12 unités par jour. 4 stagiaires × 2 unités = 8 sur chaque session.
    const base = { courseId: "caces-r489", slots: day("2026-11-05", "test"), traineeIds: trainees(4), assignments: [{ role: "tester" as const, trainerId: "paul" }] };
    ctx.sessions.push(session({ id: "s1", ...base, roomId: "salle-a", equipmentIds: ["chariot-1"] }));
    const s = session({ id: "s2", ...base, siteId: "bayonne", mode: "intra", traineeIds: trainees(4, "b"), equipmentIds: ["chariot-2"] });
    const conflicts = detectConflicts(s, ctx);
    expect(codes(conflicts)).toContain("tester_over_capacity");
    expect(conflicts.find((c) => c.code === "tester_over_capacity")?.message).toContain("16 unités");
  });

  it("exige un testeur et le matériel requis pour un CACES", () => {
    const ctx = demoContext();
    const s = session({ id: "s1", courseId: "caces-r489", slots: day("2026-11-05", "practice", "test"), roomId: "salle-b", assignments: [{ role: "practice", trainerId: "lea" }], traineeIds: trainees(3) });
    expect(codes(detectConflicts(s, ctx))).toEqual(["missing_equipment", "missing_tester"]);
  });
});

describe("detectAllConflicts", () => {
  it("ne compte qu'une fois une double réservation entre deux sessions", () => {
    const ctx = demoContext();
    const a = session({ id: "a", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-a", assignments: [{ role: "theory", trainerId: "lea" }] });
    ctx.sessions.push(a, { ...a, id: "b", assignments: [] });
    expect(codes(detectAllConflicts(ctx))).toEqual(["room_double_booked"]);
  });
});

describe("mobilisation par rôle", () => {
  it("un testeur n'est mobilisé que sur les créneaux de test", () => {
    const ctx = demoContext();
    // Marc fait passer les tests le 2e jour d'un CACES, et anime un SST le 1er jour.
    ctx.sessions.push(
      session({ id: "caces", courseId: "caces-r489", slots: [...day("2026-11-03", "practice"), ...day("2026-11-04", "test")], roomId: "salle-a", equipmentIds: ["chariot-1"], traineeIds: trainees(2), assignments: [{ role: "practice", trainerId: "lea" }, { role: "tester", trainerId: "marc" }] }),
    );
    const sst = session({ id: "sst", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-b", assignments: [{ role: "theory", trainerId: "lea" }] });
    expect(codes(detectConflicts(sst, ctx))).toEqual(["trainer_double_booked"]); // Léa, pas Marc
    const sst2 = { ...sst, assignments: [{ role: "theory" as const, trainerId: "marc" }] };
    expect(detectConflicts(sst2, ctx)).toEqual([]);
  });

  it("le formateur théorie couvre la pratique quand personne d'autre n'y est affecté", () => {
    const s = session({ id: "x", courseId: "sst", slots: [...day("2026-11-03", "theory"), ...day("2026-11-04", "practice")], assignments: [{ role: "theory", trainerId: "lea" }] });
    expect(trainerSlots(s, "lea")).toHaveLength(4);
  });
});
