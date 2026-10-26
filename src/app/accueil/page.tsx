import Link from "next/link";
import { parisDay, trainerSlots } from "@/domain";
import { formatLongDate, formatTime, fullName } from "@/lib/format";
import { loadContext } from "@/server/planning";
import { AutoRefresh } from "./refresh";

export const metadata = { title: "Accueil" };

/** Écran d'accueil du centre : les formations du jour et leurs salles. */
export default async function WelcomeScreen({ searchParams }: PageProps<"/accueil">) {
  const { site: siteParam } = await searchParams;
  const ctx = await loadContext();
  const site = ctx.sites.find((s) => s.id === siteParam);
  const now = new Date().toISOString();
  const today = parisDay(now);
  const rows = ctx.sessions
    .filter((s) => s.status === "confirmed" && s.mode === "inter" && (!site || s.siteId === site.id))
    .map((s) => ({ s, slots: s.slots.filter((sl) => parisDay(sl.start) === today) }))
    .filter((r) => r.slots.length > 0)
    .sort((a, b) => a.slots[0].start.localeCompare(b.slots[0].start));

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <AutoRefresh />
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xl text-slate-400">{site?.name ?? "Tous les sites"}</p>
          <h1 className="text-5xl font-bold">Bienvenue</h1>
        </div>
        <p className="text-2xl text-slate-300 first-letter:uppercase">{formatLongDate(now)}</p>
      </div>
      {rows.length === 0 && <p className="text-2xl text-slate-400">Aucune formation aujourd&apos;hui.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map(({ s, slots }) => {
          const course = ctx.courses.find((c) => c.id === s.courseId);
          const room = ctx.rooms.find((r) => r.id === s.roomId);
          const trainers = [...new Set(s.assignments.map((a) => a.trainerId))]
            .filter((id) => trainerSlots(s, id).some((sl) => parisDay(sl.start) === today))
            .map((id) => ctx.trainers.find((t) => t.id === id))
            .filter((t) => t !== undefined);
          return (
            <div key={s.id} className="rounded-xl bg-slate-800 p-6" style={{ borderLeft: `8px solid ${course?.color ?? "#64748b"}` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold">{course?.title}</p>
                  <p className="mt-1 text-xl text-slate-300">{trainers.map(fullName).join(", ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-amber-300">{room?.name ?? "—"}</p>
                  <p className="mt-1 text-xl text-slate-300">{formatTime(slots[0].start)} – {formatTime(slots[slots.length - 1].end)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-10 flex gap-4 text-sm text-slate-500">
        {ctx.sites.map((s) => <Link key={s.id} href={`/accueil?site=${s.id}`} className="hover:text-white">{s.name}</Link>)}
        <Link href="/tableau-de-bord" className="ml-auto hover:text-white">Retour à Optitam</Link>
      </div>
    </div>
  );
}
