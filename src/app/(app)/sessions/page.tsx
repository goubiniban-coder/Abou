import Link from "next/link";
import { detectAllConflicts, parisDay } from "@/domain";
import { formatDay, fullName, statusLabel } from "@/lib/format";
import { loadContext } from "@/server/planning";

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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Sessions</h1>
        <Link href="/sessions" className={`text-sm ${!past ? "font-semibold text-brand-700" : "text-slate-600"}`}>À venir</Link>
        <Link href="/sessions?past=1" className={`text-sm ${past ? "font-semibold text-brand-700" : "text-slate-600"}`}>Passées</Link>
        <Link href="/sessions/new" className="btn-primary ml-auto">Nouvelle session</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2">Formation</th>
              <th className="px-3 py-2">Lieu</th>
              <th className="px-3 py-2">Formateurs</th>
              <th className="px-3 py-2">Inscrits</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Conflits</th>
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
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/sessions/${s.id}`} className="hover:underline">
                      {first ? formatDay(first) : "—"}
                      {last && last !== first ? ` → ${formatDay(last)}` : ""}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/sessions/${s.id}`} className="font-medium hover:underline" style={{ color: course?.color }}>{course?.code}</Link>{" "}
                    <span className="text-slate-600">{course?.title}</span>
                  </td>
                  <td className="px-3 py-2">{s.mode === "intra" ? "Intra" : (room?.name ?? "—")} · {site?.name}</td>
                  <td className="px-3 py-2">{trainers.map(fullName).join(", ") || "—"}</td>
                  <td className="px-3 py-2">{s.traineeIds.length}{course ? ` / ${course.maxTrainees}` : ""}</td>
                  <td className="px-3 py-2">{statusLabel[s.status]}</td>
                  <td className="px-3 py-2">{n ? <span className="font-medium text-red-600">{n}</span> : <span className="text-emerald-600">0</span>}</td>
                </tr>
              );
            })}
            {sessions.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Aucune session.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
