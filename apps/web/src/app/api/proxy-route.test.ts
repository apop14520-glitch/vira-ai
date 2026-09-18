// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/[...path]/route";

const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });

describe("proxy da API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_INTERNAL_URL", "https://api.example.test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("repassa a query string para a API, senão o filtro por tópico é ignorado", async () => {
    const request = new NextRequest("https://app.example.test/api/v1/concursos/questions?topic_id=abc-123");

    const response = await GET(request, context("v1", "concursos", "questions"));

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.test/api/v1/concursos/questions?topic_id=abc-123",
    );
  });

  it("não acrescenta '?' quando a requisição não tem parâmetros", async () => {
    const request = new NextRequest("https://app.example.test/api/v1/concursos/topics");

    await GET(request, context("v1", "concursos", "topics"));

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.test/api/v1/concursos/topics");
  });

  it("continua bloqueando rotas fora da lista permitida", async () => {
    const request = new NextRequest("https://app.example.test/api/v1/admin/secrets?x=1");

    const response = await GET(request, context("v1", "admin", "secrets"));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
