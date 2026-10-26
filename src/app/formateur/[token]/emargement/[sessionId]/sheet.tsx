"use client";

import { useState, useTransition } from "react";
import { clearAttendance, markAbsent, signAsTrainer, signAttendance } from "@/app/attendance-actions";
import { SignaturePad } from "@/components/signature";
import { SignatureImage } from "@/components/signature-image";

export interface SheetRow {
  id: string;
  name: string;
  presence?: "present" | "absent";
  signature?: string;
}

/** Feuille d'émargement d'un créneau, sur le téléphone du formateur. */
export function Sheet({
  token,
  sessionId,
  slotStart,
  rows,
  trainerName,
  trainerSignature,
}: {
  token: string;
  sessionId: string;
  slotStart: string;
  rows: SheetRow[];
  trainerName: string;
  trainerSignature?: string;
}) {
  const [signing, setSigning] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const closed = Boolean(trainerSignature);
  const missing = rows.filter((r) => !r.presence).length;

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        setSigning(null);
      } catch {
        setError("L'enregistrement a échoué. Vérifiez la connexion et réessayez.");
      }
    });

  return (
    <div className="space-y-3">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <ul className="card divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="p-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{r.name}</span>
              <span className="ml-auto">
                {r.presence === "present" && <SignatureImage path={r.signature} className="h-8 w-24" />}
                {r.presence === "absent" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Absent</span>}
              </span>
            </div>
            {signing === r.id ? (
              <div className="mt-2">
                <p className="mb-1 text-xs text-slate-500">Tendez le téléphone au stagiaire : {r.name}.</p>
                <SignaturePad pending={pending} onCancel={() => setSigning(null)} onConfirm={(path) => run(() => signAttendance(token, sessionId, slotStart, r.id, path))} />
              </div>
            ) : (
              !closed && (
                <div className="mt-2 flex gap-2">
                  {r.presence ? (
                    <button className="btn-secondary text-xs" disabled={pending} onClick={() => run(() => clearAttendance(token, sessionId, slotStart, r.id))}>
                      Corriger
                    </button>
                  ) : (
                    <>
                      <button className="btn-primary flex-1" disabled={pending} onClick={() => setSigning(r.id)}>Faire signer</button>
                      <button className="btn-secondary" disabled={pending} onClick={() => run(() => markAbsent(token, sessionId, slotStart, r.id))}>Absent</button>
                    </>
                  )}
                </div>
              )
            )}
          </li>
        ))}
      </ul>

      <section className="card p-3">
        <h2 className="mb-1 text-sm font-semibold">Signature du formateur</h2>
        {closed ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <SignatureImage path={trainerSignature} className="h-10 w-32" />
            <span>Feuille close par {trainerName}.</span>
          </div>
        ) : signing === "trainer" ? (
          <SignaturePad pending={pending} onCancel={() => setSigning(null)} onConfirm={(path) => run(() => signAsTrainer(token, sessionId, slotStart, path))} />
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">
              {missing > 0 ? `Encore ${missing} stagiaire${missing > 1 ? "s" : ""} à faire signer ou à déclarer absent${missing > 1 ? "s" : ""}.` : "Tous les stagiaires sont pointés. Signez pour clore la feuille."}
            </p>
            <button className="btn-primary w-full" disabled={missing > 0 || pending} onClick={() => setSigning("trainer")}>Signer et clore la feuille</button>
          </>
        )}
      </section>
    </div>
  );
}
