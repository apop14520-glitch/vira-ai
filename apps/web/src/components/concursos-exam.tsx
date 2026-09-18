"use client";

import { useEffect, useRef, useState } from "react";

import { formatClock, optionText, optionsOf, percentage } from "@/components/concursos-shared";
import { TopicPicker } from "@/components/concursos-topic-picker";
import { concursosApi, ExamResult, QuestionOption, QuestionPublic, Topic } from "@/lib/concursos-api";

type Phase = "setup" | "running" | "result";

const MAX_QUESTIONS = 100;
const MINUTES_PER_QUESTION = 2;

const isIntegratedExamTopic = (topic: Topic) => topic.name.trim().toLowerCase().startsWith("simulado");

function MinutesField({ label, value, onChange }: { label: string; value: number; onChange: (minutes: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white"
      />
    </label>
  );
}

export function ExamMode({ topics }: { topics: Topic[] }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [customTopicIds, setCustomTopicIds] = useState<string[]>([]);
  const [customQuantity, setCustomQuantity] = useState(20);
  const [integratedMinutes, setIntegratedMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, QuestionOption>>({});
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);

  const integratedTopics = topics.filter((topic) => isIntegratedExamTopic(topic) && topic.question_count > 0);
  const integratedTotal = Math.min(
    MAX_QUESTIONS,
    integratedTopics.reduce((sum, topic) => sum + topic.question_count, 0),
  );
  const integratedMinutesValue = integratedMinutes ?? integratedTotal * MINUTES_PER_QUESTION;
  const customMinutesValue = customMinutes ?? customQuantity * MINUTES_PER_QUESTION;

  const begin = async (topicIds: string[], quantity: number, minutes: number) => {
    setBusy(true);
    setError(null);
    try {
      const drawn = await concursosApi.drawQuestions(topicIds, quantity);
      if (drawn.length === 0) {
        setError("Não há questões para montar o simulado.");
        return;
      }
      const limit = Math.floor(minutes) * 60;
      setQuestions(drawn);
      setAnswers({});
      setResult(null);
      setConfirming(false);
      setTimeLimitSeconds(limit);
      setRemaining(limit);
      startedAt.current = Date.now();
      setPhase("running");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const answered = questions
      .filter((question) => answers[question.id])
      .map((question) => ({ question_id: question.id, selected_option: answers[question.id] }));
    const blanks = questions.filter((question) => !answers[question.id]).map((question) => question.id);
    try {
      const graded = await concursosApi.submitExam(answered, blanks);
      setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      setResult(graded);
      setConfirming(false);
      setPhase("result");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // The interval outlives renders, so it must call the latest closure (current answers).
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  useEffect(() => {
    if (phase !== "running" || timeLimitSeconds === 0) return;
    const timer = setInterval(() => {
      const left = timeLimitSeconds - Math.floor((Date.now() - startedAt.current) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        void finishRef.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, timeLimitSeconds]);

  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const blankCount = questions.length - answeredCount;

  if (phase === "setup") {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
          <h2 className="text-lg font-black text-white">Simulados</h2>
          <p className="mt-1 text-sm text-slate-400">
            Prova com cronômetro: você responde tudo primeiro e só vê o gabarito e a nota no final.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
          <h3 className="text-sm font-bold text-white">Simulado Integrado</h3>
          {integratedTotal === 0 ? (
            <p className="text-sm text-slate-500">Nenhum simulado integrado cadastrado ainda.</p>
          ) : (
            <>
              <p className="text-sm text-slate-400">{integratedTotal} questões de vários assuntos, em ordem aleatória.</p>
              <MinutesField
                label="Tempo do simulado integrado (minutos, 0 = sem limite)"
                value={integratedMinutesValue}
                onChange={setIntegratedMinutes}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => begin(integratedTopics.map((topic) => topic.id), integratedTotal, integratedMinutesValue)}
                className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
              >
                Iniciar Simulado Integrado
              </button>
            </>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
          <h3 className="text-sm font-bold text-white">Simulado personalizado</h3>
          <TopicPicker
            legend="Assuntos (nenhum marcado = todos)"
            topics={topics}
            selectedIds={customTopicIds}
            onChange={setCustomTopicIds}
          />
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Quantidade de questões
              <input
                type="number"
                min={1}
                max={MAX_QUESTIONS}
                value={customQuantity}
                onChange={(event) =>
                  setCustomQuantity(Math.min(MAX_QUESTIONS, Math.max(1, Number(event.target.value) || 1)))
                }
                className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white"
              />
            </label>
            <MinutesField
              label="Tempo do simulado personalizado (minutos, 0 = sem limite)"
              value={customMinutesValue}
              onChange={setCustomMinutes}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => begin(customTopicIds, customQuantity, customMinutesValue)}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
          >
            Iniciar simulado personalizado
          </button>
        </div>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </section>
    );
  }

  if (phase === "result" && result) {
    const byId = new Map(result.results.map((item) => [item.question_id, item]));
    return (
      <section className="space-y-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 sm:p-6">
        <h2 className="text-lg font-black text-white">Resultado do simulado</h2>
        <div className="space-y-1 text-sm text-slate-200">
          <p className="font-bold text-white">
            Você acertou {result.correct} de {result.total} ({percentage(result.correct, result.total)}%).
          </p>
          <p>Em branco: {result.blank}</p>
          <p>Tempo usado: {formatClock(elapsedSeconds)}</p>
        </div>
        <div className="space-y-3">
          {questions.map((question, position) => {
            const item = byId.get(question.id);
            if (!item) return null;
            const tone = item.is_correct
              ? "border-emerald-500/40"
              : item.selected_option
                ? "border-red-500/40"
                : "border-slate-700";
            return (
              <div key={question.id} className={`rounded-lg border ${tone} bg-slate-950/60 p-3 text-sm text-slate-300`}>
                <p className="text-slate-100">{position + 1}. {question.statement}</p>
                <p className={item.is_correct ? "mt-2 text-emerald-300" : item.selected_option ? "mt-2 text-red-300" : "mt-2 text-slate-400"}>
                  {item.selected_option
                    ? `Sua resposta: ${item.selected_option.toUpperCase()}) ${optionText(question, item.selected_option)}`
                    : "Em branco"}
                </p>
                {!item.is_correct && (
                  <p className="text-emerald-300">
                    Gabarito: {item.correct_option.toUpperCase()}) {optionText(question, item.correct_option)}
                  </p>
                )}
                {item.explanation && <p className="mt-1 text-slate-400">{item.explanation}</p>}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setPhase("setup")}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
        >
          Novo simulado
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="sticky top-[4.5rem] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/95 p-3 text-sm text-slate-200 backdrop-blur">
        <span className="font-bold">
          {timeLimitSeconds > 0 ? `Tempo restante: ${formatClock(remaining)}` : "Sem limite de tempo"}
        </span>
        <span>Respondidas: {answeredCount} de {questions.length}</span>
        {!confirming ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => (blankCount > 0 ? setConfirming(true) : void finish())}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
          >
            Finalizar simulado
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-amber-200">Ainda há {blankCount} em branco. Finalizar mesmo assim?</span>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void finish()}
              className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
            >
              Sim, finalizar
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-slate-400 underline">
              Continuar respondendo
            </button>
          </span>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {questions.map((question, position) => (
        <div key={question.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm leading-6 text-slate-100">{position + 1}. {question.statement}</p>
          <div className="mt-3 grid gap-1.5">
            {optionsOf(question).map(({ letter, text }) => (
              <label key={letter} className="flex items-start gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name={`exam-${question.id}`}
                  checked={answers[question.id] === letter}
                  onChange={() => setAnswers({ ...answers, [question.id]: letter })}
                  className="mt-1"
                />
                <span>{letter.toUpperCase()}) {text}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
