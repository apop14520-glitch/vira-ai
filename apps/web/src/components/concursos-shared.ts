import type { QuestionOption, QuestionPublic } from "@/lib/concursos-api";

const OPTION_LETTERS: QuestionOption[] = ["a", "b", "c", "d", "e"];

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
