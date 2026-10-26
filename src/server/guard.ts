import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE, authEnabled, verifySessionToken } from "@/lib/auth";

/**
 * Les actions serveur sont joignables directement en POST : chacune vérifie la session
 * elle-même, sans compter sur le proxy.
 */
export async function requireAdmin() {
  if (!authEnabled()) return;
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!(await verifySessionToken(token))) throw new Error("Non autorisé");
}
