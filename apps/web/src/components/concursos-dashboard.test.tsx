import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConcursosDashboard } from "@/components/concursos-dashboard";
import type { Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({
  listTopics: vi.fn(),
  summary: vi.fn(),
  listQuestions: vi.fn(),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  createQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  auditEvents: vi.fn(),
  drawQuestions: vi.fn(),
  checkAnswer: vi.fn(),
  submitExam: vi.fn(),
}));
vi.mock("@/lib/concursos-api", () => ({ concursosApi: api }));

const topics: Topic[] = [
  { id: "t1", organization_id: "o", name: "Redes", description: "", question_count: 3, created_at: "" },
  { id: "s1", organization_id: "o", name: "Simulado Integrado", description: "", question_count: 8, created_at: "" },
];

describe("ConcursosDashboard", () => {
  beforeEach(() => {
    api.listTopics.mockResolvedValue(topics);
    api.summary.mockResolvedValue({ total_topics: 2, total_questions: 11, by_topic: {} });
    api.listQuestions.mockResolvedValue([]);
  });

  it("separa o banco de questões, a sessão de estudo e os simulados em abas", async () => {
    render(<ConcursosDashboard />);

    expect(await screen.findByRole("tab", { name: "Questões" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sessão de estudo" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Simulados" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("11 questões")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar tópico" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar sessão" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Sessão de estudo" }));
    expect(screen.getByRole("button", { name: "Começar sessão" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar tópico" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Simulados" }));
    expect(screen.getByRole("button", { name: "Iniciar Simulado Integrado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar sessão" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Questões" }));
    expect(screen.getByRole("button", { name: "Adicionar tópico" })).toBeInTheDocument();
  });

  it("ordena os tópicos pelo número da parte, não em ordem alfabética", async () => {
    const named = (id: string, name: string): Topic => ({
      id,
      organization_id: "o",
      name,
      description: "",
      question_count: 1,
      created_at: "",
    });
    api.listTopics.mockResolvedValue([
      named("a", "Parte 10 — Infraestrutura"),
      named("b", "Parte 2 — Programação"),
      named("c", "Parte 1 — Fundamentos"),
      named("d", "Simulado Integrado"),
    ]);

    render(<ConcursosDashboard />);

    await screen.findByRole("tab", { name: "Questões" });
    const shown = screen.getAllByRole("button", { name: /^(Parte|Simulado)/ }).map((button) => button.textContent);
    expect(shown.map((text) => text?.replace(/\d+$/, ""))).toEqual([
      "Parte 1 — Fundamentos",
      "Parte 2 — Programação",
      "Parte 10 — Infraestrutura",
      "Simulado Integrado",
    ]);
  });
});
