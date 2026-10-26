"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { checkSessionAction, deleteSessionAction, saveSessionAction } from "@/app/actions";
import type { AssignmentRole, Conflict, Course, Session, SlotKind } from "@/domain";
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

function rowsFromSlots(session: Session): DayRow[] {
  const byDay = new Map<string, DayRow>();
  for (const s of session.slots) {
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
  const halfDays = course?.durationHalfDays ?? 2;
  const dayCount = Math.ceil(halfDays / 2);
  const rows: DayRow[] = [];
  let date = start;
  while (rows.length < dayCount) {
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const i = rows.length;
      const last = i === dayCount - 1;
      const kind: SlotKind = last && course?.testUnitsPerTrainee ? "test" : i < dayCount / 2 ? "theory" : "practice";
      rows.push({ date, morning: true, afternoon: !(last && halfDays % 2 === 1), kind });
    }
    date = addDays(date, 1);
  }
  return rows;
}

export function SessionForm({ reference, initial, isNew, startDate }: { reference: Reference; initial: Session; isNew: boolean; startDate?: string }) {
  const router = useRouter();
  const { ctx, trainees, clients } = reference;
  const [session, setSession] = useState<Session>(initial);
  const [rows, setRows] = useState<DayRow[]>(() => (initial.slots.length ? rowsFromSlots(initial) : defaultRows(ctx.courses.find((c) => c.id === initial.courseId), startDate ?? new Date().toISOString().slice(0, 10))));
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
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dates</h2>
            <div className="flex gap-2">
              <label className="text-xs text-slate-600">
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
                  <input type="date" className="input w-auto" value={r.date} onChange={(e) => set({ date: e.target.value })} />
                  <span className="w-28 text-xs text-slate-500 capitalize">{formatDay(r.date, { weekday: "long" })}</span>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={r.morning} onChange={(e) => set({ morning: e.target.checked })} /> Matin</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={r.afternoon} onChange={(e) => set({ afternoon: e.target.checked })} /> Après-midi</label>
                  <select className="input w-auto" value={r.kind} onChange={(e) => set({ kind: e.target.value as SlotKind })}>
                    {(Object.keys(slotKindLabel) as SlotKind[]).map((k) => <option key={k} value={k}>{slotKindLabel[k]}</option>)}
                  </select>
                  <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Retirer ce jour">✕</button>
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
                    <label key={e.id} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${checked ? "border-brand-500 bg-brand-50" : "border-slate-200"}`} title={sug?.conflicts.join("\n")}>
                      <input type="checkbox" checked={checked} onChange={(ev) => update({ equipmentIds: ev.target.checked ? [...session.equipmentIds, e.id] : session.equipmentIds.filter((x) => x !== e.id) })} />
                      {e.name}
                      {sug && !checked && <span className={sug.available ? "text-emerald-600" : "text-red-600"}>{sug.available ? "libre" : "pris"}</span>}
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
            <input className="input max-w-56" placeholder="Rechercher" value={traineeFilter} onChange={(e) => setTraineeFilter(e.target.value)} />
          </div>
          <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {shownTrainees.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={session.traineeIds.includes(t.id)}
                  onChange={(e) => update({ traineeIds: e.target.checked ? [...session.traineeIds, t.id] : session.traineeIds.filter((x) => x !== t.id) })}
                />
                {fullName(t)}
                <span className="text-xs text-slate-400">{clients.find((c) => c.id === t.clientId)?.name}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <ConflictPanel conflicts={conflicts} loading={!check} />
        <div className="card space-y-2 p-4">
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={saving} onClick={() => save("confirmed")}>Confirmer la session</button>
          <button className="btn-secondary w-full" disabled={saving} onClick={() => save("draft")}>Enregistrer en brouillon</button>
          {!isNew && session.status !== "cancelled" && (
            <button className="btn-secondary w-full" disabled={saving} onClick={() => save("cancelled")}>Annuler la session</button>
          )}
          {!isNew && <button className="btn-danger w-full" disabled={saving} onClick={remove}>Supprimer</button>}
          <Link href="/planning" className="block text-center text-sm text-slate-500 hover:underline">Retour au planning</Link>
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
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-sm" value={value} onChange={(e) => onChange(e.target.value)}>
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
          <button type="button" className="text-sm text-brand-700 hover:underline" onClick={() => onChange(best.id)} title={best.reasons.join("\n")}>
            Suggestion : {options.find((o) => o.id === best.id)?.label}
          </button>
        )}
      </div>
      {value && current && current.reasons.length > 0 && <p className="mt-1 text-xs text-slate-500">{current.reasons.join(" · ")}</p>}
      {!value && best && <p className="mt-1 text-xs text-slate-500">{best.reasons.join(" · ")}</p>}
    </div>
  );
}

function ConflictPanel({ conflicts, loading }: { conflicts: Conflict[]; loading: boolean }) {
  if (loading) return <div className="card p-4 text-sm text-slate-500">Vérification…</div>;
  if (conflicts.length === 0)
    return <div className="card border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Aucun conflit détecté.</div>;
  return (
    <div className="card p-4">
      <h2 className="mb-2 text-sm font-semibold">{conflicts.length} point{conflicts.length > 1 ? "s" : ""} à régler</h2>
      <ul className="space-y-2 text-sm">
        {conflicts.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.severity === "error" ? "bg-red-500" : "bg-amber-400"}`} />
            <span>
              {c.message}
              {c.otherSessionId && (
                <>
                  {" "}
                  <Link href={`/sessions/${c.otherSessionId}`} className="text-brand-700 hover:underline">Voir l&apos;autre session</Link>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
