import Link from "next/link";
import { parisDay } from "@/domain";
import { Badge, PageHeader, Table } from "@/components/ui";
import { competenceTone, fullName } from "@/lib/format";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Formateurs" };

export default async function TrainersPage() {
  const ctx = await loadContext();
  const today = parisDay(new Date().toISOString());
  return (
    <div>
      <PageHeader title="Formateurs" action={{ href: "/formateurs/new", label: "Nouveau formateur" }} />
      <Table head={["Nom", "Rattachement", "Compétences et habilitations", "Capacité de test", "Sessions à venir"]}>
        {ctx.trainers.map((t) => {
          const upcoming = ctx.sessions.filter((s) => s.status !== "cancelled" && s.assignments.some((a) => a.trainerId === t.id) && s.slots.some((sl) => parisDay(sl.start) >= today)).length;
          return (
            <tr key={t.id}>
              <td><Link href={`/formateurs/${t.id}`} className="font-medium hover:underline">{fullName(t)}</Link></td>
              <td>{t.external ? "Externe" : (ctx.sites.find((s) => s.id === t.siteId)?.name ?? "—")}</td>
              <td className="space-x-1">
                {t.competences.map((c) => (
                  <Badge key={c.code} tone={competenceTone(c.validUntil, today)}>
                    {c.code}
                    {c.validUntil && ` → ${c.validUntil}`}
                  </Badge>
                ))}
              </td>
              <td>{t.testUnitsPerDay ? `${t.testUnitsPerDay} unités/jour` : "—"}</td>
              <td>{upcoming}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
