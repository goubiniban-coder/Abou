import type { Interval } from "./types";

const ms = (iso: string) => Date.parse(iso);

export function overlaps(a: Interval, b: Interval): boolean {
  return ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end);
}

/** Jour calendaire local d'une date ISO (« 2026-11-02T08:30:00+01:00 » → « 2026-11-02 »). */
export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function isBefore(a: string, b: string): boolean {
  return ms(a) < ms(b);
}

export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = dayOf(isoDate).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const t = new Date(`${dayOf(isoDate)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((ms(`${dayOf(toDate)}T00:00:00Z`) - ms(`${dayOf(fromDate)}T00:00:00Z`)) / 86_400_000);
}

/** Enveloppe d'une liste d'intervalles : du premier début à la dernière fin. */
export function span(intervals: Interval[]): Interval | undefined {
  if (intervals.length === 0) return undefined;
  let start = intervals[0].start;
  let end = intervals[0].end;
  for (const i of intervals) {
    if (isBefore(i.start, start)) start = i.start;
    if (isBefore(end, i.end)) end = i.end;
  }
  return { start, end };
}
