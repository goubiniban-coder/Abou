import { describe, expect, it } from "vitest";
import { day, demoContext, session, trainees } from "./fixtures";
import { suggestEquipment, suggestRooms, suggestTrainers } from "./suggestions";

describe("suggestions", () => {
  it("classe en tête le formateur interne disponible du site et écarte celui déjà pris", () => {
    const ctx = demoContext();
    ctx.sessions.push(session({ id: "other", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-b", assignments: [{ role: "theory", trainerId: "lea" }] }));
    const s = session({ id: "s1", courseId: "caces-r489", slots: day("2026-11-03", "practice"), roomId: "salle-a", traineeIds: trainees(4) });
    const ranked = suggestTrainers(s, "practice", ctx);
    expect(ranked[0].item.id).toBe("marc");
    expect(ranked.find((r) => r.item.id === "lea")?.available).toBe(false);
    expect(ranked.find((r) => r.item.id === "nina")?.available).toBe(false); // pas la compétence R489
  });

  it("ne propose comme testeurs que les formateurs qui ont une capacité de test", () => {
    const ctx = demoContext();
    const s = session({ id: "s1", courseId: "caces-r489", slots: day("2026-11-05", "test"), traineeIds: trainees(4) });
    expect(suggestTrainers(s, "tester", ctx).map((r) => r.item.id)).toEqual(["marc", "paul"]);
  });

  it("préfère la plus petite salle suffisante du site", () => {
    const ctx = demoContext();
    const s = session({ id: "s1", courseId: "sst", slots: day("2026-11-03"), traineeIds: trainees(5) });
    const ranked = suggestRooms(s, ctx);
    expect(ranked.map((r) => r.item.id)).toEqual(["salle-b", "salle-a", "salle-c"]);
  });

  it("propose les engins libres du bon type", () => {
    const ctx = demoContext();
    ctx.sessions.push(session({ id: "other", courseId: "caces-r489", slots: day("2026-11-05"), equipmentIds: ["chariot-1"] }));
    const s = session({ id: "s1", courseId: "caces-r489", slots: day("2026-11-05") });
    const ranked = suggestEquipment(s, "R489-3", ctx);
    expect(ranked[0].item.id).toBe("chariot-2");
    expect(ranked[1].available).toBe(false);
  });
});
