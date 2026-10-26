"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/planning", label: "Planning" },
  { href: "/sessions", label: "Sessions" },
  { href: "/recyclages", label: "Recyclages" },
  { href: "/formateurs", label: "Formateurs" },
  { href: "/salles", label: "Salles" },
  { href: "/materiel", label: "Matériel" },
  { href: "/formations", label: "Formations" },
  { href: "/stagiaires", label: "Stagiaires" },
  { href: "/integrations", label: "API et agendas" },
  { href: "/parametres", label: "Paramètres" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-md px-3 py-2 text-sm whitespace-nowrap ${active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
