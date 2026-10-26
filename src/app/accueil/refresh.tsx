"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit l'écran d'accueil toutes les 5 minutes. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5 * 60_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
