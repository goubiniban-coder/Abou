import Link from "next/link";
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white px-3 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <Link href="/planning" className="mb-3 block px-3 text-lg font-bold text-brand-700">
          Optitam
        </Link>
        <Nav />
        <div className="mt-6 hidden px-3 text-xs text-slate-500 md:block">
          <Link href="/accueil" className="hover:underline">Écran d&apos;accueil</Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
