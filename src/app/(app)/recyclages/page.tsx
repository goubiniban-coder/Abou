import { desc } from "drizzle-orm";
import Link from "next/link";
import { db, schema as t } from "@/db";
import { Badge, PageHeader, Table } from "@/components/ui";
import { createProposal } from "@/app/proposal-actions";
import { parisDay, recyclingsDue } from "@/domain";
import { formatDay, fullName } from "@/lib/format";
import { listSessions } from "@/server/planning";

export const metadata = { title: "Recyclages" };

export default async function RecyclingPage({ searchParams }: PageProps<"/recyclages">) {
  const sp = await searchParams;
  const horizon = Number(sp.horizon ?? 90);
  const [certs, sessions, trainees, courses, clients, sites, proposals] = await Promise.all([
    db.select().from(t.certifications),
    listSessions(),
    db.select().from(t.trainees),
    db.select().from(t.courses),
    db.select().from(t.clients),
    db.select().from(t.sites),
    db.select().from(t.proposals).orderBy(desc(t.proposals.createdAt)),
  ]);
  const today = parisDay(new Date().toISOString());
  const due = recyclingsDue(certs, sessions, today, horizon);
  const toPlan = due.filter((d) => !d.plannedSessionId);

  // Stagiaires déjà couverts par une proposition en attente ou acceptée.
  const proposed = (courseId: string, traineeId: string) =>
    proposals.find((p) => p.status !== "declined" && p.courseId === courseId && p.traineeIds.includes(traineeId) && !(p.status === "open" && p.expiresOn < today));

  // Regroupe les stagiaires à recycler par formation et par entreprise : une proposition par client.
  const groups = new Map<string, { courseId: string; clientId: string | null; traineeIds: string[]; firstExpiry: string }>();
  for (const d of toPlan) {
    const { courseId, traineeId, validUntil } = d.certification;
    if (proposed(courseId, traineeId)) continue;
    const clientId = trainees.find((x) => x.id === traineeId)?.clientId ?? null;
    const key = `${courseId}|${clientId}`;
    const g = groups.get(key) ?? { courseId, clientId, traineeIds: [], firstExpiry: validUntil };
    g.traineeIds.push(traineeId);
    if (validUntil < g.firstExpiry) g.firstExpiry = validUntil;
    groups.set(key, g);
  }
  const statusBadge = (p: (typeof proposals)[number]) =>
    p.status === "accepted" ? <Badge tone="green">Date choisie</Badge> : p.status === "declined" ? <Badge tone="red">Déclinée</Badge> : p.expiresOn < today ? <Badge>Expirée</Badge> : <Badge tone="amber">En attente du client</Badge>;

  return (
    <div className="space-y-4">
      <PageHeader title="Recyclages à prévoir" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Échéance dans les
        {[30, 90, 180].map((h) => (
          <Link key={h} href={`/recyclages?horizon=${h}`} className={`rounded px-2 py-1 ${h === horizon ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300"}`}>{h} jours</Link>
        ))}
      </div>
      {sp.error === "nodate" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Aucune date tenable trouvée avant l&apos;échéance : planifiez ce recyclage à la main.</p>
      )}
      {groups.size > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">À proposer aux clients</h2>
          <Table head={["Formation", "Entreprise", "Stagiaires", "Première échéance", ""]}>
            {[...groups.values()].map((g) => {
              const course = courses.find((c) => c.id === g.courseId);
              return (
                <tr key={`${g.courseId}${g.clientId}`}>
                  <td>{course?.code}</td>
                  <td>{clients.find((c) => c.id === g.clientId)?.name ?? "Sans entreprise"}</td>
                  <td>{g.traineeIds.length}</td>
                  <td>{formatDay(g.firstExpiry, { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <form action={createProposal} className="flex items-center gap-1">
                        <input type="hidden" name="courseId" value={g.courseId} />
                        <input type="hidden" name="clientId" value={g.clientId ?? ""} />
                        <input type="hidden" name="traineeIds" value={g.traineeIds.join(",")} />
                        <select name="siteId" className="input w-auto py-1 text-xs" aria-label="Site">
                          {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                        <button className="btn-primary whitespace-nowrap">Proposer 3 dates</button>
                      </form>
                      <Link href={`/sessions/new?course=${g.courseId}&trainees=${g.traineeIds.join(",")}`} className="text-xs text-slate-500 hover:underline">
                        Planifier moi-même
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          <p className="mt-1 text-xs text-slate-500">
            Optitam cherche trois dates avant l&apos;échéance où formateur, salle, testeur et engins sont libres, et prépare un lien à envoyer au client. Il choisit sa date en un clic : la session est créée et le devis édité.
          </p>
        </section>
      )}
      {proposals.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Propositions envoyées</h2>
          <Table head={["Devis", "Entreprise", "Formation", "Stagiaires", "Statut"]}>
            {proposals.slice(0, 20).map((p) => (
              <tr key={p.id}>
                <td><Link href={`/recyclages/propositions/${p.id}`} className="text-brand-700 hover:underline">{p.number}</Link></td>
                <td>{clients.find((c) => c.id === p.clientId)?.name ?? "—"}</td>
                <td>{courses.find((c) => c.id === p.courseId)?.code}</td>
                <td>{p.traineeIds.length}</td>
                <td>{statusBadge(p)}</td>
              </tr>
            ))}
          </Table>
        </section>
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
                ) : proposed(d.certification.courseId, d.certification.traineeId) ? (
                  <Link href={`/recyclages/propositions/${proposed(d.certification.courseId, d.certification.traineeId)!.id}`}><Badge tone="blue">Dates proposées</Badge></Link>
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
