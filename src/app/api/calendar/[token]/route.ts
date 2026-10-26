import { eq } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { toICalendar, trainerSlots } from "@/domain";
import { loadContext } from "@/server/planning";

/** Flux iCal d'un formateur : /api/calendar/<jeton>.ics, à abonner dans Google Agenda ou Outlook. */
export async function GET(_req: Request, { params }: RouteContext<"/api/calendar/[token]">) {
  const token = (await params).token.replace(/\.ics$/, "");
  const [trainer] = await db.select().from(t.trainers).where(eq(t.trainers.calendarToken, token));
  if (!trainer) return new Response("Agenda introuvable", { status: 404 });
  const ctx = await loadContext();
  // Seuls les créneaux où le formateur est mobilisé apparaissent dans son agenda.
  const sessions = ctx.sessions
    .filter((s) => s.assignments.some((a) => a.trainerId === trainer.id))
    .map((s) => ({ ...s, slots: trainerSlots(s, trainer.id) }));
  const body = toICalendar(`${trainer.firstName} ${trainer.lastName} · Abou`, sessions, ctx);
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="planning-${trainer.id}.ics"` },
  });
}
