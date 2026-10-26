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

export const TIME_ZONE = "Europe/Paris";

/** Décalage horaire de Paris (« +01:00 » ou « +02:00 ») à une date donnée. */
function parisOffset(date: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = name?.replace("GMT", "") ?? "";
  return offset === "" ? "+00:00" : offset;
}

/** Date ISO correspondant à une heure de Paris : parisTime("2026-11-03", "08:30"). */
export function parisTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00${parisOffset(date)}`).toISOString();
}

/** Jour calendaire à Paris d'un instant ISO. */
export function parisDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}

/** Lundi de la semaine qui contient `date`. */
export function mondayOf(date: string): string {
  const d = new Date(`${dayOf(date)}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  return addDays(dayOf(date), -shift);
}

/** « 2026-11-03 » → « mardi 3 novembre 2026 ». */
export function frenchDay(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${dayOf(date)}T12:00:00Z`),
  );
}
