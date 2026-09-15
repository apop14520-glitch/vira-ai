import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

function apiBaseUrl() {
  return process.env.INTERNAL_API_BASE_URL ?? process.env.API_BASE_URL;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const base = apiBaseUrl();
  const token = process.env.API_ACCESS_TOKEN;
  if (!base || !token) {
    return NextResponse.json(
      { error: "A integração de leads ainda não está configurada." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const upstreamPath = path.map(encodeURIComponent).join("/");
  const upstream = new URL(
    "/api/v1/business/" + upstreamPath,
    base.replace(/\/$/, "") + "/",
  );
  upstream.search = request.nextUrl.search;

  const headers = new Headers({ Authorization: "Bearer " + token });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "error",
    });
    const responseHeaders = new Headers();
    const responseType = response.headers.get("Content-Type");
    const requestId = response.headers.get("X-Request-ID");
    if (responseType) responseHeaders.set("Content-Type", responseType);
    if (requestId) responseHeaders.set("X-Request-ID", requestId);
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conectar ao serviço de leads." },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
