"use server";

import { requireAdmin } from "@/server/guard";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as t } from "@/db";
import { createApiKey } from "@/server/api";

export async function createApiKeyAction(_prev: { key: string } | null, form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim() || "Sans nom";
  const key = await createApiKey(name);
  revalidatePath("/integrations");
  return { key };
}

export async function revokeApiKeyAction(id: string) {
  await requireAdmin();
  await db.delete(t.apiKeys).where(eq(t.apiKeys.id, id));
  revalidatePath("/integrations");
}
