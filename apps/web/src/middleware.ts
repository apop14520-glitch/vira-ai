import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-core";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/health", "/favicon.svg", "/icon.svg"]);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/_next/")) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const username = process.env.ADMIN_USERNAME;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const subject = secret && token ? await verifySessionToken(token, secret) : null;
  if (subject && username && subject === username) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

