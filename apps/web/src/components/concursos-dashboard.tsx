"use client";

import { useEffect, useState } from "react";

import { ChoiceGroup } from "@/components/concursos-filter";
import { PracticeHub } from "@/components/concursos-practice";
import { ConcursosQuestionBank } from "@/components/concursos-question-bank";
import { sortTopics } from "@/components/concursos-shared";
import { ConcursosTheory } from "@/components/concursos-theory";
import { ui } from "@/components/concursos-ui";
import { concursosApi, ConcursosSummary, Topic } from "@/lib/concursos-api";

type Tab = "conteudo" | "estudo";
type ContentView = "teoria" | "questoes";

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

  const menu = (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      <ChoiceGroup
        bare
        title="Área"
        value={tab}
        onChange={(next) => openTab(next as Tab)}
        options={[
          { id: "conteudo", label: "Conteúdo" },
          { id: "estudo", label: "Sessão de estudo" },
        ]}
      />
      {tab === "conteudo" && (
        <ChoiceGroup
          bare
          title="Conteúdo"
          value={contentView}
          onChange={(next) => openContentView(next as ContentView)}
          options={[
            { id: "teoria", label: "Teoria", count: theoryCount },
            { id: "questoes", label: "Questões", count: bankTopics.reduce((sum, topic) => sum + topic.question_count, 0) },
          ]}
        />
      )}
    </div>
  );

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

      {tab === "conteudo" && contentView === "teoria" && (
        <ConcursosTheory menu={menu} topics={topics} initialTopicId={theoryTopicId} onPractice={practiceTopic} />
      )}

      {tab === "conteudo" && contentView === "questoes" && (
        <ConcursosQuestionBank menu={menu} topics={bankTopics} onError={setMessage} />
      )}

      {tab === "estudo" && (
        <PracticeHub menu={menu} topics={topics} initialTopicIds={studyTopicIds} onOpenTheory={readTheory} />
      )}
    </div>
  );
}
