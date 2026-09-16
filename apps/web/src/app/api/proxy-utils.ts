const allowedAuthPaths = new Set([
  "/v1/auth/login",
  "/v1/auth/setup-status",
  "/v1/auth/setup",
  "/v1/auth/session",
  "/v1/auth/logout",
  "/v1/auth/password",
]);

const forwardedResponseHeaders = ["content-type", "x-request-id", "retry-after", "www-authenticate"] as const;

export function resolveUpstreamPath(path: readonly string[]): string | null {
  const requestedPath = `/${path.join("/")}`;

  if (requestedPath === "/health") return "/health";
  if (allowedAuthPaths.has(requestedPath)) return `/api${requestedPath}`;
  if (requestedPath === "/v1/business" || requestedPath.startsWith("/v1/business/")) {
    return `/api${requestedPath}`;
  }

  return null;
}

export function resolveApiOrigin(rawValue: string | undefined, runtimeEnvironment: string | undefined): URL {
  const value = rawValue?.trim();

  if (!value) {
    if (runtimeEnvironment === "production") {
      throw new Error("API_INTERNAL_URL é obrigatória em produção.");
    }

    return new URL("http://127.0.0.1:8000/");
  }

  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new Error("API_INTERNAL_URL deve ser uma URL base válida.");
  }

  if (!new Set(["http:", "https:"]).has(origin.protocol)) {
    throw new Error("API_INTERNAL_URL deve usar http ou https.");
  }

  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("API_INTERNAL_URL deve ser uma URL base sem caminho, consulta ou credenciais.");
  }

  return origin;
}

export function resolveConfiguredApiOrigin(
  canonicalValue: string | undefined,
  legacyValue: string | undefined,
  runtimeEnvironment: string | undefined,
): URL {
  return resolveApiOrigin(canonicalValue?.trim() || legacyValue, runtimeEnvironment);
}

export function copySetCookieHeaders(source: Headers, target: Headers): void {
  for (const name of forwardedResponseHeaders) {
    const value = source.get(name);
    if (value) target.set(name, value);
  }

  const sourceWithCookies = source as Headers & { getSetCookie?: () => string[] };
  const cookies = sourceWithCookies.getSetCookie?.() ?? [];

  if (cookies.length > 0) {
    for (const cookie of cookies) target.append("set-cookie", cookie);
    return;
  }

  const cookie = source.get("set-cookie");
  if (cookie) target.append("set-cookie", cookie);
}
