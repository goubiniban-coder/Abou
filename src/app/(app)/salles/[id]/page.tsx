import Link from "next/link";
import { notFound } from "next/navigation";
import { saveRoom } from "@/app/ref-actions";
import { DeleteButton, Field, Unavailabilities, UsedError } from "@/components/ui";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Salle" };

export default async function RoomPage({ params, searchParams }: PageProps<"/salles/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const ctx = await loadContext();
  const room = ctx.rooms.find((r) => r.id === id);
  if (id !== "new" && !room) notFound();
  const back = `/salles/${id}`;
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{room?.name ?? "Nouvelle salle"}</h1>
      <UsedError error={error} />
      <form action={saveRoom} className="card grid gap-3 p-4 sm:grid-cols-2">
        {room && <input type="hidden" name="id" value={room.id} />}
        <Field label="Nom"><input name="name" required defaultValue={room?.name} className="input" /></Field>
        <Field label="Site">
          <select name="siteId" required defaultValue={room?.siteId} className="input">
            {ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Capacité (personnes)"><input type="number" min={1} name="capacity" required defaultValue={room?.capacity} className="input" /></Field>
        <Field label="Équipements" hint="Séparés par des virgules"><input name="equipment" defaultValue={room?.equipment?.join(", ")} className="input" /></Field>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary">Enregistrer</button>
          <Link href="/salles" className="btn-secondary">Retour</Link>
        </div>
      </form>
      {room && (
        <>
          <Unavailabilities type="room" id={room.id} items={ctx.unavailabilities} back={back} since={new Date().toISOString()} />
          <DeleteButton kind="room" id={room.id} back={back} list="/salles" />
        </>
      )}
    </div>
  );
}
