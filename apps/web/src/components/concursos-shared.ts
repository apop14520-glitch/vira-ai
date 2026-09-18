import { useEffect, useRef, type RefObject } from "react";

import type { QuestionOption, QuestionPublic, Topic } from "@/lib/concursos-api";

const OPTION_LETTERS: QuestionOption[] = ["a", "b", "c", "d", "e"];
const PART_NUMBER = /^Parte\s+(\d+)\b/i;

export function optionsOf(question: QuestionPublic): { letter: QuestionOption; text: string }[] {
  return OPTION_LETTERS.flatMap((letter) => {
    const text = question[`option_${letter}`];
    return text ? [{ letter, text }] : [];
  });
}

export function optionText(question: QuestionPublic, letter: QuestionOption): string {
  return optionsOf(question).find((option) => option.letter === letter)?.text ?? "";
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function percentage(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

/** "Parte 1" a "Parte 28" em ordem numérica; o que não é "Parte N" (os simulados) vem depois. */
export function sortTopics(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => {
    const partA = PART_NUMBER.exec(a.name);
    const partB = PART_NUMBER.exec(b.name);
    if (partA && partB) return Number(partA[1]) - Number(partB[1]);
    if (partA) return -1;
    if (partB) return 1;
    return a.name.localeCompare(b.name, "pt-BR", { numeric: true });
  });
}

/**
 * Leva o início do bloco para a tela quando `key` muda (não na primeira renderização).
 * Sem isso, iniciar uma prova pelo botão no fim de uma página longa deixa a pessoa
 * no meio das questões.
 */
export function useScrollIntoViewOnChange(key: string): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const previous = useRef(key);

  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    ref.current?.scrollIntoView?.({ block: "start" });
  }, [key]);

  return ref;
}
