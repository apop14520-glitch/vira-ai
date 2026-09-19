"use client";

import { ReactNode, useState } from "react";

import { ExamRunner } from "@/components/concursos-exam";
import { ChoiceGroup } from "@/components/concursos-filter";
import { useScrollIntoViewOnChange } from "@/components/concursos-shared";
import { StudyRunner } from "@/components/concursos-study";
import { TopicPicker } from "@/components/concursos-topic-picker";
import { ui } from "@/components/concursos-ui";
import { concursosApi, QuestionPublic, Topic } from "@/lib/concursos-api";

type Mode = "estudo" | "simulado";
type Run = { id: number; mode: Mode; questions: QuestionPublic[]; minutes: number };

const MAX_QUESTIONS = 100;
const MINUTES_PER_QUESTION = 2;

const modes: Record<Mode, { label: string; text: string }> = {
  estudo: { label: "Estudo", text: "Uma questão por vez, com gabarito e explicação logo depois de responder. Sem cronômetro." },
  simulado: { label: "Simulado", text: "Prova cronometrada: você responde tudo e só vê o gabarito e a nota no final." },
};
const modeOptions = (Object.keys(modes) as Mode[]).map((id) => ({ id, label: modes[id].label }));

type PracticeProps = {
  topics: Topic[];
  /** Assuntos já marcados ao abrir (por exemplo, vindos do botão "Praticar" da teoria). */
  initialTopicIds?: string[];
  onOpenTheory?: (topicId: string) => void;
  /** Menu de navegação do Concursos, mostrado no topo da coluna ao lado da configuração. */
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

  const pool = available.filter((topic) => topicIds.length === 0 || topicIds.includes(topic.id));
  const poolTotal = pool.reduce((sum, topic) => sum + topic.question_count, 0);
  const minutesValue = minutes ?? Math.min(quantity, poolTotal) * MINUTES_PER_QUESTION;

  const theoryTopic =
    topicIds.length === 1 ? topics.find((topic) => topic.id === topicIds[0] && topic.has_theory) : undefined;

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
          <p className={`mt-1 ${ui.muted}`}>{modes[mode].text}</p>
        </div>

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
    content = (
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`${ui.card} divide-y divide-slate-200 dark:divide-slate-800 lg:sticky lg:top-24`}>
          {menu}
          <ChoiceGroup bare title="Modo" value={mode} onChange={(next) => setMode(next as Mode)} options={modeOptions} />
        </div>
        {setup}
      </div>
    );
  }

  return <div ref={rootRef} className="scroll-mt-20">{content}</div>;
}
