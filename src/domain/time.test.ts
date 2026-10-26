import { describe, expect, it } from "vitest";
import { mondayOf, parisDay, parisTime, shiftParisDays } from "./time";

describe("heure de Paris", () => {
  it("tient compte de l'heure d'été et d'hiver", () => {
    expect(parisTime("2026-11-03", "08:30")).toBe("2026-11-03T07:30:00.000Z");
    expect(parisTime("2026-06-03", "08:30")).toBe("2026-06-03T06:30:00.000Z");
    expect(parisDay("2026-11-02T23:30:00.000Z")).toBe("2026-11-03");
  });
  it("trouve le lundi de la semaine", () => {
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
  });
});

describe("shiftParisDays", () => {
  it("garde l'heure locale en traversant le changement d'heure", () => {
    // 8h30 à Paris le vendredi 23 octobre 2026 (UTC+2) → lundi 26 octobre (UTC+1)
    expect(shiftParisDays("2026-10-23T06:30:00.000Z", 3)).toBe("2026-10-26T07:30:00.000Z");
  });
});
