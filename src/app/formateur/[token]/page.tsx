import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema as t } from "@/db";
import { trainerAddUnavailability, trainerDeleteUnavailability } from "@/app/ref-actions";
import { addDays, attendanceSheet, signingOpen, detectAllConflicts, parisDay, sheetComplete, slotKey, trainerSlots } from "@/domain";
import { formatDay, formatTime, fullName, roleLabel, slotKindLabel } from "@/lib/format";
import { loadContext } from "@/server/planning";
import { loadRecords } from "@/server/attendance";
import { Icon } from "@/components/icon";

export const metadata = { title: "Mon planning" };

/** Espace formateur, pensé pour le téléphone. On y accède par un lien personnel. */
export default async function TrainerSpace({ params }: PageProps<"/formateur/[token]">) {
  const { token } = await params;
  const [trainer] = await db.select().from(t.trainers).where(eq(t.trainers.calendarToken, token));
  if (!trainer) notFound();
  const ctx = await loadContext();
  const today = parisDay(new Date().toISOString());
  const host = (await headers()).get("host") ?? "localhost:3000";

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

  const now = new Date();
  const records = await loadRecords(mine.map((s) => s.id));
  const sheetOf = (sessionId: string, start: string) => {
    const s = mine.find((x) => x.id === sessionId)!;
    const r = records.get(sessionId)!;
    return attendanceSheet(s, r.attendance, r.trainerSignatures).find((x) => slotKey(x.slot.start) === slotKey(start))!;
  };
  const since = addDays(today, -30);
  const toComplete = mine
    .flatMap((s) => trainerSlots(s, trainer.id).map((slot) => ({ s, slot })))
    .filter(({ s, slot }) => parisDay(slot.start) >= since && parisDay(slot.start) < today && !sheetComplete(sheetOf(s.id, slot.start)))
    .sort((a, b) => a.slot.start.localeCompare(b.slot.start));

  return (
    <main className="mx-auto max-w-lg space-y-4 p-4 pb-16">
      <header className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white shadow-md shadow-brand-900/20">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-400 text-lg font-extrabold text-brand-900" aria-hidden>
          {trainer.firstName[0]}
          {trainer.lastName[0]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-50">Mon planning</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{fullName(trainer)}</h1>
        </div>
      </header>

      {myConflicts.length > 0 && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <h2 className="flex items-center gap-1.5 font-semibold"><Icon name="alert" className="size-4" /> À signaler au planificateur</h2>
          <ul className="mt-1 list-disc pl-5">{myConflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
        </section>
      )}

      {toComplete.length > 0 && (
        <section className="rounded-2xl border border-accent-300 bg-accent-100 p-3 text-sm text-amber-950">
          <h2 className="flex items-center gap-1.5 font-semibold"><Icon name="pen" className="size-4" /> Émargements à compléter</h2>
          <ul className="mt-1">
            {toComplete.map(({ s, slot }) => {
              const course = ctx.courses.find((c) => c.id === s.courseId);
              return (
                <li key={`${s.id}${slot.start}`}>
                  <Link className="flex min-h-11 items-center underline underline-offset-2" href={`/formateur/${token}/emargement/${s.id}?slot=${encodeURIComponent(slotKey(slot.start))}`}>
                    {formatDay(parisDay(slot.start))} {formatTime(slot.start)} · {course?.code}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {byDay.size === 0 && <p className="card p-4 text-sm text-slate-600">Aucune intervention à venir.</p>}
      {[...byDay].map(([day, list]) => (
        <section key={day}>
          <h2 className={`mb-1.5 text-sm font-bold first-letter:uppercase ${day === today ? "text-brand-800" : "text-slate-700"}`}>
            {day === today && <span className="mr-1.5 rounded-full bg-accent-400 px-2 py-0.5 text-brand-900">Aujourd&apos;hui</span>}
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
                  <summary className="group cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">{formatTime(slot.start)} – {formatTime(slot.end)}</span>
                      <span className="ml-auto text-slate-600">{slotKindLabel[slot.kind]}</span>
                      <Icon name="arrow" className="size-4 text-brand-700 transition group-open:rotate-90" />
                    </div>
                    <div className="font-medium">{course?.code} · {course?.title}</div>
                    <div className="text-sm text-slate-600">
                      {s.mode === "intra" ? `Chez ${clients.find((c) => c.id === s.clientId)?.name ?? "le client"}` : `${room?.name ?? "Salle à définir"}, ${site?.name}`} · {roles.join(", ")}
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 p-3 text-sm">
                    <p className="mb-1 font-medium">{names.length} stagiaire{names.length > 1 ? "s" : ""}</p>
                    <ul className="text-slate-600">{names.map((n) => <li key={n.id}>{fullName(n)}</li>)}</ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {signingOpen(slot.start, now) ? (
                        <Link className="btn-primary flex-1" href={`/formateur/${token}/emargement/${s.id}?slot=${encodeURIComponent(slotKey(slot.start))}`}>
                          Émargement · {sheetOf(s.id, slot.start).present.length + sheetOf(s.id, slot.start).absent.length}/{names.length}
                          {sheetOf(s.id, slot.start).trainerSigned.length > 0 && " ✓"}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-600">Émargement ouvert à {formatTime(new Date(Date.parse(slot.start) - 15 * 60_000).toISOString())}</span>
                      )}
                      {slot.kind === "test" && (roles.includes("Testeur") || !course?.testUnitsPerTrainee) && (
                        <Link className="btn-secondary flex-1" href={`/formateur/${token}/resultats/${s.id}`}>Saisir les résultats</Link>
                      )}
                    </div>
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
          {unavailable.length === 0 && <li className="text-slate-600">Aucune.</li>}
          {unavailable.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2">
              <span>{formatDay(parisDay(u.start))} → {formatDay(parisDay(new Date(Date.parse(u.end) - 1).toISOString()))}{u.reason && ` · ${u.reason}`}</span>
              <form action={trainerDeleteUnavailability.bind(null, token, u.id)}>
                <button className="btn-ghost text-xs hover:text-red-700" aria-label={`Retirer l'indisponibilité du ${formatDay(parisDay(u.start))}`}>Retirer</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={trainerAddUnavailability.bind(null, token)} className="grid grid-cols-2 gap-2">
          <label className="label">Du<input type="date" name="from" required className="input mt-1" /></label>
          <label className="label">Au<input type="date" name="to" className="input mt-1" /></label>
          <input name="reason" placeholder="Motif (facultatif)" aria-label="Motif (facultatif)" className="input col-span-2" />
          <button className="btn-primary col-span-2">Me déclarer indisponible</button>
        </form>
      </section>

      <section className="card p-4 text-sm">
        <h2 className="mb-1 font-semibold">Ajouter à mon agenda</h2>
        <p className="mb-2 text-slate-600">Abonnez-vous une fois : vos sessions apparaissent et se mettent à jour dans Google Agenda, Outlook ou le calendrier du téléphone.</p>
        <a className="btn-secondary min-h-11 w-full" href={`webcal://${host}/api/calendar/${token}.ics`}>S&apos;abonner (téléphone, Outlook)</a>
        <p className="mt-2 text-xs break-all text-slate-600">Google Agenda : « Autres agendas » → « À partir de l&apos;URL » → https://{host}/api/calendar/{token}.ics</p>
      </section>
    </main>
  );
}
