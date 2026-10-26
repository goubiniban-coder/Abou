"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

const groups: { title: string; links: { href: string; label: string; icon: IconName }[] }[] = [
  {
    title: "Piloter",
    links: [
      { href: "/tableau-de-bord", label: "Tableau de bord", icon: "home" },
      { href: "/planning", label: "Planning", icon: "calendar" },
      { href: "/sessions", label: "Sessions", icon: "layers" },
      { href: "/recyclages", label: "Recyclages", icon: "refresh" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { href: "/formateurs", label: "Formateurs", icon: "user" },
      { href: "/salles", label: "Salles", icon: "door" },
      { href: "/materiel", label: "Matériel", icon: "truck" },
      { href: "/formations", label: "Formations", icon: "book" },
      { href: "/stagiaires", label: "Stagiaires", icon: "users" },
    ],
  },
  {
    title: "Réglages",
    links: [
      { href: "/integrations", label: "API et agendas", icon: "plug" },
      { href: "/parametres", label: "Paramètres", icon: "gear" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
      {groups.map((g) => (
        <div key={g.title} className="flex gap-1 md:flex-col">
          <p className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wider text-brand-200/70 uppercase md:block">{g.title}</p>
          {g.links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`group flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition ${
                  active ? "bg-accent-400 font-semibold text-brand-900 shadow-sm" : "text-brand-50/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon name={l.icon} className={`size-[18px] transition group-hover:scale-110 ${active ? "" : "text-accent-300/90"}`} />
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
