import type { Conflict } from "./conflicts";
import type { Session } from "./types";

// Tableau de bord : une session « prête » peut se tenir sans qu'on y touche.

/** Confirmée, avec un formateur, des stagiaires et aucun conflit bloquant. */
export function sessionReady(session: Session, conflicts: Conflict[]): boolean {
  return (
    session.status === "confirmed" &&
    session.assignments.length > 0 &&
    session.traineeIds.length > 0 &&
    !conflicts.some((c) => c.severity === "error" && (c.sessionId === session.id || c.otherSessionId === session.id))
  );
}

/** Part des sessions prêtes, en pourcentage ; 100 quand il n'y a rien à préparer. */
export function readinessScore(sessions: Session[], conflicts: Conflict[]): number {
  const active = sessions.filter((s) => s.status !== "cancelled");
  if (active.length === 0) return 100;
  return Math.round((active.filter((s) => sessionReady(s, conflicts)).length / active.length) * 100);
}
