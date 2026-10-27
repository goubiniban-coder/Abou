import { notFound } from "next/navigation";
import { loadReference } from "@/server/reference";
import { statusLabel } from "@/lib/format";
import { Badge, CourseTag, PageHeader, statusTone } from "@/components/ui";
import { SessionForm } from "../session-form";
import { AttendancePanel } from "./attendance-panel";

export const metadata = { title: "Session" };

export default async function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const reference = await loadReference();
  const session = reference.ctx.sessions.find((s) => s.id === id);
  if (!session) notFound();
  const course = reference.ctx.courses.find((c) => c.id === session.courseId);
  return (
    <div className="space-y-4">
      <PageHeader
        title={
          course ? (
            <>
              <CourseTag code={course.code} color={course.color} className="font-extrabold" /> · {course.title}
            </>
          ) : (
            "Session"
          )
        }
      >
        <Badge tone={statusTone[session.status]}>{statusLabel[session.status]}</Badge>
      </PageHeader>
      <SessionForm reference={reference} initial={session} isNew={false} />
      {course && <AttendancePanel session={session} course={course} />}
    </div>
  );
}
