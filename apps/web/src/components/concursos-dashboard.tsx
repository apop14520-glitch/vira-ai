"use client";

import { useEffect, useState } from "react";

import { PracticeHub } from "@/components/concursos-practice";
import { ConcursosQuestionBank } from "@/components/concursos-question-bank";
import { sortTopics } from "@/components/concursos-shared";
import { ConcursosTheory } from "@/components/concursos-theory";
import { tab as tabTone, ui } from "@/components/concursos-ui";
import { concursosApi, ConcursosSummary, Topic } from "@/lib/concursos-api";

type Tab = "conteudo" | "estudo";
type ContentView = "teoria" | "questoes";

const tabs: { id: Tab; label: string }[] = [
  { id: "conteudo", label: "Conteúdo" },
  { id: "estudo", label: "Sessão de estudo" },
];

const contentViews: { id: ContentView; label: string }[] = [
  { id: "teoria", label: "Teoria" },
  { id: "questoes", label: "Questões" },
];

export function ConcursosDashboard() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [summary, setSummary] = useState<ConcursosSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("conteudo");
  const [contentView, setContentView] = useState<ContentView>("teoria");
  const [studyTopicIds, setStudyTopicIds] = useState<string[]>([]);
  const [theoryTopicId, setTheoryTopicId] = useState("");

  useEffect(() => {
    Promise.all([concursosApi.listTopics(), concursosApi.summary()])
      .then(([nextTopics, nextSummary]) => {
        setTopics(sortTopics(nextTopics));
        setSummary(nextSummary);
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className={`${ui.card} ${ui.muted}`}>Carregando Concursos…</div>;
  }

  // O banco de questões só lista assuntos com questões (a revisão estratégica, por exemplo, só tem teoria).
  const bankTopics = topics.filter((topic) => topic.question_count > 0);
  const theoryCount = topics.filter((topic) => topic.has_theory).length;

  const openTab = (next: Tab) => {
    setStudyTopicIds([]);
    setTheoryTopicId("");
    setTab(next);
  };
  const openContentView = (next: ContentView) => {
    setTheoryTopicId("");
    setContentView(next);
  };
  const practiceTopic = (topicId: string) => {
    setStudyTopicIds([topicId]);
    setTab("estudo");
  };
  const readTheory = (topicId: string) => {
    setTheoryTopicId(topicId);
    setContentView("teoria");
    setTab("conteudo");
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className={ui.cardAccent}>
        <p className={ui.eyebrow}>VIRA Concursos</p>
        <h1 className={ui.pageTitle}>Teoria, questões e simulados</h1>
        <p className={`mt-2 max-w-2xl ${ui.muted} leading-6`}>
          Leia a teoria de cada assunto, filtre o banco de questões e estude com feedback imediato ou em simulados
          cronometrados.
        </p>
        {summary && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={ui.pill}>{bankTopics.length} tópicos</span>
            <span className={ui.pill}>{summary.total_questions} questões</span>
            {theoryCount > 0 && <span className={ui.pill}>{theoryCount} assuntos com teoria</span>}
          </div>
        )}
        {message && (
          <div role="alert" className={`mt-4 flex items-start justify-between gap-3 ${ui.alert}`}>
            <span>{message}</span>
            <button type="button" className="shrink-0 underline" onClick={() => setMessage(null)}>fechar</button>
          </div>
        )}
      </section>

      <div role="tablist" aria-label="Áreas do VIRA Concursos" className="grid max-w-md grid-cols-2 gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`concursos-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`concursos-panel-${item.id}`}
            onClick={() => openTab(item.id)}
            className={tab === item.id ? tabTone.active : tabTone.idle}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "conteudo" && (
        <div
          role="tabpanel"
          id="concursos-panel-conteudo"
          aria-labelledby="concursos-tab-conteudo"
          className="space-y-4 sm:space-y-6"
        >
          <div role="tablist" aria-label="Conteúdo" className="grid max-w-md grid-cols-2 gap-2">
            {contentViews.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`concursos-view-${item.id}`}
                aria-selected={contentView === item.id}
                aria-controls={`concursos-view-panel-${item.id}`}
                onClick={() => openContentView(item.id)}
                className={contentView === item.id ? tabTone.active : tabTone.idle}
              >
                {item.label}
              </button>
            ))}
          </div>

          {contentView === "teoria" && (
            <div role="tabpanel" id="concursos-view-panel-teoria" aria-labelledby="concursos-view-teoria">
              <ConcursosTheory topics={topics} initialTopicId={theoryTopicId} onPractice={practiceTopic} />
            </div>
          )}

          {contentView === "questoes" && (
            <div role="tabpanel" id="concursos-view-panel-questoes" aria-labelledby="concursos-view-questoes">
              <ConcursosQuestionBank topics={bankTopics} onError={setMessage} />
            </div>
          )}
        </div>
      )}

      {tab === "estudo" && (
        <div role="tabpanel" id="concursos-panel-estudo" aria-labelledby="concursos-tab-estudo">
          <PracticeHub topics={topics} initialTopicIds={studyTopicIds} onOpenTheory={readTheory} />
        </div>
      )}
    </div>
  );
}
