import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, schema as t } from "@/db";
import { SignatureImage } from "@/components/signature-image";
import { attendedHours, decision, frenchDay, parisDay, plannedHours, slotKey, type Session } from "@/domain";
import { formatDay, formatTime, fullName, roleLabel } from "@/lib/format";
import { loadOrganization, loadSessionRecords } from "@/server/attendance";
import { loadContext } from "@/server/planning";
import { PrintButton } from "@/components/print-button";
import { PrintPage as Page } from "@/components/print-page";

const titles = { convocation: "Convocations", emargement: "Feuille d'émargement", attestation: "Attestations de fin de formation", pv: "Procès-verbal des tests" } as const;
type Doc = keyof typeof titles;

export async function generateMetadata({ params }: PageProps<"/documents/[sessionId]/[doc]">) {
  const { doc } = await params;
  return { title: titles[doc as Doc] ?? "Document" };
}

const hoursLabel = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;

/** Jours de la session, avec leurs créneaux. */
function days(session: Session) {
  const map = new Map<string, Session["slots"]>();
  for (const s of session.slots) map.set(parisDay(s.start), [...(map.get(parisDay(s.start)) ?? []), s]);
  return [...map];
}

export default async function DocumentPage({ params }: PageProps<"/documents/[sessionId]/[doc]">) {
  const { sessionId, doc } = await params;
  if (!(doc in titles)) notFound();
  const ctx = await loadContext();
  const session = ctx.sessions.find((s) => s.id === sessionId);
  if (!session) notFound();
  const course = ctx.courses.find((c) => c.id === session.courseId)!;
  const site = ctx.sites.find((s) => s.id === session.siteId);
  const room = ctx.rooms.find((r) => r.id === session.roomId);
  const [org, records, trainees, clients] = await Promise.all([
    loadOrganization(),
    loadSessionRecords(sessionId),
    session.traineeIds.length ? db.select().from(t.trainees).where(inArray(t.trainees.id, session.traineeIds)) : [],
    db.select().from(t.clients),
  ]);
  trainees.sort((a, b) => a.lastName.localeCompare(b.lastName));
  const client = (id: string | null | undefined) => clients.find((c) => c.id === id);
  const trainerName = (id: string) => {
    const tr = ctx.trainers.find((x) => x.id === id);
    return tr ? fullName(tr) : "";
  };
  const staff = session.assignments.map((a) => `${trainerName(a.trainerId)} (${roleLabel[a.role].toLowerCase()})`).join(", ");
  const place = session.mode === "intra" ? `Dans les locaux de ${client(session.clientId)?.name ?? "l'entreprise"}${client(session.clientId)?.city ? `, ${client(session.clientId)?.city}` : ""}` : [room?.name, site?.name, site?.city].filter(Boolean).join(", ");
  const sorted = session.slots.map((s) => s.start).sort();
  const firstDay = sorted.length ? parisDay(sorted[0]) : undefined;
  const lastDay = sorted.length ? parisDay(sorted.at(-1)!) : undefined;
  const period = firstDay && lastDay ? (firstDay === lastDay ? `le ${frenchDay(firstDay)}` : `du ${frenchDay(firstDay)} au ${frenchDay(lastDay)}`) : "";
  const madeAt = site?.city ?? "";
  const testers = session.assignments.filter((a) => a.role === "tester").map((a) => trainerName(a.trainerId));

  let pages: ReactNode;
  if (doc === "convocation") {
    pages = trainees.map((tr) => (
      <Page key={tr.id} org={org}>
        <div className="mb-8 ml-auto w-1/2">
          <p className="font-semibold">{fullName(tr)}</p>
          {client(tr.clientId) && <p>{client(tr.clientId)!.name}</p>}
        </div>
        <h1 className="mb-4 text-lg font-bold">Convocation à une formation</h1>
        <p className="mb-3">
          Nous avons le plaisir de vous convier à la formation <strong>{course.code} · {course.title}</strong>, qui se déroulera {period}.
        </p>
        <table className="mb-3 w-full border-collapse text-left">
          <tbody className="[&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1">
            {days(session).map(([day, slots]) => (
              <tr key={day}>
                <td className="first-letter:uppercase">{formatDay(day, { weekday: "long", day: "numeric", month: "long" })}</td>
                <td>{slots.map((s) => `${formatTime(s.start)} – ${formatTime(s.end)}`).join(" et ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mb-1"><strong>Lieu :</strong> {place}</p>
        <p className="mb-1"><strong>Durée :</strong> {hoursLabel(plannedHours(session))}</p>
        <p className="mb-3"><strong>Intervenants :</strong> {staff || "à confirmer"}</p>
        <p className="mb-3">
          Merci de vous présenter un quart d&apos;heure avant le début, muni(e) d&apos;une pièce d&apos;identité
          {course.requiredEquipmentKinds?.length ? " et de vos équipements de protection individuelle (chaussures de sécurité, gilet)" : ""}. Vous signerez
          la feuille d&apos;émargement à chaque demi-journée.
        </p>
        <p className="mt-10">Fait à {madeAt}, le {frenchDay(new Date().toISOString())}</p>
        <p className="mt-2">{org.signatory ?? org.name}</p>
      </Page>
    ));
  } else if (doc === "emargement") {
    pages = days(session).map(([day, slots]) => (
      <Page key={day} org={org}>
        <h1 className="mb-1 text-lg font-bold">Feuille d&apos;émargement</h1>
        <p className="mb-1"><strong>{course.code} · {course.title}</strong></p>
        <p className="mb-1 first-letter:uppercase">{frenchDay(day)} · {place}</p>
        <p className="mb-4">Intervenants : {staff}</p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="[&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1">
              <th>Stagiaire</th>
              {slots.map((s) => <th key={s.start} className="w-[30%]">{formatTime(s.start)} – {formatTime(s.end)}</th>)}
            </tr>
          </thead>
          <tbody className="[&_td]:h-12 [&_td]:border [&_td]:border-slate-400 [&_td]:px-2">
            {trainees.map((tr) => (
              <tr key={tr.id}>
                <td>
                  {fullName(tr)}
                  {client(tr.clientId) && <span className="block text-[11px] text-slate-500">{client(tr.clientId)!.name}</span>}
                </td>
                {slots.map((s) => {
                  const rec = records.attendance.find((r) => r.traineeId === tr.id && slotKey(r.slotStart) === slotKey(s.start));
                  return (
                    <td key={s.start}>
                      {rec?.presence === "present" && <SignatureImage path={rec.signature} className="h-10 w-28" />}
                      {rec?.presence === "absent" && <span className="text-slate-500 italic">Absent</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="font-semibold">Signature du formateur</td>
              {slots.map((s) => {
                const sig = records.trainerSignatures.find((x) => slotKey(x.slotStart) === slotKey(s.start));
                return (
                  <td key={s.start}>
                    {sig && (
                      <>
                        <SignatureImage path={sig.signature} className="h-10 w-28" />
                        <span className="block text-[10px] text-slate-500">{trainerName(sig.trainerId)}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-slate-500">Signatures recueillies sur l&apos;espace formateur d&apos;Optitam, horodatées et conservées par l&apos;organisme.</p>
      </Page>
    ));
  } else if (doc === "attestation") {
    pages = trainees.map((tr) => {
      const result = records.results.find((r) => r.traineeId === tr.id);
      const d = decision(course, result);
      return (
        <Page key={tr.id} org={org}>
          <h1 className="mb-6 text-center text-lg font-bold">Attestation de fin de formation</h1>
          <p className="mb-4">
            {org.signatory ? `Je soussigné(e), ${org.signatory}, représentant ${org.name}` : `${org.name}`}
            {org.nda ? `, organisme de formation déclaré sous le n° ${org.nda},` : ""} atteste que :
          </p>
          <p className="mb-4 text-center text-base font-semibold">
            {fullName(tr)}
            {client(tr.clientId) && <span className="block text-sm font-normal">salarié(e) de {client(tr.clientId)!.name}</span>}
          </p>
          <p className="mb-4">a suivi l&apos;action de formation suivante :</p>
          <table className="mb-4 w-full border-collapse text-left">
            <tbody className="[&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_td:first-child]:w-1/3 [&_td:first-child]:bg-slate-50">
              <tr><td>Intitulé</td><td>{course.code} · {course.title}</td></tr>
              <tr><td>Nature de l&apos;action</td><td>Action de formation (article L. 6313-1 du Code du travail)</td></tr>
              <tr><td>Dates</td><td>{period}</td></tr>
              <tr><td>Lieu</td><td>{place}</td></tr>
              <tr><td>Durée prévue</td><td>{hoursLabel(plannedHours(session))}</td></tr>
              <tr><td>Durée suivie (émargement)</td><td>{hoursLabel(attendedHours(session, records.attendance, tr.id))}</td></tr>
              {(session.slots.some((s) => s.kind === "test") || result) && (
                <tr>
                  <td>Évaluation des acquis</td>
                  <td>
                    {d === "passed" ? "Acquis" : d === "failed" ? "Non acquis" : "Non évalué"}
                    {d === "passed" && result?.categories ? ` · catégories ${result.categories}` : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-10">Fait à {madeAt}, le {lastDay ? frenchDay(lastDay) : ""}</p>
          <p className="mt-2">{org.signatory ?? org.name}</p>
          <div className="mt-2 h-20 w-56 border border-dashed border-slate-300 print:border-slate-400" />
        </Page>
      );
    });
  } else {
    pages = (
      <Page org={org}>
        <h1 className="mb-1 text-lg font-bold">Procès-verbal des tests</h1>
        <p className="mb-1"><strong>{course.code} · {course.title}</strong></p>
        <p className="mb-1">Session {period} · {place}</p>
        <p className="mb-4">Testeur{testers.length > 1 ? "s" : ""} : {testers.join(", ") || "non désigné"}</p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="[&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1">
              <th>Stagiaire</th>
              <th>Entreprise</th>
              <th>Théorie</th>
              <th>Pratique</th>
              {course.testUnitsPerTrainee ? <th>Catégories</th> : null}
              <th>Décision</th>
              <th>Observations</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border [&_td]:border-slate-400 [&_td]:px-2 [&_td]:py-1">
            {trainees.map((tr) => {
              const r = records.results.find((x) => x.traineeId === tr.id);
              const d = decision(course, r);
              const o = (v?: string) => (v === "passed" ? "Réussi" : v === "failed" ? "Échoué" : "");
              return (
                <tr key={tr.id}>
                  <td>{fullName(tr)}</td>
                  <td>{client(tr.clientId)?.name}</td>
                  <td>{o(r?.theory)}{r?.theoryScore !== undefined && ` (${r.theoryScore}/100)`}</td>
                  <td>{o(r?.practice)}</td>
                  {course.testUnitsPerTrainee ? <td>{r?.categories}</td> : null}
                  <td className="font-semibold">{d === "passed" ? "Reçu" : d === "failed" ? "Ajourné" : "En attente"}</td>
                  <td>{r?.comment}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4">
          Reçus : {trainees.filter((tr) => decision(course, records.results.find((r) => r.traineeId === tr.id)) === "passed").length} sur {trainees.length}
        </p>
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <p>Le testeur</p>
            <div className="mt-2 h-20 border border-dashed border-slate-300 print:border-slate-400" />
          </div>
          <div>
            <p>Pour l&apos;organisme, {org.signatory ?? ""}</p>
            <div className="mt-2 h-20 border border-dashed border-slate-300 print:border-slate-400" />
          </div>
        </div>
      </Page>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex w-[210mm] max-w-full items-center gap-3 px-2 print:hidden">
        <h1 className="font-semibold">{titles[doc as Doc]}</h1>
        <span className="text-sm text-slate-600">{course.code} · {period}</span>
        <span className="ml-auto"><PrintButton /></span>
      </div>
      {trainees.length === 0 && doc !== "pv" ? <p className="text-center text-sm text-slate-600">Aucun stagiaire inscrit.</p> : pages}
    </div>
  );
}
