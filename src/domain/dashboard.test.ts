import { describe, expect, it } from "vitest";
import type { Conflict } from "./conflicts";
import { readinessScore, sessionReady } from "./dashboard";
import { day, session, trainees } from "./fixtures";

const base = { courseId: "r489", slots: day("2026-11-02"), assignments: [{ role: "theory" as const, trainerId: "marc" }], traineeIds: trainees(3) };
const clash: Conflict = { code: "trainer_double_booked", severity: "error", message: "Marc est déjà pris", sessionId: "b", otherSessionId: "a" };

describe("Tableau de bord", () => {
  it("une session est prête si elle est confirmée, staffée, remplie et sans conflit bloquant", () => {
    expect(sessionReady(session({ id: "a", ...base }), [])).toBe(true);
    expect(sessionReady(session({ id: "a", ...base, status: "draft" }), [])).toBe(false);
    expect(sessionReady(session({ id: "a", ...base, assignments: [] }), [])).toBe(false);
    expect(sessionReady(session({ id: "a", ...base, traineeIds: [] }), [])).toBe(false);
    // Le conflit touche aussi l'autre session impliquée.
    expect(sessionReady(session({ id: "a", ...base }), [clash])).toBe(false);
    expect(sessionReady(session({ id: "a", ...base }), [{ ...clash, severity: "warning" }])).toBe(true);
  });

  it("calcule la part des sessions prêtes, sans compter les annulées", () => {
    const sessions = [session({ id: "a", ...base }), session({ id: "c", ...base, status: "draft" }), session({ id: "d", ...base, status: "cancelled" })];
    expect(readinessScore(sessions, [])).toBe(50);
    expect(readinessScore([], [])).toBe(100);
  });
});
