import Link from "next/link";
import { db, schema as t } from "@/db";
import { Icon, type IconName } from "@/components/icon";
import { addDays, attendanceSheet, detectAllConflicts, mondayOf, parisClock, parisDay, readinessScore, recyclingsDue, sessionReady, sheetComplete } from "@/domain";
import { formatDay, fullName } from "@/lib/format";
import { loadRecords } from "@/server/attendance";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Tableau de bord" };

interface Mission {
  label: string;
  hint: string;
  count: number;
  href: string;
  icon: IconName;
}

export default async function DashboardPage() {
  const now = new Date();
  const today = parisDay(now.toISOString());
  const monday = mondayOf(today);
  const week = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const hour = Number(parisClock(now.toISOString()).slice(0, 2));

  const [ctx, certs, proposals] = await Promise.all([loadContext(), db.select().from(t.certifications), db.select().from(t.proposals)]);
  const conflicts = detectAllConflicts(ctx);
  const active = ctx.sessions.filter((s) => s.status !== "cancelled");
  const daysOf = (s: (typeof active)[number]) => s.slots.map((sl) => parisDay(sl.start));
  const upcoming = active.filter((s) => daysOf(s).some((d) => d >= today));
  const thisWeek = active.filter((s) => daysOf(s).some((d) => d >= monday && d <= addDays(monday, 6)));
  const courseOf = (id: string) => ctx.courses.find((c) => c.id === id);
  const trainerOf = (id?: string) => ctx.trainers.find((x) => x.id === id);

  // Missions : ce qui demande une action, du plus urgent au plus administratif.
  const blocked = upcoming.filter((s) => conflicts.some((c) => c.severity === "error" && (c.sessionId === s.id || c.otherSessionId === s.id)));
  const drafts = upcoming.filter((s) => s.status === "draft");
  const since = addDays(today, -30);
  const recent = active.filter((s) => daysOf(s).some((d) => d >= since && d < today));
  const records = await loadRecords(recent.map((s) => s.id));
  const unsigned = recent.filter((s) => {
    const r = records.get(s.id)!;
    return attendanceSheet(s, r.attendance, r.trainerSignatures).some((sh) => parisDay(sh.slot.start) >= since && parisDay(sh.slot.start) < today && !sheetComplete(sh));
  });
  const toPropose = recyclingsDue(certs, ctx.sessions, today, 90).filter(
    (d) => !d.plannedSessionId && !proposals.some((p) => p.status !== "declined" && p.courseId === d.certification.courseId && p.traineeIds.includes(d.certification.traineeId) && !(p.status === "open" && p.expiresOn < today)),
  );
  const waiting = proposals.filter((p) => p.status === "open" && p.expiresOn >= today);

  const missions: Mission[] = [
    { label: "Conflits à résoudre", hint: "Double réservation, salle trop petite, habilitation manquante…", count: blocked.length, href: "/planning", icon: "alert" },
    { label: "Sessions à confirmer", hint: "Brouillons à valider pour envoyer les convocations", count: drafts.length, href: "/sessions", icon: "check" },
    { label: "Émargements incomplets", hint: "Signatures manquantes sur les 30 derniers jours", count: unsigned.length, href: "/sessions", icon: "pen" },
    { label: "Recyclages à proposer", hint: "Certificats qui expirent dans les 90 jours", count: toPropose.length, href: "/recyclages", icon: "refresh" },
    { label: "Réponses clients attendues", hint: "Propositions de dates envoyées, pas encore choisies", count: waiting.length, href: "/recyclages", icon: "mail" },
  ];
  const done = missions.filter((m) => m.count === 0).length;
  const score = readinessScore(upcoming, conflicts);

  const todaySlots = active
    .flatMap((s) => s.slots.filter((sl) => parisDay(sl.start) === today).map((slot) => ({ s, slot })))
    .sort((a, b) => a.slot.start.localeCompare(b.slot.start));
  const todayCount = new Set(todaySlots.map((x) => x.s.id)).size;
  const perDay = week.map((d) => ({ d, n: active.filter((s) => daysOf(s).includes(d)).length }));
  const busiest = Math.max(1, ...perDay.map((x) => x.n));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Bandeau d'accueil */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lg shadow-brand-900/20 md:p-8">
        <div className="absolute -top-16 -right-10 size-56 rounded-full bg-accent-400/25 blur-2xl" aria-hidden />
        <div className="absolute -bottom-20 left-1/3 size-48 rounded-full bg-accent-300/15 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-brand-100 first-letter:uppercase">{formatDay(today, { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{hour < 18 ? "Bonjour" : "Bonsoir"} 👋</h1>
            <p className="mt-2 max-w-lg text-brand-50/90">
              {todaySlots.length === 0
                ? "Aucune formation aujourd'hui."
                : `${todayCount} formation${todayCount > 1 ? "s" : ""} prévue${todayCount > 1 ? "s" : ""} aujourd'hui.`}{" "}
              {done === missions.length ? "Tout est en ordre, bravo !" : `${missions.length - done} mission${missions.length - done > 1 ? "s" : ""} à traiter ci-dessous.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/sessions/new" className="btn-accent">+ Nouvelle session</Link>
              <Link href="/planning" className="btn border border-white/25 bg-white/10 text-white hover:bg-white/20">Ouvrir le planning</Link>
            </div>
          </div>
          <ScoreRing score={score} />
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sessions cette semaine" value={thisWeek.length} icon="calendar" tone="green" />
        <Stat label="Stagiaires inscrits" value={new Set(upcoming.flatMap((s) => s.traineeIds)).size} icon="users" tone="yellow" />
        <Stat label="Formateurs mobilisés" value={new Set(thisWeek.flatMap((s) => s.assignments.map((a) => a.trainerId))).size} icon="user" tone="green" />
        <Stat label="Sessions prêtes" value={`${upcoming.filter((s) => sessionReady(s, conflicts)).length}/${upcoming.length}`} icon="check" tone="yellow" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Missions */}
        <section className="card min-w-0 p-5 lg:col-span-3">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-bold">Missions</h2>
            <span className="ml-auto rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{done}/{missions.length} accomplies</span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400 transition-all" style={{ width: `${(done / missions.length) * 100}%` }} />
          </div>
          <ul className="space-y-2">
            {missions.map((m) => (
              <li key={m.label}>
                <Link
                  href={m.href}
                  className={`group flex items-center gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md ${m.count === 0 ? "border-brand-100 bg-brand-50/50" : "border-accent-200 bg-accent-100/40"}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${m.count === 0 ? "bg-brand-500 text-white" : "bg-accent-400 text-brand-900"}`}>
                    <Icon name={m.count === 0 ? "check" : m.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${m.count === 0 ? "text-brand-800" : ""}`}>{m.label}</span>
                    <span className="block truncate text-xs text-slate-500">{m.count === 0 ? "Rien à faire, c'est carré" : m.hint}</span>
                  </span>
                  {m.count > 0 && <span className="rounded-full bg-brand-900 px-2.5 py-0.5 text-sm font-bold text-accent-300">{m.count}</span>}
                  <Icon name="arrow" className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Aujourd'hui */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Aujourd&apos;hui</h2>
            {todaySlots.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">Journée calme ☀️ Aucun créneau prévu.</p>
            ) : (
              <ol className="relative space-y-3 border-l-2 border-dashed border-brand-200 pl-4">
                {todaySlots.map(({ s, slot }) => {
                  const course = courseOf(s.courseId);
                  const trainer = trainerOf(s.assignments[0]?.trainerId);
                  return (
                    <li key={`${s.id}${slot.start}`} className="relative">
                      <span className="absolute top-1.5 -left-[23px] size-3 rounded-full border-2 border-white bg-accent-400 ring-2 ring-brand-500" />
                      <Link href={`/sessions/${s.id}`} className="block rounded-xl p-1 hover:bg-brand-50">
                        <p className="text-xs font-semibold text-brand-700">{parisClock(slot.start)} – {parisClock(slot.end)}</p>
                        <p className="text-sm font-semibold">
                          <span className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: course?.color ?? "#64748b" }} />
                          {course?.code} · {course?.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[ctx.rooms.find((r) => r.id === s.roomId)?.name, trainer && fullName(trainer), `${s.traineeIds.length} stagiaire${s.traineeIds.length > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Semaine */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Ma semaine</h2>
            <div className="flex h-32 items-end gap-2">
              {perDay.map(({ d, n }) => (
                <Link key={d} href={`/planning?week=${monday}`} className="group flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-bold text-slate-600">{n || ""}</span>
                  <span
                    className={`w-full rounded-t-xl transition group-hover:opacity-80 ${d === today ? "bg-accent-400" : "bg-brand-500"}`}
                    style={{ height: `${Math.max(6, (n / busiest) * 80)}px` }}
                  />
                  <span className={`text-xs capitalize ${d === today ? "font-bold text-brand-800" : "text-slate-500"}`}>{formatDay(d, { weekday: "short" }).replace(".", "")}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const mood = score >= 80 ? "Au top !" : score >= 50 ? "Ça avance" : "On s'y met ?";
  return (
    <div className="flex flex-col items-center">
      <div className="relative size-32">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/15" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="text-accent-400" />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-3xl font-extrabold">{score}<span className="text-base">%</span></span>
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold text-accent-200">{mood}</p>
      <p className="text-xs text-brand-100/80">sessions à venir prêtes</p>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number | string; icon: IconName; tone: "green" | "yellow" }) {
  return (
    <div className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone === "green" ? "bg-brand-100 text-brand-700" : "bg-accent-100 text-accent-500"}`}>
        <Icon name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-tight font-extrabold">{value}</span>
        <span className="block text-xs text-slate-500">{label}</span>
      </span>
    </div>
  );
}
