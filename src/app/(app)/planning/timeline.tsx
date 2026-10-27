"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import { moveSessionAction, type PlanningView } from "@/app/actions";
import { Icon } from "@/components/icon";
import { formatDay, roleLabel, statusLabel } from "@/lib/format";

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
      <div role="status" aria-live="polite">
        {message && (
          <div className={`flex items-center justify-between gap-2 px-4 py-1 text-sm font-medium ${message.tone === "ok" ? "bg-brand-100 text-brand-900" : message.tone === "warn" ? "bg-accent-100 text-amber-900" : "bg-red-50 text-red-800"}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="btn-ghost text-current" aria-label="Fermer le message">✕</button>
          </div>
        )}
      </div>
      <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
        <div className="min-w-[56rem]">
          {/* En-tête des jours */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-mint-100/70 text-xs">
            <div className="w-44 shrink-0 border-r border-slate-200 px-3 py-2 font-semibold text-brand-800">
              {view === "trainer" ? "Formateur" : view === "room" ? "Salle" : "Matériel"}
            </div>
            <div className="grid flex-1" style={{ gridTemplateColumns: gridTemplate }}>
              {days.map((d) => (
                <div key={d} className={`col-span-2 border-r border-slate-200 px-2 py-1 text-center ${d === today ? "bg-accent-200 font-bold text-brand-900" : "font-medium text-slate-700"}`}>
                  <div className="first-letter:uppercase">
                    {formatDay(d)}
                    {d === today && <span className="ml-1 rounded-full bg-brand-700 px-1.5 py-px text-[10px] text-white">aujourd&apos;hui</span>}
                  </div>
                  <div className="flex justify-around text-[11px] font-normal text-slate-600" aria-hidden><span>matin</span><span>après-midi</span></div>
                </div>
              ))}
            </div>
          </div>

          {rows.map((row) => {
            const rowBlocks = blocks.filter((b) => b.resourceId === row.id);
            return (
              <div key={row.id ?? "none"} className="flex border-b border-slate-100">
                <div className="w-44 shrink-0 border-r border-slate-200 px-3 py-2">
                  <div className="truncate text-sm font-semibold">{row.label}</div>
                  {row.sub && <div className="truncate text-xs text-slate-600">{row.sub}</div>}
                </div>
                <div className="relative flex-1">
                  {/* Cellules de fond : cibles du glisser-déposer */}
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: gridTemplate }}>
                  {Array.from({ length: cols }, (_, c) => {
                    const id = `${row.id}:${c}`;
                    return (
                      <div
                        key={c}
                        className={`border-r ${c % 2 ? "border-slate-200" : "border-slate-100 border-dashed"} ${days[Math.floor(c / 2)] === today ? "bg-accent-100/50" : ""} ${hover === id ? "bg-brand-100 ring-2 ring-brand-400 ring-inset" : ""}`}
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 bg-mint-50 px-4 py-2 text-xs text-slate-600">
        <span>Glisser une session pour la déplacer (autre jour ou autre ligne).</span>
        <span>Double-cliquer une case vide pour créer une session.</span>
        <span>Au clavier : Tab puis Entrée ouvre la session, où l&apos;on change dates et ressources.</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm border-2 border-red-500" aria-hidden /> conflit bloquant</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm border-2 border-dashed border-slate-500" aria-hidden /> brouillon</span>
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
  const hasError = block.conflicts.some((c) => c.severity === "error");
  const hasWarning = block.conflicts.length > 0;
  const draft = block.status === "draft";
  const tooltip = [
    `${block.title} · ${block.subtitle}`,
    `${block.trainees} inscrit(s)`,
    ...block.roles.map((r) => roleLabel[r]),
    ...block.conflicts.map((c) => `⚠ ${c.message}`),
  ].join("\n");
  return (
    // Un lien : la session s'ouvre aussi au clavier (Tab puis Entrée).
    <Link
      href={`/sessions/${block.sessionId}`}
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
      title={tooltip}
      style={{
        gridColumn: `${from + 1} / ${to + 2}`,
        borderLeftColor: block.color,
        backgroundColor: draft ? undefined : `color-mix(in srgb, ${block.color} 9%, white)`,
        pointerEvents: dragging ? "none" : "auto",
      }}
      className={`z-[1] m-0.5 block cursor-grab overflow-hidden rounded-lg border border-l-4 px-2 py-1 text-xs shadow-sm transition hover:-translate-y-px hover:shadow-md active:cursor-grabbing ${
        hasError ? "border-red-500 ring-1 ring-red-300" : hasWarning ? "border-accent-500" : "border-slate-200"
      } ${draft ? "border-dashed bg-white" : ""}`}
    >
      <span className="flex items-center gap-1 font-bold text-slate-900">
        {block.title}
        {draft && <span className="rounded-full bg-accent-200 px-1.5 text-[10px] font-semibold text-brand-900">{statusLabel.draft}</span>}
        {hasError && (
          <>
            <Icon name="alert" className="size-3.5 text-red-600" />
            <span className="sr-only">, conflit bloquant</span>
          </>
        )}
      </span>
      <span className="block truncate text-slate-700">{block.subtitle}</span>
      <span className="block text-[11px] text-slate-600">
        {block.trainees} inscrit{block.trainees > 1 ? "s" : ""}
        {block.roles.length > 0 && ` · ${block.roles.map((r) => roleLabel[r]).join(", ")}`}
      </span>
    </Link>
  );
}
