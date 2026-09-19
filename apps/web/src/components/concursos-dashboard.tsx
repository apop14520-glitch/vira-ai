"use client";

import { useEffect, useState } from "react";

import { ChoiceGroup } from "@/components/concursos-filter";
import { PracticeHub } from "@/components/concursos-practice";
import { sortTopics } from "@/components/concursos-shared";
import { ConcursosTheory } from "@/components/concursos-theory";
import { ui } from "@/components/concursos-ui";
import { concursosApi, ConcursosSummary, Topic } from "@/lib/concursos-api";

type Tab = "conteudo" | "estudo";

export function ConcursosDashboard() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [summary, setSummary] = useState<ConcursosSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("conteudo");
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

  // A revisão estratégica, por exemplo, só tem teoria, então não conta como assunto com questões.
  const questionTopics = topics.filter((topic) => topic.question_count > 0);
  const theoryCount = topics.filter((topic) => topic.has_theory).length;

  const openTab = (next: Tab) => {
    setStudyTopicIds([]);
    setTheoryTopicId("");
    setTab(next);
  };
  const practiceTopic = (topicId: string) => {
    setStudyTopicIds([topicId]);
    setTab("estudo");
  };
  const readTheory = (topicId: string) => {
    setTheoryTopicId(topicId);
    setTab("conteudo");
  };

  const menu = (
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
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className={ui.cardAccent}>
        <p className={ui.eyebrow}>VIRA Concursos</p>
        <h1 className={ui.pageTitle}>Teoria, questões e simulados</h1>
        <p className={`mt-2 max-w-2xl ${ui.muted} leading-6`}>
          Leia a teoria de cada assunto e estude com feedback imediato ou em simulados cronometrados.
        </p>
        {summary && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={ui.pill}>{questionTopics.length} tópicos</span>
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

      {tab === "conteudo" && (
        <ConcursosTheory menu={menu} topics={topics} initialTopicId={theoryTopicId} onPractice={practiceTopic} />
      )}

      {tab === "estudo" && (
        <PracticeHub menu={menu} topics={topics} initialTopicIds={studyTopicIds} onOpenTheory={readTheory} />
      )}
    </div>
  );
}
