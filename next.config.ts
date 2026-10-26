import type { NextConfig } from "next";

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

export default nextConfig;
