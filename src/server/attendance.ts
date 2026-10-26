import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema as t } from "@/db";
import type { AttendanceRecord, TestResult, TrainerSignature } from "@/domain";

const iso = (s: string) => new Date(s).toISOString();

export type AttendanceRow = AttendanceRecord & { signature?: string };
export type TrainerSignatureRow = TrainerSignature & { signature: string };

export interface SessionRecords {
  attendance: AttendanceRow[];
  trainerSignatures: TrainerSignatureRow[];
  results: TestResult[];
  /** Stagiaires qui ont déjà un certificat issu de cette session. */
  certified: string[];
}

/** Émargements, résultats et certificats d'une ou plusieurs sessions. */
export async function loadRecords(sessionIds: string[]): Promise<Map<string, SessionRecords>> {
  const out = new Map<string, SessionRecords>(sessionIds.map((id) => [id, { attendance: [], trainerSignatures: [], results: [], certified: [] }]));
  if (sessionIds.length === 0) return out;
  const [att, sigs, res, certs] = await Promise.all([
    db.select().from(t.attendance).where(inArray(t.attendance.sessionId, sessionIds)),
    db.select().from(t.trainerSignatures).where(inArray(t.trainerSignatures.sessionId, sessionIds)),
    db.select().from(t.testResults).where(inArray(t.testResults.sessionId, sessionIds)),
    db.select().from(t.certifications).where(inArray(t.certifications.sessionId, sessionIds)),
  ]);
  for (const a of att) {
    out.get(a.sessionId)!.attendance.push({ slotStart: iso(a.slotStart), traineeId: a.traineeId, presence: a.presence, signature: a.signature ?? undefined });
  }
  for (const s of sigs) out.get(s.sessionId)!.trainerSignatures.push({ slotStart: iso(s.slotStart), trainerId: s.trainerId, signature: s.signature });
  for (const r of res) {
    out.get(r.sessionId)!.results.push({
      traineeId: r.traineeId,
      theory: r.theory ?? undefined,
      theoryScore: r.theoryScore ?? undefined,
      practice: r.practice ?? undefined,
      categories: r.categories ?? undefined,
      comment: r.comment ?? undefined,
    });
  }
  for (const c of certs) if (c.sessionId) out.get(c.sessionId)!.certified.push(c.traineeId);
  return out;
}

export async function loadSessionRecords(sessionId: string): Promise<SessionRecords> {
  return (await loadRecords([sessionId])).get(sessionId)!;
}

export type Organization = typeof t.organization.$inferSelect;

export async function loadOrganization(): Promise<Organization> {
  const [org] = await db.select().from(t.organization).where(eq(t.organization.id, "main"));
  return org ?? { id: "main", name: "Organisme de formation", address: null, siret: null, nda: null, phone: null, email: null, signatory: null, vatRate: 20 };
}
