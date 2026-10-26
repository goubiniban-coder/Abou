import type { Metadata, Viewport } from "next";
import "./globals.css";

// Toutes les pages lisent la base à chaque requête.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Abou", template: "%s · Abou" },
  description: "Planning opérationnel pour organismes de formation",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#1f57c3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
