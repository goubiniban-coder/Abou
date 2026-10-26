import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db, schema as t } from "@/db";
import { addUnavailability, deleteUnavailability } from "@/app/ref-actions";
import { detectAllConflicts, parisDay, trainerSlots } from "@/domain";
import { formatDay, formatTime, fullName, roleLabel, slotKindLabel } from "@/lib/format";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Mon planning" };

/** Espace formateur, pensé pour le téléphone. On y accède par un lien personnel. */
export default async function TrainerSpace({ params }: PageProps<"/formateur/[token]">) {
  const { token } = await params;
  const [trainer] = await db.select().from(t.trainers).where(eq(t.trainers.calendarToken, token));
  if (!trainer) notFound();
  const ctx = await loadContext();
  const today = parisDay(new Date().toISOString());
  const host = (await headers()).get("host") ?? "localhost:3000";
  const back = `/formateur/${token}`;

  const mine = ctx.sessions.filter((s) => s.status !== "cancelled" && s.assignments.some((a) => a.trainerId === trainer.id));
  const items = mine
    .flatMap((s) => trainerSlots(s, trainer.id).map((slot) => ({ s, slot })))
    .filter(({ slot }) => parisDay(slot.start) >= today)
    .sort((a, b) => a.slot.start.localeCompare(b.slot.start));
  const byDay = new Map<string, typeof items>();
  for (const it of items) byDay.set(parisDay(it.slot.start), [...(byDay.get(parisDay(it.slot.start)) ?? []), it]);

  const myConflicts = detectAllConflicts(ctx).filter((c) => c.resource?.type === "trainer" && c.resource.id === trainer.id);
  const unavailable = ctx.unavailabilities.filter((u) => u.resourceType === "trainer" && u.resourceId === trainer.id && parisDay(u.end) >= today);
  const [trainees, clients] = await Promise.all([db.select().from(t.trainees), db.select().from(t.clients)]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-16">
      <header>
        <p className="text-sm text-slate-500">Mon planning</p>
        <h1 className="text-2xl font-bold">{fullName(trainer)}</h1>
      </header>

      {myConflicts.length > 0 && (
        <section className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">À signaler au planificateur</p>
          <ul className="mt-1 list-disc pl-5">{myConflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
        </section>
      )}

      {byDay.size === 0 && <p className="card p-4 text-sm text-slate-500">Aucune intervention à venir.</p>}
      {[...byDay].map(([day, list]) => (
        <section key={day}>
          <h2 className={`mb-1 text-sm font-semibold first-letter:uppercase ${day === today ? "text-brand-700" : "text-slate-700"}`}>
            {day === today ? "Aujourd'hui · " : ""}
            {formatDay(day, { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <div className="space-y-2">
            {list.map(({ s, slot }) => {
              const course = ctx.courses.find((c) => c.id === s.courseId);
              const room = ctx.rooms.find((r) => r.id === s.roomId);
              const site = ctx.sites.find((x) => x.id === s.siteId);
              const roles = s.assignments.filter((a) => a.trainerId === trainer.id).map((a) => roleLabel[a.role]);
              const names = s.traineeIds.map((id) => trainees.find((x) => x.id === id)).filter((x) => x !== undefined);
              return (
                <details key={`${s.id}${slot.start}`} className="card overflow-hidden" style={{ borderLeft: `4px solid ${course?.color ?? "#64748b"}` }}>
                  <summary className="cursor-pointer list-none p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{formatTime(slot.start)} – {formatTime(slot.end)}</span>
                      <span className="text-slate-500">{slotKindLabel[slot.kind]}</span>
                    </div>
                    <div className="font-medium">{course?.code} · {course?.title}</div>
                    <div className="text-sm text-slate-600">
                      {s.mode === "intra" ? `Chez ${clients.find((c) => c.id === s.clientId)?.name ?? "le client"}` : `${room?.name ?? "Salle à définir"}, ${site?.name}`} · {roles.join(", ")}
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 p-3 text-sm">
                    <p className="mb-1 font-medium">{names.length} stagiaire{names.length > 1 ? "s" : ""}</p>
                    <ul className="text-slate-600">{names.map((n) => <li key={n.id}>{fullName(n)}</li>)}</ul>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      ))}

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Mes indisponibilités</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {unavailable.length === 0 && <li className="text-slate-500">Aucune.</li>}
          {unavailable.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2">
              <span>{formatDay(parisDay(u.start))} → {formatDay(parisDay(new Date(Date.parse(u.end) - 1).toISOString()))}{u.reason && ` · ${u.reason}`}</span>
              <form action={deleteUnavailability}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="back" value={back} />
                <button className="text-xs text-slate-400">Retirer</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addUnavailability} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="resourceType" value="trainer" />
          <input type="hidden" name="resourceId" value={trainer.id} />
          <input type="hidden" name="back" value={back} />
          <label className="text-xs">Du<input type="date" name="from" required className="input" /></label>
          <label className="text-xs">Au<input type="date" name="to" className="input" /></label>
          <input name="reason" placeholder="Motif (facultatif)" className="input col-span-2" />
          <button className="btn-primary col-span-2">Me déclarer indisponible</button>
        </form>
      </section>

      <section className="card p-4 text-sm">
        <h2 className="mb-1 font-semibold">Ajouter à mon agenda</h2>
        <p className="mb-2 text-slate-600">Abonnez-vous une fois : vos sessions apparaissent et se mettent à jour dans Google Agenda, Outlook ou le calendrier du téléphone.</p>
        <a className="btn-secondary w-full" href={`webcal://${host}/api/calendar/${token}.ics`}>S&apos;abonner (téléphone, Outlook)</a>
        <p className="mt-2 text-xs break-all text-slate-500">Google Agenda : « Autres agendas » → « À partir de l&apos;URL » → https://{host}/api/calendar/{token}.ics</p>
      </section>
    </div>
  );
}
