import { isValidSignature, SIGNATURE_VIEWBOX } from "@/domain";

/** Affiche une signature enregistrée. Un tracé invalide n'est jamais rendu. */
export function SignatureImage({ path, className = "h-8 w-24" }: { path?: string | null; className?: string }) {
  if (!path || !isValidSignature(path)) return null;
  return (
    <svg viewBox={SIGNATURE_VIEWBOX} className={className} aria-label="Signature">
      <path d={path} fill="none" stroke="#0f172a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
