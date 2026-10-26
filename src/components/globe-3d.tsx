"use client";

import { useEffect, useRef, useState } from "react";
import { BookGlobe } from "./book-globe";

// Globe de l'écran de connexion en vraie 3D (three.js, chargé à la demande) : sphère en plâtre
// à ceinture labyrinthe en relief, réseau géodésique, billes de plâtre et de verre, socle lumineux
// et livres en orbite. Tant que la 3D charge, ou sans WebGL, on affiche la version SVG.

export function Globe3D({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("./globe-scene")
      .then(({ mountGlobe }) => {
        if (cancelled) return;
        dispose = mountGlobe(el, () => setReady(true));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div className={`relative aspect-[400/470] ${className}`}>
      <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}>
        <BookGlobe className="w-full" />
      </div>
      <div ref={host} className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden />
    </div>
  );
}
