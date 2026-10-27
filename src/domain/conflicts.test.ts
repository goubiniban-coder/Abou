import { describe, expect, it } from "vitest";
import { detectAllConflicts, detectConflicts, hasBlockingConflict, testerLoad, testUnitsByDay, trainerSlots } from "./conflicts";
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

describe("règles non couvertes jusqu'ici", () => {
  const sst = (partial: Partial<Parameters<typeof session>[0]> = {}) =>
    session({ id: "s1", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-a", assignments: [{ role: "theory", trainerId: "lea" }], ...partial });

  it("ne vérifie pas une session annulée", () => {
    const ctx = demoContext();
    expect(detectConflicts(sst({ roomId: "salle-b", traineeIds: trainees(20), status: "cancelled" }), ctx)).toEqual([]);
  });

  it("ignore l'ancienne version de la session présente dans le planning", () => {
    const ctx = demoContext();
    const s = sst();
    ctx.sessions.push(s);
    expect(detectConflicts({ ...s, slots: day("2026-11-04") }, ctx)).toEqual([]);
  });

  it("compte une session brouillon comme occupant la salle", () => {
    const ctx = demoContext();
    ctx.sessions.push(sst({ id: "brouillon", status: "draft", assignments: [] }));
    expect(codes(detectConflicts(sst({ assignments: [{ role: "theory", trainerId: "marc" }], slots: day("2026-11-03") }), ctx))).toEqual(["room_double_booked"]);
  });

  it("avertit quand une session inter n'a pas de salle, pas une session intra", () => {
    const ctx = demoContext();
    const [c] = detectConflicts(sst({ roomId: undefined }), ctx);
    expect(c).toMatchObject({ code: "missing_room", severity: "warning" });
    expect(detectConflicts(sst({ roomId: undefined, mode: "intra" }), ctx)).toEqual([]);
  });

  it("avertit quand la salle est sur un autre site", () => {
    const ctx = demoContext();
    const [c] = detectConflicts(sst({ roomId: "salle-c" }), ctx);
    expect(c).toMatchObject({ code: "room_other_site", severity: "warning", resource: { type: "room", id: "salle-c" } });
  });

  it("avertit au-delà du nombre maximal de stagiaires, sans bloquer", () => {
    const ctx = demoContext();
    const conflicts = detectConflicts(sst({ traineeIds: trainees(11) }), ctx);
    expect(codes(conflicts)).toEqual(["too_many_trainees"]);
    expect(hasBlockingConflict(conflicts)).toBe(false);
  });

  it("accepte une salle remplie exactement à sa capacité", () => {
    const ctx = demoContext();
    ctx.courses.find((c) => c.id === "sst")!.maxTrainees = 12;
    expect(detectConflicts(sst({ traineeIds: trainees(12) }), ctx)).toEqual([]);
    expect(codes(detectConflicts(sst({ traineeIds: trainees(13) }), ctx))).toEqual(["room_too_small", "too_many_trainees"]);
  });

  it("vérifie la compétence de chaque formateur, testeur compris", () => {
    const ctx = demoContext();
    const s = sst({ assignments: [{ role: "theory", trainerId: "lea" }, { role: "practice", trainerId: "nina" }] });
    const conflicts = detectConflicts(s, ctx);
    expect(codes(conflicts)).toEqual(["missing_competence"]);
    expect(conflicts[0].resource).toEqual({ type: "trainer", id: "nina" });
  });

  it("accepte une habilitation encore valide à la fin de la session", () => {
    const ctx = demoContext();
    // Marc : SST valable jusqu'au 15 novembre 2026.
    expect(detectConflicts(sst({ slots: day("2026-11-14"), assignments: [{ role: "theory", trainerId: "marc" }] }), ctx)).toEqual([]);
    expect(codes(detectConflicts(sst({ slots: day("2026-11-16"), assignments: [{ role: "theory", trainerId: "marc" }] }), ctx))).toEqual(["competence_expired"]);
  });

  it("ne signale qu'une fois un formateur affecté deux fois à la même session", () => {
    const ctx = demoContext();
    ctx.sessions.push(sst({ id: "autre", roomId: "salle-b" }));
    const s = sst({ id: "s2", assignments: [{ role: "theory", trainerId: "lea" }, { role: "practice", trainerId: "lea" }] });
    expect(codes(detectConflicts(s, ctx))).toEqual(["trainer_double_booked"]);
  });

  it("ignore un formateur inconnu du référentiel", () => {
    const ctx = demoContext();
    expect(detectConflicts(sst({ assignments: [{ role: "theory", trainerId: "fantome" }] }), ctx)).toEqual([]);
  });

  it("signale l'indisponibilité d'une salle et d'un engin", () => {
    const ctx = demoContext();
    ctx.unavailabilities.push(
      { id: "u1", resourceType: "room", resourceId: "salle-a", start: "2026-11-05T13:00:00+01:00", end: "2026-11-05T18:00:00+01:00", reason: "travaux" },
      { id: "u2", resourceType: "equipment", resourceId: "chariot-1", start: "2026-11-05T00:00:00+01:00", end: "2026-11-06T00:00:00+01:00" },
    );
    const s = session({ id: "c1", courseId: "caces-r489", slots: day("2026-11-05", "practice"), roomId: "salle-a", equipmentIds: ["chariot-1"], traineeIds: trainees(3), assignments: [{ role: "practice", trainerId: "lea" }] });
    const conflicts = detectConflicts(s, ctx).filter((c) => c.code === "resource_unavailable");
    expect(conflicts.map((c) => c.resource?.id).sort()).toEqual(["chariot-1", "salle-a"]);
    expect(conflicts.find((c) => c.resource?.id === "salle-a")?.message).toContain("travaux");
  });

  it("n'oppose pas à un testeur une indisponibilité hors de ses créneaux de test", () => {
    const ctx = demoContext();
    ctx.unavailabilities.push({ id: "u1", resourceType: "trainer", resourceId: "marc", start: "2026-11-03T00:00:00+01:00", end: "2026-11-04T00:00:00+01:00" });
    const s = session({
      id: "c1",
      courseId: "caces-r489",
      slots: [...day("2026-11-03", "practice"), ...day("2026-11-04", "test")],
      roomId: "salle-a",
      equipmentIds: ["chariot-1"],
      traineeIds: trainees(2),
      assignments: [{ role: "practice", trainerId: "lea" }, { role: "tester", trainerId: "marc" }],
    });
    expect(detectConflicts(s, ctx)).toEqual([]);
    ctx.unavailabilities[0] = { ...ctx.unavailabilities[0], start: "2026-11-04T00:00:00+01:00", end: "2026-11-05T00:00:00+01:00" };
    expect(codes(detectConflicts(s, ctx))).toEqual(["resource_unavailable"]);
  });

  it("n'oppose pas d'indisponibilité qui finit quand la session commence", () => {
    const ctx = demoContext();
    ctx.unavailabilities.push({ id: "u1", resourceType: "trainer", resourceId: "lea", start: "2026-11-02T00:00:00+01:00", end: "2026-11-03T08:30:00+01:00" });
    expect(detectConflicts(sst(), ctx)).toEqual([]);
  });

  it("ignore le matériel réservé par une session annulée", () => {
    const ctx = demoContext();
    const base = { courseId: "caces-r489", slots: day("2026-11-05", "practice"), equipmentIds: ["chariot-1"], traineeIds: trainees(2), assignments: [{ role: "practice" as const, trainerId: "lea" }] };
    ctx.sessions.push(session({ id: "c0", ...base, roomId: "salle-b", status: "cancelled", assignments: [] }));
    expect(detectConflicts(session({ id: "c1", ...base, roomId: "salle-a" }), ctx)).toEqual([]);
  });
});

describe("capacité des testeurs", () => {
  const caces = (id: string, n: number, extra: Partial<Parameters<typeof session>[0]> = {}) =>
    session({ id, courseId: "caces-r489", slots: day("2026-11-05", "test"), mode: "intra", traineeIds: trainees(n, id), assignments: [{ role: "tester", trainerId: "paul" }], equipmentIds: ["chariot-1"], ...extra });

  it("répartit les unités de test sur les jours de test", () => {
    const ctx = demoContext();
    const s = caces("c1", 3, { slots: [...day("2026-11-05", "test"), ...day("2026-11-06", "test")] });
    expect([...testUnitsByDay(s, ctx.courses[0])]).toEqual([["2026-11-05", 3], ["2026-11-06", 3]]);
    expect(testUnitsByDay(s, undefined).size).toBe(0);
  });

  it("accepte un testeur chargé exactement à sa capacité", () => {
    const ctx = demoContext();
    // Paul : 12 unités par jour. Tests le matin puis l'après-midi : 4 + 2 stagiaires × 2 unités = 12.
    const [morning, afternoon] = day("2026-11-05", "test");
    ctx.sessions.push(caces("c1", 4, { slots: [morning] }));
    expect(detectConflicts(caces("c2", 2, { slots: [afternoon] }), ctx)).toEqual([]);
    expect(codes(detectConflicts(caces("c2", 3, { slots: [afternoon] }), ctx))).toEqual(["tester_over_capacity"]);
  });

  it("partage la charge entre plusieurs testeurs d'une même session", () => {
    const ctx = demoContext();
    const s = caces("c1", 10, { assignments: [{ role: "tester", trainerId: "paul" }, { role: "tester", trainerId: "marc" }] });
    ctx.sessions.push(s);
    // 10 stagiaires × 2 unités = 20, soit 10 chacun : sous les 12 de Paul.
    expect(testerLoad("paul", "2026-11-05", ctx)).toBe(10);
    expect(codes(detectConflicts(s, ctx))).toEqual(["too_many_trainees"]);
  });

  it("ne cumule pas les tests de deux jours différents ni ceux d'une session annulée", () => {
    const ctx = demoContext();
    ctx.sessions.push(caces("c1", 5, { slots: day("2026-11-04", "test") }), caces("c0", 5, { status: "cancelled" }));
    expect(testerLoad("paul", "2026-11-05", ctx)).toBe(0);
    expect(detectConflicts(caces("c2", 5), ctx)).toEqual([]);
  });

  it("rattache les tests au jour de Paris, pas au jour UTC", () => {
    const ctx = demoContext();
    // 00:30 à Paris le 6 novembre = 23:30 UTC le 5 novembre.
    const s = caces("c1", 2, { slots: [{ start: "2026-11-05T23:30:00Z", end: "2026-11-06T01:00:00Z", kind: "test" }] });
    expect([...testUnitsByDay(s, ctx.courses[0]).keys()]).toEqual(["2026-11-06"]);
  });

  it("ne signale qu'une fois un dépassement partagé par plusieurs sessions", () => {
    const ctx = demoContext();
    const [morning, afternoon] = day("2026-11-05", "test");
    ctx.sessions.push(caces("c1", 4, { slots: [morning] }), caces("c2", 4, { slots: [afternoon] }));
    const over = detectAllConflicts(ctx).filter((c) => c.code === "tester_over_capacity");
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ resource: { type: "trainer", id: "paul" }, day: "2026-11-05" });
  });
});

describe("mobilisation des formateurs", () => {
  it("un testeur seul couvre toute la session quand elle n'a pas de test", () => {
    const s = session({ id: "x", courseId: "sst", slots: day("2026-11-03"), assignments: [{ role: "tester", trainerId: "paul" }] });
    expect(trainerSlots(s, "paul")).toHaveLength(2);
  });

  it("un formateur théorie ne couvre pas la pratique confiée à un autre", () => {
    const s = session({
      id: "x",
      courseId: "sst",
      slots: [...day("2026-11-03", "theory"), ...day("2026-11-04", "practice")],
      assignments: [{ role: "theory", trainerId: "lea" }, { role: "practice", trainerId: "marc" }],
    });
    expect(trainerSlots(s, "lea").map((sl) => sl.kind)).toEqual(["theory", "theory"]);
    expect(trainerSlots(s, "marc").map((sl) => sl.kind)).toEqual(["practice", "practice"]);
    expect(trainerSlots(s, "nina")).toEqual([]);
  });
});

describe("planning complet", () => {
  it("donne le même résultat quel que soit l'ordre des sessions", () => {
    const ctx = demoContext();
    const a = session({ id: "a", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-a", assignments: [{ role: "theory", trainerId: "lea" }] });
    const b = { ...a, id: "b" };
    ctx.sessions.push(a, b);
    const forward = detectAllConflicts(ctx).map((c) => c.code).sort();
    ctx.sessions.reverse();
    expect(detectAllConflicts(ctx).map((c) => c.code).sort()).toEqual(forward);
    expect(forward).toEqual(["room_double_booked", "trainer_double_booked"]);
  });

  it("chaque double réservation désigne une session réelle du planning", () => {
    const ctx = demoContext();
    const base = { courseId: "caces-r489", slots: day("2026-11-05", "practice"), roomId: "salle-a", equipmentIds: ["chariot-1"], traineeIds: trainees(2), assignments: [{ role: "practice" as const, trainerId: "lea" }] };
    ctx.sessions.push(session({ id: "a", ...base }), session({ id: "b", ...base }), session({ id: "c", ...base }));
    const all = detectAllConflicts(ctx);
    const ids = new Set(ctx.sessions.map((s) => s.id));
    for (const c of all.filter((x) => x.code.endsWith("double_booked"))) {
      expect(ids.has(c.otherSessionId!)).toBe(true);
      expect(c.otherSessionId).not.toBe(c.sessionId);
    }
    // 3 paires (a-b, a-c, b-c) × salle, formateur, engin.
    expect(all.filter((x) => x.code.endsWith("double_booked"))).toHaveLength(9);
  });
});
