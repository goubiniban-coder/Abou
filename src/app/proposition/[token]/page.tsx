import { inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema as t } from "@/db";
import { acceptProposal, declineProposal } from "@/app/proposal-actions";
import { OptionDates, optionPeriod } from "@/components/option-dates";
import { optionStarted } from "@/domain";
import { fullName, formatDay } from "@/lib/format";
import { loadOrganization } from "@/server/attendance";
import { loadContext } from "@/server/planning";
import { euros, isExpired, proposalByToken, quote } from "@/server/proposals";

export const metadata = { title: "Proposition de dates", robots: { index: false } };

/** Page envoyée au client : il choisit une des dates proposées, sans compte ni mot de passe. */
export default async function ProposalPage({ params, searchParams }: PageProps<"/proposition/[token]">) {
  const { token } = await params;
  const { taken } = await searchParams;
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
  const amounts = quote(p, org.vatRate);
  const now = new Date();
  const expired = isExpired(p) || p.options.every((o) => optionStarted(o, now));
  const chosen = p.chosenOption !== null ? p.options[p.chosenOption] : undefined;
  const placeOf = (roomId?: string) => [ctx.rooms.find((r) => r.id === roomId)?.name, site?.name, site?.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-16">
      <header className="border-b border-slate-200 pb-3">
        <p className="font-bold text-brand-700">{org.name}</p>
        <p className="text-xs text-slate-500">{[org.address, org.phone, org.email].filter(Boolean).join(" · ")}</p>
      </header>

      <section>
        <p className="text-sm text-slate-500">{client ? `Pour ${client.name}` : "Proposition"} · devis {p.number}</p>
        <h1 className="text-2xl font-bold">Recyclage {course.code} · {course.title}</h1>
        <p className="mt-2 text-sm text-slate-700">
          {trainees.length > 1 ? "Les certificats de vos salariés arrivent" : "Le certificat de votre salarié arrive"} à échéance. Voici des dates où{" "}
          {["le formateur", "la salle", course.requiredEquipmentKinds?.length && "les engins", course.testUnitsPerTrainee && "le testeur"].filter(Boolean).join(", ")} sont
          disponibles. Choisissez celle qui vous convient : la place est réservée aussitôt.
        </p>
        <ul className="mt-2 flex flex-wrap gap-1 text-sm">
          {trainees.map((tr) => <li key={tr.id} className="rounded bg-slate-100 px-2 py-0.5">{fullName(tr)}</li>)}
        </ul>
        {p.pricePerTrainee !== null && (
          <p className="mt-2 text-sm">
            {trainees.length} × {euros(p.pricePerTrainee)} HT = <strong>{euros(amounts.net)} HT</strong>
            {org.vatRate > 0 ? ` (${euros(amounts.gross)} TTC)` : " (exonéré de TVA)"}
          </p>
        )}
      </section>

      {p.status === "accepted" && chosen ? (
        <section className="card space-y-2 border-emerald-300 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-800">Date réservée, merci {p.acceptedBy}</h2>
          <p className="text-sm">Recyclage {optionPeriod(chosen)}, {placeOf(chosen.roomId)}.</p>
          <OptionDates option={chosen} />
          <p className="text-sm text-slate-600">Nous vous enverrons les convocations. Le devis correspondant est prêt à être téléchargé.</p>
          <Link href={`/proposition/${token}/devis`} className="btn-primary">Voir le devis</Link>
        </section>
      ) : p.status === "declined" ? (
        <p className="card p-4 text-sm">Vous avez décliné cette proposition. Contactez-nous si vous souhaitez d&apos;autres dates.</p>
      ) : expired ? (
        <p className="card p-4 text-sm">Cette proposition a expiré le {formatDay(p.expiresOn, { day: "numeric", month: "long" })}. Contactez-nous pour de nouvelles dates.</p>
      ) : (
        <>
          {typeof taken === "string" && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Cette date vient d&apos;être prise par un autre client. Merci d&apos;en choisir une autre.</p>
          )}
          <div className="space-y-3">
            {p.options.map((option, i) => optionStarted(option, now) ? null : (
              <form key={i} action={acceptProposal.bind(null, token, i)} className="card space-y-2 p-4">
                <h2 className="font-semibold first-letter:uppercase">{optionPeriod(option)}</h2>
                <p className="text-sm text-slate-600">{placeOf(option.roomId)}</p>
                <div className="text-sm"><OptionDates option={option} /></div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <input name="name" required placeholder="Votre nom" aria-label="Votre nom" className="input max-w-56 flex-1" />
                  <button className="btn-primary">Choisir cette date</button>
                </div>
              </form>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Proposition valable jusqu&apos;au {formatDay(p.expiresOn, { day: "numeric", month: "long" })}. En choisissant une date, vous acceptez le devis {p.number}.{" "}
            <Link href={`/proposition/${token}/devis`} className="underline">Voir le devis</Link>
          </p>
          <form action={declineProposal.bind(null, token)}>
            <button className="text-xs text-slate-400 underline">Aucune date ne convient</button>
          </form>
        </>
      )}
    </div>
  );
}
