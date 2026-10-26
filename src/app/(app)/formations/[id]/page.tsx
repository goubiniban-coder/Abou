import Link from "next/link";
import { notFound } from "next/navigation";
import { saveCourse } from "@/app/ref-actions";
import { DeleteButton, Field, UsedError } from "@/components/ui";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Formation" };

export default async function CoursePage({ params, searchParams }: PageProps<"/formations/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const ctx = await loadContext();
  const c = ctx.courses.find((x) => x.id === id);
  if (id !== "new" && !c) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{c ? `${c.code} · ${c.title}` : "Nouvelle formation"}</h1>
      <UsedError error={error} />
      <form action={saveCourse} className="card grid gap-3 p-4 sm:grid-cols-2">
        {c && <input type="hidden" name="id" value={c.id} />}
        <Field label="Code"><input name="code" required defaultValue={c?.code} className="input" /></Field>
        <Field label="Intitulé"><input name="title" required defaultValue={c?.title} className="input" /></Field>
        <Field label="Durée (demi-journées)"><input type="number" min={1} name="durationHalfDays" required defaultValue={c?.durationHalfDays ?? 2} className="input" /></Field>
        <Field label="Effectif maximum"><input type="number" min={1} name="maxTrainees" required defaultValue={c?.maxTrainees ?? 10} className="input" /></Field>
        <Field label="Compétences exigées des formateurs" hint="Codes séparés par des virgules"><input name="requiredCompetences" defaultValue={c?.requiredCompetences.join(", ")} className="input" /></Field>
        <Field label="Types de matériel nécessaires" hint="Un engin par type, ex. R489-3"><input name="requiredEquipmentKinds" defaultValue={c?.requiredEquipmentKinds?.join(", ")} className="input" /></Field>
        <Field label="Unités de test par stagiaire" hint="CACES : sert au calcul de la charge des testeurs"><input type="number" min={0} name="testUnitsPerTrainee" defaultValue={c?.testUnitsPerTrainee ?? ""} className="input" /></Field>
        <Field label="Validité du certificat (mois)" hint="Sert au calcul des recyclages"><input type="number" min={0} name="validityMonths" defaultValue={c?.validityMonths ?? ""} className="input" /></Field>
        <Field label="Prix par stagiaire (€ HT)" hint="Repris sur les devis de recyclage"><input type="number" min={0} name="pricePerTrainee" defaultValue={c?.pricePerTrainee ?? ""} className="input" /></Field>
        <Field label="Couleur sur le planning"><input type="color" name="color" defaultValue={c?.color ?? "#2f6fde"} className="h-9 w-16 rounded border border-slate-300" /></Field>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">Enregistrer</button>
          <Link href="/formations" className="btn-secondary">Retour</Link>
        </div>
      </form>
      {c && <DeleteButton kind="course" id={c.id} back={`/formations/${c.id}`} list="/formations" />}
    </div>
  );
}
