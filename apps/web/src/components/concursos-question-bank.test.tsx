import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConcursosQuestionBank } from "@/components/concursos-question-bank";
import type { Question, QuestionDifficulty, Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({ listQuestions: vi.fn(), auditEvents: vi.fn() }));
vi.mock("@/lib/concursos-api", () => ({ concursosApi: api }));

const topic = (id: string, name: string, count: number): Topic => ({
  id,
  organization_id: "o",
  name,
  description: "",
  question_count: count,
  has_theory: false,
  created_at: "",
});

const question = (id: string, topicId: string, statement: string, difficulty: QuestionDifficulty = "media"): Question => ({
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
  difficulty,
  source: "manual",
  created_at: "",
});

const topics = [topic("t1", "Parte 1 — Fundamentos", 2), topic("t2", "Parte 2 — Programação", 1)];
const questions = [
  question("q1", "t1", "Enunciado da primeira?", "facil"),
  question("q2", "t1", "Enunciado da segunda?", "media"),
  question("q3", "t2", "Enunciado da terceira?", "dificil"),
];

function setViewport(kind: "desktop" | "mobile") {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: kind === "desktop" && query.includes("min-width"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("ConcursosQuestionBank", () => {
  beforeEach(() => {
    setViewport("desktop");
    api.listQuestions.mockReset().mockResolvedValue(questions);
    api.auditEvents.mockReset().mockResolvedValue([]);
  });

  it("carrega o banco todo de uma vez e mostra as questões agrupadas por assunto, sem gabarito", async () => {
    render(<ConcursosQuestionBank topics={topics} onError={vi.fn()} />);

    expect(await screen.findByText("Enunciado da primeira?")).toBeInTheDocument();
    expect(api.listQuestions).toHaveBeenCalledTimes(1);
    expect(api.listQuestions).toHaveBeenCalledWith();
    expect(screen.getByText("3 questões")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Parte 1 — Fundamentos/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Parte 2 — Programação/ })).toBeInTheDocument();
    expect(screen.queryByText(/Gabarito/)).not.toBeInTheDocument();
    expect(screen.queryByText("Porque sim.")).not.toBeInTheDocument();
  });

  it("filtra por assunto com as caixas de marcação e mostra os filtros ativos", async () => {
    render(<ConcursosQuestionBank topics={topics} onError={vi.fn()} />);
    await screen.findByText("Enunciado da primeira?");

    fireEvent.click(screen.getByRole("checkbox", { name: /Parte 2 — Programação/ }));

    expect(screen.getByText("Enunciado da terceira?")).toBeInTheDocument();
    expect(screen.queryByText("Enunciado da primeira?")).not.toBeInTheDocument();
    expect(screen.getByText("1 questão encontrada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover filtro Parte 2 — Programação" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover filtro Parte 2 — Programação" }));
    expect(screen.getByText("3 questões")).toBeInTheDocument();
  });

  it("busca o assunto no campo de busca do filtro", async () => {
    render(<ConcursosQuestionBank topics={topics} onError={vi.fn()} />);
    await screen.findByText("Enunciado da primeira?");

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar assunto" }), { target: { value: "programacao" } });

    expect(screen.getByRole("checkbox", { name: /Parte 2 — Programação/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Parte 1 — Fundamentos/ })).not.toBeInTheDocument();
  });

  it("combina assunto e dificuldade e limpa tudo de uma vez", async () => {
    render(<ConcursosQuestionBank topics={topics} onError={vi.fn()} />);
    await screen.findByText("Enunciado da primeira?");

    const difficulty = within(screen.getByRole("button", { name: "Dificuldade" }).closest("section") as HTMLElement);
    fireEvent.click(difficulty.getByLabelText(/Fácil/));
    expect(screen.getByText("Enunciado da primeira?")).toBeInTheDocument();
    expect(screen.queryByText("Enunciado da segunda?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Parte 2 — Programação/ }));
    expect(screen.getByText("Nenhuma questão com esses filtros.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("3 questões")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("conta as questões de cada dificuldade", async () => {
    render(<ConcursosQuestionBank topics={topics} onError={vi.fn()} />);
    await screen.findByText("Enunciado da primeira?");

    const difficulty = within(screen.getByRole("button", { name: "Dificuldade" }).closest("section") as HTMLElement);
    expect(difficulty.getByLabelText(/Difícil/).closest("label")).toHaveTextContent("1");
    expect(difficulty.getByLabelText(/Média/).closest("label")).toHaveTextContent("1");
  });

  it("no celular, os filtros começam recolhidos e abrem pelo título", async () => {
    setViewport("mobile");
    render(<ConcursosQuestionBank topics={topics} onError={vi.fn()} />);
    await screen.findByText("Enunciado da primeira?");

    const header = screen.getByRole("button", { name: "Assuntos" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: /Parte 1 — Fundamentos/ })).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByRole("checkbox", { name: /Parte 1 — Fundamentos/ })).toBeInTheDocument();
  });

  it("avisa o erro de carregamento", async () => {
    api.listQuestions.mockRejectedValue(new Error("Falha ao carregar"));
    const onError = vi.fn();
    render(<ConcursosQuestionBank topics={topics} onError={onError} />);

    await screen.findByText("0 questões");
    expect(onError).toHaveBeenCalledWith("Falha ao carregar");
  });

  it("mostra o log de auditoria sob demanda", async () => {
    render(<ConcursosQuestionBank topics={topics} onError={vi.fn()} />);
    await screen.findByText("Enunciado da primeira?");

    fireEvent.click(screen.getByRole("button", { name: "Ver log de auditoria" }));

    expect(await screen.findByText("Nenhum evento registrado.")).toBeInTheDocument();
    expect(api.auditEvents).toHaveBeenCalledTimes(1);
  });
});
