import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

const AUTH_PAGES = ["/login", "/register"];

/**
 * Edge middleware: first line of route protection.
 * Verifies the JWT signature (no DB access on the edge) and redirects.
 * API routes and server components still do their own full auth checks —
 * this only improves UX by redirecting early.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/w/");

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (isProtected && !session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/w/:path*", "/login", "/register"],
};
