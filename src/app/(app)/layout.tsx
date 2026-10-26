import Link from "next/link";
import { Icon } from "@/components/icon";
import { Nav } from "@/components/nav";
import { logout } from "@/app/auth-actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-gradient-to-b from-brand-700 via-brand-600 to-brand-500 px-3 py-3 text-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:py-5">
        <div className="mb-3 flex items-center md:mb-6">
          <Link href="/tableau-de-bord" className="flex items-center gap-2 px-3">
            <span className="grid size-8 place-items-center rounded-xl bg-accent-400 text-brand-900 shadow-sm">
              <Icon name="calendar" className="size-[18px]" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Opti<span className="text-accent-300">tam</span>
            </span>
          </Link>
          <form action={logout} className="ml-auto md:hidden">
            <button className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-white/90 hover:bg-white/15" aria-label="Se déconnecter">
              <Icon name="logout" className="size-[18px] text-accent-300" />
            </button>
          </form>
        </div>
        <Nav />
        <form action={logout} className="mt-auto hidden pt-6 md:block">
          <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/90 transition hover:bg-white/15 hover:text-white">
            <Icon name="logout" className="size-[18px] text-accent-300" /> Se déconnecter
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
