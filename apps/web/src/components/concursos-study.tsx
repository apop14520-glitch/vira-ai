"use client";

import { useState } from "react";

import { optionText, optionsOf, percentage, useScrollIntoViewOnChange } from "@/components/concursos-shared";
import { choice, letter as letterTone, reviewCard, scoreTone, ui, verdict } from "@/components/concursos-ui";
import { concursosApi, QuestionOption, QuestionPublic, QuizAnswerResult } from "@/lib/concursos-api";

type Phase = "running" | "done";
type Attempt = { question: QuestionPublic; result: QuizAnswerResult };

type StudyRunnerProps = {
  questions: QuestionPublic[];
  onExit: () => void;
};

/** Sessão de estudo: uma questão por vez, com gabarito e explicação logo depois de responder. */
export function StudyRunner({ questions, onExit }: StudyRunnerProps) {
  const [phase, setPhase] = useState<Phase>("running");
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useScrollIntoViewOnChange(`${phase}-${index}`);

  const answer = async (option: QuestionOption) => {
    if (feedback || busy) return;
    const question = questions[index];
    setBusy(true);
    setError(null);
    try {
      const result = await concursosApi.checkAnswer(question.id, option);
      setFeedback(result);
      setAttempts((current) => [...current, { question, result }]);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setPhase("done");
      return;
    }
    setIndex(index + 1);
    setFeedback(null);
  };

  const correctCount = attempts.filter((attempt) => attempt.result.is_correct).length;
  const score = percentage(correctCount, attempts.length);

  let content;

  if (phase === "done") {
    const missed = attempts.filter((attempt) => !attempt.result.is_correct);
    const tone = score >= 70 ? scoreTone.good : score >= 50 ? scoreTone.fair : scoreTone.poor;
    content = (
      <section className={`${ui.card} space-y-5`}>
        <h2 className={ui.title}>Sessão concluída</h2>
        <p className={`rounded-2xl border px-4 py-3 text-base font-black ${tone}`}>
          Você acertou {correctCount} de {attempts.length} ({score}%).
        </p>
        {missed.length > 0 && (
          <div className="space-y-3">
            <h3 className={ui.heading}>Para revisar</h3>
            {missed.map(({ question, result }) => (
              <div key={question.id} className={reviewCard.wrong}>
                <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-slate-100">{question.statement}</p>
                <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">
                  Sua resposta: {result.selected_option.toUpperCase()}) {optionText(question, result.selected_option)}
                </p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Gabarito: {result.correct_option.toUpperCase()}) {optionText(question, result.correct_option)}
                </p>
                {result.explanation && <p className={`mt-2 ${ui.body}`}>{result.explanation}</p>}
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={onExit} className={`${ui.primaryButton} w-full sm:w-auto`}>
          Nova sessão
        </button>
      </section>
    );
  } else {
    const question = questions[index];
    const isLast = index + 1 >= questions.length;
    content = (
      <section className={`${ui.card} space-y-5`}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <span>Questão {index + 1} de {questions.length}</span>
            <span>Acertos: {correctCount} de {attempts.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
          </div>
        </div>
        <p className="text-base font-semibold leading-7 text-slate-950 dark:text-slate-100">{question.statement}</p>
        <div className="grid gap-2">
          {optionsOf(question).map(({ letter, text }) => {
            let tone: keyof typeof choice = "idle";
            if (feedback) {
              if (letter === feedback.correct_option) tone = "correct";
              else if (letter === feedback.selected_option) tone = "wrong";
              else tone = "muted";
            }
            return (
              <button
                key={letter}
                type="button"
                onClick={() => answer(letter)}
                disabled={Boolean(feedback) || busy}
                className={`${choice[tone]} disabled:cursor-default`}
              >
                <span className={letterTone[tone]}>{letter.toUpperCase()}</span>
                <span className="min-w-0">{text}</span>
              </button>
            );
          })}
        </div>
        {error && <p role="alert" className={ui.alert}>{error}</p>}
        {feedback && (
          <div role="status" className={`space-y-2 ${feedback.is_correct ? verdict.correct : verdict.wrong}`}>
            <p className="font-black">
              {feedback.is_correct ? "Correto!" : `Incorreto. Gabarito: ${feedback.correct_option.toUpperCase()}`}
            </p>
            {feedback.explanation && <p className="leading-6">{feedback.explanation}</p>}
            <button type="button" onClick={next} className={`${ui.primaryButton} !px-4 !py-2`}>
              {isLast ? "Ver resultado" : "Próxima questão"}
            </button>
          </div>
        )}
      </section>
    );
  }

  return <div ref={rootRef} className="scroll-mt-20">{content}</div>;
}
