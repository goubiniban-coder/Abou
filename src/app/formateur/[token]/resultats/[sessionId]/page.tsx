import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema as t } from "@/db";
import { saveResults } from "@/app/attendance-actions";
import { decision, evaluationOpen } from "@/domain";
import { getSession } from "@/server/planning";
import { loadSessionRecords } from "@/server/attendance";
import { fullName } from "@/lib/format";

export const metadata = { title: "Résultats des tests" };

const decisionLabel = { passed: "Reçu", failed: "Ajourné", pending: "À compléter" } as const;
const decisionTone = { passed: "bg-emerald-100 text-emerald-800", failed: "bg-red-100 text-red-800", pending: "bg-slate-100 text-slate-600" } as const;

function OutcomeChoice({ name, value }: { name: string; value?: string }) {
  return (
    <div className="flex gap-1">
      {[
        ["passed", "Réussi"],
        ["failed", "Échoué"],
      ].map(([v, label]) => (
        <label key={v} className="flex-1">
          <input type="radio" name={name} value={v} defaultChecked={value === v} className="peer sr-only" />
          <span className="btn-secondary w-full text-xs peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">{label}</span>
        </label>
      ))}
    </div>
  );
}

/** Saisie des résultats sur le téléphone du testeur, stagiaire par stagiaire. */
export default async function ResultsPage({ params, searchParams }: PageProps<"/formateur/[token]/resultats/[sessionId]">) {
  const { token, sessionId } = await params;
  const { ok } = await searchParams;
  const [trainer] = await db.select().from(t.trainers).where(eq(t.trainers.calendarToken, token));
  const session = await getSession(sessionId);
  if (!trainer || !session || !session.assignments.some((a) => a.trainerId === trainer.id)) notFound();
  const [course] = await db.select().from(t.courses).where(eq(t.courses.id, session.courseId));
  const isTester = session.assignments.some((a) => a.trainerId === trainer.id && a.role === "tester");
  if (course.testUnitsPerTrainee && !isTester) notFound();
  const trainees = session.traineeIds.length ? await db.select().from(t.trainees).where(inArray(t.trainees.id, session.traineeIds)) : [];
  const { results, certified } = await loadSessionRecords(sessionId);
  const caces = Boolean(course.testUnitsPerTrainee);

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4 pb-16">
      <Link href={`/formateur/${token}`} className="text-sm text-brand-700">← Mon planning</Link>
      <header>
        <p className="text-sm text-slate-500">{caces ? "Résultats des tests CACES" : "Évaluation des stagiaires"}</p>
        <h1 className="text-xl font-bold">{course.code} · {course.title}</h1>
      </header>
      {!evaluationOpen(session, new Date()) && (
        <p className="card p-4 text-sm text-slate-500">La saisie ouvre au début du premier créneau de test.</p>
      )}
      {ok && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Résultats enregistrés. Le centre peut éditer le PV et les attestations.</p>}

      {evaluationOpen(session, new Date()) && (
        <form action={saveResults.bind(null, token, sessionId)} className="space-y-3">
          {trainees
            .sort((a, b) => a.lastName.localeCompare(b.lastName))
            .map((tr) => {
              const r = results.find((x) => x.traineeId === tr.id);
              const d = decision(course, r);
              const locked = certified.includes(tr.id);
              return (
                <fieldset key={tr.id} disabled={locked} className="card space-y-2 p-3">
                  <legend className="sr-only">{fullName(tr)}</legend>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fullName(tr)}</span>
                    <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${decisionTone[d]}`}>{locked ? "Certificat délivré" : decisionLabel[d]}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_5rem] items-end gap-2">
                    <div>
                      <span className="label">Théorie</span>
                      <OutcomeChoice name={`${tr.id}.theory`} value={r?.theory} />
                    </div>
                    <label>
                      <span className="label">Note /100</span>
                      <input name={`${tr.id}.theoryScore`} type="number" min={0} max={100} inputMode="numeric" defaultValue={r?.theoryScore} className="input" />
                    </label>
                  </div>
                  <div>
                    <span className="label">Pratique</span>
                    <OutcomeChoice name={`${tr.id}.practice`} value={r?.practice} />
                  </div>
                  {caces && (
                    <label className="block">
                      <span className="label">Catégories obtenues</span>
                      <input name={`${tr.id}.categories`} defaultValue={r?.categories} placeholder="ex. 3, 5" className="input" />
                    </label>
                  )}
                  <label className="block">
                    <span className="label">Observations</span>
                    <input name={`${tr.id}.comment`} defaultValue={r?.comment} className="input" />
                  </label>
                </fieldset>
              );
            })}
          <button className="btn-primary sticky bottom-3 w-full py-2.5 shadow-lg">Enregistrer les résultats</button>
        </form>
      )}
    </div>
  );
}
