import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth-gate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/preferences-menu", () => ({
  PreferencesMenu: () => <button type="button">Configurações</button>,
}));
vi.mock("@/components/system-status", () => ({
  SystemStatus: () => <footer aria-label="Informações do sistema" />,
}));
vi.mock("@/lib/auth-api", () => ({ logout: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/business" }));

import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("apresenta a navegação principal lado a lado no cabeçalho", () => {
    render(<AppShell><div>Conteúdo</div></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(navigation).toHaveClass("lg:flex", "overflow-x-auto");
    expect(screen.getByRole("link", { name: /Business/ })).toHaveAttribute("href", "/business");
    expect(screen.queryByText("Workspace local")).not.toBeInTheDocument();
  });
});
