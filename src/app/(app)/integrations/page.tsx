import { desc } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { PageHeader, Table } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { openapi } from "@/server/openapi";
import { KeyForm, RevokeButton } from "./keys";

export const metadata = { title: "API et agendas" };

export default async function IntegrationsPage() {
  const keys = await db.select().from(t.apiKeys).orderBy(desc(t.apiKeys.createdAt));
  const endpoints = Object.entries(openapi.paths).flatMap(([path, ops]) =>
    Object.entries(ops).map(([method, op]) => ({ method: method.toUpperCase(), path, summary: (op as { summary: string }).summary })),
  );
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="API et agendas" />

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Agendas des formateurs</h2>
        <p className="text-slate-600">
          Chaque formateur a un lien personnel (sur sa fiche) vers son espace mobile et un flux iCal. Abonné dans Google Agenda, Outlook ou le calendrier
          du téléphone, ce flux se met à jour tout seul quand le planning change.
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Clés d&apos;API</h2>
        <KeyForm />
        {keys.length > 0 && (
          <Table head={["Nom", "Début de la clé", "Créée le", "Dernier usage", ""]}>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td><code>{k.prefix}…</code></td>
                <td>{formatDate(k.createdAt)}</td>
                <td>{k.lastUsedAt ? formatDate(k.lastUsedAt) : "jamais"}</td>
                <td><RevokeButton id={k.id} /></td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="card space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Points d&apos;accès</h2>
        <p className="text-slate-600">
          Base : <code>/api/v1</code>. En-tête : <code>Authorization: Bearer &lt;clé&gt;</code>. Description complète au format OpenAPI :{" "}
          <a className="text-brand-700 hover:underline" href="/api/openapi">/api/openapi</a>.
        </p>
        <Table head={["Méthode", "Chemin", "Rôle"]}>
          {endpoints.map((e) => (
            <tr key={`${e.method}${e.path}`}>
              <td><code className="font-semibold">{e.method}</code></td>
              <td><code>{e.path}</code></td>
              <td>{e.summary}</td>
            </tr>
          ))}
        </Table>
        <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{`curl -H "Authorization: Bearer abou_…" \\
  "https://votre-domaine/api/v1/sessions?from=2026-11-01&to=2026-11-30"`}</pre>
      </section>
    </div>
  );
}
