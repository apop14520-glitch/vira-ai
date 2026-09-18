import { describe, expect, it } from "vitest";

import { copySetCookieHeaders, resolveApiOrigin, resolveConfiguredApiOrigin, resolveUpstreamPath } from "@/app/api/proxy-utils";

describe("contrato do proxy Cloudflare", () => {
  it("converte login para a rota de API correspondente", () => {
    expect(resolveUpstreamPath(["v1", "auth", "login"])).toBe("/api/v1/auth/login");
  });

  it("encaminha somente as rotas públicas de ativação administrativa", () => {
    expect(resolveUpstreamPath(["v1", "auth", "setup-status"])).toBe("/api/v1/auth/setup-status");
    expect(resolveUpstreamPath(["v1", "auth", "setup"])).toBe("/api/v1/auth/setup");
  });

  it("recusa uma rota fora da allowlist", () => {
    expect(resolveUpstreamPath(["v1", "admin", "secrets"])).toBeNull();
  });

  it("encaminha as rotas do módulo Concursos", () => {
    expect(resolveUpstreamPath(["v1", "concursos", "topics"])).toBe("/api/v1/concursos/topics");
    expect(resolveUpstreamPath(["v1", "concursos", "quiz", "start"])).toBe("/api/v1/concursos/quiz/start");
  });

  it("aceita a origem HTTPS sem acrescentar caminhos", () => {
    expect(resolveApiOrigin("https://vira-api-production.up.railway.app", "production").toString()).toBe(
      "https://vira-api-production.up.railway.app/",
    );
  });

  it("recusa origem de produção ausente ou com caminho", () => {
    expect(() => resolveApiOrigin(undefined, "production")).toThrow("API_INTERNAL_URL");
    expect(() => resolveApiOrigin("https://vira-api-production.up.railway.app/login", "production")).toThrow(
      "URL base",
    );
  });

  it("mantém o fallback local apenas fora da produção", () => {
    expect(resolveApiOrigin(undefined, "development").toString()).toBe("http://127.0.0.1:8000/");
  });

  it("aceita a variável legada da URL somente como compatibilidade", () => {
    expect(resolveConfiguredApiOrigin(undefined, "https://vira-api-production.up.railway.app", "production").origin)
      .toBe("https://vira-api-production.up.railway.app");
    expect(resolveConfiguredApiOrigin("https://canonical.example", "https://legacy.example", "production").origin)
      .toBe("https://canonical.example");
  });

  it("copia todos os cookies de sessão para a resposta", () => {
    const source = new Headers({ "content-type": "application/json" });
    Object.defineProperty(source, "getSetCookie", {
      value: () => ["vira_admin_session=one; Path=/", "vira_admin_session=two; Path=/"],
    });
    const target = new Headers();

    copySetCookieHeaders(source, target);

    expect(target.get("set-cookie")).toContain("vira_admin_session=one");
    expect(target.get("set-cookie")).toContain("vira_admin_session=two");
  });
});
