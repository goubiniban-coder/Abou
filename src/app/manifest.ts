import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Optitam · Planning de formation",
    short_name: "Optitam",
    description: "Planning opérationnel pour organismes de formation",
    start_url: "/tableau-de-bord",
    display: "standalone",
    background_color: "#f6f9f2",
    theme_color: "#15873b",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
