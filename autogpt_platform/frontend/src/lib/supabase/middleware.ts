import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { detectAndCleanupLegacySessions } from "./actions";
import { getCookieSettings, isAdminPage, isProtectedPage } from "./helpers";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const isAvailable = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!isAvailable) {
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;

  // Use the server action to detect and cleanup legacy sessions
  try {
    const sessionResult = await detectAndCleanupLegacySessions(pathname);

    // If session is invalid and we have a redirect path, redirect immediately
    if (!sessionResult.isValid && sessionResult.redirectPath) {
      const url = request.nextUrl.clone();
      url.pathname = sessionResult.redirectPath;

      // Add session_migrated flag if this was due to legacy session cleanup
      if (sessionResult.redirectPath === "/login") {
        url.searchParams.set("session_migrated", "true");
      }

      return NextResponse.redirect(url);
    }

    // If we have a valid session, continue with normal middleware flow
    if (sessionResult.isValid && sessionResult.user) {
      const _supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value),
              );
              supabaseResponse = NextResponse.next({
                request,
              });
              cookiesToSet.forEach(({ name, value, options }) => {
                supabaseResponse.cookies.set(name, value, {
                  ...options,
                  ...getCookieSettings(),
                });
              });
            },
          },
        },
      );

      const userRole = sessionResult.user.role;
      const url = request.nextUrl.clone();

      // Check admin access
      if (sessionResult.user && userRole !== "admin" && isAdminPage(pathname)) {
        url.pathname = "/marketplace";
        return NextResponse.redirect(url);
      }
    }

    // Handle unauthenticated users trying to access protected pages
    if (!sessionResult.isValid) {
      const attemptingProtectedPage = isProtectedPage(pathname);
      const attemptingAdminPage = isAdminPage(pathname);

      if (attemptingProtectedPage || attemptingAdminPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    }
  } catch (error) {
    console.error("Failed to run Supabase middleware", error);

    // Fallback: if session detection fails, try basic supabase client approach
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value),
              );
              supabaseResponse = NextResponse.next({
                request,
              });
              cookiesToSet.forEach(({ name, value, options }) => {
                supabaseResponse.cookies.set(name, value, {
                  ...options,
                  ...getCookieSettings(),
                });
              });
            },
          },
        },
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const attemptingProtectedPage = isProtectedPage(pathname);
        const attemptingAdminPage = isAdminPage(pathname);

        if (attemptingProtectedPage || attemptingAdminPage) {
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          return NextResponse.redirect(url);
        }
      }
    } catch (fallbackError) {
      console.error("Fallback middleware error:", fallbackError);
    }
  }

  return supabaseResponse;
}
