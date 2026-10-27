import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "@/lib/sentry";

// Remontée des erreurs serveur (pages, actions, routes d'API, proxy) vers Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      dataCollection: sentryDataCollection,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
