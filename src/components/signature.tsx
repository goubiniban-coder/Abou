"use client";

import { useRef, useState } from "react";
import { SIGNATURE_VIEWBOX } from "@/domain/attendance";

const W = 300;
const H = 100;

/** Zone de signature au doigt ou au stylet. Le tracé est rendu en SVG (commandes M et L). */
export function SignaturePad({ onCancel, onConfirm, pending }: { onCancel: () => void; onConfirm: (path: string) => void; pending?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const [path, setPath] = useState("");

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    return `${Math.max(0, Math.min(W, x)).toFixed(1)} ${Math.max(0, Math.min(H, y)).toFixed(1)}`;
  };

  return (
    <div>
      <svg
        ref={ref}
        viewBox={SIGNATURE_VIEWBOX}
        role="img"
        aria-label={path ? "Signature tracée" : "Zone de signature : signez avec le doigt ou un stylet"}
        className="aspect-[3/1] w-full touch-none rounded-xl border-2 border-dashed border-brand-300 bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          setPath((p) => `${p} M${point(e)}`.trim());
        }}
        onPointerMove={(e) => {
          if (drawing.current) setPath((p) => `${p} L${point(e)}`);
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerCancel={() => (drawing.current = false)}
      >
        <path d={path} fill="none" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {!path && (
          <text x={W / 2} y={H / 2 + 5} textAnchor="middle" className="fill-slate-500 text-[14px] select-none">
            Signez ici
          </text>
        )}
      </svg>
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn-secondary min-h-11" onClick={onCancel}>Annuler</button>
        <button type="button" className="btn-secondary min-h-11" onClick={() => setPath("")} disabled={!path}>Effacer</button>
        <button type="button" className="btn-primary ml-auto min-h-11" disabled={!path.includes("L") || pending} onClick={() => onConfirm(path)}>
          {pending ? "Enregistrement…" : "Valider la signature"}
        </button>
      </div>
    </div>
  );
}
