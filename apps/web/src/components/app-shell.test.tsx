import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth-gate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/preferences-menu", () => ({
  PreferencesMenu: () => <button type="button">Configurações</button>,
}));
vi.mock("@/lib/auth-api", () => ({ logout: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/business" }));

import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("apresenta a navegação principal lado a lado no cabeçalho", () => {
    render(<AppShell><div>Conteúdo</div></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(navigation).toHaveClass("lg:flex", "overflow-x-auto");
    expect(within(navigation).getByRole("link", { name: /Business/ })).toHaveAttribute("href", "/business");
    expect(screen.queryByText("Workspace local")).not.toBeInTheDocument();
  });

  it("alinha as bordas do cabeçalho com as do conteúdo em qualquer largura de tela", () => {
    render(<AppShell><div>Conteúdo</div></AppShell>);

    const headerInner = screen.getByRole("banner").firstElementChild as HTMLElement;
    for (const container of [headerInner, screen.getByRole("main")]) {
      expect(container).toHaveClass("mx-auto", "max-w-[1440px]", "px-4", "sm:px-6", "lg:px-8");
    }
  });

  it("mantém o conteúdo encostado ao cabeçalho no celular sem perder o espaçamento inferior", () => {
    render(<AppShell><div>Conteúdo</div></AppShell>);

    expect(screen.getByRole("main")).toHaveClass("pt-0", "pb-7");
  });
});
