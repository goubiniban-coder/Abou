import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { saveClient } from "@/app/ref-actions";
import { Field, PageHeader, Table } from "@/components/ui";
import { fullName } from "@/lib/format";

export const metadata = { title: "Stagiaires" };

export default async function TraineesPage({ searchParams }: PageProps<"/stagiaires">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.toLowerCase() : "";
  const [trainees, clients, certs] = await Promise.all([
    db.select().from(t.trainees).orderBy(asc(t.trainees.lastName)),
    db.select().from(t.clients).orderBy(asc(t.clients.name)),
    db.select().from(t.certifications),
  ]);
  const shown = trainees.filter((s) => !query || fullName(s).toLowerCase().includes(query));
  return (
    <div className="space-y-4">
      <PageHeader title="Stagiaires" action={{ href: "/stagiaires/new", label: "Nouveau stagiaire" }} />
      <form className="flex gap-2">
        <input name="q" defaultValue={query} placeholder="Rechercher un stagiaire" className="input max-w-xs" />
        <button className="btn-secondary">Rechercher</button>
      </form>
      <Table head={["Nom", "Entreprise", "Certificats"]}>
        {shown.map((s) => (
          <tr key={s.id}>
            <td><Link href={`/stagiaires/${s.id}`} className="font-medium hover:underline">{fullName(s)}</Link></td>
            <td>{clients.find((c) => c.id === s.clientId)?.name ?? "—"}</td>
            <td>{certs.filter((c) => c.traineeId === s.id).length}</td>
          </tr>
        ))}
      </Table>
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold">Entreprises clientes</h2>
        <p className="mb-3 text-sm text-slate-600">{clients.map((c) => c.name).join(", ") || "Aucune."}</p>
        <form action={saveClient} className="flex flex-wrap items-end gap-2">
          <Field label="Nouvelle entreprise"><input name="name" required className="input" /></Field>
          <Field label="Ville"><input name="city" className="input" /></Field>
          <button className="btn-secondary">Ajouter</button>
        </form>
      </section>
    </div>
  );
}
