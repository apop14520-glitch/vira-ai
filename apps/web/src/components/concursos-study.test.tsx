import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StudySession } from "@/components/concursos-study";
import type { QuestionPublic, Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({ drawQuestions: vi.fn(), checkAnswer: vi.fn() }));
vi.mock("@/lib/concursos-api", () => ({ concursosApi: api }));

const topics: Topic[] = [
  { id: "t1", organization_id: "o", name: "Redes", description: "", question_count: 2, has_theory: true, created_at: "" },
  { id: "t2", organization_id: "o", name: "Vazio", description: "", question_count: 0, has_theory: false, created_at: "" },
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

describe("StudySession", () => {
  beforeEach(() => {
    api.drawQuestions.mockReset();
    api.checkAnswer.mockReset();
  });

  it("só oferece assuntos que têm questões", () => {
    render(<StudySession topics={topics} />);

    expect(screen.getByLabelText(/Redes/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Vazio/)).not.toBeInTheDocument();
  });

  it("mostra o gabarito e a explicação logo após responder e resume a sessão no final", async () => {
    api.drawQuestions.mockResolvedValue([question("q1", "Primeira pergunta?"), question("q2", "Segunda pergunta?")]);
    api.checkAnswer
      .mockResolvedValueOnce({
        question_id: "q1",
        selected_option: "a",
        correct_option: "b",
        is_correct: false,
        explanation: "Porque a alternativa B é a correta.",
      })
      .mockResolvedValueOnce({
        question_id: "q2",
        selected_option: "c",
        correct_option: "c",
        is_correct: true,
        explanation: "",
      });

    render(<StudySession topics={topics} />);
    fireEvent.click(screen.getByLabelText(/Redes/));
    fireEvent.click(screen.getByRole("button", { name: "Começar sessão" }));

    expect(await screen.findByText("Primeira pergunta?")).toBeInTheDocument();
    expect(api.drawQuestions).toHaveBeenCalledWith(["t1"], 10);
    expect(screen.getByText("Questão 1 de 2")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^A\s*Opção um/ }));

    const feedback = await screen.findByRole("status");
    expect(feedback).toHaveTextContent("Incorreto. Gabarito: B");
    expect(feedback).toHaveTextContent("Porque a alternativa B é a correta.");
    expect(screen.getByRole("button", { name: /^C\s*Opção três/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima questão" }));
    expect(await screen.findByText("Segunda pergunta?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^C\s*Opção três/ }));
    expect(await screen.findByText("Correto!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver resultado" }));
    expect(await screen.findByText("Você acertou 1 de 2 (50%).")).toBeInTheDocument();
    expect(screen.getByText("Para revisar")).toBeInTheDocument();
    expect(screen.getByText("Primeira pergunta?")).toBeInTheDocument();
    expect(screen.getByText(/Gabarito: B\) Opção dois/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nova sessão" }));
    expect(screen.getByRole("button", { name: "Começar sessão" })).toBeInTheDocument();
  });

  it("abre com os assuntos já marcados quando vem da teoria", () => {
    render(<StudySession topics={topics} initialTopicIds={["t1"]} />);

    expect(screen.getByLabelText(/Redes/)).toBeChecked();
  });

  it("oferece ler a teoria quando exatamente um assunto com teoria está marcado", () => {
    const onOpenTheory = vi.fn();
    render(<StudySession topics={topics} onOpenTheory={onOpenTheory} />);

    expect(screen.queryByRole("button", { name: /Ler a teoria/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Redes/));
    fireEvent.click(screen.getByRole("button", { name: "Ler a teoria antes das questões" }));

    expect(onOpenTheory).toHaveBeenCalledWith("t1");
  });

  it("não oferece a teoria de um assunto que não tem", () => {
    const semTeoria = [{ ...topics[0], has_theory: false }];
    render(<StudySession topics={semTeoria} initialTopicIds={["t1"]} onOpenTheory={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Ler a teoria/ })).not.toBeInTheDocument();
  });

  it("avisa quando não há questões e não inicia a sessão", async () => {
    api.drawQuestions.mockResolvedValue([]);

    render(<StudySession topics={topics} />);
    fireEvent.click(screen.getByRole("button", { name: "Começar sessão" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não há questões nos tópicos escolhidos."));
    expect(screen.queryByText(/Questão 1 de/)).not.toBeInTheDocument();
  });
});
