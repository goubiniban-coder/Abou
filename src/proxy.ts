import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, verifySessionToken } from "@/lib/auth";

// Pages ouvertes sans connexion : elles ont leur propre protection (jeton personnel ou clé d'API).
// /monitoring relaie les erreurs du navigateur vers Sentry (voir next.config.ts).
const PUBLIC = [/^\/login/, /^\/monitoring/, /^\/formateur\//, /^\/proposition\//, /^\/api\/calendar\//, /^\/api\/v1\//, /^\/api\/openapi/, /^\/manifest\.webmanifest$/, /^\/icon\.svg$/];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!authEnabled() || PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
