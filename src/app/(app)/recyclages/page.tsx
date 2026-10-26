import Link from "next/link";
import { db, schema as t } from "@/db";
import { Badge, PageHeader, Table } from "@/components/ui";
import { parisDay, recyclingsDue } from "@/domain";
import { formatDay, fullName } from "@/lib/format";
import { listSessions } from "@/server/planning";

export const metadata = { title: "Recyclages" };

export default async function RecyclingPage({ searchParams }: PageProps<"/recyclages">) {
  const sp = await searchParams;
  const horizon = Number(sp.horizon ?? 90);
  const [certs, sessions, trainees, courses, clients] = await Promise.all([
    db.select().from(t.certifications),
    listSessions(),
    db.select().from(t.trainees),
    db.select().from(t.courses),
    db.select().from(t.clients),
  ]);
  const today = parisDay(new Date().toISOString());
  const due = recyclingsDue(certs, sessions, today, horizon);
  const toPlan = due.filter((d) => !d.plannedSessionId);

  // Regroupe les stagiaires à recycler par formation pour créer une session en un clic.
  const byCourse = new Map<string, string[]>();
  for (const d of toPlan) byCourse.set(d.certification.courseId, [...(byCourse.get(d.certification.courseId) ?? []), d.certification.traineeId]);

  return (
    <div className="space-y-4">
      <PageHeader title="Recyclages à prévoir" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Échéance dans les
        {[30, 90, 180].map((h) => (
          <Link key={h} href={`/recyclages?horizon=${h}`} className={`rounded px-2 py-1 ${h === horizon ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300"}`}>{h} jours</Link>
        ))}
      </div>
      {byCourse.size > 0 && (
        <div className="card flex flex-wrap gap-3 p-4">
          {[...byCourse].map(([courseId, ids]) => {
            const course = courses.find((c) => c.id === courseId);
            return (
              <Link key={courseId} href={`/sessions/new?course=${courseId}&trainees=${ids.join(",")}`} className="btn-primary">
                Planifier un recyclage {course?.code} ({ids.length} stagiaire{ids.length > 1 ? "s" : ""})
              </Link>
            );
          })}
        </div>
      )}
      <Table head={["Stagiaire", "Entreprise", "Formation", "Fin de validité", "Statut"]}>
        {due.map((d) => {
          const tr = trainees.find((x) => x.id === d.certification.traineeId);
          const course = courses.find((c) => c.id === d.certification.courseId);
          return (
            <tr key={d.certification.id}>
              <td>{tr ? <Link href={`/stagiaires/${tr.id}`} className="hover:underline">{fullName(tr)}</Link> : "—"}</td>
              <td>{clients.find((c) => c.id === tr?.clientId)?.name ?? "—"}</td>
              <td>{course?.code}</td>
              <td>
                {formatDay(d.certification.validUntil, { day: "numeric", month: "short", year: "numeric" })}{" "}
                <span className="text-xs text-slate-500">({d.expired ? `expiré depuis ${-d.daysLeft} j` : `dans ${d.daysLeft} j`})</span>
              </td>
              <td>
                {d.plannedSessionId ? (
                  <Link href={`/sessions/${d.plannedSessionId}`}><Badge tone="green">Recyclage planifié</Badge></Link>
                ) : d.expired ? (
                  <Badge tone="red">Expiré</Badge>
                ) : (
                  <Badge tone="amber">À planifier</Badge>
                )}
              </td>
            </tr>
          );
        })}
        {due.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500">Aucun recyclage dans cette période.</td></tr>}
      </Table>
    </div>
  );
}
