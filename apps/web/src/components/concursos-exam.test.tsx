import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamMode } from "@/components/concursos-exam";
import type { QuestionPublic, Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({ drawQuestions: vi.fn(), submitExam: vi.fn() }));
vi.mock("@/lib/concursos-api", () => ({ concursosApi: api }));

const topics: Topic[] = [
  { id: "s1", organization_id: "o", name: "Simulado Integrado", description: "", question_count: 20, created_at: "" },
  {
    id: "s2",
    organization_id: "o",
    name: "Simulado Integrado — Conhecimentos Gerais",
    description: "",
    question_count: 12,
    created_at: "",
  },
  { id: "t1", organization_id: "o", name: "Redes", description: "", question_count: 5, created_at: "" },
];

const question = (id: string, statement: string): QuestionPublic => ({
  id,
  topic_id: "t1",
  statement,
  option_a: "Alternativa um",
  option_b: "Alternativa dois",
  option_c: "Alternativa três",
  option_d: "Alternativa quatro",
  option_e: null,
  difficulty: "media",
});

const drawn = [question("q1", "Primeira da prova?"), question("q2", "Segunda da prova?")];

const graded = {
  total: 2,
  correct: 1,
  blank: 1,
  results: [
    { question_id: "q1", selected_option: "b", correct_option: "b", is_correct: true, explanation: "Certo." },
    { question_id: "q2", selected_option: null, correct_option: "c", is_correct: false, explanation: "Ver a regra." },
  ],
};

describe("ExamMode", () => {
  beforeEach(() => {
    api.drawQuestions.mockReset();
    api.submitExam.mockReset();
    api.drawQuestions.mockResolvedValue(drawn);
    api.submitExam.mockResolvedValue(graded);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("monta o Simulado Integrado com todas as questões dos tópicos de simulado", async () => {
    render(<ExamMode topics={topics} />);

    expect(screen.getByText("32 questões de vários assuntos, em ordem aleatória.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tempo do simulado integrado/)).toHaveValue(64);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar Simulado Integrado" }));

    expect(await screen.findByText("1. Primeira da prova?")).toBeInTheDocument();
    expect(api.drawQuestions).toHaveBeenCalledWith(["s1", "s2"], 32);
    expect(screen.getByText("Tempo restante: 64:00")).toBeInTheDocument();
  });

  it("não revela gabarito durante a prova e corrige tudo no final, contando as em branco", async () => {
    render(<ExamMode topics={topics} />);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Simulado Integrado" }));
    await screen.findByText("1. Primeira da prova?");

    expect(screen.getByText("Respondidas: 0 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText(/^B\s*Alternativa dois/)[0]);
    expect(screen.getByText("Respondidas: 1 de 2")).toBeInTheDocument();
    expect(screen.queryByText(/Gabarito/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finalizar simulado" }));
    expect(screen.getByText("Ainda há 1 em branco. Finalizar mesmo assim?")).toBeInTheDocument();
    expect(api.submitExam).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sim, finalizar" }));

    expect(await screen.findByText("Você acertou 1 de 2 (50%).")).toBeInTheDocument();
    expect(api.submitExam).toHaveBeenCalledWith([{ question_id: "q1", selected_option: "b" }], ["q2"]);
    expect(screen.getByText("Em branco: 1")).toBeInTheDocument();
    expect(screen.getAllByText("Em branco")).toHaveLength(1);
    expect(screen.getByText(/Gabarito: C\) Alternativa três/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo simulado" }));
    expect(screen.getByRole("button", { name: "Iniciar Simulado Integrado" })).toBeInTheDocument();
  });

  it("envia sozinho quando o tempo acaba, com as respostas dadas até ali", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ExamMode topics={topics} />);

    fireEvent.change(screen.getByLabelText(/Tempo do simulado integrado/), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Simulado Integrado" }));
    await screen.findByText("1. Primeira da prova?");

    fireEvent.click(screen.getAllByLabelText(/^B\s*Alternativa dois/)[0]);
    expect(api.submitExam).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(api.submitExam).toHaveBeenCalledTimes(1);
    expect(api.submitExam).toHaveBeenCalledWith([{ question_id: "q1", selected_option: "b" }], ["q2"]);
    expect(await screen.findByText("Resultado do simulado")).toBeInTheDocument();
  });

  it("volta ao topo ao iniciar a prova, para não deixar a pessoa no meio das questões", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<ExamMode topics={topics} />);
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Iniciar Simulado Integrado" }));
    await screen.findByText("1. Primeira da prova?");

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    const callsAfterStart = scrollIntoView.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Finalizar simulado" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, finalizar" }));
    await screen.findByText("Resultado do simulado");

    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsAfterStart);
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("sugere o tempo do simulado personalizado pelas questões que existem, não pela quantidade pedida", () => {
    render(<ExamMode topics={topics} />);

    fireEvent.click(screen.getByLabelText(/Redes/));

    expect(screen.getByText("5 questões disponíveis nos assuntos escolhidos.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tempo do simulado personalizado/)).toHaveValue(10);
  });

  it("permite um simulado personalizado e sem limite de tempo", async () => {
    render(<ExamMode topics={topics} />);

    fireEvent.click(screen.getByLabelText(/Redes/));
    fireEvent.change(screen.getByLabelText(/Tempo do simulado personalizado/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar simulado personalizado" }));

    expect(await screen.findByText("Sem limite de tempo")).toBeInTheDocument();
    expect(api.drawQuestions).toHaveBeenCalledWith(["t1"], 20);
  });
});
