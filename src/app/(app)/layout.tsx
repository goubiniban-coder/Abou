import Link from "next/link";
import { Icon } from "@/components/icon";
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-brand-900 px-3 py-3 text-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:py-5">
        <Link href="/tableau-de-bord" className="mb-3 flex items-center gap-2 px-3 md:mb-6">
          <span className="grid size-8 place-items-center rounded-xl bg-accent-400 text-brand-900 shadow-sm">
            <Icon name="calendar" className="size-[18px]" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Opti<span className="text-accent-300">tam</span>
          </span>
        </Link>
        <Nav />
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
