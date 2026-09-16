import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/metric-card", () => ({
  MetricCard: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@/components/module-card", () => ({
  ModuleCard: ({ module }: { module: { title: string } }) => <div>{module.title}</div>,
}));
vi.mock("@/components/system-status", () => ({
  SystemStatus: () => <aside>Saúde da plataforma</aside>,
}));

import Home from "@/app/page";

describe("Home", () => {
  it("mantém a abertura focada nos módulos sem cards técnicos redundantes", () => {
    render(<Home />);

    expect(screen.queryByText("Workspace de desenvolvimento")).not.toBeInTheDocument();
    expect(screen.queryByText("Versão da base")).not.toBeInTheDocument();
    expect(screen.queryByText("Saúde da plataforma")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir VIRA Sites" })).toHaveAttribute("href", "/sites");
  });
});
