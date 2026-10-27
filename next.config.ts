import type { NextConfig } from "next";

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

export default nextConfig;
