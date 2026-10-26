import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Optitam · Planning de formation",
    short_name: "Optitam",
    description: "Planning opérationnel pour organismes de formation",
    start_url: "/planning",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1f57c3",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
