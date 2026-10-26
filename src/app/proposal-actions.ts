"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema as t } from "@/db";
import { optionStarted, optionStillFree } from "@/domain";
import { requireAdmin } from "@/server/guard";
import { loadContext, saveSession } from "@/server/planning";
import { computeOptions, expiryFromToday, isExpired, nextQuoteNumber, proposalByToken } from "@/server/proposals";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/** Première échéance parmi les certificats des stagiaires pour cette formation. */
async function firstExpiry(courseId: string, traineeIds: string[]) {
  const certs = await db
    .select()
    .from(t.certifications)
    .where(and(eq(t.certifications.courseId, courseId), inArray(t.certifications.traineeId, traineeIds)));
  return certs.map((c) => c.validUntil).sort()[0] ?? new Date().toISOString().slice(0, 10);
}

/** Recyclages : calcule trois dates tenables pour un client et une formation, et prépare le lien à lui envoyer. */
export async function createProposal(f: FormData) {
  await requireAdmin();
  const ctx = await loadContext();
  const course = ctx.courses.find((c) => c.id === str(f, "courseId"));
  const siteId = str(f, "siteId") ?? ctx.sites[0]?.id;
  if (!course || !siteId) throw new Error("Formation ou site introuvable");
  const traineeIds = (str(f, "traineeIds") ?? "").split(",").filter(Boolean).slice(0, course.maxTrainees);
  if (traineeIds.length === 0) throw new Error("Aucun stagiaire");
  const options = computeOptions(course, siteId, traineeIds, await firstExpiry(course.id, traineeIds), ctx);
  if (options.length === 0) redirect(`/recyclages?error=nodate`);
  const [row] = await db
    .insert(t.proposals)
    .values({
      number: await nextQuoteNumber(),
      clientId: str(f, "clientId"),
      courseId: course.id,
      siteId,
      traineeIds,
      options,
      pricePerTrainee: course.pricePerTrainee ?? null,
      expiresOn: expiryFromToday(),
    })
    .returning();
  revalidatePath("/recyclages");
  redirect(`/recyclages/propositions/${row.id}`);
}

/** Recalcule les dates d'une proposition non acceptée, la rouvre et repousse son expiration. */
export async function refreshProposal(id: string) {
  await requireAdmin();
  const [p] = await db.select().from(t.proposals).where(eq(t.proposals.id, id));
  if (!p || p.status === "accepted") return;
  const ctx = await loadContext();
  const course = ctx.courses.find((c) => c.id === p.courseId)!;
  const options = computeOptions(course, p.siteId, p.traineeIds, await firstExpiry(p.courseId, p.traineeIds), ctx);
  await db.update(t.proposals).set({ options, status: "open", expiresOn: expiryFromToday() }).where(eq(t.proposals.id, id));
  revalidatePath(`/recyclages/propositions/${id}`);
}

export async function updateProposalPrice(id: string, f: FormData) {
  await requireAdmin();
  const price = str(f, "pricePerTrainee");
  await db
    .update(t.proposals)
    .set({ pricePerTrainee: price === null ? null : Math.max(0, Number.parseInt(price, 10) || 0) })
    .where(and(eq(t.proposals.id, id), eq(t.proposals.status, "open")));
  revalidatePath(`/recyclages/propositions/${id}`);
}

/**
 * Le client choisit une date depuis son lien. On réserve la proposition d'abord (une seule
 * acceptation possible), puis on revérifie que la date est toujours libre avant de créer la session.
 */
export async function acceptProposal(token: string, index: number, f: FormData) {
  const p = await proposalByToken(token);
  if (!p || p.status !== "open" || isExpired(p)) redirect(`/proposition/${token}`);
  const option = p.options[index];
  const name = str(f, "name")?.slice(0, 120);
  if (!option || !name || optionStarted(option, new Date())) redirect(`/proposition/${token}`);

  const claimed = await db
    .update(t.proposals)
    .set({ status: "accepted", chosenOption: index, acceptedBy: name, acceptedAt: new Date().toISOString() })
    .where(and(eq(t.proposals.id, p.id), eq(t.proposals.status, "open")))
    .returning();
  if (claimed.length === 0) redirect(`/proposition/${token}`);

  const ctx = await loadContext();
  const course = ctx.courses.find((c) => c.id === p.courseId)!;
  if (!optionStillFree(option, course, p.siteId, p.traineeIds, ctx)) {
    await db.update(t.proposals).set({ status: "open", chosenOption: null, acceptedBy: null, acceptedAt: null }).where(eq(t.proposals.id, p.id));
    redirect(`/proposition/${token}?taken=${index}`);
  }

  // Brouillon : le planificateur la confirme, mais ses ressources sont déjà réservées sur le planning.
  const sessionId = crypto.randomUUID();
  await saveSession({
    id: sessionId,
    courseId: p.courseId,
    siteId: p.siteId,
    mode: "inter",
    clientId: p.clientId ?? undefined,
    status: "draft",
    traineeIds: p.traineeIds,
    ...option,
  });
  await db.update(t.proposals).set({ sessionId }).where(eq(t.proposals.id, p.id));
  revalidatePath("/", "layout");
  redirect(`/proposition/${token}`);
}

export async function declineProposal(token: string) {
  const p = await proposalByToken(token);
  if (p?.status === "open") await db.update(t.proposals).set({ status: "declined" }).where(and(eq(t.proposals.id, p.id), eq(t.proposals.status, "open")));
  revalidatePath("/recyclages");
  redirect(`/proposition/${token}`);
}
