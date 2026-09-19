import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  getSession: vi.fn(),
  session: { authenticated: true, username: "admin", organization_id: "org-local" },
  changePassword: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/auth-gate", () => ({
  useAdminSession: () => mocks.session,
}));

vi.mock("@/lib/business-api", () => ({
  businessApi: {
    foursquareStatus: vi.fn().mockResolvedValue({ configured: false, mode: "local", message: "Não configurada" }),
    saveFoursquareKey: vi.fn(),
    clearFoursquareKey: vi.fn(),
  },
}));

vi.mock("@/lib/auth-api", () => ({
  getSession: mocks.getSession,
  changePassword: mocks.changePassword,
  logout: mocks.logout,
}));

import { PreferencesMenu } from "@/components/preferences-menu";

describe("PreferencesMenu", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.getSession.mockReset().mockResolvedValue({ authenticated: true, username: "admin", organization_id: "org-local" });
    mocks.changePassword.mockReset();
    mocks.logout.mockReset();
  });

  it("apresenta somente as três áreas principais sem densidade", async () => {
    render(<PreferencesMenu />);
    const trigger = screen.getByRole("button", { name: "Configurações" });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(trigger).toHaveAttribute("aria-controls", "vira-preferences-panel");
      expect(screen.getAllByRole("menuitem")).toHaveLength(3);
      expect(screen.getByRole("menuitem", { name: /Aparência/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Conexões/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Segurança/ })).toBeInTheDocument();
      expect(screen.queryByText("Densidade")).not.toBeInTheDocument();
    });
  });

  it("mostra só o tema em Aparência e só sessão e senha em Segurança", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));

    expect(await screen.findByText("Tema da interface")).toBeInTheDocument();
    expect(screen.queryByText("Idioma e região")).not.toBeInTheDocument();
    expect(screen.queryByText("America/Manaus")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /Segurança/ }));
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
    expect(screen.getByText("Alterar senha", { selector: "h3" })).toBeInTheDocument();
    expect(screen.queryByText("Controles ativos")).not.toBeInTheDocument();
  });

  it("mostra só a chave do Foursquare em Conexões, sem o cartão de saúde do sistema", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Conexões/ }));

    expect(await screen.findByText("Foursquare Places")).toBeInTheDocument();
    expect(screen.getByLabelText("Chave de serviço")).toBeInTheDocument();
    expect(screen.queryByText("Saúde do sistema")).not.toBeInTheDocument();
    expect(screen.queryByText("API FastAPI")).not.toBeInTheDocument();
    expect(screen.queryByText("SQLite")).not.toBeInTheDocument();
  });

  it("mantém o painel fora do cabeçalho para não ser cortado no celular", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));

    const dialog = await screen.findByRole("dialog", { name: "Configurações do VIRA.AI" });
    expect(dialog.parentElement).toBe(document.body);
  });

  it("reutiliza a sessão validada pelo AuthGate sem fazer uma segunda consulta", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Segurança/ }));

    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("fecha pelo controle de fechar", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar configurações" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Configurações do VIRA.AI" })).not.toBeInTheDocument());
  });

  it("mantém a segurança dentro do painel com rolagem para conteúdo longo", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Segurança/ }));
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog", { name: "Configurações do VIRA.AI" });
    const scrollRegion = dialog.querySelector(".settings-scroll");

    expect(dialog).toHaveClass("settings-panel--bounded");
    expect(scrollRegion).toHaveClass("overflow-y-auto", "pb-10");
  });

  it("impede o envio quando a confirmação não corresponde à nova senha", async () => {
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Segurança/ }));
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "Senha-atual-2026!" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "Nova-senha-2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "Outra-senha-2026!" } });

    expect(screen.getByText("A confirmação não corresponde à nova senha.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alterar senha" })).toBeDisabled();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("altera a senha, limpa o formulário e encaminha para o login", async () => {
    mocks.changePassword.mockResolvedValue(undefined);
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Segurança/ }));
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "Senha-atual-2026!" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "Nova-senha-2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "Nova-senha-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledWith("Senha-atual-2026!", "Nova-senha-2026!", "Nova-senha-2026!"));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveValue("");
  });

  it("mostra o erro retornado ao falhar a alteração", async () => {
    mocks.changePassword.mockRejectedValue(new Error("A senha atual está incorreta."));
    render(<PreferencesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Segurança/ }));
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "Senha-incorreta-2026!" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "Nova-senha-2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "Nova-senha-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual está incorreta.");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
