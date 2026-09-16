import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInitialSetupStatus: vi.fn(),
  setupInitialAdmin: vi.fn(),
  login: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/auth-api", () => ({
  getInitialSetupStatus: mocks.getInitialSetupStatus,
  setupInitialAdmin: mocks.setupInitialAdmin,
  login: mocks.login,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("exibe ativação inicial somente quando a API informa ausência de administrador", async () => {
    mocks.getInitialSetupStatus.mockResolvedValue({ required: true, configured: true });
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "Criar acesso administrativo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Código de ativação")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirmar senha")).toHaveAttribute("type", "password");
  });

  it("mantém o login quando já existe administrador", async () => {
    mocks.getInitialSetupStatus.mockResolvedValue({ required: false, configured: true });
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "Entrar no painel" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.getInitialSetupStatus).toHaveBeenCalled());
    expect(screen.getByLabelText("Usuário")).toHaveValue("");
    expect(screen.getByLabelText("Usuário")).toHaveAttribute("placeholder", "Digite o usuário configurado");
    expect(screen.queryByLabelText("Código de ativação")).not.toBeInTheDocument();
  });

  it("envia os quatro campos e encaminha ao painel sem repetir a senha", async () => {
    mocks.getInitialSetupStatus.mockResolvedValue({ required: true, configured: true });
    mocks.setupInitialAdmin.mockResolvedValue({ authenticated: true, username: "novo-admin" });
    render(<LoginPage />);
    await screen.findByLabelText("Código de ativação");
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: "novo-admin" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Senha-segura-2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "Senha-segura-2026!" } });
    fireEvent.change(screen.getByLabelText("Código de ativação"), { target: { value: "código-secreto" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar acesso" }));
    await waitFor(() => expect(mocks.setupInitialAdmin).toHaveBeenCalledWith("novo-admin", "Senha-segura-2026!", "Senha-segura-2026!", "código-secreto"));
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  it("limpa os campos secretos após falha de ativação", async () => {
    mocks.getInitialSetupStatus.mockResolvedValue({ required: true, configured: true });
    mocks.setupInitialAdmin.mockRejectedValue(new Error("Código inválido."));
    render(<LoginPage />);
    await screen.findByLabelText("Código de ativação");
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: "novo-admin" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Senha-segura-2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "Senha-segura-2026!" } });
    fireEvent.change(screen.getByLabelText("Código de ativação"), { target: { value: "errado" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar acesso" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido.");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar senha")).toHaveValue("");
    expect(screen.getByLabelText("Código de ativação")).toHaveValue("");
  });

  it("mantém login utilizável quando a consulta de status falha", async () => {
    mocks.getInitialSetupStatus.mockRejectedValue(new Error("falha de rede"));
    render(<LoginPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível verificar");
    expect(screen.getByRole("heading", { name: "Entrar no painel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });
});
