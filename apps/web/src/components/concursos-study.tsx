"use client";

import { useState } from "react";

import { optionText, optionsOf, percentage } from "@/components/concursos-shared";
import { TopicPicker } from "@/components/concursos-topic-picker";
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

  if (phase === "setup") {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-black text-white">Sessão de estudo</h2>
          <p className="mt-1 text-sm text-slate-400">
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
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Quantidade de questões
          <select
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white"
          >
            {QUANTITIES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
        >
          Começar sessão
        </button>
      </section>
    );
  }

  if (phase === "done") {
    const missed = attempts.filter((attempt) => !attempt.result.is_correct);
    return (
      <section className="space-y-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 sm:p-6">
        <h2 className="text-lg font-black text-white">Sessão concluída</h2>
        <p className="text-sm font-bold text-white">
          Você acertou {correctCount} de {attempts.length} ({percentage(correctCount, attempts.length)}%).
        </p>
        {missed.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">Para revisar</h3>
            {missed.map(({ question, result }) => (
              <div key={question.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                <p className="text-slate-100">{question.statement}</p>
                <p className="mt-2 text-red-300">
                  Sua resposta: {result.selected_option.toUpperCase()}) {optionText(question, result.selected_option)}
                </p>
                <p className="text-emerald-300">
                  Gabarito: {result.correct_option.toUpperCase()}) {optionText(question, result.correct_option)}
                </p>
                {result.explanation && <p className="mt-1 text-slate-400">{result.explanation}</p>}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPhase("setup")}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
        >
          Nova sessão
        </button>
      </section>
    );
  }

  const question = questions[index];
  const isLast = index + 1 >= questions.length;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>Questão {index + 1} de {questions.length}</span>
        <span>Acertos: {correctCount} de {attempts.length}</span>
      </div>
      <p className="text-base leading-7 text-slate-100">{question.statement}</p>
      <div className="grid gap-2">
        {optionsOf(question).map(({ letter, text }) => {
          let tone = "border-slate-700 bg-slate-950/60 text-slate-200 hover:border-amber-400/60";
          if (feedback) {
            if (letter === feedback.correct_option) tone = "border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
            else if (letter === feedback.selected_option) tone = "border-red-500/60 bg-red-500/10 text-red-200";
            else tone = "border-slate-800 bg-slate-950/40 text-slate-500";
          }
          return (
            <button
              key={letter}
              type="button"
              onClick={() => answer(letter)}
              disabled={Boolean(feedback) || busy}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${tone}`}
            >
              {letter.toUpperCase()}) {text}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {feedback && (
        <div role="status" className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
          <p className={feedback.is_correct ? "font-bold text-emerald-300" : "font-bold text-red-300"}>
            {feedback.is_correct ? "Correto!" : `Incorreto. Gabarito: ${feedback.correct_option.toUpperCase()}`}
          </p>
          {feedback.explanation && <p className="text-slate-300">{feedback.explanation}</p>}
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
          >
            {isLast ? "Ver resultado" : "Próxima questão"}
          </button>
        </div>
      )}
    </section>
  );
}
