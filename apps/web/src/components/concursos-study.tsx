"use client";

import { useState } from "react";

import { optionText, optionsOf, percentage, useScrollIntoViewOnChange } from "@/components/concursos-shared";
import { TopicPicker } from "@/components/concursos-topic-picker";
import { choice, letter as letterTone, reviewCard, scoreTone, ui, verdict } from "@/components/concursos-ui";
import { concursosApi, QuestionOption, QuestionPublic, QuizAnswerResult, Topic } from "@/lib/concursos-api";

type Phase = "setup" | "running" | "done";
type Attempt = { question: QuestionPublic; result: QuizAnswerResult };

const QUANTITIES = [5, 10, 20, 50];

export function StudySession({ topics }: { topics: Topic[] }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(10);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useScrollIntoViewOnChange(`${phase}-${index}`);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const drawn = await concursosApi.drawQuestions(selectedTopicIds, quantity);
      if (drawn.length === 0) {
        setError("Não há questões nos tópicos escolhidos.");
        return;
      }
      setQuestions(drawn);
      setIndex(0);
      setFeedback(null);
      setAttempts([]);
      setPhase("running");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

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

  if (phase === "setup") {
    content = (
      <section className={`${ui.card} space-y-5`}>
        <div>
          <h2 className={ui.title}>Sessão de estudo</h2>
          <p className={`mt-1 ${ui.muted}`}>
            Resolva uma questão por vez e veja o gabarito com a explicação logo depois de responder. Sem cronômetro e
            sem nota: o objetivo é aprender.
          </p>
        </div>
        <TopicPicker
          legend="Assuntos (nenhum marcado = todos)"
          topics={topics}
          selectedIds={selectedTopicIds}
          onChange={setSelectedTopicIds}
        />
        <label className={`flex flex-wrap items-center gap-3 ${ui.body} font-bold`}>
          Quantidade de questões
          <select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className={ui.control}>
            {QUANTITIES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className={ui.alert}>{error}</p>}
        <button type="button" onClick={start} disabled={busy} className={`${ui.primaryButton} w-full sm:w-auto`}>
          Começar sessão
        </button>
      </section>
    );
  } else if (phase === "done") {
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
        <button type="button" onClick={() => setPhase("setup")} className={`${ui.primaryButton} w-full sm:w-auto`}>
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
