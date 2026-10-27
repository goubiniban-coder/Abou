import Link from "next/link";
import type { ReactNode } from "react";
import { deleteEntity, deleteUnavailability, addUnavailability } from "@/app/ref-actions";
import type { ResourceType, Unavailability } from "@/domain";
import { formatDate, formatTime } from "@/lib/format";

export function PageHeader({ title, action, children }: { title: ReactNode; action?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-extrabold tracking-tight">
        {title}
        <span className="mt-1 block h-1.5 w-10 rounded-full bg-accent-400" aria-hidden />
      </h1>
      {children}
      {action && <Link href={action.href} className="btn-primary ml-auto">{action.label}</Link>}
    </div>
  );
}

/** Code de formation précédé de sa pastille de couleur. Le texte reste foncé : la couleur seule n'est pas assez contrastée. */
export function CourseTag({ code, color, className = "" }: { code?: string; color?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-slate-900 ${className}`}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color ?? "#64748b" }} aria-hidden />
      {code}
    </span>
  );
}

/** Pastille de gravité d'un conflit, avec son nom pour les lecteurs d'écran. */
export function SeverityDot({ severity }: { severity: "error" | "warning" }) {
  return (
    <>
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${severity === "error" ? "bg-red-500" : "bg-accent-500"}`} aria-hidden />
      <span className="sr-only">{severity === "error" ? "Bloquant :" : "À vérifier :"}</span>
    </>
  );
}

export const statusTone = { draft: "amber", confirmed: "green", cancelled: "slate" } as const;

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-mint-100/70 text-left text-xs text-brand-800">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-slate-100 [&>tr]:transition [&>tr:hover]:bg-mint-50 [&_td]:px-3 [&_td]:py-2.5">{children}</tbody>
      </table>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "red" | "amber" | "green" | "blue" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-800",
    amber: "bg-accent-100 text-amber-800",
    green: "bg-brand-100 text-brand-800",
    blue: "bg-brand-100 text-brand-700",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function DeleteButton({ kind, id, back, list }: { kind: string; id: string; back: string; list: string }) {
  return (
    <form action={deleteEntity}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="list" value={list} />
      <button className="btn-danger">Supprimer</button>
    </form>
  );
}

export function UsedError({ error }: { error?: string | string[] }) {
  return error === "used" ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">Suppression impossible : cet élément est utilisé par des sessions.</p> : null;
}

export function Unavailabilities({ type, id, items, back, since }: { type: ResourceType; id: string; items: Unavailability[]; back: string; since: string }) {
  const upcoming = items.filter((u) => u.resourceType === type && u.resourceId === id && u.end >= since).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-semibold">Indisponibilités</h2>
      <ul className="mb-3 space-y-1 text-sm">
        {upcoming.length === 0 && <li className="text-slate-500">Aucune indisponibilité à venir.</li>}
        {upcoming.map((u) => (
          <li key={u.id} className="flex items-center gap-2">
            <span>
              Du {formatDate(u.start)} {formatTime(u.start)} au {formatDate(u.end)} {formatTime(u.end)}
              {u.reason && <span className="text-slate-500"> · {u.reason}</span>}
            </span>
            <form action={deleteUnavailability} className="ml-auto">
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="back" value={back} />
              <button className="btn-ghost text-xs hover:text-red-700">Retirer</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addUnavailability} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="resourceType" value={type} />
        <input type="hidden" name="resourceId" value={id} />
        <input type="hidden" name="back" value={back} />
        <Field label="Du"><input type="date" name="from" required className="input" /></Field>
        <Field label="Au (inclus)"><input type="date" name="to" className="input" /></Field>
        <Field label="Période">
          <select name="period" className="input">
            <option value="day">Journées entières</option>
            <option value="morning">Matin</option>
            <option value="afternoon">Après-midi</option>
          </select>
        </Field>
        <Field label="Motif"><input name="reason" className="input" placeholder="Congés, maintenance…" /></Field>
        <button className="btn-secondary">Ajouter</button>
      </form>
    </section>
  );
}
