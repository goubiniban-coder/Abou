import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "@/lib/sentry";

// Remontée des erreurs du navigateur vers Sentry. Sans NEXT_PUBLIC_SENTRY_DSN, rien n'est envoyé.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  dataCollection: sentryDataCollection,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
