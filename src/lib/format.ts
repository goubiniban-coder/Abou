import { TIME_ZONE } from "@/domain";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, ...opts });

export const formatTime = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const formatDate = (iso: string) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
export const formatLongDate = (iso: string) => fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
/** Jour sans heure (« 2026-11-03 ») : affiché tel quel, sans conversion de fuseau. */
export const formatDay = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(new Date(`${day}T12:00:00Z`));

export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

export const roleLabel = { theory: "Théorie", practice: "Pratique", tester: "Testeur" } as const;
export const slotKindLabel = { theory: "Théorie", practice: "Pratique", test: "Test" } as const;
export const statusLabel = { draft: "Brouillon", confirmed: "Confirmée", cancelled: "Annulée" } as const;
