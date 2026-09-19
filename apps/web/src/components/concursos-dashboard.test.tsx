import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConcursosDashboard } from "@/components/concursos-dashboard";
import type { Theory, Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({
  listTopics: vi.fn(),
  getTheory: vi.fn(),
  summary: vi.fn(),
  auditEvents: vi.fn(),
  drawQuestions: vi.fn(),
  checkAnswer: vi.fn(),
  submitExam: vi.fn(),
}));
vi.mock("@/lib/concursos-api", () => ({ concursosApi: api }));

const topic = (id: string, name: string, count = 2, hasTheory = false): Topic => ({
  id,
  organization_id: "o",
  name,
  description: "",
  question_count: count,
  has_theory: hasTheory,
  created_at: "",
});

const theory: Theory = {
  summary: "Base da computação",
  sources: "Manual, edição 3.0+",
  chapters: [
    {
      number: "1.1",
      title: "Organização de computadores",
      objective: "Explicar o sistema.",
      sections: [{ heading: "O sistema", blocks: [{ type: "paragraph", text: "Texto do capítulo um." }] }],
      review: [],
    },
  ],
};

function setViewport(kind: "desktop" | "mobile") {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: kind === "desktop" && query.includes("min-width"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const topics = [
  topic("t10", "Parte 10 — Infraestrutura"),
  topic("t2", "Parte 2 — Programação"),
  topic("t1", "Parte 1 — Fundamentos", 2, true),
  topic("s1", "Simulado Integrado", 8),
  topic("t29", "Parte 29 — Revisão Estratégica", 0, true),
];

describe("ConcursosDashboard", () => {
  beforeEach(() => {
    setViewport("desktop");
    api.listTopics.mockReset().mockResolvedValue(topics);
    api.getTheory.mockReset().mockResolvedValue(theory);
    Element.prototype.scrollIntoView = vi.fn();
    api.summary.mockReset().mockResolvedValue({ total_topics: 4, total_questions: 14, by_topic: {} });
    api.auditEvents.mockReset().mockResolvedValue([]);
  });

  it("tem só duas áreas: Conteúdo (teoria) e Sessão de estudo (com os simulados)", async () => {
    render(<ConcursosDashboard />);

    const areas = within((await screen.findByRole("button", { name: "Área" })).closest("section") as HTMLElement);
    expect(areas.getAllByRole("checkbox").map((item) => item.closest("label")?.textContent)).toEqual(["Conteúdo", "Sessão de estudo"]);
    expect(areas.getByRole("checkbox", { name: "Conteúdo" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Simulados" })).not.toBeInTheDocument();
    expect(screen.getByText("14 questões")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assuntos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar sessão" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Sessão de estudo" }));
    expect(screen.getByRole("button", { name: "Começar sessão" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Estudo" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Simulado" })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Montar Simulado Integrado" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulados" })).toBeInTheDocument();
  });

  it("põe o menu dentro da caixa de assuntos da teoria, sem opção de banco de questões", async () => {
    render(<ConcursosDashboard />);

    const subjects = (await screen.findByRole("heading", { name: "Assuntos" })).closest("div.space-y-3") as HTMLElement;
    expect(within(subjects).getByRole("button", { name: "Área" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conteúdo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Questões/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Banco de questões/, hidden: true })).not.toBeInTheDocument();
  });

  it("é somente leitura: não oferece criar nem excluir tópicos e questões", async () => {
    render(<ConcursosDashboard />);
    await screen.findByRole("heading", { name: "Assuntos" });

    expect(screen.queryByText("Novo tópico")).not.toBeInTheDocument();
    expect(screen.queryByText("Nova questão")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir|excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Iniciar simulado/i })).not.toBeInTheDocument();
  });

  it("resume no cabeçalho os assuntos com questões e os com teoria", async () => {
    render(<ConcursosDashboard />);

    expect(await screen.findByText("4 tópicos")).toBeInTheDocument();
    expect(screen.getByText("2 assuntos com teoria")).toBeInTheDocument();
  });

  it("leva da teoria para a sessão de estudo com o assunto já marcado", async () => {
    render(<ConcursosDashboard />);
    await screen.findByRole("checkbox", { name: /^Conteúdo/ });
    fireEvent.click(screen.getByRole("button", { name: "Parte 1 — Fundamentos" }));
    await screen.findByText("Texto do capítulo um.");

    fireEvent.click(screen.getByRole("button", { name: "Praticar questões deste tópico" }));

    expect(screen.getByRole("checkbox", { name: /^Sessão de estudo/ })).toBeChecked();
    expect(screen.getByLabelText(/Parte 1 — Fundamentos/)).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: /^Conteúdo/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Sessão de estudo/ }));
    expect(screen.getByLabelText(/Parte 1 — Fundamentos/)).not.toBeChecked();
  });

  it("leva da sessão de estudo para a teoria do assunto marcado", async () => {
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Sessão de estudo/ }));
    fireEvent.click(screen.getByLabelText(/Parte 1 — Fundamentos/));

    fireEvent.click(screen.getByRole("button", { name: "Ler a teoria antes das questões" }));

    expect(screen.getByRole("checkbox", { name: /^Conteúdo/ })).toBeChecked();
    expect(await screen.findByText("Texto do capítulo um.")).toBeInTheDocument();
    expect(api.getTheory).toHaveBeenCalledWith("t1");
  });
});
