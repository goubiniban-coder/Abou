import type { Session } from "@/domain";
import { loadReference } from "@/server/reference";
import { SessionForm } from "../session-form";

export const metadata = { title: "Nouvelle session" };

export default async function NewSessionPage({ searchParams }: PageProps<"/sessions/new">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const reference = await loadReference();
  const { ctx } = reference;
  const room = ctx.rooms.find((r) => r.id === one("room"));
  const course = ctx.courses.find((c) => c.id === one("course")) ?? ctx.courses[0];
  const trainer = one("trainer");
  const date = one("date") ?? new Date().toISOString().slice(0, 10);
  const initial: Session = {
    id: crypto.randomUUID(),
    courseId: course?.id ?? "",
    siteId: room?.siteId ?? one("site") ?? ctx.sites[0]?.id ?? "",
    mode: "inter",
    roomId: room?.id,
    assignments: trainer ? [{ role: "theory", trainerId: trainer }] : [],
    equipmentIds: one("equipment") ? [one("equipment")!] : [],
    traineeIds: one("trainees")?.split(",").filter(Boolean) ?? [],
    status: "draft",
    // Un créneau fictif transmet la date de début ; le formulaire recalcule les jours.
    slots: [],
  };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nouvelle session</h1>
      <SessionForm reference={reference} initial={initial} isNew startDate={date} />
    </div>
  );
}
