import { addMonths, daysBetween } from "./time";
import type { Certification, Course, Session } from "./types";

/** Date de fin de validité d'un certificat obtenu le `obtainedOn`. */
export function validityEnd(course: Course, obtainedOn: string): string | undefined {
  return course.validityMonths ? addMonths(obtainedOn, course.validityMonths) : undefined;
}

export interface RecyclingDue {
  certification: Certification;
  daysLeft: number;
  expired: boolean;
  /** Session de recyclage déjà planifiée avant l'échéance, s'il y en a une. */
  plannedSessionId?: string;
}

/**
 * Certificats qui expirent dans les `horizonDays` jours (ou déjà expirés),
 * en indiquant ceux pour qui un recyclage est déjà planifié.
 */
export function recyclingsDue(
  certifications: Certification[],
  sessions: Session[],
  today: string,
  horizonDays = 90,
): RecyclingDue[] {
  return certifications
    .map((certification) => {
      const daysLeft = daysBetween(today, certification.validUntil);
      const planned = sessions.find(
        (s) =>
          s.status !== "cancelled" &&
          s.courseId === certification.courseId &&
          s.traineeIds.includes(certification.traineeId) &&
          s.slots.some((slot) => slot.start >= today),
      );
      return { certification, daysLeft, expired: daysLeft < 0, plannedSessionId: planned?.id };
    })
    .filter((r) => r.daysLeft <= horizonDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
