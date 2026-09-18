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

  it("tem só duas abas: Conteúdo (teoria e questões) e Sessão de estudo (com os simulados)", async () => {
    render(<ConcursosDashboard />);

    const areas = within(await screen.findByRole("tablist", { name: "Áreas do VIRA Concursos" }));
    expect(areas.getAllByRole("tab").map((item) => item.textContent)).toEqual(["Conteúdo", "Sessão de estudo"]);
    expect(areas.getByRole("tab", { name: "Conteúdo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Simulados" })).not.toBeInTheDocument();
    expect(screen.getByText("14 questões")).toBeInTheDocument();

    const views = within(screen.getByRole("tablist", { name: "Conteúdo" }));
    expect(views.getByRole("tab", { name: "Teoria" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Assuntos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar sessão" })).not.toBeInTheDocument();

    fireEvent.click(views.getByRole("tab", { name: "Questões" }));
    expect(await screen.findByRole("heading", { name: "Banco de questões" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Assuntos" })).not.toBeInTheDocument();

    fireEvent.click(areas.getByRole("tab", { name: "Sessão de estudo" }));
    expect(screen.getByRole("button", { name: "Começar sessão" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Simulado/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Montar Simulado Integrado" })).toBeInTheDocument();
  });

  it("é somente leitura: não oferece criar nem excluir tópicos e questões", async () => {
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Questões" }));
    await screen.findByRole("heading", { name: "Banco de questões" });

    expect(screen.queryByText("Novo tópico")).not.toBeInTheDocument();
    expect(screen.queryByText("Nova questão")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir|excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Iniciar simulado/i })).not.toBeInTheDocument();
  });

  it("não lista no filtro do banco os assuntos que só têm teoria", async () => {
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Questões" }));
    await screen.findByRole("heading", { name: "Banco de questões" });

    expect(screen.getByRole("checkbox", { name: /Parte 1 — Fundamentos/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Parte 29/ })).not.toBeInTheDocument();
    expect(screen.getByText("2 assuntos com teoria")).toBeInTheDocument();
  });

  it("leva da teoria para a sessão de estudo com o assunto já marcado", async () => {
    render(<ConcursosDashboard />);
    await screen.findByRole("tab", { name: "Conteúdo" });
    fireEvent.click(screen.getByRole("button", { name: "Parte 1 — Fundamentos" }));
    await screen.findByText("Texto do capítulo um.");

    fireEvent.click(screen.getByRole("button", { name: "Praticar questões deste tópico" }));

    expect(screen.getByRole("tab", { name: "Sessão de estudo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Parte 1 — Fundamentos/)).toBeChecked();

    fireEvent.click(screen.getByRole("tab", { name: "Conteúdo" }));
    fireEvent.click(screen.getByRole("tab", { name: "Sessão de estudo" }));
    expect(screen.getByLabelText(/Parte 1 — Fundamentos/)).not.toBeChecked();
  });

  it("leva da sessão de estudo para a teoria do assunto marcado", async () => {
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sessão de estudo" }));
    fireEvent.click(screen.getByLabelText(/Parte 1 — Fundamentos/));

    fireEvent.click(screen.getByRole("button", { name: "Ler a teoria antes das questões" }));

    expect(screen.getByRole("tab", { name: "Conteúdo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Teoria" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Texto do capítulo um.")).toBeInTheDocument();
    expect(api.getTheory).toHaveBeenCalledWith("t1");
  });

  it("ordena os assuntos do filtro de 1 a 28 e deixa os simulados por último", async () => {
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Questões" }));
    await screen.findByRole("heading", { name: "Banco de questões" });

    const group = screen.getByRole("button", { name: "Assuntos" }).closest("section") as HTMLElement;
    const names = within(group)
      .getAllByRole("checkbox")
      .map((box) => box.closest("label")?.textContent?.replace(/\d+$/, ""));
    expect(names).toEqual([
      "Parte 1 — Fundamentos",
      "Parte 2 — Programação",
      "Parte 10 — Infraestrutura",
      "Simulado Integrado",
    ]);
  });

  it("lista as questões do assunto escolhido sem mostrar o gabarito antes da hora", async () => {
    api.listQuestions.mockResolvedValue([
      question("q1", "t1", "Enunciado da primeira?"),
      question("q2", "t1", "Enunciado da segunda?"),
      question("q3", "t2", "Enunciado de outro assunto?"),
    ]);
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Questões" }));
    await screen.findByText("Enunciado da primeira?");

    fireEvent.click(screen.getByRole("checkbox", { name: /Parte 1 — Fundamentos/ }));

    expect(api.listQuestions).toHaveBeenCalledWith();
    expect(screen.getByText("Enunciado da segunda?")).toBeInTheDocument();
    expect(screen.queryByText("Enunciado de outro assunto?")).not.toBeInTheDocument();
    expect(screen.queryByText(/Gabarito/)).not.toBeInTheDocument();
    expect(screen.queryByText("Porque sim.")).not.toBeInTheDocument();
  });

  it("no celular, deixa os filtros recolhidos e abre-os pelo título", async () => {
    setViewport("mobile");
    api.listQuestions.mockResolvedValue([question("q1", "t1", "Enunciado no celular?")]);
    render(<ConcursosDashboard />);
    fireEvent.click(await screen.findByRole("tab", { name: "Questões" }));
    await screen.findByText("Enunciado no celular?");

    const header = screen.getByRole("button", { name: "Assuntos" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: /Parte 1 — Fundamentos/ })).not.toBeInTheDocument();

    fireEvent.click(header);
    fireEvent.click(screen.getByRole("checkbox", { name: /Parte 1 — Fundamentos/ }));
    await waitFor(() => expect(screen.getByText("1 questão encontrada")).toBeInTheDocument());
  });
});
