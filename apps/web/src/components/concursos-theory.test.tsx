import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConcursosTheory } from "@/components/concursos-theory";
import type { Theory, Topic } from "@/lib/concursos-api";

const api = vi.hoisted(() => ({ getTheory: vi.fn() }));
vi.mock("@/lib/concursos-api", () => ({ concursosApi: api }));

const topic = (id: string, name: string, overrides: Partial<Topic> = {}): Topic => ({
  id,
  organization_id: "o",
  name,
  description: "",
  question_count: 2,
  has_theory: true,
  created_at: "",
  ...overrides,
});

const theory: Theory = {
  summary: "Arquitetura, algoritmos e estruturas de dados",
  sources: "Manual Completo, edição 3.0+",
  chapters: [
    {
      number: "1.1",
      title: "Organização de computadores",
      objective: "Explicar o sistema computacional.",
      sections: [
        {
          heading: "O sistema computacional",
          blocks: [
            { type: "paragraph", text: "Um sistema computacional recebe dados." },
            { type: "definition", term: "ULA", text: "unidade que executa operações aritméticas." },
            { type: "callout", text: "Cache não substitui a RAM." },
            {
              type: "table",
              caption: "Barramentos",
              header: ["Grupo", "Pergunta respondida"],
              rows: [
                ["Dados", "O que é transferido?"],
                ["Endereços", "Onde está?"],
              ],
            },
          ],
        },
      ],
      review: ["A CPU coordena a execução."],
    },
    {
      number: "1.2",
      title: "Algoritmos",
      objective: "",
      sections: [{ heading: "Custo", blocks: [{ type: "paragraph", text: "Big-O compara crescimento." }] }],
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
  topic("t1", "Parte 1 — Fundamentos"),
  topic("s1", "Simulado Integrado", { has_theory: false, question_count: 24 }),
];

describe("ConcursosTheory", () => {
  beforeEach(() => {
    setViewport("desktop");
    api.getTheory.mockReset().mockResolvedValue(theory);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("lista só os assuntos que têm teoria, em ordem numérica", () => {
    render(<ConcursosTheory topics={topics} onPractice={vi.fn()} />);

    const list = screen.getByRole("heading", { name: "Assuntos" }).parentElement as HTMLElement;
    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Parte 1 — Fundamentos",
      "Parte 10 — Infraestrutura",
    ]);
    expect(screen.getByText("Escolha um assunto para ler a teoria.")).toBeInTheDocument();
  });

  it("abre um assunto e mostra objetivo, texto, definição, destaque, tabela e revisão do capítulo", async () => {
    render(<ConcursosTheory topics={topics} onPractice={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Parte 1 — Fundamentos" }));

    expect(await screen.findByRole("heading", { name: "Organização de computadores" })).toBeInTheDocument();
    expect(api.getTheory).toHaveBeenCalledWith("t1");
    expect(screen.getByText("Arquitetura, algoritmos e estruturas de dados")).toBeInTheDocument();
    expect(screen.getByText("Explicar o sistema computacional.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O sistema computacional" })).toBeInTheDocument();
    expect(screen.getByText("Um sistema computacional recebe dados.")).toBeInTheDocument();
    expect(screen.getByText("ULA")).toBeInTheDocument();
    expect(screen.getByText(/unidade que executa operações aritméticas/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Importante lembrar");
    expect(screen.getByRole("note")).toHaveTextContent("Cache não substitui a RAM.");

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Grupo" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Endereços" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "Onde está?" })).toBeInTheDocument();
    expect(screen.getByText("Barramentos")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Revisão do capítulo" })).toBeInTheDocument();
    expect(screen.getByText("A CPU coordena a execução.")).toBeInTheDocument();
  });

  it("navega entre capítulos, volta ao início do texto e só oferece as questões no último", async () => {
    const onPractice = vi.fn();
    render(<ConcursosTheory topics={topics} onPractice={onPractice} />);
    fireEvent.click(screen.getByRole("button", { name: "Parte 1 — Fundamentos" }));
    await screen.findByRole("heading", { name: "Organização de computadores" });

    expect(screen.getByRole("button", { name: /Capítulo 1\.1/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Capítulo anterior/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Praticar questões/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Fontes de estudo/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Próximo capítulo/ }));

    expect(await screen.findByRole("heading", { name: "Algoritmos" })).toBeInTheDocument();
    expect(screen.getByText("Big-O compara crescimento.")).toBeInTheDocument();
    expect(screen.queryByText("Um sistema computacional recebe dados.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Capítulo 1\.2/ })).toHaveAttribute("aria-current", "true");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText(/Manual Completo, edição 3\.0\+/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Próximo capítulo/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Praticar questões deste tópico" }));
    expect(onPractice).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByRole("button", { name: /Capítulo 1\.1/ }));
    expect(await screen.findByRole("heading", { name: "Organização de computadores" })).toBeInTheDocument();
  });

  it("não oferece a prática quando o assunto não tem questões", async () => {
    const semQuestoes = [topic("t29", "Parte 29 — Revisão Estratégica", { question_count: 0 })];
    api.getTheory.mockResolvedValue({ ...theory, chapters: [theory.chapters[1]] });
    render(<ConcursosTheory topics={semQuestoes} onPractice={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Parte 29 — Revisão Estratégica" }));

    await screen.findByRole("heading", { name: "Algoritmos" });
    expect(screen.queryByRole("button", { name: /Praticar questões/ })).not.toBeInTheDocument();
  });

  it("abre direto no assunto pedido e mostra o erro quando a teoria não carrega", async () => {
    api.getTheory.mockRejectedValue(new Error("Este tópico ainda não tem teoria."));
    render(<ConcursosTheory topics={topics} initialTopicId="t10" onPractice={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Este tópico ainda não tem teoria."));
    expect(api.getTheory).toHaveBeenCalledWith("t10");
  });

  it("no celular, mostra a lista de assuntos e, ao escolher um, só o texto com botão para voltar", async () => {
    setViewport("mobile");
    render(<ConcursosTheory topics={topics} onPractice={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Parte 1 — Fundamentos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Parte 1 — Fundamentos" }));

    expect(await screen.findByRole("heading", { name: "Organização de computadores" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Parte 10 — Infraestrutura" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Todos os assuntos/ }));

    expect(screen.getByRole("button", { name: "Parte 10 — Infraestrutura" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Organização de computadores" })).not.toBeInTheDocument();
  });
});
