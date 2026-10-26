import { notFound } from "next/navigation";
import { loadReference } from "@/server/reference";
import { statusLabel } from "@/lib/format";
import { SessionForm } from "../session-form";

export const metadata = { title: "Session" };

export default async function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const reference = await loadReference();
  const session = reference.ctx.sessions.find((s) => s.id === id);
  if (!session) notFound();
  const course = reference.ctx.courses.find((c) => c.id === session.courseId);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{course ? `${course.code} · ${course.title}` : "Session"}</h1>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{statusLabel[session.status]}</span>
      </div>
      <SessionForm reference={reference} initial={session} isNew={false} />
    </div>
  );
}
