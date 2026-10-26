import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { saveTrainer } from "@/app/ref-actions";
import { DeleteButton, Field, Unavailabilities, UsedError } from "@/components/ui";
import { fullName } from "@/lib/format";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Formateur" };

export default async function TrainerPage({ params, searchParams }: PageProps<"/formateurs/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const ctx = await loadContext();
  const isNew = id === "new";
  const [row] = isNew ? [undefined] : await db.select().from(t.trainers).where(eq(t.trainers.id, id));
  if (!isNew && !row) notFound();
  const back = `/formateurs/${id}`;
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{row ? fullName(row) : "Nouveau formateur"}</h1>
      <UsedError error={error} />
      <form action={saveTrainer} className="card grid gap-3 p-4 sm:grid-cols-2">
        {row && <input type="hidden" name="id" value={row.id} />}
        <Field label="Prénom"><input name="firstName" required defaultValue={row?.firstName} className="input" /></Field>
        <Field label="Nom"><input name="lastName" required defaultValue={row?.lastName} className="input" /></Field>
        <Field label="Email"><input type="email" name="email" defaultValue={row?.email ?? ""} className="input" /></Field>
        <Field label="Site de rattachement">
          <select name="siteId" defaultValue={row?.siteId ?? ""} className="input">
            <option value="">Aucun</option>
            {ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="external" defaultChecked={row?.external} /> Formateur externe (sous-traitant)</label>
        <Field label="Capacité de test CACES (unités par jour)" hint="Laisser vide si ce formateur n'est pas testeur.">
          <input type="number" min={0} name="testUnitsPerDay" defaultValue={row?.testUnitsPerDay ?? ""} className="input" />
        </Field>
        <Field label="Compétences et habilitations" className="sm:col-span-2" hint="Une par ligne. Ajouter la date de fin de validité après un point-virgule : SST;2027-06-30">
          <textarea name="competences" rows={4} className="input font-mono" defaultValue={row?.competences.map((c) => (c.validUntil ? `${c.code};${c.validUntil}` : c.code)).join("\n")} />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">Enregistrer</button>
          <Link href="/formateurs" className="btn-secondary">Retour</Link>
        </div>
      </form>
      {row && (
        <>
          <section className="card space-y-1 p-4 text-sm">
            <h2 className="mb-1 font-semibold">Espace formateur et agenda</h2>
            <p>
              Lien personnel (mobile) :{" "}
              <Link className="text-brand-700 hover:underline" href={`/formateur/${row.calendarToken}`}>/formateur/{row.calendarToken.slice(0, 8)}…</Link>
            </p>
            <p className="text-slate-600">
              Abonnement agenda (Google, Outlook) : <code className="rounded bg-slate-100 px-1">/api/calendar/{row.calendarToken}.ics</code>
            </p>
          </section>
          <Unavailabilities type="trainer" id={row.id} items={ctx.unavailabilities} back={back} since={new Date().toISOString()} />
          <DeleteButton kind="trainer" id={row.id} back={back} list="/formateurs" />
        </>
      )}
    </div>
  );
}
