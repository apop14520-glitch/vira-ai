import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PracticeHub } from "@/components/concursos-practice";
import type { QuestionPublic, Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({ drawQuestions: vi.fn(), checkAnswer: vi.fn(), submitExam: vi.fn() }));
vi.mock("@/lib/concursos-api", () => ({ concursosApi: api }));

const topic = (id: string, name: string, count: number, hasTheory = false): Topic => ({
  id,
  organization_id: "o",
  name,
  description: "",
  question_count: count,
  has_theory: hasTheory,
  created_at: "",
});

const topics: Topic[] = [
  topic("t1", "Parte 1 — Redes", 5, true),
  topic("t2", "Vazio", 0),
  topic("s1", "Simulado Integrado", 20),
  topic("s2", "Simulado Integrado — Conhecimentos Gerais", 12),
];

const question = (id: string, statement: string): QuestionPublic => ({
  id,
  topic_id: "t1",
  statement,
  option_a: "Opção um",
  option_b: "Opção dois",
  option_c: "Opção três",
  option_d: "Opção quatro",
  option_e: "Opção cinco",
  difficulty: "media",
});

const graded = {
  total: 2,
  correct: 1,
  blank: 1,
  results: [
    { question_id: "q1", selected_option: "b", correct_option: "b", is_correct: true, explanation: "Certo." },
    { question_id: "q2", selected_option: null, correct_option: "c", is_correct: false, explanation: "Ver a regra." },
  ],
};

const startIntegratedExam = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Montar Simulado Integrado" }));
  fireEvent.click(screen.getByRole("button", { name: "Iniciar simulado" }));
  await screen.findByText("1. Primeira da prova?");
};

describe("PracticeHub", () => {
  beforeEach(() => {
    api.drawQuestions.mockReset();
    api.checkAnswer.mockReset();
    api.submitExam.mockReset();
    api.drawQuestions.mockResolvedValue([question("q1", "Primeira da prova?"), question("q2", "Segunda da prova?")]);
    api.submitExam.mockResolvedValue(graded);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reúne estudo e simulado numa tela só, com os assuntos escolhidos uma única vez", () => {
    render(<PracticeHub topics={topics} />);

    expect(screen.getByRole("radio", { name: /Estudo/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Simulado/ })).not.toBeChecked();
    expect(screen.getAllByRole("button", { name: /Começar sessão/ })).toHaveLength(1);
    expect(screen.queryByLabelText(/Tempo do simulado/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Simulado/ }));
    expect(screen.getByLabelText(/Tempo do simulado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar simulado" })).toBeInTheDocument();
    expect(screen.getAllByText("Assuntos (nenhum marcado = todos)")).toHaveLength(1);
  });

  it("só oferece assuntos que têm questões e agrupa os simulados à parte", () => {
    render(<PracticeHub topics={topics} />);

    expect(screen.getByLabelText(/Redes/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Vazio/)).not.toBeInTheDocument();

    const exams = within(screen.getByRole("button", { name: "Simulados" }).closest("section") as HTMLElement);
    expect(exams.getAllByRole("checkbox")).toHaveLength(2);
    expect(exams.getByLabelText(/Conhecimentos Gerais/)).toBeInTheDocument();
    expect(exams.queryByLabelText(/Redes/)).not.toBeInTheDocument();
  });

  it("no estudo, mostra o gabarito e a explicação logo após responder e resume a sessão no final", async () => {
    api.checkAnswer
      .mockResolvedValueOnce({
        question_id: "q1",
        selected_option: "a",
        correct_option: "b",
        is_correct: false,
        explanation: "Porque a alternativa B é a correta.",
      })
      .mockResolvedValueOnce({ question_id: "q2", selected_option: "c", correct_option: "c", is_correct: true, explanation: "" });

    render(<PracticeHub topics={topics} />);
    fireEvent.click(screen.getByLabelText(/Redes/));
    fireEvent.click(screen.getByRole("button", { name: "Começar sessão" }));

    expect(await screen.findByText("Primeira da prova?")).toBeInTheDocument();
    expect(api.drawQuestions).toHaveBeenCalledWith(["t1"], 10);
    expect(screen.getByText("Questão 1 de 2")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^A\s*Opção um/ }));

    const feedback = await screen.findByRole("status");
    expect(feedback).toHaveTextContent("Incorreto. Gabarito: B");
    expect(feedback).toHaveTextContent("Porque a alternativa B é a correta.");
    expect(screen.getByRole("button", { name: /^C\s*Opção três/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima questão" }));
    expect(await screen.findByText("Segunda da prova?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^C\s*Opção três/ }));
    expect(await screen.findByText("Correto!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver resultado" }));
    expect(await screen.findByText("Você acertou 1 de 2 (50%).")).toBeInTheDocument();
    expect(screen.getByText("Para revisar")).toBeInTheDocument();
    expect(screen.getByText(/Gabarito: B\) Opção dois/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nova sessão" }));
    expect(screen.getByRole("button", { name: "Começar sessão" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Redes/)).toBeChecked();
  });

  it("monta o Simulado Integrado com todas as questões dos tópicos de simulado", async () => {
    render(<PracticeHub topics={topics} />);

    expect(screen.getByText("32 questões de vários assuntos, em ordem aleatória.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Montar Simulado Integrado" }));

    expect(screen.getByRole("radio", { name: /Simulado/ })).toBeChecked();
    expect(screen.getByLabelText(/Quantidade de questões/)).toHaveValue(32);
    expect(screen.getByLabelText(/Tempo do simulado/)).toHaveValue(64);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar simulado" }));

    expect(await screen.findByText("1. Primeira da prova?")).toBeInTheDocument();
    expect(api.drawQuestions).toHaveBeenCalledWith(["s1", "s2"], 32);
    expect(screen.getByText("Tempo restante: 64:00")).toBeInTheDocument();
  });

  it("não revela gabarito durante a prova e corrige tudo no final, contando as em branco", async () => {
    render(<PracticeHub topics={topics} />);
    await startIntegratedExam();

    expect(screen.getByText("Respondidas: 0 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText(/^B\s*Opção dois/)[0]);
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
    expect(screen.getByText(/Gabarito: C\) Opção três/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo simulado" }));
    expect(screen.getByRole("button", { name: "Iniciar simulado" })).toBeInTheDocument();
  });

  it("envia sozinho quando o tempo acaba, com as respostas dadas até ali", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<PracticeHub topics={topics} />);

    fireEvent.click(screen.getByRole("button", { name: "Montar Simulado Integrado" }));
    fireEvent.change(screen.getByLabelText(/Tempo do simulado/), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar simulado" }));
    await screen.findByText("1. Primeira da prova?");

    fireEvent.click(screen.getAllByLabelText(/^B\s*Opção dois/)[0]);
    expect(api.submitExam).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(api.submitExam).toHaveBeenCalledTimes(1);
    expect(api.submitExam).toHaveBeenCalledWith([{ question_id: "q1", selected_option: "b" }], ["q2"]);
    expect(await screen.findByText("Resultado do simulado")).toBeInTheDocument();
  });

  it("volta ao topo ao iniciar e ao terminar, para não deixar a pessoa no meio das questões", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<PracticeHub topics={topics} />);
    expect(scrollIntoView).not.toHaveBeenCalled();

    await startIntegratedExam();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    const callsAfterStart = scrollIntoView.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Finalizar simulado" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, finalizar" }));
    await screen.findByText("Resultado do simulado");

    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsAfterStart);
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("sugere o tempo do simulado pelas questões que existem, não pela quantidade pedida", () => {
    render(<PracticeHub topics={topics} />);

    fireEvent.click(screen.getByLabelText(/Redes/));
    fireEvent.click(screen.getByRole("radio", { name: /Simulado/ }));

    expect(screen.getByText("5 questões disponíveis nos assuntos escolhidos.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tempo do simulado/)).toHaveValue(10);
  });

  it("permite um simulado sem limite de tempo", async () => {
    render(<PracticeHub topics={topics} />);

    fireEvent.click(screen.getByLabelText(/Redes/));
    fireEvent.click(screen.getByRole("radio", { name: /Simulado/ }));
    fireEvent.change(screen.getByLabelText(/Tempo do simulado/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar simulado" }));

    expect(await screen.findByText("Sem limite de tempo")).toBeInTheDocument();
    expect(api.drawQuestions).toHaveBeenCalledWith(["t1"], 10);
  });

  it("abre com os assuntos já marcados quando vem da teoria", () => {
    render(<PracticeHub topics={topics} initialTopicIds={["t1"]} />);

    expect(screen.getByLabelText(/Redes/)).toBeChecked();
  });

  it("oferece ler a teoria quando exatamente um assunto com teoria está marcado", () => {
    const onOpenTheory = vi.fn();
    render(<PracticeHub topics={topics} onOpenTheory={onOpenTheory} />);

    expect(screen.queryByRole("button", { name: /Ler a teoria/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Redes/));
    fireEvent.click(screen.getByRole("button", { name: "Ler a teoria antes das questões" }));

    expect(onOpenTheory).toHaveBeenCalledWith("t1");
  });

  it("não oferece a teoria de um assunto que não tem", () => {
    const semTeoria = topics.map((item) => ({ ...item, has_theory: false }));
    render(<PracticeHub topics={semTeoria} initialTopicIds={["t1"]} onOpenTheory={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Ler a teoria/ })).not.toBeInTheDocument();
  });

  it("avisa quando não há questões e não inicia a sessão", async () => {
    api.drawQuestions.mockResolvedValue([]);

    render(<PracticeHub topics={topics} />);
    fireEvent.click(screen.getByRole("button", { name: "Começar sessão" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não há questões nos tópicos escolhidos."));
    expect(screen.queryByText(/Questão 1 de/)).not.toBeInTheDocument();
  });
});
