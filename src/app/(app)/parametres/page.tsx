import { saveOrganization } from "@/app/attendance-actions";
import Link from "next/link";
import { db, schema as t } from "@/db";
import { Icon } from "@/components/icon";
import { Field, PageHeader } from "@/components/ui";
import { loadOrganization } from "@/server/attendance";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: PageProps<"/parametres">) {
  const { ok } = await searchParams;
  const [org, sites] = await Promise.all([loadOrganization(), db.select().from(t.sites)]);
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Paramètres" />
      {ok && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">Enregistré.</p>}
      <form action={saveOrganization} className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Identité de l&apos;organisme, reprise sur les documents</h2>
        <Field label="Nom" className="sm:col-span-2"><input name="name" defaultValue={org.name} required className="input" /></Field>
        <Field label="Adresse" className="sm:col-span-2"><input name="address" defaultValue={org.address ?? ""} className="input" /></Field>
        <Field label="SIRET"><input name="siret" defaultValue={org.siret ?? ""} className="input" /></Field>
        <Field label="N° de déclaration d'activité"><input name="nda" defaultValue={org.nda ?? ""} className="input" /></Field>
        <Field label="Téléphone"><input name="phone" defaultValue={org.phone ?? ""} className="input" /></Field>
        <Field label="E-mail"><input name="email" type="email" defaultValue={org.email ?? ""} className="input" /></Field>
        <Field label="Signataire des attestations" hint="Nom et fonction, par exemple « Anne Dupuis, directrice »" className="sm:col-span-2">
          <input name="signatory" defaultValue={org.signatory ?? ""} className="input" />
        </Field>
        <Field label="TVA sur les devis (%)" hint="0 si l'organisme est exonéré (article 261-4-4° du CGI)">
          <input name="vatRate" type="number" min={0} max={100} defaultValue={org.vatRate} className="input" />
        </Field>
        <div className="sm:col-span-2"><button className="btn-primary">Enregistrer</button></div>
      </form>

      <section className="card space-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-100 text-accent-500"><Icon name="tv" /></span>
          <div>
            <h2 className="text-sm font-semibold">Écran TV du hall</h2>
            <p className="text-xs text-slate-500">Les formations du jour, leurs salles et formateurs, en grand pour les stagiaires qui arrivent. Ouvrez le lien sur la télé du site, il se met à jour tout seul.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/accueil" target="_blank" className="btn-secondary">Tous les sites</Link>
          {sites.map((s) => (
            <Link key={s.id} href={`/accueil?site=${s.id}`} target="_blank" className="btn-secondary">{s.name}</Link>
          ))}
        </div>
      </section>
    </div>
  );
}
