import { describe, expect, it } from "vitest";

import { sortTopics } from "@/components/concursos-shared";
import type { Topic } from "@/lib/concursos-api";

const topic = (name: string): Topic => ({
  id: name,
  organization_id: "o",
  name,
  description: "",
  question_count: 1,
  has_theory: false,
  created_at: "",
});

describe("sortTopics", () => {
  it("ordena 'Parte 1' a 'Parte 28' numericamente e não alfabeticamente", () => {
    const shuffled = [28, 10, 2, 19, 1, 9].map((number) => topic(`Parte ${number} — Assunto`));

    expect(sortTopics(shuffled).map((item) => item.name)).toEqual([
      "Parte 1 — Assunto",
      "Parte 2 — Assunto",
      "Parte 9 — Assunto",
      "Parte 10 — Assunto",
      "Parte 19 — Assunto",
      "Parte 28 — Assunto",
    ]);
  });

  it("deixa os simulados depois das partes, com o integrado antes do de conhecimentos gerais", () => {
    const sorted = sortTopics([
      topic("Simulado Integrado — Conhecimentos Gerais"),
      topic("Parte 3 — Engenharia de Software"),
      topic("Simulado Integrado"),
      topic("Parte 1 — Fundamentos"),
    ]);

    expect(sorted.map((item) => item.name)).toEqual([
      "Parte 1 — Fundamentos",
      "Parte 3 — Engenharia de Software",
      "Simulado Integrado",
      "Simulado Integrado — Conhecimentos Gerais",
    ]);
  });

  it("não altera a lista original", () => {
    const original = [topic("Parte 2 — B"), topic("Parte 1 — A")];

    sortTopics(original);

    expect(original.map((item) => item.name)).toEqual(["Parte 2 — B", "Parte 1 — A"]);
  });
});
