"use client";

import { useEffect, useMemo, useState } from "react";

import { FilterGroup } from "@/components/concursos-filter";
import { filter as filterTone, ui } from "@/components/concursos-ui";
import { AuditEvent, concursosApi, Question, QuestionDifficulty, Topic } from "@/lib/concursos-api";
import { useMediaQuery } from "@/lib/use-media-query";

const difficultyLabels: Record<QuestionDifficulty, string> = {
  facil: "Fácil",
  media: "Média",
  dificil: "Difícil",
};
const difficultyOrder: QuestionDifficulty[] = ["facil", "media", "dificil"];

type ConcursosQuestionBankProps = {
  /** Assuntos que têm questões, já em ordem. */
  topics: Topic[];
  onError: (message: string) => void;
};

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className={filterTone.chip}>
      {label}
      <button
        type="button"
        aria-label={`Remover filtro ${label}`}
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:hover:bg-cyan-400/25"
      >
        ×
      </button>
    </span>
  );
}

function AuditLog({ onError }: { onError: (message: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);

  const toggle = async () => {
    const next = !visible;
    setVisible(next);
    if (next && events.length === 0) {
      setLoading(true);
      try {
        setEvents(await concursosApi.auditEvents());
      } catch (error) {
        onError((error as Error).message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <section className={ui.card}>
      <button type="button" onClick={toggle} className={ui.secondaryButton}>
        {visible ? "Ocultar" : "Ver"} log de auditoria
      </button>
      {visible && (
        <div className="mt-4 space-y-2">
          {loading && <p className={ui.muted}>Carregando…</p>}
          {!loading && events.length === 0 && <p className={ui.muted}>Nenhum evento registrado.</p>}
          {events.map((event) => (
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
  );
}

export function ConcursosQuestionBank({ topics, onError }: ConcursosQuestionBankProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  useEffect(() => {
    let cancelled = false;
    concursosApi
      .listQuestions()
      .then((next) => {
        if (!cancelled) setQuestions(next);
      })
      .catch((error: Error) => {
        if (!cancelled) onError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Carrega uma única vez ao abrir o banco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const difficultyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const question of questions) counts[question.difficulty] = (counts[question.difficulty] ?? 0) + 1;
    return counts;
  }, [questions]);

  const groups = useMemo(() => {
    const byTopic = new Map<string, Question[]>();
    for (const question of questions) {
      if (topicIds.length > 0 && !topicIds.includes(question.topic_id)) continue;
      if (difficulties.length > 0 && !difficulties.includes(question.difficulty)) continue;
      byTopic.set(question.topic_id, [...(byTopic.get(question.topic_id) ?? []), question]);
    }
    return topics.flatMap((topic) => {
      const items = byTopic.get(topic.id);
      return items ? [{ topic, items }] : [];
    });
  }, [questions, topics, topicIds, difficulties]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const topicName = (id: string) => topics.find((topic) => topic.id === id)?.name ?? id;
  const hasFilters = topicIds.length > 0 || difficulties.length > 0;
  const clear = () => {
    setTopicIds([]);
    setDifficulties([]);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className={ui.heading}>Filtrar questões</h2>
            {hasFilters && (
              <button type="button" onClick={clear} className={ui.linkButton}>
                Limpar filtros
              </button>
            )}
          </div>
          <FilterGroup
            title="Assuntos"
            searchPlaceholder="Buscar assunto"
            defaultOpen={isDesktop}
            options={topics.map((topic) => ({ id: topic.id, label: topic.name, count: topic.question_count }))}
            selected={topicIds}
            onChange={setTopicIds}
          />
          <FilterGroup
            title="Dificuldade"
            defaultOpen={isDesktop}
            options={difficultyOrder.map((id) => ({ id, label: difficultyLabels[id], count: difficultyCounts[id] ?? 0 }))}
            selected={difficulties}
            onChange={setDifficulties}
          />
        </div>

        <div className={`${ui.card} space-y-5`}>
          <div className="space-y-3">
            <div>
              <h2 className={ui.title}>Banco de questões</h2>
              <p className={ui.muted} aria-live="polite">
                {loading ? "Carregando questões…" : `${total} ${total === 1 ? "questão" : "questões"}${hasFilters ? (total === 1 ? " encontrada" : " encontradas") : ""}`}
              </p>
            </div>
            {hasFilters && (
              <div className="flex flex-wrap gap-2">
                {topicIds.map((id) => (
                  <Chip key={id} label={topicName(id)} onRemove={() => setTopicIds(topicIds.filter((item) => item !== id))} />
                ))}
                {difficulties.map((id) => (
                  <Chip
                    key={id}
                    label={difficultyLabels[id as QuestionDifficulty]}
                    onRemove={() => setDifficulties(difficulties.filter((item) => item !== id))}
                  />
                ))}
              </div>
            )}
          </div>

          {!loading && total === 0 && <p className={ui.muted}>Nenhuma questão com esses filtros.</p>}

          {groups.map(({ topic, items }) => (
            <section key={topic.id} aria-labelledby={`bank-${topic.id}`} className="space-y-2">
              <h3 id={`bank-${topic.id}`} className="flex items-baseline justify-between gap-3 text-sm font-black text-slate-950 dark:text-white">
                <span className="min-w-0">{topic.name}</span>
                <span className="shrink-0 text-xs font-bold text-slate-600 dark:text-slate-400">{items.length}</span>
              </h3>
              <ol className="space-y-2">
                {items.map((question, position) => (
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
            </section>
          ))}
        </div>
      </section>

      <AuditLog onError={onError} />
    </div>
  );
}
