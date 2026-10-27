import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authEnabled, checkPassword, createSessionToken, safeNext, verifySessionToken } from "./auth";
import { clearFailures, isLocked, recordFailure } from "./login-throttle";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "mot-de-passe");
  vi.stubEnv("AUTH_SECRET", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("session d'administration", () => {
  it("accepte un cookie signé et refuse un cookie modifié", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
    const [expires, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(expires) + 1}.${sig}`)).toBe(false);
  });

  it("fonctionne sans AUTH_SECRET", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("déconnecte tout le monde quand le mot de passe change", async () => {
    const token = await createSessionToken();
    vi.stubEnv("ADMIN_PASSWORD", "nouveau");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("vérifie le mot de passe", async () => {
    expect(await checkPassword("mot-de-passe")).toBe(true);
    expect(await checkPassword("mot-de-pass")).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(await checkPassword("")).toBe(false);
  });

  it("reste verrouillée en production sans mot de passe", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(authEnabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(authEnabled()).toBe(false);
  });
});

describe("page de retour après connexion", () => {
  it("garde les chemins du site", () => {
    expect(safeNext("/planning?semaine=2026-10-26")).toBe("/planning?semaine=2026-10-26");
  });
  it("refuse les autres domaines", () => {
    for (const bad of ["https://exemple.com", "//exemple.com", "/\\exemple.com", "/\t/exemple.com", undefined]) {
      expect(safeNext(bad)).toBe("/tableau-de-bord");
    }
  });
});

describe("frein aux essais de mot de passe", () => {
  it("bloque après 5 échecs pendant 15 minutes", () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) recordFailure("1.2.3.4", now);
    expect(isLocked("1.2.3.4", now)).toBe(true);
    expect(isLocked("5.6.7.8", now)).toBe(false);
    expect(isLocked("1.2.3.4", now + 16 * 60 * 1000)).toBe(false);
    clearFailures("1.2.3.4");
  });
});
