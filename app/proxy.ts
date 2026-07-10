import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session.
const PUBLIC_PATHS = new Set(["/login", "/signup", "/design"]);

// Where an interrupted visitor is sent back to after completing auth.
// Only /join/<uuid> qualifies — never trust arbitrary paths from cookies.
const RESUME_COOKIE = "resume-path";
const RESUMABLE_RE = /^\/join\/[0-9a-f-]{36}$/i;

/**
 * Session + AAL2 enforcement (02-tenancy-and-identity.md):
 *  - no session            -> /login (invite links remembered via resume cookie)
 *  - aal1, no factor       -> forced 2FA enrollment (/2fa/enroll) — only reachable screen
 *  - aal1, factor enrolled -> 2FA challenge (/2fa/challenge) — only reachable screen
 *  - aal2                  -> app (auth screens redirect home; resume cookie honoured)
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

  const wantsResume = RESUMABLE_RE.test(path);
  const withResumeCookie = (res: NextResponse) => {
    res.cookies.set(RESUME_COOKIE, path, {
      maxAge: 60 * 60, // survives signup + email confirmation detours
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  };

  if (!user) {
    if (PUBLIC_PATHS.has(path)) return response;
    // Invitees are usually new users — signup first (it cross-links to login),
    // and the invite is resumed after auth completes.
    if (wantsResume) return withResumeCookie(redirect("/signup"));
    return redirect("/login");
  }

  // Sign-out must work at any assurance level.
  if (path === "/auth/signout") return response;

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const current = aal?.currentLevel ?? "aal1";
  const next = aal?.nextLevel ?? "aal1";

  if (current === "aal2") {
    // Fully authenticated: honour a pending invite resume first.
    const resume = request.cookies.get(RESUME_COOKIE)?.value;
    if (resume && RESUMABLE_RE.test(resume) && path !== resume) {
      const toResume = redirect(resume);
      toResume.cookies.delete(RESUME_COOKIE);
      return toResume;
    }
    if (resume && path === resume) {
      response.cookies.delete(RESUME_COOKIE);
      return response;
    }
    // Auth screens bounce home — except enrollment, which an aal2 user may
    // revisit to add a second authenticator device (/me → security).
    if (PUBLIC_PATHS.has(path) && path !== "/design") return redirect("/");
    if (path.startsWith("/2fa") && path !== "/2fa/enroll") return redirect("/");
    return response;
  }

  if (next === "aal2") {
    // Factor enrolled, second step pending: challenge is the only screen.
    if (path === "/2fa/challenge") return response;
    const toChallenge = redirect("/2fa/challenge");
    return wantsResume ? withResumeCookie(toChallenge) : toChallenge;
  }

  // No factor yet: enrollment is forced (02-tenancy-and-identity.md).
  if (path === "/2fa/enroll") return response;
  const toEnroll = redirect("/2fa/enroll");
  return wantsResume ? withResumeCookie(toEnroll) : toEnroll;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
