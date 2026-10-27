import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema as t } from "@/db";
import { getSession } from "@/server/planning";
import { loadSessionRecords } from "@/server/attendance";
import { signingOpen, slotKey } from "@/domain";
import { formatDate, formatTime, fullName, slotKindLabel } from "@/lib/format";
import { Icon } from "@/components/icon";
import { Sheet } from "./sheet";

export const metadata = { title: "Émargement" };

export default async function AttendancePage({ params, searchParams }: PageProps<"/formateur/[token]/emargement/[sessionId]">) {
  const { token, sessionId } = await params;
  const { slot: wanted } = await searchParams;
  const [trainer] = await db.select().from(t.trainers).where(eq(t.trainers.calendarToken, token));
  const session = await getSession(sessionId);
  if (!trainer || !session || !session.assignments.some((a) => a.trainerId === trainer.id)) notFound();

  const now = new Date();
  const started = session.slots.filter((s) => signingOpen(s.start, now));
  const wantedKey = typeof wanted === "string" && !Number.isNaN(Date.parse(wanted)) ? slotKey(wanted) : null;
  const slot = started.find((s) => slotKey(s.start) === wantedKey) ?? started.at(-1);
  const [course] = await db.select().from(t.courses).where(eq(t.courses.id, session.courseId));
  const trainees = session.traineeIds.length ? await db.select().from(t.trainees).where(inArray(t.trainees.id, session.traineeIds)) : [];
  const records = await loadSessionRecords(sessionId);

  return (
    <main className="mx-auto max-w-lg space-y-3 p-4 pb-16">
      <Link href={`/formateur/${token}`} className="btn-ghost -ml-3 text-brand-700">← Mon planning</Link>
      <header>
        <p className="text-sm font-semibold text-brand-700">Émargement</p>
        <h1 className="text-xl font-extrabold tracking-tight">{course?.code} · {course?.title}</h1>
        <span className="mt-1 block h-1.5 w-10 rounded-full bg-accent-400" aria-hidden />
      </header>

      {!slot ? (
        <p className="card p-4 text-sm text-slate-600">L&apos;émargement ouvre un quart d&apos;heure avant le début du premier créneau.</p>
      ) : (
        <>
          <nav aria-label="Créneaux" className="flex flex-wrap gap-1.5">
            {started.map((s) => {
              const active = slotKey(s.start) === slotKey(slot.start);
              const done = records.trainerSignatures.some((x) => slotKey(x.slotStart) === slotKey(s.start));
              return (
                <Link
                  key={s.start}
                  href={`?slot=${encodeURIComponent(slotKey(s.start))}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-xs ${active ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  {formatDate(s.start)} {formatTime(s.start)}
                  {done && (
                    <>
                      <Icon name="check" className={`size-3.5 ${active ? "text-accent-300" : "text-brand-600"}`} />
                      <span className="sr-only">(feuille close)</span>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
          <p className="text-sm font-medium text-slate-700">
            {formatDate(slot.start)}, {formatTime(slot.start)} – {formatTime(slot.end)} · {slotKindLabel[slot.kind]}
          </p>
          <Sheet
            key={slot.start}
            token={token}
            sessionId={sessionId}
            slotStart={slotKey(slot.start)}
            trainerName={fullName(trainer)}
            trainerSignature={records.trainerSignatures.find((x) => slotKey(x.slotStart) === slotKey(slot.start))?.signature}
            rows={trainees
              .sort((a, b) => a.lastName.localeCompare(b.lastName))
              .map((tr) => {
                const rec = records.attendance.find((r) => r.traineeId === tr.id && slotKey(r.slotStart) === slotKey(slot.start));
                return { id: tr.id, name: fullName(tr), presence: rec?.presence, signature: rec?.signature };
              })}
          />
        </>
      )}
    </main>
  );
}
