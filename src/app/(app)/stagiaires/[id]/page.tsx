import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { addCertification, deleteCertification, saveTrainee } from "@/app/ref-actions";
import { Badge, DeleteButton, Field, UsedError } from "@/components/ui";
import { parisDay } from "@/domain";
import { competenceTone, formatDay, fullName } from "@/lib/format";

export const metadata = { title: "Stagiaire" };

export default async function TraineePage({ params, searchParams }: PageProps<"/stagiaires/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const isNew = id === "new";
  const [[trainee], clients, courses, certs] = await Promise.all([
    isNew ? Promise.resolve([undefined]) : db.select().from(t.trainees).where(eq(t.trainees.id, id)),
    db.select().from(t.clients).orderBy(asc(t.clients.name)),
    db.select().from(t.courses),
    isNew ? Promise.resolve([]) : db.select().from(t.certifications).where(eq(t.certifications.traineeId, id)),
  ]);
  if (!isNew && !trainee) notFound();
  const today = parisDay(new Date().toISOString());
  const back = `/stagiaires/${id}`;
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{trainee ? fullName(trainee) : "Nouveau stagiaire"}</h1>
      <UsedError error={error} />
      <form action={saveTrainee} className="card grid gap-3 p-4 sm:grid-cols-2">
        {trainee && <input type="hidden" name="id" value={trainee.id} />}
        <Field label="Prénom"><input name="firstName" required defaultValue={trainee?.firstName} className="input" /></Field>
        <Field label="Nom"><input name="lastName" required defaultValue={trainee?.lastName} className="input" /></Field>
        <Field label="Email"><input type="email" name="email" defaultValue={trainee?.email ?? ""} className="input" /></Field>
        <Field label="Entreprise">
          <select name="clientId" defaultValue={trainee?.clientId ?? ""} className="input">
            <option value="">Particulier</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">Enregistrer</button>
          <Link href="/stagiaires" className="btn-secondary">Retour</Link>
        </div>
      </form>
      {trainee && (
        <>
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Certificats et habilitations</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {certs.length === 0 && <li className="text-slate-500">Aucun certificat.</li>}
              {certs.map((c) => {
                const course = courses.find((x) => x.id === c.courseId);
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <Badge tone={competenceTone(c.validUntil, today)}>{course?.code}</Badge>
                    obtenu le {formatDay(c.obtainedOn, { day: "numeric", month: "short", year: "numeric" })}, valable jusqu&apos;au{" "}
                    {formatDay(c.validUntil, { day: "numeric", month: "short", year: "numeric" })}
                    <form action={deleteCertification} className="ml-auto">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="back" value={back} />
                      <button className="text-xs text-slate-400 hover:text-red-600">Retirer</button>
                    </form>
                  </li>
                );
              })}
            </ul>
            <form action={addCertification} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="traineeId" value={trainee.id} />
              <Field label="Formation">
                <select name="courseId" className="input">
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
              </Field>
              <Field label="Obtenu le"><input type="date" name="obtainedOn" required className="input" /></Field>
              <Field label="Valable jusqu'au" hint="Calculé si vide"><input type="date" name="validUntil" className="input" /></Field>
              <button className="btn-secondary">Ajouter</button>
            </form>
          </section>
          <DeleteButton kind="trainee" id={trainee.id} back={back} list="/stagiaires" />
        </>
      )}
    </div>
  );
}
