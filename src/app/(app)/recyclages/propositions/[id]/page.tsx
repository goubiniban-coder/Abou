import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema as t } from "@/db";
import { refreshProposal, updateProposalPrice } from "@/app/proposal-actions";
import { CopyButton } from "@/components/copy-button";
import { OptionDates, optionPeriod } from "@/components/option-dates";
import { Badge, Field } from "@/components/ui";
import { optionStillFree, parisDay } from "@/domain";
import { formatDay, fullName, roleLabel } from "@/lib/format";
import { loadOrganization } from "@/server/attendance";
import { loadContext } from "@/server/planning";
import { euros, isExpired, quote } from "@/server/proposals";

export const metadata = { title: "Proposition de recyclage" };

export default async function ProposalAdminPage({ params }: PageProps<"/recyclages/propositions/[id]">) {
  const { id } = await params;
  const [p] = await db.select().from(t.proposals).where(eq(t.proposals.id, id));
  if (!p) notFound();
  const [ctx, org, trainees, clients] = await Promise.all([
    loadContext(),
    loadOrganization(),
    db.select().from(t.trainees).where(inArray(t.trainees.id, p.traineeIds)),
    db.select().from(t.clients),
  ]);
  const course = ctx.courses.find((c) => c.id === p.courseId)!;
  const client = clients.find((c) => c.id === p.clientId);
  const h = await headers();
  const link = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/proposition/${p.token}`;
  const amounts = quote(p, org.vatRate);
  const subject = `Recyclage ${course.code} : choisissez votre date`;
  const body = `Bonjour,\n\nLes certificats ${course.code} de ${trainees.map(fullName).join(", ")} arrivent à échéance. Nous vous proposons ${p.options.length} dates, à choisir en un clic :\n\n${link}\n\nLa proposition est valable jusqu'au ${formatDay(p.expiresOn, { day: "numeric", month: "long" })}.\n\nCordialement,\n${org.signatory ?? org.name}`;
  const trainerName = (tid: string) => {
    const tr = ctx.trainers.find((x) => x.id === tid);
    return tr ? fullName(tr) : "?";
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/recyclages" className="text-sm text-brand-700">← Recyclages</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Recyclage {course.code} · {client?.name ?? "sans entreprise"}</h1>
        {p.status === "accepted" ? <Badge tone="green">Date choisie</Badge> : p.status === "declined" ? <Badge tone="red">Déclinée</Badge> : isExpired(p) ? <Badge>Expirée</Badge> : <Badge tone="amber">En attente du client</Badge>}
      </div>
      <p className="text-sm text-slate-600">
        Devis {p.number} · {trainees.length} stagiaire{trainees.length > 1 ? "s" : ""} : {trainees.map(fullName).join(", ")}
      </p>

      {p.status === "accepted" ? (
        <section className="card space-y-2 p-4 text-sm">
          <p>
            Choisie par <strong>{p.acceptedBy}</strong> le {p.acceptedAt && formatDay(parisDay(p.acceptedAt), { day: "numeric", month: "long" })} :{" "}
            {p.chosenOption !== null && optionPeriod(p.options[p.chosenOption])}.
          </p>
          <p className="text-slate-600">La session a été créée en brouillon, ressources réservées. Confirmez-la pour envoyer les convocations.</p>
          <div className="flex flex-wrap gap-2">
            {p.sessionId && <Link href={`/sessions/${p.sessionId}`} className="btn-primary">Ouvrir la session</Link>}
            <a href={`/proposition/${p.token}/devis`} target="_blank" className="btn-secondary">Devis accepté</a>
          </div>
        </section>
      ) : (
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Lien à envoyer au client</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1.5 text-xs">{link}</code>
            <CopyButton text={link} />
            <a className="btn-primary" href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Préparer l&apos;e-mail</a>
          </div>
          <p className="text-xs text-slate-500">
            Valable jusqu&apos;au {formatDay(p.expiresOn, { day: "numeric", month: "long" })}. Le client voit les dates, le prix et le devis, et choisit sans compte.
          </p>
          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
            <form action={updateProposalPrice.bind(null, p.id)} className="flex items-end gap-2">
              <Field label="Prix par stagiaire (€ HT)">
                <input name="pricePerTrainee" type="number" min={0} defaultValue={p.pricePerTrainee ?? ""} className="input w-28" />
              </Field>
              <button className="btn-secondary">Mettre à jour</button>
            </form>
            <p className="text-sm text-slate-600">Total : {euros(amounts.net)} HT</p>
            <a href={`/proposition/${p.token}/devis`} target="_blank" className="btn-secondary ml-auto">Voir le devis</a>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Dates proposées</h2>
          {p.status !== "accepted" && (
            <form action={refreshProposal.bind(null, p.id)} className="ml-auto">
              <button className="btn-secondary">{p.status === "declined" || isExpired(p) ? "Rouvrir avec de nouvelles dates" : "Recalculer les dates"}</button>
            </form>
          )}
        </div>
        {p.options.map((o, i) => {
          const free = p.status !== "open" || optionStillFree(o, course, p.siteId, p.traineeIds, ctx);
          return (
            <div key={i} className={`card p-3 text-sm ${p.chosenOption === i ? "border-emerald-400" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold first-letter:uppercase">{optionPeriod(o)}</span>
                {p.chosenOption === i && <Badge tone="green">Choisie</Badge>}
                {!free && <Badge tone="red">Plus disponible</Badge>}
              </div>
              <OptionDates option={o} />
              <p className="mt-1 text-slate-600">
                {ctx.rooms.find((r) => r.id === o.roomId)?.name} · {o.assignments.map((a) => `${trainerName(a.trainerId)} (${roleLabel[a.role].toLowerCase()})`).join(", ")}
                {o.equipmentIds.length > 0 && ` · ${o.equipmentIds.map((e) => ctx.equipment.find((x) => x.id === e)?.name).join(", ")}`}
              </p>
            </div>
          );
        })}
        <p className="text-xs text-slate-500">Les ressources ne sont réservées qu&apos;au moment où le client choisit ; la disponibilité est revérifiée à cet instant.</p>
      </section>
    </div>
  );
}
