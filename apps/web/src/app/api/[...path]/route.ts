import { NextRequest, NextResponse } from "next/server";

const allowedAuthPaths = new Set([
  "/v1/auth/login",
  "/v1/auth/session",
  "/v1/auth/logout",
  "/v1/auth/password",
]);

function resolveUpstreamPath(path: string[]): string | null {
  const requestedPath = `/${path.join("/")}`;
  if (requestedPath === "/health") return "/health";
  if (allowedAuthPaths.has(requestedPath)) return `/api${requestedPath}`;
  if (requestedPath === "/v1/business" || requestedPath.startsWith("/v1/business/")) return `/api${requestedPath}`;
  return null;
}

function forwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "x-request-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamPath = resolveUpstreamPath(path);
  if (!upstreamPath) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }, { status: 404 });

  const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  let target: URL;
  try {
    target = new URL(upstreamPath, apiInternalUrl);
  } catch {
    return NextResponse.json({ error: { code: "UPSTREAM_UNAVAILABLE", message: "A API local não está disponível." } }, { status: 502 });
  }

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers: forwardHeaders(request),
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: { code: "UPSTREAM_UNAVAILABLE", message: "A API local não está disponível." } }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of ["content-type", "x-request-id", "retry-after", "www-authenticate"]) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  for (const cookie of getSetCookie?.call(response.headers) ?? []) responseHeaders.append("set-cookie", cookie);
  return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
