import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Le planning affiche des données qui changent à chaque instant : toutes les pages
// sont rendues à la demande (voir `dynamic` dans src/app/layout.tsx), sans Cache Components.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Empêche d'afficher Optitam dans le cadre d'un autre site (détournement de clics).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Les liens formateur et client portent un jeton : il ne doit pas partir vers d'autres sites.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
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
