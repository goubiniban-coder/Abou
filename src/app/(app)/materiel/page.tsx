import Link from "next/link";
import { PageHeader, Table } from "@/components/ui";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Matériel" };

export default async function EquipmentPage() {
  const ctx = await loadContext();
  return (
    <div>
      <PageHeader title="Matériel et engins" action={{ href: "/materiel/new", label: "Nouveau matériel" }} />
      <Table head={["Nom", "Type", "Site"]}>
        {ctx.equipment.map((e) => (
          <tr key={e.id}>
            <td><Link href={`/materiel/${e.id}`} className="font-medium hover:underline">{e.name}</Link></td>
            <td><code>{e.kind}</code></td>
            <td>{ctx.sites.find((s) => s.id === e.siteId)?.name ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
