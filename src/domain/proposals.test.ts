import { describe, expect, it } from "vitest";
import { demoContext, session, day } from "./fixtures";
import { defaultSlots, optionStillFree, proposeDates, searchWindow } from "./proposals";

const ctx = demoContext();
const caces = ctx.courses.find((c) => c.id === "caces-r489")!;
const trainees = ["t1", "t2", "t3"];

describe("créneaux par défaut", () => {
  it("enchaîne les jours ouvrés et termine par le test", () => {
    // Vendredi 6 novembre 2026 : la formation reprend le lundi.
    const slots = defaultSlots(caces, "2026-11-06");
    expect(slots.map((s) => [s.start, s.kind])).toEqual([
      ["2026-11-06T07:30:00.000Z", "theory"],
      ["2026-11-06T12:30:00.000Z", "theory"],
      ["2026-11-09T07:30:00.000Z", "practice"],
      ["2026-11-09T12:30:00.000Z", "practice"],
      ["2026-11-10T07:30:00.000Z", "test"],
      ["2026-11-10T12:30:00.000Z", "test"],
    ]);
  });
});

describe("propositions de dates", () => {
  it("propose des dates espacées, avec salle, formateur, testeur et engins", () => {
    const options = proposeDates({ course: caces, siteId: "pau", traineeIds: trainees, from: "2026-11-02", until: "2026-12-31" }, ctx);
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.slots[0].start.slice(0, 10))).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    const first = options[0];
    expect(first.roomId).toBeDefined();
    expect(first.assignments.map((a) => a.role)).toEqual(["theory", "tester"]);
    expect(first.equipmentIds).toHaveLength(1);
  });

  it("écarte les jours où les ressources sont prises", () => {
    // Tous les chariots de Pau sont pris la semaine du 2 novembre.
    const busy = session({ id: "occupe", courseId: caces.id, slots: [...day("2026-11-02"), ...day("2026-11-03"), ...day("2026-11-04"), ...day("2026-11-05"), ...day("2026-11-06")], equipmentIds: ["chariot-1", "chariot-2"] });
    const options = proposeDates({ course: caces, siteId: "pau", traineeIds: trainees, from: "2026-11-02", until: "2026-12-31", count: 1 }, { ...ctx, sessions: [busy] });
    expect(options[0].slots[0].start.slice(0, 10)).toBe("2026-11-09");
  });

  it("revérifie une option au moment du choix", () => {
    const [option] = proposeDates({ course: caces, siteId: "pau", traineeIds: trainees, from: "2026-11-02", until: "2026-12-31", count: 1 }, ctx);
    expect(optionStillFree(option, caces, "pau", trainees, ctx)).toBe(true);
    const taken = session({ id: "pris", courseId: caces.id, slots: option.slots, roomId: option.roomId, equipmentIds: option.equipmentIds, assignments: option.assignments });
    expect(optionStillFree(option, caces, "pau", trainees, { ...ctx, sessions: [taken] })).toBe(false);
  });

  it("cherche avant l'échéance, ou sur deux mois si elle est trop proche", () => {
    expect(searchWindow("2026-10-26", "2027-01-15")).toEqual({ from: "2026-11-02", until: "2027-01-14" });
    expect(searchWindow("2026-10-26", "2026-11-05")).toEqual({ from: "2026-11-02", until: "2027-01-01" });
  });
});
