// Freine les essais de mot de passe en série depuis une même adresse.
// La mémoire est propre à chaque instance serverless : c'est un frein, pas une barrière.
// Une règle de limitation sur /login dans le pare-feu Vercel la complète.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const failures = new Map<string, { count: number; since: number }>();

export function isLocked(ip: string, now = Date.now()): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (now - entry.since > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(ip: string, now = Date.now()) {
  const entry = failures.get(ip);
  if (!entry || now - entry.since > WINDOW_MS) failures.set(ip, { count: 1, since: now });
  else entry.count++;
  // Évite que la table grossisse sans fin sous une attaque venant de nombreuses adresses.
  if (failures.size > 10_000) failures.delete(failures.keys().next().value!);
}

export function clearFailures(ip: string) {
  failures.delete(ip);
}

/** Adresse du client derrière le proxy Vercel. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "inconnue";
}
