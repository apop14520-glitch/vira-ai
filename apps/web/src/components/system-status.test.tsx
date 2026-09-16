import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SystemStatus } from "@/components/system-status";

describe("SystemStatus", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ service: "vira-api", status: "ok" }), { status: 200 }),
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("apresenta status técnico de forma compacta no rodapé", async () => {
    render(<SystemStatus />);

    const footer = await screen.findByRole("contentinfo", { name: "Informações do sistema" });
    expect(footer).toHaveTextContent("© 2026 VIRA.AI");
    expect(footer).toHaveTextContent("Ambiente de desenvolvimento");
    expect(footer).toHaveTextContent("v0.1");
    expect(footer).toHaveTextContent("API disponível");
    expect(screen.queryByText("Saúde da plataforma")).not.toBeInTheDocument();
  });
});
