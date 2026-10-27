import Link from "next/link";
import { detectAllConflicts, parisDay } from "@/domain";
import { formatDay, fullName, statusLabel } from "@/lib/format";
import { loadContext } from "@/server/planning";
import { Icon } from "@/components/icon";
import { Badge, CourseTag, PageHeader, statusTone } from "@/components/ui";

export const metadata = { title: "Sessions" };

export default async function SessionsPage({ searchParams }: PageProps<"/sessions">) {
  const sp = await searchParams;
  const past = sp.past === "1";
  const ctx = await loadContext();
  const today = parisDay(new Date().toISOString());
  const conflicts = detectAllConflicts(ctx);
  const sessions = ctx.sessions
    .map((s) => ({ s, first: s.slots[0] ? parisDay(s.slots[0].start) : "", last: s.slots.at(-1) ? parisDay(s.slots.at(-1)!.start) : "" }))
    .filter(({ last }) => (past ? last < today : last >= today))
    .sort((a, b) => (past ? b.first.localeCompare(a.first) : a.first.localeCompare(b.first)));

  return (
    <div className="space-y-4">
      <PageHeader title="Sessions" action={{ href: "/sessions/new", label: "Nouvelle session" }}>
        <nav aria-label="Période" className="segmented">
          <Link href="/sessions" aria-current={!past ? "page" : undefined} className="segment">À venir</Link>
          <Link href="/sessions?past=1" aria-current={past ? "page" : undefined} className="segment">Passées</Link>
        </nav>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Sessions {past ? "passées" : "à venir"}</caption>
          <thead className="bg-mint-100/70 text-left text-xs text-brand-800">
            <tr>
              {["Dates", "Formation", "Lieu", "Formateurs", "Inscrits", "Statut", "Conflits"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map(({ s, first, last }) => {
              const course = ctx.courses.find((c) => c.id === s.courseId);
              const room = ctx.rooms.find((r) => r.id === s.roomId);
              const site = ctx.sites.find((x) => x.id === s.siteId);
              const n = conflicts.filter((c) => c.sessionId === s.id || c.otherSessionId === s.id).length;
              const trainers = [...new Set(s.assignments.map((a) => a.trainerId))].map((id) => ctx.trainers.find((t) => t.id === id)).filter((t) => t !== undefined);
              return (
                <tr key={s.id} className="border-t border-slate-100 transition hover:bg-mint-50">
                  <td className="px-3 py-2.5 whitespace-nowrap first-letter:uppercase">
                    {first ? formatDay(first) : "—"}
                    {last && last !== first ? ` → ${formatDay(last)}` : ""}
                  </td>
                  <td className="px-3 py-2.5">
                    {/* Un seul lien par ligne, nommé par la formation. */}
                    <Link href={`/sessions/${s.id}`} className="group inline-flex flex-wrap items-center gap-x-1.5 rounded-md">
                      <CourseTag code={course?.code} color={course?.color} className="group-hover:underline" />
                      <span className="text-slate-600">{course?.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{s.mode === "intra" ? "Intra" : (room?.name ?? "—")} · {site?.name}</td>
                  <td className="px-3 py-2.5">{trainers.map(fullName).join(", ") || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums">{s.traineeIds.length}{course ? ` / ${course.maxTrainees}` : ""}</td>
                  <td className="px-3 py-2.5"><Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge></td>
                  <td className="px-3 py-2.5">{n ? <Badge tone="red">{n} conflit{n > 1 ? "s" : ""}</Badge> : <Badge tone="green">Aucun</Badge>}</td>
                </tr>
              );
            })}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center">
                  <span className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-accent-200 text-brand-800" aria-hidden>
                    <Icon name="layers" />
                  </span>
                  <p className="font-semibold">{past ? "Aucune session passée." : "Aucune session à venir."}</p>
                  {!past && <Link href="/sessions/new" className="mt-1 inline-block font-medium text-brand-700 underline underline-offset-2">Planifier une session</Link>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
