import Link from "next/link";
import { PageHeader, Table } from "@/components/ui";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Formations" };

export default async function CoursesPage() {
  const ctx = await loadContext();
  return (
    <div>
      <PageHeader title="Catalogue de formations" action={{ href: "/formations/new", label: "Nouvelle formation" }} />
      <Table head={["Code", "Intitulé", "Durée", "Effectif max", "Compétences requises", "Matériel", "Test", "Validité"]}>
        {ctx.courses.map((c) => (
          <tr key={c.id}>
            <td><Link href={`/formations/${c.id}`} className="font-semibold hover:underline" style={{ color: c.color }}>{c.code}</Link></td>
            <td>{c.title}</td>
            <td>{c.durationHalfDays / 2} j</td>
            <td>{c.maxTrainees}</td>
            <td>{c.requiredCompetences.join(", ") || "—"}</td>
            <td>{c.requiredEquipmentKinds?.join(", ") || "—"}</td>
            <td>{c.testUnitsPerTrainee ? `${c.testUnitsPerTrainee} unités/stagiaire` : "—"}</td>
            <td>{c.validityMonths ? `${c.validityMonths / 12} ans` : "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
