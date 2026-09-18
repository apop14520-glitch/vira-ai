import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConcursosDashboard } from "@/components/concursos-dashboard";
import type { Question, Theory, Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({
  listTopics: vi.fn(),
  getTheory: vi.fn(),
  summary: vi.fn(),
  listQuestions: vi.fn(),
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

const question = (id: string, topicId: string, statement: string): Question => ({
  id,
  organization_id: "o",
  topic_id: topicId,
  statement,
  option_a: "A1",
  option_b: "B1",
  option_c: "C1",
  option_d: "D1",
  option_e: null,
  correct_option: "b",
  explanation: "Porque sim.",
  difficulty: "media",
  source: "manual",
  created_at: "",
});

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
    api.listQuestions.mockReset().mockResolvedValue([]);
    api.auditEvents.mockReset().mockResolvedValue([]);
  });

  it("separa o banco de questões, a teoria, a sessão de estudo e os simulados em abas", async () => {
    render(<ConcursosDashboard />);

    expect(await screen.findByRole("tab", { name: "Questões" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Teoria" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Sessão de estudo" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Simulados" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("14 questões")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar sessão" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Teoria" }));
    expect(screen.getByRole("heading", { name: "Assuntos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar sessão" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Sessão de estudo" }));
    expect(screen.getByRole("button", { name: "Começar sessão" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Simulados" }));
    expect(screen.getByRole("button", { name: "Iniciar Simulado Integrado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar sessão" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Questões" }));
    expect(screen.getByRole("heading", { name: "Tópicos" })).toBeInTheDocument();
  });

  it("é somente leitura: não oferece criar nem excluir tópicos e questões", async () => {
    render(<ConcursosDashboard />);
    await screen.findByRole("tab", { name: "Questões" });
    fireEvent.click(screen.getByRole("button", { name: /Parte 1 — Fundamentos/ }));
    await screen.findByRole("heading", { name: "Parte 1 — Fundamentos" });

    expect(screen.queryByText("Novo tópico")).not.toBeInTheDocument();
    expect(screen.queryByText("Nova questão")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir|excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Iniciar simulado/i })).not.toBeInTheDocument();
  });

  it("não lista no banco de questões os assuntos que só têm teoria", async () => {
    render(<ConcursosDashboard />);
    await screen.findByRole("tab", { name: "Questões" });

    expect(screen.getByRole("button", { name: /Parte 1 — Fundamentos/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Parte 29/ })).not.toBeInTheDocument();
    expect(screen.getByText("2 assuntos com teoria")).toBeInTheDocument();
  });

  it("leva da teoria para a sessão de estudo com o assunto já marcado", async () => {
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Teoria" }));
    fireEvent.click(screen.getByRole("button", { name: "Parte 1 — Fundamentos" }));
    await screen.findByText("Texto do capítulo um.");

    fireEvent.click(screen.getByRole("button", { name: "Praticar questões deste tópico" }));

    expect(screen.getByRole("tab", { name: "Sessão de estudo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Parte 1 — Fundamentos/)).toBeChecked();

    fireEvent.click(screen.getByRole("tab", { name: "Teoria" }));
    fireEvent.click(screen.getByRole("tab", { name: "Sessão de estudo" }));
    expect(screen.getByLabelText(/Parte 1 — Fundamentos/)).not.toBeChecked();
  });

  it("leva da sessão de estudo para a teoria do assunto marcado", async () => {
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sessão de estudo" }));
    fireEvent.click(screen.getByLabelText(/Parte 1 — Fundamentos/));

    fireEvent.click(screen.getByRole("button", { name: "Ler a teoria antes das questões" }));

    expect(screen.getByRole("tab", { name: "Teoria" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Texto do capítulo um.")).toBeInTheDocument();
    expect(api.getTheory).toHaveBeenCalledWith("t1");
  });

  it("ordena os tópicos de 1 a 28 e deixa os simulados por último", async () => {
    render(<ConcursosDashboard />);
    await screen.findByRole("tab", { name: "Questões" });

    const list = screen.getByRole("heading", { name: "Tópicos" }).parentElement as HTMLElement;
    const names = within(list)
      .getAllByRole("button")
      .map((button) => button.textContent?.replace(/\d+$/, ""));
    expect(names).toEqual([
      "Parte 1 — Fundamentos",
      "Parte 2 — Programação",
      "Parte 10 — Infraestrutura",
      "Simulado Integrado",
    ]);
  });

  it("lista as questões do tópico escolhido sem mostrar o gabarito antes da hora", async () => {
    api.listQuestions.mockResolvedValue([question("q1", "t1", "Enunciado da primeira?"), question("q2", "t1", "Enunciado da segunda?")]);
    render(<ConcursosDashboard />);
    await screen.findByRole("tab", { name: "Questões" });

    fireEvent.click(screen.getByRole("button", { name: /Parte 1 — Fundamentos/ }));

    expect(await screen.findByText("Enunciado da primeira?")).toBeInTheDocument();
    expect(api.listQuestions).toHaveBeenCalledWith("t1");
    expect(screen.getByText("Enunciado da segunda?")).toBeInTheDocument();
    expect(screen.queryByText(/Gabarito/)).not.toBeInTheDocument();
    expect(screen.queryByText("Porque sim.")).not.toBeInTheDocument();
  });

  it("no celular, guarda todas as questões num bloco que abre os tópicos e, dentro deles, as questões", async () => {
    setViewport("mobile");
    api.listQuestions.mockResolvedValue([question("q1", "t1", "Enunciado no celular?")]);
    render(<ConcursosDashboard />);

    const bank = await screen.findByRole("button", { name: /Todas as questões/ });
    expect(bank).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Parte 1 — Fundamentos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tópicos" })).not.toBeInTheDocument();

    fireEvent.click(bank);
    expect(bank).toHaveAttribute("aria-expanded", "true");

    const topicButton = screen.getByRole("button", { name: /Parte 1 — Fundamentos/ });
    expect(topicButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(topicButton);

    expect(await screen.findByText("Enunciado no celular?")).toBeInTheDocument();
    expect(topicButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText(/Gabarito/)).not.toBeInTheDocument();

    fireEvent.click(topicButton);
    await waitFor(() => expect(screen.queryByText("Enunciado no celular?")).not.toBeInTheDocument());

    fireEvent.click(bank);
    expect(screen.queryByRole("button", { name: /Parte 1 — Fundamentos/ })).not.toBeInTheDocument();
  });
});
