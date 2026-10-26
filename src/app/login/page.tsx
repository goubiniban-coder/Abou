import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BookGlobe } from "@/components/book-globe";
import { Icon, type IconName } from "@/components/icon";
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

const TITLE = ["Planifiez.", "Formez.", "Certifiez."];

const PROMISES: { icon: IconName; label: string }[] = [
  { icon: "calendar", label: "Planning sans conflit" },
  { icon: "pen", label: "Émargement sur mobile" },
  { icon: "refresh", label: "Recyclages proposés aux clients" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <div className="min-h-screen bg-mint-50">
      {/* Accueil : fond coupé en deux, comme une scène, avec le globe à cheval sur la coupure */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 hidden w-[33%] bg-gradient-to-b from-brand-800 to-brand-900 lg:block" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-brand-800 to-brand-900 lg:hidden" aria-hidden />

        <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-5 py-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-accent-400 text-brand-900 shadow-sm">
            <Icon name="calendar" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white lg:text-brand-800">
            Opti<span className="text-accent-400 lg:text-accent-500">tam</span>
          </span>
          <a href="#a-propos" className="ml-auto rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/10">
            À propos
          </a>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-5 pb-14 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[1fr_1.05fr] lg:pb-10">
          <div className="order-2 lg:order-1">
            <h1 className="text-5xl leading-[0.95] font-extrabold tracking-tight text-brand-900 md:text-7xl">
              {TITLE.map((word, i) => (
                <span key={word} className="rise block" style={{ animationDelay: `${i * 120}ms` }}>
                  {i === TITLE.length - 1 ? <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">{word}</span> : word}
                </span>
              ))}
            </h1>
            <p className="rise mt-5 max-w-md text-lg text-slate-600" style={{ animationDelay: "400ms" }}>
              Le planning des organismes de formation qui se tient tout seul : formateurs, salles, engins et CACES, sans un seul conflit.
            </p>

            <form action={login} className="rise card mt-7 flex max-w-md flex-col gap-3 p-4 sm:flex-row sm:items-end" style={{ animationDelay: "520ms" }}>
              <input type="hidden" name="next" value={typeof next === "string" ? next : "/tableau-de-bord"} />
              <label className="block flex-1">
                <span className="label">Mot de passe</span>
                <input type="password" name="password" required className="input" />
              </label>
              <button className="btn-primary py-2.5">
                Se connecter <Icon name="arrow" className="size-4" />
              </button>
            </form>
            {error && <p className="mt-3 max-w-md rounded-xl bg-red-50 p-2.5 text-sm text-red-700">Mot de passe incorrect.</p>}

            <ul className="rise mt-6 flex max-w-md flex-wrap gap-2" style={{ animationDelay: "640ms" }}>
              {PROMISES.map((p) => (
                <li key={p.label} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm ring-1 ring-mint-200">
                  <Icon name={p.icon} className="size-4 text-brand-500" /> {p.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 lg:order-2">
            <BookGlobe className="mx-auto w-[min(88vw,340px)] lg:w-full lg:max-w-[540px]" />
          </div>
        </div>
      </section>

      {/* À propos */}
      <section id="a-propos" className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-bold tracking-widest text-brand-600 uppercase">À propos d&apos;Optitam</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-900 md:text-4xl">
              Le planning sur lequel les centres de formation s&apos;appuient.
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              Des centaines de sessions, <span className="font-bold text-brand-700">zéro conflit</span>.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ["alert", "Conflits détectés", "Formateur, salle, engin ou testeur déjà pris : Optitam le voit avant vous."],
              ["pen", "Émargement mobile", "Les stagiaires signent sur le téléphone du formateur, créneau par créneau."],
              ["refresh", "Recyclages CACES", "Trois dates tenables proposées au client, qui choisit en un clic."],
              ["book", "Documents prêts", "Convocations, feuilles d'émargement, attestations et devis générés."],
            ].map(([icon, title, text]) => (
              <li key={title} className="rounded-2xl bg-mint-50 p-4 ring-1 ring-mint-200">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-400 text-brand-900"><Icon name={icon as IconName} className="size-[18px]" /></span>
                <p className="mt-2 font-bold text-brand-900">{title}</p>
                <p className="text-sm text-slate-600">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
