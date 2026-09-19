"use client";

import { ReactNode, useState } from "react";

import { ExamRunner } from "@/components/concursos-exam";
import { isExamTopic, useScrollIntoViewOnChange } from "@/components/concursos-shared";
import { StudyRunner } from "@/components/concursos-study";
import { TopicPicker } from "@/components/concursos-topic-picker";
import { ui } from "@/components/concursos-ui";
import { concursosApi, QuestionPublic, Topic } from "@/lib/concursos-api";

type Mode = "estudo" | "simulado";
type Run = { id: number; mode: Mode; questions: QuestionPublic[]; minutes: number };

const MAX_QUESTIONS = 100;
const MINUTES_PER_QUESTION = 2;

const modes: { id: Mode; title: string; text: string }[] = [
  { id: "estudo", title: "Estudo", text: "Uma questão por vez, com gabarito e explicação logo depois de responder. Sem cronômetro." },
  { id: "simulado", title: "Simulado", text: "Prova cronometrada: você responde tudo e só vê o gabarito e a nota no final." },
];

const modeCard =
  "flex cursor-pointer flex-col gap-1 rounded-xl border border-slate-300 bg-white p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50 has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:has-[:checked]:border-cyan-400/60 dark:has-[:checked]:bg-cyan-400/15";

type PracticeProps = {
  topics: Topic[];
  /** Assuntos já marcados ao abrir (por exemplo, vindos do botão "Praticar" da teoria). */
  initialTopicIds?: string[];
  onOpenTheory?: (topicId: string) => void;
  /** Menu de navegação do Concursos, mostrado ao lado da configuração. */
  menu?: ReactNode;
};

/** Sessão de estudo e simulados numa tela só: escolhe os assuntos uma vez e depois o modo de resolver. */
export function PracticeHub({ topics, initialTopicIds = [], onOpenTheory, menu }: PracticeProps) {
  const [mode, setMode] = useState<Mode>("estudo");
  const [topicIds, setTopicIds] = useState<string[]>(initialTopicIds);
  const [quantity, setQuantity] = useState(10);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useScrollIntoViewOnChange(run ? "run" : "setup");

  const available = topics.filter((topic) => topic.question_count > 0);
  const integratedTopics = available.filter(isExamTopic);
  const integratedTotal = Math.min(
    MAX_QUESTIONS,
    integratedTopics.reduce((sum, topic) => sum + topic.question_count, 0),
  );

  const pool = available.filter((topic) => topicIds.length === 0 || topicIds.includes(topic.id));
  const poolTotal = pool.reduce((sum, topic) => sum + topic.question_count, 0);
  const minutesValue = minutes ?? Math.min(quantity, poolTotal) * MINUTES_PER_QUESTION;

  const theoryTopic =
    topicIds.length === 1 ? topics.find((topic) => topic.id === topicIds[0] && topic.has_theory) : undefined;

  const selectIntegrated = () => {
    setMode("simulado");
    setTopicIds(integratedTopics.map((topic) => topic.id));
    setQuantity(integratedTotal);
    setMinutes(null);
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const drawn = await concursosApi.drawQuestions(topicIds, quantity);
      if (drawn.length === 0) {
        setError("Não há questões nos tópicos escolhidos.");
        return;
      }
      setRunCount((count) => count + 1);
      setRun({ id: runCount + 1, mode, questions: drawn, minutes: minutesValue });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  let content;

  if (run?.mode === "estudo") {
    content = <StudyRunner key={run.id} questions={run.questions} onExit={() => setRun(null)} />;
  } else if (run?.mode === "simulado") {
    content = <ExamRunner key={run.id} questions={run.questions} minutes={run.minutes} onExit={() => setRun(null)} />;
  } else {
    const setup = (
      <section className={`${ui.card} space-y-6`}>
        <div>
          <h2 className={ui.title}>Sessão de estudo</h2>
          <p className={`mt-1 ${ui.muted}`}>Escolha os assuntos, o modo e a quantidade de questões.</p>
        </div>

        <fieldset className="space-y-3">
          <legend className={ui.heading}>Modo</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {modes.map((item) => (
              <label key={item.id} className={modeCard}>
                <input
                  type="radio"
                  name="concursos-modo"
                  value={item.id}
                  checked={mode === item.id}
                  onChange={() => setMode(item.id)}
                  className="sr-only"
                />
                <span className="text-sm font-black text-slate-950 dark:text-white">{item.title}</span>
                <span className="text-sm leading-5 text-slate-700 dark:text-slate-300">{item.text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {integratedTopics.length > 0 && (
          <div className={`${ui.panel} flex flex-wrap items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className={ui.heading}>Simulado Integrado</p>
              <p className={ui.muted}>{integratedTotal} questões de vários assuntos, em ordem aleatória.</p>
            </div>
            <button type="button" onClick={selectIntegrated} className={ui.secondaryButton}>
              Montar Simulado Integrado
            </button>
          </div>
        )}

        <TopicPicker
          legend="Assuntos (nenhum marcado = todos)"
          topics={topics}
          selectedIds={topicIds}
          onChange={setTopicIds}
        />

        {theoryTopic && onOpenTheory && (
          <p className={ui.info}>
            Este assunto tem teoria no manual.{" "}
            <button type="button" onClick={() => onOpenTheory(theoryTopic.id)} className={`${ui.linkButton} !text-sm`}>
              Ler a teoria antes das questões
            </button>
          </p>
        )}

        <div className="space-y-3">
          <p className={ui.muted}>{poolTotal} questões disponíveis nos assuntos escolhidos.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            <label className={`flex flex-wrap items-center gap-3 ${ui.body} font-bold`}>
              Quantidade de questões
              <input
                type="number"
                min={1}
                max={MAX_QUESTIONS}
                value={quantity}
                onChange={(event) => setQuantity(Math.min(MAX_QUESTIONS, Math.max(1, Number(event.target.value) || 1)))}
                className={`w-24 ${ui.control}`}
              />
            </label>
            {mode === "simulado" && (
              <label className={`flex flex-wrap items-center gap-3 ${ui.body} font-bold`}>
                Tempo do simulado (minutos, 0 = sem limite)
                <input
                  type="number"
                  min={0}
                  value={minutesValue}
                  onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))}
                  className={`w-24 ${ui.control}`}
                />
              </label>
            )}
          </div>
        </div>

        {error && <p role="alert" className={ui.alert}>{error}</p>}
        <button type="button" onClick={start} disabled={busy} className={`${ui.primaryButton} w-full sm:w-auto`}>
          {mode === "simulado" ? "Iniciar simulado" : "Começar sessão"}
        </button>
      </section>
    );
    content = menu ? (
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`${ui.card} lg:sticky lg:top-24`}>{menu}</div>
        {setup}
      </div>
    ) : (
      setup
    );
  }

  return <div ref={rootRef} className="scroll-mt-20">{content}</div>;
}
