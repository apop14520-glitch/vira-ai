import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/site-footer";

describe("SiteFooter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("apresenta a marca, os módulos e o direito autoral, sem status técnico da API", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo", { name: "Rodapé" });
    expect(within(footer).getAllByRole("link")[0]).toHaveTextContent("VIRA.AI");
    expect(within(footer).getAllByRole("link")[0]).toHaveAttribute("href", "/");
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} VIRA.AI. Todos os direitos reservados.`);
    expect(footer).not.toHaveTextContent(/API disponível|indisponível|Ambiente de desenvolvimento/);

    const platform = within(screen.getByRole("navigation", { name: "Plataforma" }));
    expect(platform.getByRole("link", { name: "Concursos" })).toHaveAttribute("href", "/concursos");
    expect(platform.getByRole("link", { name: "Business" })).toHaveAttribute("href", "/business");
    expect(screen.getByRole("link", { name: "Ir para o VIRA Concursos" })).toHaveAttribute("href", "/concursos");
  });

  it("volta ao topo da página", () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    render(<SiteFooter />);

    fireEvent.click(screen.getByRole("button", { name: /Voltar ao topo/ }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
