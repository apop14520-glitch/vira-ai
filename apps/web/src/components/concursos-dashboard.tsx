"use client";

import { useEffect, useState } from "react";

import { ExamMode } from "@/components/concursos-exam";
import { sortTopics } from "@/components/concursos-shared";
import { StudySession } from "@/components/concursos-study";
import { tab as tabTone, topicRow, ui } from "@/components/concursos-ui";
import { AuditEvent, concursosApi, ConcursosSummary, Question, QuestionDifficulty, Topic } from "@/lib/concursos-api";
import { useMediaQuery } from "@/lib/use-media-query";

type Tab = "questoes" | "estudo" | "simulados";

const tabs: { id: Tab; label: string }[] = [
  { id: "questoes", label: "Questões" },
  { id: "estudo", label: "Sessão de estudo" },
  { id: "simulados", label: "Simulados" },
];

const difficultyLabels: Record<QuestionDifficulty, string> = {
  facil: "Fácil",
  media: "Média",
  dificil: "Difícil",
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 5 5 5-5" />
    </svg>
  );
}

function QuestionList({ questions, loading }: { questions: Question[]; loading: boolean }) {
  if (loading) return <p className={ui.muted}>Carregando questões…</p>;
  if (questions.length === 0) return <p className={ui.muted}>Nenhuma questão neste tópico.</p>;

  return (
    <ol className="space-y-2">
      {questions.map((question, position) => (
        <li key={question.id} className={`${ui.panel} flex items-start gap-3`}>
          <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-cyan-100 px-1 text-xs font-black text-cyan-900 dark:bg-cyan-400/15 dark:text-cyan-200">
            {position + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">{question.statement}</p>
            <span className="mt-1 inline-block text-xs font-bold text-slate-600 dark:text-slate-400">
              {difficultyLabels[question.difficulty]}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ConcursosDashboard() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [summary, setSummary] = useState<ConcursosSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("questoes");
  const [bankOpen, setBankOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditVisible, setAuditVisible] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  useEffect(() => {
    Promise.all([concursosApi.listTopics(), concursosApi.summary()])
      .then(([nextTopics, nextSummary]) => {
        setTopics(sortTopics(nextTopics));
        setSummary(nextSummary);
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setQuestions([]);
    if (!selectedTopicId) return;
    let cancelled = false;
    setQuestionsLoading(true);
    concursosApi
      .listQuestions(selectedTopicId)
      .then((next) => {
        if (!cancelled) setQuestions(next);
      })
      .catch((error: Error) => {
        if (!cancelled) setMessage(error.message);
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTopicId]);

  const toggleAuditLog = async () => {
    const next = !auditVisible;
    setAuditVisible(next);
    if (next && auditEvents.length === 0) {
      setAuditLoading(true);
      try {
        setAuditEvents(await concursosApi.auditEvents());
      } catch (error) {
        setMessage((error as Error).message);
      } finally {
        setAuditLoading(false);
      }
    }
  };

  if (loading) {
    return <div className={`${ui.card} ${ui.muted}`}>Carregando Concursos…</div>;
  }

  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className={ui.cardAccent}>
        <p className={ui.eyebrow}>VIRA Concursos</p>
        <h1 className={ui.pageTitle}>Questões, estudo e simulados</h1>
        <p className={`mt-2 max-w-2xl ${ui.muted} leading-6`}>
          Consulte o banco de questões, estude com feedback imediato e faça simulados cronometrados.
        </p>
        {summary && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={ui.pill}>{summary.total_topics} tópicos</span>
            <span className={ui.pill}>{summary.total_questions} questões</span>
          </div>
        )}
        {message && (
          <div role="alert" className={`mt-4 flex items-start justify-between gap-3 ${ui.alert}`}>
            <span>{message}</span>
            <button type="button" className="shrink-0 underline" onClick={() => setMessage(null)}>fechar</button>
          </div>
        )}
      </section>

      <div role="tablist" aria-label="Áreas do VIRA Concursos" className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`concursos-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`concursos-panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`${tab === item.id ? tabTone.active : tabTone.idle} sm:px-5`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "estudo" && (
        <div role="tabpanel" id="concursos-panel-estudo" aria-labelledby="concursos-tab-estudo">
          <StudySession topics={topics} />
        </div>
      )}

      {tab === "simulados" && (
        <div role="tabpanel" id="concursos-panel-simulados" aria-labelledby="concursos-tab-simulados">
          <ExamMode topics={topics} />
        </div>
      )}

      {tab === "questoes" && (
        <div
          role="tabpanel"
          id="concursos-panel-questoes"
          aria-labelledby="concursos-tab-questoes"
          className="space-y-6 sm:space-y-8"
        >
          {isDesktop ? (
            <section className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className={`${ui.card} space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto`}>
                <h2 className={ui.heading}>Tópicos</h2>
                {topics.length === 0 && <p className={ui.muted}>Nenhum tópico cadastrado ainda.</p>}
                <ul className="space-y-2">
                  {topics.map((topic) => {
                    const active = selectedTopicId === topic.id;
                    return (
                      <li key={topic.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedTopicId(topic.id)}
                          className={active ? topicRow.active : topicRow.idle}
                        >
                          <span className="min-w-0">{topic.name}</span>
                          <span className={active ? topicRow.count.active : topicRow.count.idle}>{topic.question_count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className={`${ui.card} space-y-4`}>
                {!selectedTopic ? (
                  <p className={ui.muted}>Selecione um tópico para ver as questões.</p>
                ) : (
                  <>
                    <div>
                      <h2 className={ui.title}>{selectedTopic.name}</h2>
                      <p className={ui.muted}>{selectedTopic.question_count} questões</p>
                    </div>
                    <QuestionList questions={questions} loading={questionsLoading} />
                  </>
                )}
              </div>
            </section>
          ) : (
            <section className={ui.card}>
              <button
                type="button"
                aria-expanded={bankOpen}
                aria-controls="concursos-bank"
                onClick={() => setBankOpen((open) => !open)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl text-left ${ui.focus}`}
              >
                <span>
                  <span className={ui.eyebrow}>Banco de questões</span>
                  <span className="mt-1 block text-base font-black text-slate-950 dark:text-white">Todas as questões</span>
                  <span className={`block ${ui.muted}`}>
                    {topics.length} tópicos · {summary?.total_questions ?? 0} questões
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200">
                  <Chevron open={bankOpen} />
                </span>
              </button>

              {bankOpen && (
                <ul id="concursos-bank" className="mt-4 space-y-2">
                  {topics.length === 0 && <li className={ui.muted}>Nenhum tópico cadastrado ainda.</li>}
                  {topics.map((topic) => {
                    const open = selectedTopicId === topic.id;
                    return (
                      <li key={topic.id}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setSelectedTopicId(open ? "" : topic.id)}
                          className={open ? topicRow.active : topicRow.idle}
                        >
                          <span className="min-w-0">{topic.name}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={open ? topicRow.count.active : topicRow.count.idle}>{topic.question_count}</span>
                            <Chevron open={open} />
                          </span>
                        </button>
                        {open && (
                          <div className="mt-2 border-l-2 border-cyan-400/60 pl-3">
                            <QuestionList questions={questions} loading={questionsLoading} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <section className={ui.card}>
            <button type="button" onClick={toggleAuditLog} className={ui.secondaryButton}>
              {auditVisible ? "Ocultar" : "Ver"} log de auditoria
            </button>
            {auditVisible && (
              <div className="mt-4 space-y-2">
                {auditLoading && <p className={ui.muted}>Carregando…</p>}
                {!auditLoading && auditEvents.length === 0 && <p className={ui.muted}>Nenhum evento registrado.</p>}
                {auditEvents.map((event) => (
                  <div key={event.id} className={`${ui.panel} flex flex-wrap items-center gap-x-3 gap-y-1 !py-2 text-xs text-slate-700 dark:text-slate-300`}>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{event.action}</span>
                    <span>{event.resource_type}</span>
                    <span>{new Date(event.occurred_at).toLocaleString("pt-BR")}</span>
                    <span className={event.outcome === "success" ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-bold text-amber-700 dark:text-amber-300"}>
                      {event.outcome}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
