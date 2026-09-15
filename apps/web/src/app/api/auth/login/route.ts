import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, verifyPassword } from "@/lib/auth-core";

const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attemptsByClient = new Map<string, number[]>();

function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function consumeAttempt(key: string): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (attemptsByClient.get(key) ?? []).filter((timestamp) => now - timestamp < ATTEMPT_WINDOW_MS);
  const limited = recent.length >= MAX_ATTEMPTS;
  if (!limited) recent.push(now);
  attemptsByClient.set(key, recent);
  if (attemptsByClient.size > 10_000) {
    for (const [entryKey, timestamps] of attemptsByClient) {
      if (!timestamps.some((timestamp) => now - timestamp < ATTEMPT_WINDOW_MS)) attemptsByClient.delete(entryKey);
    }
  }
  const oldest = recent[0] ?? now;
  return { limited, retryAfter: Math.max(1, Math.ceil((oldest + ATTEMPT_WINDOW_MS - now) / 1000)) };
}

export async function POST(request: NextRequest) {
  const attempt = consumeAttempt(clientKey(request));
  if (attempt.limited) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429, headers: { "Retry-After": String(attempt.retryAfter) } });
  }

  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;
  const authSecret = process.env.AUTH_SECRET;
  if (!configuredUsername || !configuredHash || !authSecret || authSecret.length < 32) {
    return NextResponse.json({ error: "O acesso administrativo ainda não foi configurado." }, { status: 503 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Informe usuário e senha." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const valid = username === configuredUsername && await verifyPassword(password, configuredHash);
  if (!valid) return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });

  attemptsByClient.delete(clientKey(request));
  const token = await createSessionToken(configuredUsername, authSecret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

