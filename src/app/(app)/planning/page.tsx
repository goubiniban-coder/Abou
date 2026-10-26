import Link from "next/link";
import { addDays, detectAllConflicts, mondayOf, parisDay, trainerSlots, type Conflict } from "@/domain";
import { formatDay, fullName } from "@/lib/format";
import { loadContext } from "@/server/planning";
import { Timeline, type TimelineBlock, type TimelineRow } from "./timeline";
import type { PlanningView } from "@/app/actions";

export const metadata = { title: "Planning" };

const views: { id: PlanningView; label: string }[] = [
  { id: "trainer", label: "Formateurs" },
  { id: "room", label: "Salles" },
  { id: "equipment", label: "Matériel" },
];

export default async function PlanningPage({ searchParams }: PageProps<"/planning">) {
  const sp = await searchParams;
  const view = (views.find((v) => v.id === sp.view)?.id ?? "trainer") as PlanningView;
  const today = parisDay(new Date().toISOString());
  const monday = mondayOf(typeof sp.week === "string" ? sp.week : today);
  const site = typeof sp.site === "string" ? sp.site : "";
  const dayCount = sp.weekend === "1" ? 7 : 5;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(monday, i));
  const lastDay = days[days.length - 1];

  const ctx = await loadContext();
  const allConflicts = detectAllConflicts(ctx);
  const conflictsBySession = new Map<string, Conflict[]>();
  for (const c of allConflicts) {
    for (const id of [c.sessionId, c.otherSessionId]) {
      if (!id) continue;
      conflictsBySession.set(id, [...(conflictsBySession.get(id) ?? []), c]);
    }
  }

  const inWeek = ctx.sessions.filter(
    (s) => s.status !== "cancelled" && s.slots.some((sl) => parisDay(sl.start) >= monday && parisDay(sl.start) <= lastDay) && (!site || s.siteId === site),
  );

  let rows: TimelineRow[];
  if (view === "trainer") {
    rows = ctx.trainers
      .filter((t) => !site || t.siteId === site || t.external)
      .map((t) => ({ id: t.id, label: fullName(t), sub: t.external ? "Externe" : ctx.sites.find((s) => s.id === t.siteId)?.name }));
  } else if (view === "room") {
    rows = ctx.rooms.filter((r) => !site || r.siteId === site).map((r) => ({ id: r.id, label: r.name, sub: `${r.capacity} places · ${ctx.sites.find((s) => s.id === r.siteId)?.name}` }));
    rows.push({ id: null, label: "Sans salle", sub: "Intra ou à affecter" });
  } else {
    rows = ctx.equipment.filter((e) => !site || e.siteId === site).map((e) => ({ id: e.id, label: e.name, sub: e.kind }));
  }

  const resourcesOf = (s: (typeof inWeek)[number]): (string | null)[] =>
    view === "trainer" ? [...new Set(s.assignments.map((a) => a.trainerId))] : view === "room" ? [s.roomId ?? null] : s.equipmentIds;

  const blocks: TimelineBlock[] = inWeek.flatMap((s) => {
    const course = ctx.courses.find((c) => c.id === s.courseId);
    const conflicts = conflictsBySession.get(s.id) ?? [];
    return resourcesOf(s).map((resourceId) => ({
      key: `${s.id}:${resourceId}`,
      sessionId: s.id,
      resourceId,
      title: course?.code ?? "Session",
      subtitle: course?.title ?? "",
      color: course?.color ?? "#64748b",
      status: s.status,
      trainees: s.traineeIds.length,
      slots: (view === "trainer" && resourceId ? trainerSlots(s, resourceId) : s.slots).map((sl) => ({ start: sl.start, kind: sl.kind })),
      roles: view === "trainer" ? s.assignments.filter((a) => a.trainerId === resourceId).map((a) => a.role) : [],
      conflicts: conflicts.filter((c) => !c.resource || c.resource.id === resourceId || view === "room").map((c) => ({ severity: c.severity, message: c.message })),
      allConflicts: conflicts.length,
    }));
  });

  const weekConflicts = allConflicts.filter((c) => inWeek.some((s) => s.id === c.sessionId));
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ view, week: monday, ...(site ? { site } : {}), ...(dayCount === 7 ? { weekend: "1" } : {}) });
    for (const [k, v] of Object.entries(patch)) (v === undefined ? p.delete(k) : p.set(k, v));
    return `/planning?${p}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Planning</h1>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {views.map((v) => (
            <Link key={v.id} href={qs({ view: v.id })} className={`rounded px-3 py-1 ${v.id === view ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {v.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link className="btn-secondary" href={qs({ week: addDays(monday, -7) })} aria-label="Semaine précédente">←</Link>
          <Link className="btn-secondary" href={qs({ week: mondayOf(today) })}>Aujourd&apos;hui</Link>
          <Link className="btn-secondary" href={qs({ week: addDays(monday, 7) })} aria-label="Semaine suivante">→</Link>
          <span className="ml-2 font-medium text-slate-700">
            {formatDay(monday, { day: "numeric", month: "long" })} – {formatDay(lastDay, { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link href={qs({ site: undefined })} className={`rounded px-2 py-1 ${!site ? "font-semibold text-brand-700" : "text-slate-600"}`}>Tous les sites</Link>
          {ctx.sites.map((s) => (
            <Link key={s.id} href={qs({ site: s.id })} className={`rounded px-2 py-1 ${site === s.id ? "font-semibold text-brand-700" : "text-slate-600"}`}>{s.name}</Link>
          ))}
        </div>
        <Link href={qs({ weekend: dayCount === 7 ? undefined : "1" })} className="text-sm text-slate-600 hover:underline">
          {dayCount === 7 ? "Masquer le week-end" : "Afficher le week-end"}
        </Link>
        <Link href={`/sessions/new?date=${monday}`} className="btn-primary ml-auto">Nouvelle session</Link>
      </div>

      <Timeline view={view} days={days} today={today} rows={rows} blocks={blocks} />

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold">
          {weekConflicts.length === 0 ? "Aucun conflit cette semaine" : `${weekConflicts.length} conflit${weekConflicts.length > 1 ? "s" : ""} cette semaine`}
        </h2>
        <ul className="space-y-1 text-sm">
          {weekConflicts.map((c, i) => {
            const course = ctx.courses.find((co) => co.id === ctx.sessions.find((s) => s.id === c.sessionId)?.courseId);
            return (
              <li key={i} className="flex gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.severity === "error" ? "bg-red-500" : "bg-amber-400"}`} />
                <Link href={`/sessions/${c.sessionId}`} className="hover:underline">
                  <span className="font-medium">{course?.code}</span> : {c.message}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
