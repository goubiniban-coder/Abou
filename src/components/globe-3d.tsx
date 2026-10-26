"use client";

import { useEffect, useRef, useState } from "react";
import { BookGlobe } from "./book-globe";

// Globe de l'écran de connexion en vraie 3D (three.js, chargé à la demande) : sphère en plâtre
// à ceinture labyrinthe en relief, réseau géodésique, billes de plâtre et de verre, socle lumineux
// et livres en orbite. Pendant le chargement, seul un halo s'affiche ; la version SVG ne sert
// que si le navigateur ne sait pas faire de 3D.

type State = "loading" | "ready" | "fallback";

export function Globe3D({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dispose: (() => void) | null = null;
    let cancelled = false;
    import("./globe-scene")
      .then(({ mountGlobe }) => {
        if (cancelled) return;
        dispose = mountGlobe(el, () => setState("ready"));
        if (!dispose) setState("fallback");
      })
      .catch(() => !cancelled && setState("fallback"));
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div className={`relative aspect-[400/470] ${className}`}>
      {state === "loading" && (
        <div className="absolute inset-x-[18%] top-[16%] aspect-square animate-pulse rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.55),rgba(200,236,181,.25)_55%,transparent_70%)]" aria-hidden />
      )}
      {state === "fallback" && <BookGlobe className="w-full" />}
      <div ref={host} className={`absolute inset-0 transition-opacity duration-700 ${state === "ready" ? "opacity-100" : "opacity-0"}`} aria-hidden />
    </div>
  );
}
