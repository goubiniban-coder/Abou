"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import { moveSessionAction, type PlanningView } from "@/app/actions";
import { formatDay, roleLabel } from "@/lib/format";

export interface TimelineRow {
  id: string | null;
  label: string;
  sub?: string;
}

export interface TimelineBlock {
  key: string;
  sessionId: string;
  resourceId: string | null;
  title: string;
  subtitle: string;
  color: string;
  status: "draft" | "confirmed" | "cancelled";
  trainees: number;
  slots: { start: string; kind: string }[];
  roles: ("theory" | "practice" | "tester")[];
  conflicts: { severity: "error" | "warning"; message: string }[];
  allConflicts: number;
}

const parisDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
const parisHour = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));

/** Regroupe les demi-journées occupées en segments contigus [début, fin] (indices de colonnes). */
function runs(block: TimelineBlock, days: string[]): [number, number][] {
  const cols = [
    ...new Set(
      block.slots
        .map((s) => {
          const d = days.indexOf(parisDay(s.start));
          return d < 0 ? -1 : d * 2 + (parisHour(s.start) < 12 ? 0 : 1);
        })
        .filter((c) => c >= 0),
    ),
  ].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const c of cols) {
    const last = out[out.length - 1];
    if (last && last[1] === c - 1) last[1] = c;
    else out.push([c, c]);
  }
  return out;
}

export function Timeline({ view, days, today, rows, blocks }: { view: PlanningView; days: string[]; today: string; rows: TimelineRow[]; blocks: TimelineBlock[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drag, setDrag] = useState<{ block: TimelineBlock; originDay: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const cols = days.length * 2;
  const gridTemplate = `repeat(${cols}, minmax(3.25rem, 1fr))`;

  function onDrop(row: TimelineRow, col: number) {
    if (!drag) return;
    const deltaDays = Math.floor(col / 2) - drag.originDay;
    const { block } = drag;
    setDrag(null);
    setHover(null);
    if (deltaDays === 0 && row.id === block.resourceId) return;
    const input = { sessionId: block.sessionId, deltaDays, view, fromResourceId: block.resourceId, toResourceId: row.id };
    startTransition(async () => {
      let result = await moveSessionAction(input);
      if (!result.ok && result.blocked) {
        const list = result.conflicts.filter((c) => c.severity === "error").map((c) => `• ${c.message}`).join("\n");
        if (window.confirm(`Ce déplacement crée des conflits :\n\n${list}\n\nDéplacer quand même ?`)) {
          result = await moveSessionAction({ ...input, force: true });
        } else {
          setMessage({ tone: "warn", text: "Déplacement annulé." });
          return;
        }
      }
      if (result.ok) {
        const errors = result.conflicts.filter((c) => c.severity === "error").length;
        setMessage(errors ? { tone: "warn", text: `Session déplacée, avec ${errors} conflit(s) à résoudre.` } : { tone: "ok", text: "Session déplacée, aucun conflit." });
        router.refresh();
      } else if (!result.blocked) {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <div className="card overflow-hidden">
      {message && (
        <div className={`flex justify-between px-4 py-2 text-sm ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : message.tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
          <button onClick={() => setMessage(null)} aria-label="Fermer">×</button>
        </div>
      )}
      <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <div className="min-w-[56rem]">
          {/* En-tête des jours */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50 text-xs">
            <div className="w-44 shrink-0 border-r border-slate-200 px-3 py-2 font-medium text-slate-500">
              {view === "trainer" ? "Formateur" : view === "room" ? "Salle" : "Matériel"}
            </div>
            <div className="grid flex-1" style={{ gridTemplateColumns: gridTemplate }}>
              {days.map((d) => (
                <div key={d} className={`col-span-2 border-r border-slate-200 px-2 py-1 text-center ${d === today ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>
                  <div className="first-letter:uppercase">{formatDay(d)}</div>
                  <div className="flex justify-around text-[10px] text-slate-400"><span>matin</span><span>après-midi</span></div>
                </div>
              ))}
            </div>
          </div>

          {rows.map((row) => {
            const rowBlocks = blocks.filter((b) => b.resourceId === row.id);
            return (
              <div key={row.id ?? "none"} className="flex border-b border-slate-100">
                <div className="w-44 shrink-0 border-r border-slate-200 px-3 py-2">
                  <div className="truncate text-sm font-medium">{row.label}</div>
                  {row.sub && <div className="truncate text-xs text-slate-500">{row.sub}</div>}
                </div>
                <div className="relative flex-1">
                  {/* Cellules de fond : cibles du glisser-déposer */}
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: gridTemplate }}>
                  {Array.from({ length: cols }, (_, c) => {
                    const id = `${row.id}:${c}`;
                    return (
                      <div
                        key={c}
                        className={`border-r ${c % 2 ? "border-slate-200" : "border-slate-100 border-dashed"} ${days[Math.floor(c / 2)] === today ? "bg-brand-50/40" : ""} ${hover === id ? "bg-brand-100" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setHover(id);
                        }}
                        onDragLeave={() => setHover((h) => (h === id ? null : h))}
                        onDrop={(e) => {
                          e.preventDefault();
                          onDrop(row, c);
                        }}
                        onDoubleClick={() => {
                          const params = new URLSearchParams({ date: days[Math.floor(c / 2)] });
                          if (row.id) params.set(view, row.id);
                          router.push(`/sessions/new?${params}`);
                        }}
                        title="Double-cliquer pour créer une session"
                      />
                    );
                  })}
                  </div>
                  <div className="pointer-events-none relative grid min-h-[3.25rem]" style={{ gridTemplateColumns: gridTemplate }}>
                  {rowBlocks.flatMap((b) =>
                    runs(b, days).map(([from, to], i) => (
                      <BlockCard
                        key={`${b.key}:${i}`}
                        block={b}
                        from={from}
                        to={to}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", b.sessionId);
                          setDrag({ block: b, originDay: Math.floor(from / 2) });
                        }}
                        onDragEnd={() => setDrag(null)}
                        onDropOnBlock={(col) => onDrop(row, col)}
                        dragging={!!drag}
                      />
                    )),
                  )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        <span>Glisser une session pour la déplacer (autre jour ou autre ligne).</span>
        <span>Double-cliquer une case vide pour créer une session.</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-2 border-red-500" /> conflit bloquant</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-2 border-dashed border-slate-400" /> brouillon</span>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  from,
  to,
  onDragStart,
  onDragEnd,
  onDropOnBlock,
  dragging,
}: {
  block: TimelineBlock;
  from: number;
  to: number;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDropOnBlock: (col: number) => void;
  dragging: boolean;
}) {
  const router = useRouter();
  const hasError = block.conflicts.some((c) => c.severity === "error");
  const hasWarning = block.conflicts.length > 0;
  const tooltip = [
    `${block.title} · ${block.subtitle}`,
    `${block.trainees} inscrit(s)`,
    ...block.roles.map((r) => roleLabel[r]),
    ...block.conflicts.map((c) => `⚠ ${c.message}`),
  ].join("\n");
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Déposer sur une autre session : on vise la colonne sous le curseur.
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        onDropOnBlock(from + Math.min(to - from, Math.floor(ratio * (to - from + 1))));
      }}
      onClick={() => router.push(`/sessions/${block.sessionId}`)}
      title={tooltip}
      style={{ gridColumn: `${from + 1} / ${to + 2}`, borderLeftColor: block.color, pointerEvents: dragging ? "none" : "auto" }}
      className={`z-[1] m-0.5 cursor-grab overflow-hidden rounded-md border border-l-4 bg-white px-2 py-1 text-xs shadow-sm hover:shadow active:cursor-grabbing ${
        hasError ? "border-red-500 ring-1 ring-red-300" : hasWarning ? "border-amber-400" : "border-slate-200"
      } ${block.status === "draft" ? "border-dashed bg-slate-50" : ""}`}
    >
      <div className="flex items-center gap-1 font-semibold" style={{ color: block.color }}>
        {block.title}
        {hasError && <span className="text-red-600" aria-label="Conflit">⚠</span>}
      </div>
      <div className="truncate text-slate-600">{block.subtitle}</div>
      <div className="text-[10px] text-slate-500">
        {block.trainees} inscrit{block.trainees > 1 ? "s" : ""}
        {block.roles.length > 0 && ` · ${block.roles.map((r) => roleLabel[r]).join(", ")}`}
      </div>
    </div>
  );
}
