import type { Course, PlanningContext, Session } from "./types";

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Flux iCalendar d'une liste de sessions, à abonner depuis Google Agenda ou Outlook. */
export function toICalendar(name: string, sessions: Session[], ctx: PlanningContext, now = new Date().toISOString()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Abou//Planning//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escape(name)}`];
  for (const session of sessions) {
    if (session.status === "cancelled") continue;
    const course: Course | undefined = ctx.courses.find((c) => c.id === session.courseId);
    const room = ctx.rooms.find((r) => r.id === session.roomId);
    const site = ctx.sites.find((s) => s.id === session.siteId);
    session.slots.forEach((slot, i) => {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${session.id}-${i}@abou`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(slot.start)}`,
        `DTEND:${stamp(slot.end)}`,
        `SUMMARY:${escape(course ? `${course.code} ${course.title}` : "Session")}`,
        `LOCATION:${escape([room?.name, site?.name].filter(Boolean).join(", ") || (session.mode === "intra" ? "Chez le client" : ""))}`,
        `STATUS:${session.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
        "END:VEVENT",
      );
    });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
