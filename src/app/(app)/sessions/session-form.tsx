"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { SeverityDot } from "@/components/ui";
import { checkSessionAction, deleteSessionAction, saveSessionAction } from "@/app/actions";
import { defaultSlots, type AssignmentRole, type Conflict, type Course, type Session, type Slot, type SlotKind } from "@/domain";
import { addDays, parisClock, parisDay, parisTime } from "@/domain/time";
import { formatDay, fullName, roleLabel, slotKindLabel } from "@/lib/format";
import type { Reference } from "@/server/reference";

type Check = Awaited<ReturnType<typeof checkSessionAction>>;
type SuggestionList = Check["suggestions"]["rooms"];

interface DayRow {
  date: string;
  morning: boolean;
  afternoon: boolean;
  kind: SlotKind;
}

const MORNING = ["08:30", "12:00"] as const;
const AFTERNOON = ["13:30", "17:00"] as const;

function rowsFromSlots(slots: Slot[]): DayRow[] {
  const byDay = new Map<string, DayRow>();
  for (const s of slots) {
    const date = parisDay(s.start);
    const row = byDay.get(date) ?? { date, morning: false, afternoon: false, kind: s.kind };
    if (parisClock(s.start) < "12:00") row.morning = true;
    else row.afternoon = true;
    if (s.kind === "test") row.kind = "test";
    byDay.set(date, row);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function slotsFromRows(rows: DayRow[]) {
  return rows.flatMap((r) => [
    ...(r.morning ? [{ start: parisTime(r.date, MORNING[0]), end: parisTime(r.date, MORNING[1]), kind: r.kind }] : []),
    ...(r.afternoon ? [{ start: parisTime(r.date, AFTERNOON[0]), end: parisTime(r.date, AFTERNOON[1]), kind: r.kind }] : []),
  ]);
}

/** Jours ouvrés successifs à partir de `start`, selon la durée de la formation. */
function defaultRows(course: Course | undefined, start: string): DayRow[] {
  const fallback: Course = { id: "", code: "", title: "", durationHalfDays: 2, maxTrainees: 0, requiredCompetences: [] };
  return rowsFromSlots(defaultSlots(course ?? fallback, start));
}

export function SessionForm({ reference, initial, isNew, startDate }: { reference: Reference; initial: Session; isNew: boolean; startDate?: string }) {
  const router = useRouter();
  const { ctx, trainees, clients } = reference;
  const [session, setSession] = useState<Session>(initial);
  const [rows, setRows] = useState<DayRow[]>(() => (initial.slots.length ? rowsFromSlots(initial.slots) : defaultRows(ctx.courses.find((c) => c.id === initial.courseId), startDate ?? new Date().toISOString().slice(0, 10))));
  const [check, setCheck] = useState<Check | null>(null);
  const [traineeFilter, setTraineeFilter] = useState("");
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const course = ctx.courses.find((c) => c.id === session.courseId);
  const draft: Session = useMemo(() => ({ ...session, slots: slotsFromRows(rows) }), [session, rows]);

  // Vérification à la volée : conflits et suggestions recalculés à chaque modification.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkSessionAction(draft);
      if (!cancelled) setCheck(result);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft]);

  const update = (patch: Partial<Session>) => setSession((s) => ({ ...s, ...patch }));
  const trainerFor = (role: AssignmentRole) => session.assignments.find((a) => a.role === role)?.trainerId ?? "";
  const setTrainer = (role: AssignmentRole, trainerId: string) =>
    update({ assignments: [...session.assignments.filter((a) => a.role !== role), ...(trainerId ? [{ role, trainerId }] : [])] });

  function changeCourse(courseId: string) {
    const next = ctx.courses.find((c) => c.id === courseId);
    update({ courseId });
    setRows(defaultRows(next, rows[0]?.date ?? new Date().toISOString().slice(0, 10)));
  }

  function save(status: Session["status"], force = false) {
    setError(null);
    startSaving(async () => {
      const result = await saveSessionAction({ ...draft, status }, force);
      if (result.ok) {
        router.push(`/sessions/${result.id}`);
        router.refresh();
      } else if (result.blocked) {
        const list = result.conflicts.filter((c) => c.severity === "error").map((c) => `• ${c.message}`).join("\n");
        if (window.confirm(`Impossible de confirmer : conflits bloquants.\n\n${list}\n\nConfirmer quand même ?`)) save(status, true);
      } else {
        setError(result.error);
      }
    });
  }

  function remove() {
    if (!window.confirm("Supprimer définitivement cette session ?")) return;
    startSaving(async () => {
      await deleteSessionAction(session.id);
      router.push("/sessions");
    });
  }

  const conflicts = check?.conflicts ?? [];
  const shownTrainees = trainees.filter(
    (t) =>
      (!traineeFilter || fullName(t).toLowerCase().includes(traineeFilter.toLowerCase())) &&
      (session.mode === "inter" || !session.clientId || t.clientId === session.clientId),
  );
  const roles: AssignmentRole[] = course?.testUnitsPerTrainee ? ["theory", "practice", "tester"] : ["theory", "practice"];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="course">Formation</label>
            <select id="course" className="input" value={session.courseId} onChange={(e) => changeCourse(e.target.value)}>
              {ctx.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="site">Site</label>
            <select id="site" className="input" value={session.siteId} onChange={(e) => update({ siteId: e.target.value })}>
              {ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mode">Type</label>
            <select id="mode" className="input" value={session.mode} onChange={(e) => update({ mode: e.target.value as Session["mode"], roomId: e.target.value === "intra" ? undefined : session.roomId })}>
              <option value="inter">Inter (dans nos locaux)</option>
              <option value="intra">Intra (chez le client)</option>
            </select>
          </div>
          {session.mode === "intra" && (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="client">Client</label>
              <select id="client" className="input" value={session.clientId ?? ""} onChange={(e) => update({ clientId: e.target.value || undefined })}>
                <option value="">Choisir un client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </section>

        <section className="card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Dates</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">
                Début{" "}
                <input
                  type="date"
                  className="input inline-block w-auto"
                  value={rows[0]?.date ?? ""}
                  onChange={(e) => e.target.value && setRows(defaultRows(course, e.target.value))}
                />
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRows([...rows, { date: addDays(rows[rows.length - 1]?.date ?? new Date().toISOString().slice(0, 10), 1), morning: true, afternoon: true, kind: "practice" }])}
              >
                + Jour
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {rows.map((r, i) => {
              const set = (patch: Partial<DayRow>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="date" className="input w-auto" aria-label={`Date du jour ${i + 1}`} value={r.date} onChange={(e) => set({ date: e.target.value })} />
                  <span className="w-28 text-xs text-slate-600 capitalize" aria-hidden>{formatDay(r.date, { weekday: "long" })}</span>
                  <label className="flex min-h-11 items-center gap-1.5"><input type="checkbox" className="size-4" checked={r.morning} onChange={(e) => set({ morning: e.target.checked })} /> Matin</label>
                  <label className="flex min-h-11 items-center gap-1.5"><input type="checkbox" className="size-4" checked={r.afternoon} onChange={(e) => set({ afternoon: e.target.checked })} /> Après-midi</label>
                  <select className="input w-auto" aria-label={`Type du jour ${i + 1}`} value={r.kind} onChange={(e) => set({ kind: e.target.value as SlotKind })}>
                    {(Object.keys(slotKindLabel) as SlotKind[]).map((k) => <option key={k} value={k}>{slotKindLabel[k]}</option>)}
                  </select>
                  <button type="button" className="btn-ghost w-11 px-0 hover:text-red-700" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Retirer le ${formatDay(r.date, { weekday: "long", day: "numeric", month: "long" })}`}>✕</button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Matin {MORNING.join("–")}, après-midi {AFTERNOON.join("–")}.</p>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Ressources</h2>
          {session.mode === "inter" && (
            <ResourcePicker
              label="Salle"
              value={session.roomId ?? ""}
              onChange={(v) => update({ roomId: v || undefined })}
              options={ctx.rooms.map((r) => ({ id: r.id, label: `${r.name} (${r.capacity} places)` }))}
              suggestions={check?.suggestions.rooms}
            />
          )}
          {roles.map((role) => (
            <ResourcePicker
              key={role}
              label={`Formateur ${roleLabel[role].toLowerCase()}`}
              value={trainerFor(role)}
              onChange={(v) => setTrainer(role, v)}
              options={ctx.trainers.filter((t) => role !== "tester" || t.testUnitsPerDay).map((t) => ({ id: t.id, label: `${fullName(t)}${t.external ? " (externe)" : ""}` }))}
              suggestions={check?.suggestions.trainers[role]}
            />
          ))}
          {(course?.requiredEquipmentKinds ?? []).map((kind) => (
            <div key={kind}>
              <span className="label">Matériel {kind}</span>
              <div className="flex flex-wrap gap-2">
                {ctx.equipment.filter((e) => e.kind === kind).map((e) => {
                  const sug = check?.suggestions.equipment[kind]?.find((s) => s.id === e.id);
                  const checked = session.equipmentIds.includes(e.id);
                  return (
                    <label key={e.id} className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm transition ${checked ? "border-brand-500 bg-brand-50 font-medium" : "border-slate-200 hover:border-brand-300"}`} title={sug?.conflicts.join("\n")}>
                      <input type="checkbox" checked={checked} onChange={(ev) => update({ equipmentIds: ev.target.checked ? [...session.equipmentIds, e.id] : session.equipmentIds.filter((x) => x !== e.id) })} />
                      {e.name}
                      {sug && !checked && <span className={`text-xs font-semibold ${sug.available ? "text-brand-700" : "text-red-700"}`}>{sug.available ? "libre" : "pris"}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Stagiaires ({session.traineeIds.length}{course ? ` / ${course.maxTrainees}` : ""})
            </h2>
            <input type="search" className="input max-w-56" placeholder="Rechercher" aria-label="Rechercher un stagiaire" value={traineeFilter} onChange={(e) => setTraineeFilter(e.target.value)} />
          </div>
          <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {shownTrainees.map((t) => (
              <label key={t.id} className="flex min-h-9 items-center gap-2 rounded-lg px-1 text-sm hover:bg-mint-50">
                <input
                  type="checkbox"
                  checked={session.traineeIds.includes(t.id)}
                  onChange={(e) => update({ traineeIds: e.target.checked ? [...session.traineeIds, t.id] : session.traineeIds.filter((x) => x !== t.id) })}
                />
                {fullName(t)}
                <span className="text-xs text-slate-600">{clients.find((c) => c.id === t.clientId)?.name}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <ConflictPanel conflicts={conflicts} loading={!check} />
        <div className="card space-y-2 p-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-800">{error}</p>}
          <button className="btn-primary w-full" disabled={saving} onClick={() => save("confirmed")}>Confirmer la session</button>
          <button className="btn-secondary w-full" disabled={saving} onClick={() => save("draft")}>Enregistrer en brouillon</button>
          {!isNew && session.status !== "cancelled" && (
            <button className="btn-secondary w-full" disabled={saving} onClick={() => save("cancelled")}>Annuler la session</button>
          )}
          {!isNew && <button className="btn-danger w-full" disabled={saving} onClick={remove}>Supprimer</button>}
          <Link href="/planning" className="btn-ghost w-full">Retour au planning</Link>
        </div>
      </aside>
    </div>
  );
}

function ResourcePicker({
  label,
  value,
  onChange,
  options,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  suggestions?: SuggestionList;
}) {
  const ranked = suggestions ? [...options].sort((a, b) => (suggestions.find((s) => s.id === b.id)?.score ?? -9999) - (suggestions.find((s) => s.id === a.id)?.score ?? -9999)) : options;
  const best = suggestions?.find((s) => s.available && s.id !== value);
  const current = suggestions?.find((s) => s.id === value);
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <select id={id} className="input max-w-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-why`}>
          <option value="">Non affecté</option>
          {ranked.map((o) => {
            const s = suggestions?.find((x) => x.id === o.id);
            return (
              <option key={o.id} value={o.id}>
                {s && o.id !== value ? (s.available ? "✓ " : "✗ ") : ""}
                {o.label}
              </option>
            );
          })}
        </select>
        {!value && best && (
          <button type="button" className="btn-accent min-h-11" onClick={() => onChange(best.id)} title={best.reasons.join("\n")}>
            <Icon name="spark" className="size-4" />
            Suggestion : {options.find((o) => o.id === best.id)?.label}
          </button>
        )}
      </div>
      <p id={`${id}-why`} className="mt-1 text-xs text-slate-600 empty:hidden">
        {value && current ? current.reasons.join(" · ") : !value && best ? best.reasons.join(" · ") : ""}
      </p>
    </div>
  );
}

/** Résultat de la vérification à la volée, annoncé poliment aux lecteurs d'écran. */
function ConflictPanel({ conflicts, loading }: { conflicts: Conflict[]; loading: boolean }) {
  return (
    <div role="status" aria-live="polite">
      <ConflictContent conflicts={conflicts} loading={loading} />
    </div>
  );
}

function ConflictContent({ conflicts, loading }: { conflicts: Conflict[]; loading: boolean }) {
  if (loading) return <div className="card p-4 text-sm text-slate-600">Vérification…</div>;
  if (conflicts.length === 0)
    return (
      <div className="card flex items-center gap-2 border-brand-200 bg-brand-50 p-4 text-sm font-medium text-brand-900">
        <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-white" aria-hidden><Icon name="check" className="size-4" /></span>
        Aucun conflit détecté, c&apos;est tout bon !
      </div>
    );
  return (
    <div className="card border-red-200 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-red-100 text-red-700" aria-hidden><Icon name="alert" className="size-4" /></span>
        {conflicts.length} point{conflicts.length > 1 ? "s" : ""} à régler
      </h2>
      <ul className="space-y-2 text-sm">
        {conflicts.map((c, i) => (
          <li key={i} className="flex gap-2">
            <SeverityDot severity={c.severity} />
            <span>
              {c.message}
              {c.otherSessionId && (
                <>
                  {" "}
                  <Link href={`/sessions/${c.otherSessionId}`} className="font-medium text-brand-700 underline underline-offset-2">Voir l&apos;autre session</Link>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
