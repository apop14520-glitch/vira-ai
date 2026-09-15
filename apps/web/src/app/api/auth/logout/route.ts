import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-core";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT), sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

