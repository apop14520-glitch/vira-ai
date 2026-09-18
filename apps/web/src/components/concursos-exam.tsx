"use client";

import { useEffect, useRef, useState } from "react";

import { formatClock, optionText, optionsOf, percentage, useScrollIntoViewOnChange } from "@/components/concursos-shared";
import { TopicPicker } from "@/components/concursos-topic-picker";
import { choice, letter as letterTone, reviewCard, scoreTone, timerTone, ui } from "@/components/concursos-ui";
import { concursosApi, ExamResult, QuestionOption, QuestionPublic, Topic } from "@/lib/concursos-api";

type Phase = "setup" | "running" | "result";

const MAX_QUESTIONS = 100;
const MINUTES_PER_QUESTION = 2;

const isIntegratedExamTopic = (topic: Topic) => topic.name.trim().toLowerCase().startsWith("simulado");

function MinutesField({ label, value, onChange }: { label: string; value: number; onChange: (minutes: number) => void }) {
  return (
    <label className={`flex flex-wrap items-center gap-3 ${ui.body} font-bold`}>
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className={`w-24 ${ui.control}`}
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
  const rootRef = useScrollIntoViewOnChange(phase);

  const integratedTopics = topics.filter((topic) => isIntegratedExamTopic(topic) && topic.question_count > 0);
  const integratedTotal = Math.min(
    MAX_QUESTIONS,
    integratedTopics.reduce((sum, topic) => sum + topic.question_count, 0),
  );
  const integratedMinutesValue = integratedMinutes ?? integratedTotal * MINUTES_PER_QUESTION;

  const customPool = topics.filter((topic) => customTopicIds.length === 0 || customTopicIds.includes(topic.id));
  const customAvailable = customPool.reduce((sum, topic) => sum + topic.question_count, 0);
  const customDrawn = Math.min(customQuantity, customAvailable);
  const customMinutesValue = customMinutes ?? customDrawn * MINUTES_PER_QUESTION;

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

  // O intervalo sobrevive às renderizações, então precisa chamar o fechamento mais recente (respostas atuais).
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

  let content;

  if (phase === "setup") {
    content = (
      <section className="space-y-4">
        <div className={ui.card}>
          <h2 className={ui.title}>Simulados</h2>
          <p className={`mt-1 ${ui.muted}`}>
            Prova com cronômetro: você responde tudo primeiro e só vê o gabarito e a nota no final.
          </p>
        </div>

        <div className={`${ui.card} space-y-3`}>
          <h3 className={ui.heading}>Simulado Integrado</h3>
          {integratedTotal === 0 ? (
            <p className={ui.muted}>Nenhum simulado integrado cadastrado ainda.</p>
          ) : (
            <>
              <p className={ui.muted}>{integratedTotal} questões de vários assuntos, em ordem aleatória.</p>
              <MinutesField
                label="Tempo do simulado integrado (minutos, 0 = sem limite)"
                value={integratedMinutesValue}
                onChange={setIntegratedMinutes}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => begin(integratedTopics.map((topic) => topic.id), integratedTotal, integratedMinutesValue)}
                className={`${ui.primaryButton} w-full sm:w-auto`}
              >
                Iniciar Simulado Integrado
              </button>
            </>
          )}
        </div>

        <div className={`${ui.card} space-y-4`}>
          <h3 className={ui.heading}>Simulado personalizado</h3>
          <TopicPicker
            legend="Assuntos (nenhum marcado = todos)"
            topics={topics}
            selectedIds={customTopicIds}
            onChange={setCustomTopicIds}
          />
          <p className={ui.muted}>{customAvailable} questões disponíveis nos assuntos escolhidos.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            <label className={`flex flex-wrap items-center gap-3 ${ui.body} font-bold`}>
              Quantidade de questões
              <input
                type="number"
                min={1}
                max={MAX_QUESTIONS}
                value={customQuantity}
                onChange={(event) =>
                  setCustomQuantity(Math.min(MAX_QUESTIONS, Math.max(1, Number(event.target.value) || 1)))
                }
                className={`w-24 ${ui.control}`}
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
            className={`${ui.primaryButton} w-full sm:w-auto`}
          >
            Iniciar simulado personalizado
          </button>
        </div>

        {error && <p role="alert" className={ui.alert}>{error}</p>}
      </section>
    );
  } else if (phase === "result" && result) {
    const byId = new Map(result.results.map((item) => [item.question_id, item]));
    const score = percentage(result.correct, result.total);
    const tone = score >= 70 ? scoreTone.good : score >= 50 ? scoreTone.fair : scoreTone.poor;
    content = (
      <section className={`${ui.card} space-y-5`}>
        <h2 className={ui.title}>Resultado do simulado</h2>
        <div className={`space-y-1 rounded-2xl border px-4 py-3 text-sm font-semibold ${tone}`}>
          <p className="text-base font-black">
            Você acertou {result.correct} de {result.total} ({score}%).
          </p>
          <p>Em branco: {result.blank}</p>
          <p>Tempo usado: {formatClock(elapsedSeconds)}</p>
        </div>
        <div className="space-y-3">
          {questions.map((question, position) => {
            const item = byId.get(question.id);
            if (!item) return null;
            const card = item.is_correct ? reviewCard.correct : item.selected_option ? reviewCard.wrong : reviewCard.blank;
            const answerTone = item.is_correct
              ? "text-emerald-700 dark:text-emerald-300"
              : item.selected_option
                ? "text-red-700 dark:text-red-300"
                : "text-slate-600 dark:text-slate-400";
            return (
              <div key={question.id} className={card}>
                <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-slate-100">
                  {position + 1}. {question.statement}
                </p>
                <p className={`mt-2 text-sm font-semibold ${answerTone}`}>
                  {item.selected_option
                    ? `Sua resposta: ${item.selected_option.toUpperCase()}) ${optionText(question, item.selected_option)}`
                    : "Em branco"}
                </p>
                {!item.is_correct && (
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Gabarito: {item.correct_option.toUpperCase()}) {optionText(question, item.correct_option)}
                  </p>
                )}
                {item.explanation && <p className={`mt-2 ${ui.body}`}>{item.explanation}</p>}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setPhase("setup")} className={`${ui.primaryButton} w-full sm:w-auto`}>
          Novo simulado
        </button>
      </section>
    );
  } else {
    const timerClass = remaining <= 60 ? timerTone.critical : remaining <= 300 ? timerTone.warning : timerTone.calm;
    content = (
      <section className="space-y-4">
        <div className="sticky top-[4.5rem] z-10 space-y-3 rounded-2xl border border-slate-300 bg-white/95 p-3 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <span className={timeLimitSeconds > 0 ? timerClass : timerTone.calm}>
              {timeLimitSeconds > 0 ? `Tempo restante: ${formatClock(remaining)}` : "Sem limite de tempo"}
            </span>
            <span>Respondidas: {answeredCount} de {questions.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all"
              style={{ width: `${percentage(answeredCount, questions.length)}%` }}
            />
          </div>
          {!confirming ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => (blankCount > 0 ? setConfirming(true) : void finish())}
              className={`${ui.primaryButton} w-full !py-2 sm:w-auto`}
            >
              Finalizar simulado
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                Ainda há {blankCount} em branco. Finalizar mesmo assim?
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void finish()}
                className={`${ui.primaryButton} !px-4 !py-2`}
              >
                Sim, finalizar
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={ui.linkButton}>
                Continuar respondendo
              </button>
            </div>
          )}
        </div>
        {error && <p role="alert" className={ui.alert}>{error}</p>}
        {questions.map((question, position) => (
          <div key={question.id} className={ui.card}>
            <p className="text-base font-semibold leading-7 text-slate-950 dark:text-slate-100">
              {position + 1}. {question.statement}
            </p>
            <div className="mt-3 grid gap-2">
              {optionsOf(question).map(({ letter, text }) => {
                const selected = answers[question.id] === letter;
                return (
                  <label key={letter} className={`${selected ? choice.selected : choice.idle} cursor-pointer`}>
                    <input
                      type="radio"
                      name={`exam-${question.id}`}
                      checked={selected}
                      onChange={() => setAnswers({ ...answers, [question.id]: letter })}
                      className={`mt-1.5 h-4 w-4 shrink-0 ${ui.accent}`}
                    />
                    <span className={selected ? letterTone.selected : letterTone.idle}>{letter.toUpperCase()}</span>
                    <span className="min-w-0">{text}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    );
  }

  return <div ref={rootRef} className="scroll-mt-20">{content}</div>;
}
