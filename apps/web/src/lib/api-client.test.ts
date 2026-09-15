import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiJson, apiRequest } from "@/lib/api-client";

describe("cliente same-origin", () => {
  afterEach(() => vi.restoreAllMocks());

  it("envia credenciais de sessão sem expor um destino upstream", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiJson<{ authenticated: boolean }>("/api/v1/auth/session");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/session",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("127.0.0.1:8000");
  });

  it("converte uma resposta 401 em erro seguro para a interface", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "detalhe interno" } }), { status: 401 }),
    );

    await expect(apiJson("/api/v1/auth/session")).rejects.toMatchObject({
      status: 401,
      message: "Sua sessão expirou. Entre novamente para continuar.",
    });
  });

  it("mostra mensagem de credencial inválida somente no login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "detalhe interno" } }), { status: 401 }),
    );

    await expect(apiJson("/api/v1/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 401,
      message: "Usuário ou senha inválidos.",
    });
  });

  it("mantém o retry-after quando o backend limita tentativas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 429, headers: { "Retry-After": "12" } }),
    );

    await expect(apiRequest("/api/v1/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 429,
      retryAfter: 12,
    });
  });
});
