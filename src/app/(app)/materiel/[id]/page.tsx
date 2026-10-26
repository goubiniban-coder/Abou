import Link from "next/link";
import { notFound } from "next/navigation";
import { saveEquipment } from "@/app/ref-actions";
import { DeleteButton, Field, Unavailabilities, UsedError } from "@/components/ui";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Matériel" };

export default async function EquipmentItemPage({ params, searchParams }: PageProps<"/materiel/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const ctx = await loadContext();
  const item = ctx.equipment.find((e) => e.id === id);
  if (id !== "new" && !item) notFound();
  const back = `/materiel/${id}`;
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{item?.name ?? "Nouveau matériel"}</h1>
      <UsedError error={error} />
      <form action={saveEquipment} className="card grid gap-3 p-4 sm:grid-cols-3">
        {item && <input type="hidden" name="id" value={item.id} />}
        <Field label="Nom"><input name="name" required defaultValue={item?.name} className="input" /></Field>
        <Field label="Type" hint="Doit correspondre au type requis par la formation, ex. R489-3"><input name="kind" required defaultValue={item?.kind} className="input" /></Field>
        <Field label="Site">
          <select name="siteId" defaultValue={item?.siteId ?? ""} className="input">
            <option value="">Aucun</option>
            {ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-2 sm:col-span-3">
          <button className="btn-primary">Enregistrer</button>
          <Link href="/materiel" className="btn-secondary">Retour</Link>
        </div>
      </form>
      {item && (
        <>
          <Unavailabilities type="equipment" id={item.id} items={ctx.unavailabilities} back={back} since={new Date().toISOString()} />
          <DeleteButton kind="equipment" id={item.id} back={back} list="/materiel" />
        </>
      )}
    </div>
  );
}
