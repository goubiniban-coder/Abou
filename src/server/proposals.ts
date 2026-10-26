import "server-only";
import { eq, like } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { addDays, parisDay, proposeDates, searchWindow, type Course, type DateOption, type PlanningContext } from "@/domain";

export type Proposal = typeof t.proposals.$inferSelect;

/** Durée de validité d'une proposition envoyée au client. */
export const PROPOSAL_VALID_DAYS = 14;

/** Dates tenables pour recycler ces stagiaires avant la première de leurs échéances. */
export function computeOptions(course: Course, siteId: string, traineeIds: string[], firstExpiry: string, ctx: PlanningContext): DateOption[] {
  const today = parisDay(new Date().toISOString());
  return proposeDates({ course, siteId, traineeIds, ...searchWindow(today, firstExpiry) }, ctx);
}

/** Numéro de devis suivant pour l'année : DEV-2026-0001, DEV-2026-0002… */
export async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const rows = await db.select({ number: t.proposals.number }).from(t.proposals).where(like(t.proposals.number, `${prefix}%`));
  const last = Math.max(0, ...rows.map((r) => Number.parseInt(r.number.slice(prefix.length), 10) || 0));
  return `${prefix}${String(last + 1).padStart(4, "0")}`;
}

export const expiryFromToday = () => addDays(parisDay(new Date().toISOString()), PROPOSAL_VALID_DAYS);

export async function proposalByToken(token: string): Promise<Proposal | undefined> {
  const [p] = await db.select().from(t.proposals).where(eq(t.proposals.token, token));
  return p;
}

export const isExpired = (p: Proposal) => p.status === "open" && p.expiresOn < parisDay(new Date().toISOString());

/** Montants du devis. */
export function quote(p: Pick<Proposal, "pricePerTrainee" | "traineeIds">, vatRate: number) {
  const net = (p.pricePerTrainee ?? 0) * p.traineeIds.length;
  const vat = Math.round(net * vatRate) / 100;
  return { net, vat, gross: net + vat };
}

export const euros = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
