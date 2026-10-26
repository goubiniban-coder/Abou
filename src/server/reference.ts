import "server-only";
import { asc } from "drizzle-orm";
import { db, schema as t } from "@/db";
import { loadContext } from "./planning";

/** Données de référence nécessaires au formulaire de session. */
export async function loadReference() {
  const [ctx, trainees, clients] = await Promise.all([
    loadContext(),
    db.select().from(t.trainees).orderBy(asc(t.trainees.lastName)),
    db.select().from(t.clients).orderBy(asc(t.clients.name)),
  ]);
  return {
    ctx,
    trainees: trainees.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, clientId: s.clientId })),
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}

export type Reference = Awaited<ReturnType<typeof loadReference>>;
