import { describe, expect, it } from "vitest";
import { attendanceSheet, attendedHours, certificatesToIssue, decision, evaluationOpen, isValidSignature, plannedHours, sheetComplete } from "./attendance";
import { day, demoContext, session } from "./fixtures";

const course = demoContext().courses[0]; // CACES R489, tests théorie et pratique
const s = session({ id: "s", courseId: course.id, slots: [...day("2026-11-02"), ...day("2026-11-03", "test")], traineeIds: ["a", "b", "c"] });
const morning = "2026-11-02T08:30:00+01:00";
const afternoon = "2026-11-02T13:30:00+01:00";

describe("émargement", () => {
  it("compte les heures prévues et les heures signées", () => {
    const records = [
      { slotStart: morning, traineeId: "a", presence: "present" as const },
      // Même instant écrit en UTC : c'est bien le même créneau.
      { slotStart: "2026-11-02T12:30:00.000Z", traineeId: "a", presence: "present" as const },
      { slotStart: morning, traineeId: "b", presence: "absent" as const },
    ];
    expect(plannedHours(s)).toBe(14);
    expect(attendedHours(s, records, "a")).toBe(7);
    expect(attendedHours(s, records, "b")).toBe(0);
  });

  it("indique, par créneau, qui a signé, qui est absent et qui manque", () => {
    const sheet = attendanceSheet(
      s,
      [
        { slotStart: morning, traineeId: "a", presence: "present" },
        { slotStart: morning, traineeId: "b", presence: "absent" },
        { slotStart: morning, traineeId: "c", presence: "present" },
        { slotStart: afternoon, traineeId: "a", presence: "present" },
        { slotStart: morning, traineeId: "intrus", presence: "present" },
      ],
      [{ slotStart: morning, trainerId: "lea" }],
    );
    expect(sheet[0]).toMatchObject({ present: ["a", "c"], absent: ["b"], missing: [], trainerSigned: ["lea"] });
    expect(sheetComplete(sheet[0])).toBe(true);
    expect(sheet[1]).toMatchObject({ present: ["a"], missing: ["b", "c"], trainerSigned: [] });
    expect(sheetComplete(sheet[1])).toBe(false);
  });
});

describe("résultats", () => {
  it("ouvre la saisie au premier créneau de test", () => {
    expect(evaluationOpen(s, new Date("2026-11-02T10:00:00+01:00"))).toBe(false);
    expect(evaluationOpen(s, new Date("2026-11-03T08:30:00+01:00"))).toBe(true);
    const noTest = session({ id: "n", courseId: "sst", slots: day("2026-11-02") });
    expect(evaluationOpen(noTest, new Date("2026-11-02T10:00:00+01:00"))).toBe(false);
    expect(evaluationOpen(noTest, new Date("2026-11-02T13:30:00+01:00"))).toBe(true);
  });

  it("exige la théorie et la pratique pour un CACES", () => {
    expect(decision(course, undefined)).toBe("pending");
    expect(decision(course, { traineeId: "a", theory: "passed" })).toBe("pending");
    expect(decision(course, { traineeId: "a", theory: "passed", practice: "failed" })).toBe("failed");
    expect(decision(course, { traineeId: "a", theory: "passed", practice: "passed" })).toBe("passed");
  });

  it("se contente d'une évaluation réussie hors CACES", () => {
    const sst = demoContext().courses.find((c) => !c.testUnitsPerTrainee)!;
    expect(decision(sst, { traineeId: "a", practice: "passed" })).toBe("passed");
    expect(decision(sst, { traineeId: "a" })).toBe("pending");
  });

  it("crée un certificat par stagiaire reçu, daté du dernier jour, sans doublon", () => {
    const results = [
      { traineeId: "a", theory: "passed" as const, practice: "passed" as const },
      { traineeId: "b", theory: "passed" as const, practice: "failed" as const },
      { traineeId: "c", theory: "passed" as const, practice: "passed" as const },
    ];
    expect(certificatesToIssue(s, course, results, ["c"])).toEqual([{ traineeId: "a", obtainedOn: "2026-11-03", validUntil: "2031-11-03" }]);
    expect(certificatesToIssue(s, { ...course, validityMonths: undefined }, results, [])).toEqual([]);
  });
});

describe("signature", () => {
  it("n'accepte qu'un tracé simple", () => {
    expect(isValidSignature("M10 20 L30.5 40 L50 60")).toBe(true);
    expect(isValidSignature("M10 20")).toBe(false);
    expect(isValidSignature('M10 20 L30 40" onload="x')).toBe(false);
    expect(isValidSignature("")).toBe(false);
  });
});
