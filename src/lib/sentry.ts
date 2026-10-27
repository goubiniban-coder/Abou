import type * as Sentry from "@sentry/nextjs";

type DataCollection = NonNullable<Parameters<typeof Sentry.init>[0]["dataCollection"]>;

// Optitam manipule des données de stagiaires (noms, signatures, résultats) : Sentry ne reçoit
// que l'erreur et sa pile, jamais les cookies, les corps de requête, les paramètres SQL ni
// les valeurs des variables.
export const sentryDataCollection: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
};
