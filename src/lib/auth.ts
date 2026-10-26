// Session d'administration signée (HMAC), utilisable dans le proxy comme côté serveur.

export const AUTH_COOKIE = "optitam_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

async function hmac(value: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(sig).toString("base64url");
}

/** Sans mot de passe configuré, l'application est ouverte (développement local). */
export const authEnabled = () => Boolean(process.env.ADMIN_PASSWORD);

export async function createSessionToken(): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  return `${expires}.${await hmac(String(expires))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  return sig === (await hmac(expires));
}

export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S };
