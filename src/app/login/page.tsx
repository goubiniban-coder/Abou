import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icon";
import { AUTH_COOKIE, cookieOptions, createSessionToken } from "@/lib/auth";

export const metadata = { title: "Connexion" };

async function login(form: FormData) {
  "use server";
  const next = String(form.get("next") || "/tableau-de-bord");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/tableau-de-bord";
  if (String(form.get("password") ?? "") !== process.env.ADMIN_PASSWORD) redirect(`/login?error=1&next=${encodeURIComponent(safeNext)}`);
  (await cookies()).set(AUTH_COOKIE, await createSessionToken(), cookieOptions);
  redirect(safeNext);
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-400 via-brand-600 to-brand-800 p-4">
      <div className="absolute -top-24 -left-24 size-80 rounded-full bg-accent-400/20 blur-3xl" aria-hidden />
      <div className="absolute -right-20 -bottom-28 size-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <form action={login} className="card relative w-full max-w-sm space-y-5 p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-accent-400 text-brand-900 shadow-sm">
            <Icon name="calendar" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-brand-800">
              Opti<span className="text-accent-500">tam</span>
            </h1>
            <p className="text-xs text-slate-500">Le planning de formation qui se tient tout seul</p>
          </div>
        </div>
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/tableau-de-bord"} />
        <label className="block">
          <span className="label">Mot de passe</span>
          <input type="password" name="password" required autoFocus className="input" />
        </label>
        {error && <p className="rounded-xl bg-red-50 p-2.5 text-sm text-red-700">Mot de passe incorrect.</p>}
        <button className="btn-primary w-full py-2.5">Se connecter</button>
      </form>
    </div>
  );
}
