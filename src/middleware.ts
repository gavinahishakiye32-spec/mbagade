import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge middleware:
 * 1. Verifies the session JWT signature (no DB access at the edge).
 * 2. Guards protected page routes — real authorization still happens
 *    server-side in every route handler / server component.
 * 3. Adds security headers.
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/messages",
  "/notifications",
  "/settings",
  "/saved",
  "/orders",
];

const AUTH_PAGES = ["/login", "/register"];

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET ?? (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret-change-me" : undefined);
  if (!s) return new TextEncoder().encode("invalid");
  return new TextEncoder().encode(s);
}

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("bb_session")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  let response: NextResponse;

  if (isProtected && !(await hasValidSession(req))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    response = NextResponse.redirect(url);
  } else if (isAuthPage && (await hasValidSession(req))) {
    response = NextResponse.redirect(new URL("/", req.url));
  } else {
    response = NextResponse.next();
  }

  // Security headers
  const headers = response.headers;
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  headers.set("X-DNS-Prefetch-Control", "on");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js).*)"],
};
