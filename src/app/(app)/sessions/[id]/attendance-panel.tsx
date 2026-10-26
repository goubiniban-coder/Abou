import { inArray } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { issueCertificates } from "@/app/attendance-actions";
import { Badge, Table } from "@/components/ui";
import { attendanceSheet, certificatesToIssue, decision, evaluationOpen, type Course, type Session } from "@/domain";
import { formatDate, formatTime, fullName, slotKindLabel } from "@/lib/format";
import { loadSessionRecords } from "@/server/attendance";

const outcomeLabel = { passed: "Réussi", failed: "Échoué" } as const;

/** Suivi de l'émargement, des résultats et des documents d'une session. */
export async function AttendancePanel({ session, course }: { session: Session; course: Course }) {
  const records = await loadSessionRecords(session.id);
  const sheet = attendanceSheet(session, records.attendance, records.trainerSignatures);
  const trainees = session.traineeIds.length ? await db.select().from(t.trainees).where(inArray(t.trainees.id, session.traineeIds)) : [];
  trainees.sort((a, b) => a.lastName.localeCompare(b.lastName));
  const toIssue = certificatesToIssue(session, course, records.results, records.certified);
  const hasTests = session.slots.some((s) => s.kind === "test");
  const now = new Date();
  const docs = [
    ["convocation", "Convocations"],
    ["emargement", "Feuille d'émargement"],
    ["attestation", "Attestations de fin de formation"],
    ...(hasTests || records.results.length ? [["pv", "Procès-verbal des tests"]] : []),
  ];

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold">Documents</h2>
        <div className="flex flex-wrap gap-2">
          {docs.map(([doc, label]) => (
            <a key={doc} href={`/documents/${session.id}/${doc}`} target="_blank" className="btn-secondary">{label}</a>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Les documents s&apos;ouvrent dans un nouvel onglet, prêts à imprimer ou à enregistrer en PDF. Identité de l&apos;organisme : menu Paramètres.</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Émargement</h2>
        <Table head={["Créneau", "Présents", "Absents", "À pointer", "Formateur"]}>
          {sheet.map((row) => {
            const future = Date.parse(row.slot.start) > now.getTime();
            return (
              <tr key={row.slot.start} className={future ? "text-slate-400" : ""}>
                <td>{formatDate(row.slot.start)} {formatTime(row.slot.start)} · {slotKindLabel[row.slot.kind]}</td>
                <td>{row.present.length}</td>
                <td>{row.absent.length || ""}</td>
                <td>{future ? "" : row.missing.length ? <Badge tone="amber">{row.missing.length}</Badge> : ""}</td>
                <td>{row.trainerSigned.length ? <Badge tone="green">Signé</Badge> : future ? "" : <Badge tone="amber">À signer</Badge>}</td>
              </tr>
            );
          })}
        </Table>
        <p className="mt-1 text-xs text-slate-500">Le formateur fait signer les stagiaires sur son téléphone, depuis son espace formateur.</p>
      </section>

      {(hasTests || records.results.length > 0) && (
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Résultats</h2>
            {toIssue.length > 0 && evaluationOpen(session, now) && (
              <form action={issueCertificates.bind(null, session.id)} className="ml-auto">
                <button className="btn-primary">Créer {toIssue.length > 1 ? `les ${toIssue.length} certificats` : "le certificat"}</button>
              </form>
            )}
          </div>
          <Table head={["Stagiaire", "Théorie", "Pratique", "Catégories", "Décision"]}>
            {trainees.map((tr) => {
              const r = records.results.find((x) => x.traineeId === tr.id);
              const d = decision(course, r);
              return (
                <tr key={tr.id}>
                  <td>{fullName(tr)}</td>
                  <td>{r?.theory ? outcomeLabel[r.theory] : ""}{r?.theoryScore !== undefined && ` (${r.theoryScore}/100)`}</td>
                  <td>{r?.practice ? outcomeLabel[r.practice] : ""}</td>
                  <td>{r?.categories}</td>
                  <td>
                    {records.certified.includes(tr.id) ? (
                      <Badge tone="blue">Certificat délivré</Badge>
                    ) : (
                      <Badge tone={d === "passed" ? "green" : d === "failed" ? "red" : "slate"}>{d === "passed" ? "Reçu" : d === "failed" ? "Ajourné" : "En attente"}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          {course.validityMonths ? (
            <p className="mt-1 text-xs text-slate-500">Les certificats créés ici alimentent l&apos;écran Recyclages : l&apos;échéance est suivie automatiquement.</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
