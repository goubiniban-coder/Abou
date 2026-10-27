"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Dernier filet : une erreur qui casse toute l'application est signalée à Sentry
// et l'utilisateur voit un message plutôt qu'une page blanche.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Une erreur est survenue</h1>
        <p style={{ color: "#555", marginBottom: "1.5rem" }}>Elle a été signalée automatiquement. Vous pouvez réessayer.</p>
        <button onClick={reset} style={{ background: "#15873b", color: "white", border: 0, borderRadius: 8, padding: "0.6rem 1.2rem", cursor: "pointer" }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
