import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/business-api", () => ({
  businessApi: {
    foursquareStatus: vi.fn().mockResolvedValue({ configured: false, mode: "local", message: "Não configurada" }),
    saveFoursquareKey: vi.fn(),
    clearFoursquareKey: vi.fn(),
  },
}));

vi.mock("@/lib/auth-api", () => ({
  getSession: vi.fn().mockResolvedValue({ authenticated: true, username: "admin", organization_id: "org-local" }),
  changePassword: vi.fn(),
  logout: vi.fn(),
}));

import { PreferencesMenu } from "@/components/preferences-menu";

describe("PreferencesMenu", () => {
  it("apresenta somente as três áreas principais sem densidade", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));

    await waitFor(() => {
      expect(screen.getAllByRole("menuitem")).toHaveLength(3);
      expect(screen.getByRole("menuitem", { name: /Aparência/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Conexões/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Segurança/ })).toBeInTheDocument();
      expect(screen.queryByText("Densidade")).not.toBeInTheDocument();
    });
  });

  it("fecha pelo controle de fechar", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar configurações" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Configurações do VIRA.AI" })).not.toBeInTheDocument());
  });
});
