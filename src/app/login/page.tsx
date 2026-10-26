import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, cookieOptions, createSessionToken } from "@/lib/auth";

export const metadata = { title: "Connexion" };

async function login(form: FormData) {
  "use server";
  const next = String(form.get("next") || "/planning");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/planning";
  if (String(form.get("password") ?? "") !== process.env.ADMIN_PASSWORD) redirect(`/login?error=1&next=${encodeURIComponent(safeNext)}`);
  (await cookies()).set(AUTH_COOKIE, await createSessionToken(), cookieOptions);
  redirect(safeNext);
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-bold text-brand-700">Abou</h1>
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/planning"} />
        <label className="block">
          <span className="label">Mot de passe</span>
          <input type="password" name="password" required autoFocus className="input" />
        </label>
        {error && <p className="text-sm text-red-700">Mot de passe incorrect.</p>}
        <button className="btn-primary w-full">Se connecter</button>
      </form>
    </div>
  );
}
