import { describe, expect, it } from "vitest";
import { recyclingsDue, validityEnd } from "./caces";
import { day, demoContext, session } from "./fixtures";
import { toICalendar } from "./ical";

describe("CACES", () => {
  it("calcule la fin de validité, y compris en fin de mois", () => {
    const course = demoContext().courses[0];
    expect(validityEnd(course, "2026-11-05")).toBe("2031-11-05");
    expect(validityEnd({ ...course, validityMonths: 1 }, "2026-01-31")).toBe("2026-02-28");
  });

  it("liste les recyclages à prévoir sous 90 jours et repère ceux déjà planifiés", () => {
    const certs = [
      { id: "c1", traineeId: "t1", courseId: "caces-r489", obtainedOn: "2021-12-01", validUntil: "2026-12-01" },
      { id: "c2", traineeId: "t2", courseId: "caces-r489", obtainedOn: "2022-06-01", validUntil: "2027-06-01" },
      { id: "c3", traineeId: "t3", courseId: "sst", obtainedOn: "2024-10-01", validUntil: "2026-10-01" },
    ];
    const planned = session({ id: "recyclage", courseId: "caces-r489", slots: day("2026-11-20"), traineeIds: ["t1"] });
    const due = recyclingsDue(certs, [planned], "2026-10-26");
    expect(due.map((d) => [d.certification.id, d.daysLeft, d.expired, d.plannedSessionId])).toEqual([
      ["c3", -25, true, undefined],
      ["c1", 36, false, "recyclage"],
    ]);
  });
});

describe("iCal", () => {
  it("produit un événement par créneau en UTC", () => {
    const ctx = demoContext();
    const s = session({ id: "s1", courseId: "sst", slots: day("2026-11-03"), roomId: "salle-a" });
    const ics = toICalendar("Léa Martin", [s], ctx, "2026-10-26T10:00:00Z");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART:20261103T073000Z");
    expect(ics).toContain("LOCATION:Salle A\\, Centre de Pau");
  });
});
