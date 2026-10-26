import { saveOrganization } from "@/app/attendance-actions";
import { Field, PageHeader } from "@/components/ui";
import { loadOrganization } from "@/server/attendance";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: PageProps<"/parametres">) {
  const { ok } = await searchParams;
  const org = await loadOrganization();
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Paramètres" />
      {ok && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Enregistré.</p>}
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
    </div>
  );
}
