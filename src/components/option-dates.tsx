import { parisDay, type DateOption } from "@/domain";
import { formatDay, formatTime } from "@/lib/format";

/** Jours d'une date proposée, avec les horaires de chaque jour. */
export function OptionDates({ option }: { option: DateOption }) {
  const days = new Map<string, DateOption["slots"]>();
  for (const s of option.slots) days.set(parisDay(s.start), [...(days.get(parisDay(s.start)) ?? []), s]);
  return (
    <ul className="space-y-0.5">
      {[...days].map(([day, slots]) => (
        <li key={day}>
          <span className="font-medium first-letter:uppercase">{formatDay(day, { weekday: "long", day: "numeric", month: "long" })}</span>
          <span className="text-slate-500"> · {slots.map((s) => `${formatTime(s.start)}–${formatTime(s.end)}`).join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

/** « du lundi 9 au mercredi 11 novembre » */
export function optionPeriod(option: DateOption) {
  const starts = option.slots.map((s) => s.start).sort();
  const first = parisDay(starts[0]);
  const last = parisDay(starts.at(-1)!);
  const long = { weekday: "long", day: "numeric", month: "long" } as const;
  return first === last ? `le ${formatDay(first, long)}` : `du ${formatDay(first, long)} au ${formatDay(last, long)}`;
}
