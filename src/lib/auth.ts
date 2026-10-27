// Session d'administration signée (HMAC), utilisable dans le proxy comme côté serveur.

export const AUTH_COOKIE = "optitam_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

/** La clé de signature mêle AUTH_SECRET et le mot de passe : changer le mot de passe déconnecte toutes les sessions. */
async function hmac(value: string): Promise<string> {
  const secret = `${process.env.AUTH_SECRET ?? ""}\0${process.env.ADMIN_PASSWORD ?? ""}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(sig).toString("base64url");
}

/** Comparaison en temps constant, pour ne rien laisser deviner par la durée de la réponse. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Sans mot de passe configuré, l'application est ouverte, mais seulement en développement local :
 * en production, un mot de passe oublié verrouille l'accès au lieu de l'ouvrir à tous.
 */
export const authEnabled = () => Boolean(process.env.ADMIN_PASSWORD) || process.env.NODE_ENV === "production";

export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // On compare les empreintes, de même longueur, plutôt que les mots de passe eux-mêmes.
  return sameString(await hmac(`pw:${candidate}`), await hmac(`pw:${expected}`));
}

export async function createSessionToken(): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  return `${expires}.${await hmac(String(expires))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || !/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000) return false;
  return sameString(sig, await hmac(expires));
}

/** Page de retour après connexion : un chemin du site uniquement, jamais un autre domaine. */
export function safeNext(next: unknown, fallback = "/tableau-de-bord"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  // « /\exemple.com » est lu comme « //exemple.com » par les navigateurs.
  if (/[\\\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S };
