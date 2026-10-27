import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Le planning affiche des données qui changent à chaque instant : toutes les pages
// sont rendues à la demande (voir `dynamic` dans src/app/layout.tsx), sans Cache Components.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Sentry : l'envoi des source maps n'a lieu que si SENTRY_AUTH_TOKEN, SENTRY_ORG et
// SENTRY_PROJECT sont définis (sur Vercel). Sans eux, le build passe sans rien envoyer.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Les erreurs du navigateur passent par /monitoring pour ne pas être bloquées par les bloqueurs de pub.
  tunnelRoute: "/monitoring",
});
