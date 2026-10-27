import Link from "next/link";
import { addDays, detectAllConflicts, mondayOf, parisDay, trainerSlots, type Conflict } from "@/domain";
import { formatDay, fullName } from "@/lib/format";
import { loadContext } from "@/server/planning";
import { Icon, type IconName } from "@/components/icon";
import { PageHeader, SeverityDot } from "@/components/ui";
import { Timeline, type TimelineBlock, type TimelineRow } from "./timeline";
import type { PlanningView } from "@/app/actions";

export const metadata = { title: "Planning" };

const views: { id: PlanningView; label: string; icon: IconName }[] = [
  { id: "trainer", label: "Formateurs", icon: "user" },
  { id: "room", label: "Salles", icon: "door" },
  { id: "equipment", label: "Matériel", icon: "truck" },
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
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    return `/planning?${p}`;
  };

  const weekLabel = `${formatDay(monday, { day: "numeric", month: "long" })} – ${formatDay(lastDay, { day: "numeric", month: "long", year: "numeric" })}`;
  const errors = weekConflicts.filter((c) => c.severity === "error").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Planning" action={{ href: `/sessions/new?date=${monday}`, label: "Nouvelle session" }}>
        <nav aria-label="Vue du planning" className="segmented">
          {views.map((v) => (
            <Link key={v.id} href={qs({ view: v.id })} aria-current={v.id === view ? "page" : undefined} className="segment">
              <Icon name={v.icon} className="size-4" />
              {v.label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-2">
        <nav aria-label="Semaine" className="flex items-center gap-1">
          <Link className="btn-secondary size-11 p-0" href={qs({ week: addDays(monday, -7) })} aria-label="Semaine précédente">
            <Icon name="arrow" className="size-4 rotate-180" />
          </Link>
          <Link className="btn-secondary min-h-11" href={qs({ week: mondayOf(today) })}>Aujourd&apos;hui</Link>
          <Link className="btn-secondary size-11 p-0" href={qs({ week: addDays(monday, 7) })} aria-label="Semaine suivante">
            <Icon name="arrow" className="size-4" />
          </Link>
        </nav>
        <p className="font-semibold text-brand-900" aria-live="polite">
          <span className="sr-only">Semaine du </span>
          {weekLabel}
        </p>
        <nav aria-label="Site" className="segmented">
          <Link href={qs({ site: undefined })} aria-current={!site ? "page" : undefined} className="segment">Tous les sites</Link>
          {ctx.sites.map((s) => (
            <Link key={s.id} href={qs({ site: s.id })} aria-current={site === s.id ? "page" : undefined} className="segment">{s.name}</Link>
          ))}
        </nav>
        <Link href={qs({ weekend: dayCount === 7 ? undefined : "1" })} className="btn-ghost ml-auto">
          {dayCount === 7 ? "Masquer le week-end" : "Afficher le week-end"}
        </Link>
      </div>

      <Timeline view={view} days={days} today={today} rows={rows} blocks={blocks} />

      <section className={`card p-4 ${errors ? "border-red-200" : weekConflicts.length ? "border-accent-300" : "border-brand-200 bg-brand-50"}`} aria-labelledby="conflits-semaine">
        <h2 id="conflits-semaine" className="flex items-center gap-2 text-sm font-semibold">
          <span className={`grid size-7 place-items-center rounded-lg ${weekConflicts.length ? "bg-red-100 text-red-700" : "bg-brand-600 text-white"}`} aria-hidden>
            <Icon name={weekConflicts.length ? "alert" : "check"} className="size-4" />
          </span>
          {weekConflicts.length === 0 ? "Aucun conflit cette semaine, tout roule !" : `${weekConflicts.length} conflit${weekConflicts.length > 1 ? "s" : ""} cette semaine`}
        </h2>
        {weekConflicts.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {weekConflicts.map((c, i) => {
              const course = ctx.courses.find((co) => co.id === ctx.sessions.find((s) => s.id === c.sessionId)?.courseId);
              return (
                <li key={i} className="flex gap-2">
                  <SeverityDot severity={c.severity} />
                  <Link href={`/sessions/${c.sessionId}`} className="underline decoration-slate-300 underline-offset-2 hover:decoration-brand-600">
                    <span className="font-semibold">{course?.code}</span> : {c.message}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
