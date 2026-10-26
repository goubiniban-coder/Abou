import Link from "next/link";
import { PageHeader, Table } from "@/components/ui";
import { loadContext } from "@/server/planning";

export const metadata = { title: "Salles" };

export default async function RoomsPage() {
  const ctx = await loadContext();
  return (
    <div>
      <PageHeader title="Salles" action={{ href: "/salles/new", label: "Nouvelle salle" }} />
      <Table head={["Salle", "Site", "Capacité", "Équipements"]}>
        {ctx.rooms.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/salles/${r.id}`} className="font-medium hover:underline">{r.name}</Link></td>
            <td>{ctx.sites.find((s) => s.id === r.siteId)?.name}</td>
            <td>{r.capacity} places</td>
            <td className="text-slate-600">{r.equipment?.join(", ") || "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
