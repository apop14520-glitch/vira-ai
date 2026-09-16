import { NextRequest, NextResponse } from "next/server";

import { copySetCookieHeaders, resolveConfiguredApiOrigin, resolveUpstreamPath } from "@/app/api/proxy-utils";

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

  let target: URL;
  try {
    target = new URL(
      upstreamPath,
      resolveConfiguredApiOrigin(process.env.API_INTERNAL_URL, process.env.URL_INTERNA_DA_API, process.env.NODE_ENV),
    );
  } catch {
    return NextResponse.json(
      { error: { code: "UPSTREAM_MISCONFIGURED", message: "A API não está configurada neste Worker. Defina API_INTERNAL_URL com a URL pública do serviço Railway." } },
      { status: 502 },
    );
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
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Não foi possível conectar à API. Verifique se o serviço Railway está ativo." } },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  copySetCookieHeaders(response.headers, responseHeaders);
  return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
