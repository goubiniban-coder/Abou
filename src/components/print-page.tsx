import type { ReactNode } from "react";
import type { Organization } from "@/server/attendance";

/** Une page A4 ; chaque page commence sur une nouvelle feuille à l'impression. */
export function PrintPage({ org, children }: { org: Organization; children: ReactNode }) {
  return (
    <article className="mx-auto mb-6 flex min-h-[297mm] w-[210mm] max-w-full flex-col bg-white p-[15mm] text-[13px] leading-relaxed shadow print:m-0 print:min-h-0 print:w-auto print:break-after-page print:p-0 print:shadow-none">
      <header className="mb-6 border-b border-slate-300 pb-2">
        <p className="text-base font-bold">{org.name}</p>
        {org.address && <p className="text-xs text-slate-600">{org.address}</p>}
        <p className="text-xs text-slate-600">{[org.phone, org.email].filter(Boolean).join(" · ")}</p>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mt-6 border-t border-slate-300 pt-2 text-center text-[10px] text-slate-500">
        {[org.name, org.siret && `SIRET ${org.siret}`, org.nda && `Déclaration d'activité n° ${org.nda}`].filter(Boolean).join(" · ")}
      </footer>
    </article>
  );
}
