import { afterEach, describe, expect, it, vi } from "vitest";

import { getInitialSetupStatus, setupInitialAdmin } from "@/lib/auth-api";

describe("API de ativação administrativa", () => {
  afterEach(() => vi.restoreAllMocks());

  it("consulta o status pela rota same-origin", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ required: true, configured: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getInitialSetupStatus()).resolves.toEqual({ required: true, configured: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/setup-status",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("envia os quatro campos do cadastro sem URL Railway", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: true, username: "novo-admin" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await setupInitialAdmin("novo-admin", "Senha-segura-2026!", "Senha-segura-2026!", "codigo-ativacao");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/setup",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      username: "novo-admin",
      password: "Senha-segura-2026!",
      confirmation: "Senha-segura-2026!",
      setup_token: "codigo-ativacao",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("railway");
  });
});
