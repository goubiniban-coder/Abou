import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema as t } from "@/db";
import { optionPeriod } from "@/components/option-dates";
import { PrintButton } from "@/components/print-button";
import { PrintPage } from "@/components/print-page";
import { frenchDay, parisDay, plannedHours } from "@/domain";
import { formatDay, fullName } from "@/lib/format";
import { loadOrganization } from "@/server/attendance";
import { loadContext } from "@/server/planning";
import { euros, proposalByToken, quote } from "@/server/proposals";

export const metadata = { title: "Devis", robots: { index: false } };

export default async function QuotePage({ params }: PageProps<"/proposition/[token]/devis">) {
  const { token } = await params;
  const p = await proposalByToken(token);
  if (!p) notFound();
  const [ctx, org, trainees, clients] = await Promise.all([
    loadContext(),
    loadOrganization(),
    db.select().from(t.trainees).where(inArray(t.trainees.id, p.traineeIds)),
    db.select().from(t.clients),
  ]);
  const course = ctx.courses.find((c) => c.id === p.courseId)!;
  const site = ctx.sites.find((s) => s.id === p.siteId);
  const client = clients.find((c) => c.id === p.clientId);
  const chosen = p.chosenOption !== null ? p.options[p.chosenOption] : undefined;
  const amounts = quote(p, org.vatRate);
  const hours = plannedHours(chosen ?? p.options[0]);
  const created = parisDay(p.createdAt);

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex w-[210mm] max-w-full items-center gap-3 px-2 print:hidden">
        <h1 className="font-semibold">Devis {p.number}</h1>
        <span className="ml-auto"><PrintButton /></span>
      </div>
      <PrintPage org={org}>
        <div className="mb-6 flex justify-between gap-6">
          <div>
            <h1 className="text-lg font-bold">Devis n° {p.number}</h1>
            <p>Date : {frenchDay(created)}</p>
            <p>Valable jusqu&apos;au {frenchDay(p.expiresOn)}</p>
          </div>
          <div className="w-1/2 text-right">
            <p className="font-semibold">{client?.name ?? "Client"}</p>
            {client?.city && <p>{client.city}</p>}
          </div>
        </div>

        <p className="mb-2"><strong>Objet :</strong> recyclage {course.code} · {course.title}</p>
        <p className="mb-2">
          <strong>Dates :</strong>{" "}
          {chosen ? optionPeriod(chosen) : `au choix : ${p.options.map((o) => optionPeriod(o)).join(" ; ")}`}
        </p>
        <p className="mb-2"><strong>Lieu :</strong> {[site?.name, site?.city].filter(Boolean).join(", ")}</p>
        <p className="mb-4"><strong>Stagiaires :</strong> {trainees.map(fullName).join(", ")}</p>

        <table className="mb-4 w-full border-collapse text-left">
          <thead>
            <tr className="[&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1">
              <th>Désignation</th>
              <th className="text-right">Quantité</th>
              <th className="text-right">Prix unitaire HT</th>
              <th className="text-right">Total HT</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border [&_td]:border-slate-400 [&_td]:px-2 [&_td]:py-1">
            <tr>
              <td>
                Formation {course.code} · {course.title}, {hours} h par stagiaire
                {course.testUnitsPerTrainee ? ", tests compris" : ""}
              </td>
              <td className="text-right">{trainees.length}</td>
              <td className="text-right">{p.pricePerTrainee !== null ? euros(p.pricePerTrainee) : "à définir"}</td>
              <td className="text-right">{euros(amounts.net)}</td>
            </tr>
          </tbody>
        </table>

        <table className="mb-4 ml-auto w-1/2 border-collapse">
          <tbody className="[&_td]:px-2 [&_td]:py-0.5">
            <tr><td>Total HT</td><td className="text-right">{euros(amounts.net)}</td></tr>
            {org.vatRate > 0 ? (
              <tr><td>TVA {org.vatRate} %</td><td className="text-right">{euros(amounts.vat)}</td></tr>
            ) : (
              <tr><td colSpan={2} className="text-xs text-slate-600">TVA non applicable, article 261-4-4° a du CGI</td></tr>
            )}
            <tr className="font-bold"><td>Total TTC</td><td className="text-right">{euros(amounts.gross)}</td></tr>
          </tbody>
        </table>

        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p>Pour {org.name}</p>
            <p className="text-slate-600">{org.signatory}</p>
          </div>
          <div className="rounded border border-slate-300 p-2">
            <p className="font-semibold">Bon pour accord</p>
            {p.status === "accepted" && p.acceptedAt ? (
              <p className="text-sm">
                Accepté en ligne par {p.acceptedBy} le {formatDay(parisDay(p.acceptedAt), { day: "numeric", month: "long", year: "numeric" })}
              </p>
            ) : (
              <div className="h-16" />
            )}
          </div>
        </div>
      </PrintPage>
    </div>
  );
}
