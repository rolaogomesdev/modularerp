import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session.
const PUBLIC_PATHS = new Set(["/login", "/signup", "/design"]);

/**
 * Session + AAL2 enforcement (02-tenancy-and-identity.md):
 *  - no session            -> /login
 *  - aal1, no factor       -> forced 2FA enrollment (/2fa/enroll) — only reachable screen
 *  - aal1, factor enrolled -> 2FA challenge (/2fa/challenge) — only reachable screen
 *  - aal2                  -> app (auth screens redirect home)
 * This is UX routing; the real enforcement is RLS (company data requires aal2).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Also refreshes an expired session (writes new cookies onto the response).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const redirectResponse = NextResponse.redirect(url);
    // carry refreshed session cookies over to the redirect
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    return redirectResponse;
  };

  if (!user) {
    return PUBLIC_PATHS.has(path) ? response : redirect("/login");
  }

  // Sign-out must work at any assurance level.
  if (path === "/auth/signout") return response;

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const current = aal?.currentLevel ?? "aal1";
  const next = aal?.nextLevel ?? "aal1";

  if (current === "aal2") {
    // Fully authenticated: auth screens bounce home.
    if (PUBLIC_PATHS.has(path) && path !== "/design") return redirect("/");
    if (path.startsWith("/2fa")) return redirect("/");
    return response;
  }

  if (next === "aal2") {
    // Factor enrolled, second step pending: challenge is the only screen.
    return path === "/2fa/challenge" ? response : redirect("/2fa/challenge");
  }

  // No factor yet: enrollment is forced (02-tenancy-and-identity.md).
  return path === "/2fa/enroll" ? response : redirect("/2fa/enroll");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
