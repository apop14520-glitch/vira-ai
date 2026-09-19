"use client";

import { ReactNode, useEffect, useState } from "react";

import { sortTopics, useScrollIntoViewOnChange } from "@/components/concursos-shared";
import { theory as tone, topicRow, ui } from "@/components/concursos-ui";
import { concursosApi, Theory, TheoryBlock, TheoryChapter, Topic } from "@/lib/concursos-api";
import { useMediaQuery } from "@/lib/use-media-query";

type ConcursosTheoryProps = {
  topics: Topic[];
  initialTopicId?: string;
  onPractice: (topicId: string) => void;
  /** Menu de navegação do Concursos, mostrado no topo da caixa de assuntos. */
  menu?: ReactNode;
};

function Block({ block }: { block: TheoryBlock }) {
  if (block.type === "paragraph") return <p className={tone.prose}>{block.text}</p>;

  if (block.type === "definition") {
    return (
      <p className={tone.definition}>
        <dfn className="font-black not-italic text-slate-950 dark:text-white">{block.term}</dfn>: {block.text}
      </p>
    );
  }

  if (block.type === "callout") {
    return (
      <aside role="note" className={tone.callout}>
        <strong className="mb-1 block text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
          Importante lembrar
        </strong>
        {block.text}
      </aside>
    );
  }

  return (
    <figure>
      {block.caption && <figcaption className={tone.tableCaption}>{block.caption}</figcaption>}
      <div className={tone.tableWrap} role="region" aria-label={block.caption || "Tabela"} tabIndex={0}>
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {block.header.map((cell, column) => (
                <th key={column} scope="col" className={tone.th}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, line) => (
              <tr key={line} className={tone.tr}>
                {row.map((cell, column) =>
                  column === 0 ? (
                    <th key={column} scope="row" className={`${tone.tdLabel} text-left`}>
                      {cell}
                    </th>
                  ) : (
                    <td key={column} className={tone.td}>
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Chapter({ chapter, position, total }: { chapter: TheoryChapter; position: number; total: number }) {
  return (
    <article className="space-y-6" aria-label={chapter.title}>
      <header className="space-y-3">
        <p className={ui.eyebrow}>{chapter.number ? `Capítulo ${chapter.number}` : `Bloco ${position + 1} de ${total}`}</p>
        <h3 className={tone.chapterTitle}>{chapter.title}</h3>
        {chapter.objective && (
          <p className={tone.objective}>
            <strong className="font-black">Objetivo: </strong>
            {chapter.objective}
          </p>
        )}
      </header>

      {chapter.sections.map((section, index) => (
        <section key={`${section.heading}-${index}`} className="space-y-3">
          {section.heading && <h4 className={tone.heading}>{section.heading}</h4>}
          {section.blocks.map((block, blockIndex) => (
            <Block key={blockIndex} block={block} />
          ))}
        </section>
      ))}

      {chapter.review.length > 0 && (
        <section className={tone.review} aria-labelledby={`review-${position}`}>
          <h4 id={`review-${position}`} className={tone.heading}>
            Revisão do capítulo
          </h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-800 marker:text-cyan-600 dark:text-slate-200 dark:marker:text-cyan-400">
            {chapter.review.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Reader({ topic, document, onPractice }: { topic: Topic; document: Theory; onPractice: (id: string) => void }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const rootRef = useScrollIntoViewOnChange(`${topic.id}-${chapterIndex}`);
  const chapters = document.chapters;
  const chapter = chapters[chapterIndex];
  const isLast = chapterIndex === chapters.length - 1;

  return (
    <div ref={rootRef} className="scroll-mt-20 space-y-5">
      <div>
        <h2 className={ui.title}>{topic.name}</h2>
        {document.summary && <p className={`mt-1 ${ui.muted}`}>{document.summary}</p>}
      </div>

      <nav aria-label="Capítulos" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chapters.map((item, index) => {
          const label = item.number || String(index + 1);
          const active = index === chapterIndex;
          return (
            <button
              key={index}
              type="button"
              aria-current={active ? "true" : undefined}
              aria-label={`Capítulo ${label}: ${item.title}`}
              title={item.title}
              onClick={() => setChapterIndex(index)}
              className={active ? tone.chip.active : tone.chip.idle}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <Chapter chapter={chapter} position={chapterIndex} total={chapters.length} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          disabled={chapterIndex === 0}
          onClick={() => setChapterIndex(chapterIndex - 1)}
          className={`${ui.secondaryButton} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          ← Capítulo anterior
        </button>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {chapterIndex + 1} de {chapters.length}
        </span>
        {!isLast && (
          <button type="button" onClick={() => setChapterIndex(chapterIndex + 1)} className={ui.primaryButton}>
            Próximo capítulo →
          </button>
        )}
      </div>

      {isLast && (
        <div className="space-y-4">
          {document.sources && (
            <p className={`${ui.muted} text-xs leading-5`}>
              <strong className="font-black">Fontes de estudo: </strong>
              {document.sources}
            </p>
          )}
          {topic.question_count > 0 && (
            <button type="button" onClick={() => onPractice(topic.id)} className={`${ui.primaryButton} w-full sm:w-auto`}>
              Praticar questões deste tópico
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ConcursosTheory({ topics, initialTopicId = "", onPractice, menu }: ConcursosTheoryProps) {
  const [topicId, setTopicId] = useState(initialTopicId);
  const [document, setDocument] = useState<Theory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  const available = sortTopics(topics.filter((topic) => topic.has_theory));
  const selected = available.find((topic) => topic.id === topicId);

  useEffect(() => {
    setDocument(null);
    setError(null);
    if (!topicId) return;
    let cancelled = false;
    setLoading(true);
    concursosApi
      .getTheory(topicId)
      .then((next) => {
        if (!cancelled) setDocument(next);
      })
      .catch((failure: Error) => {
        if (!cancelled) setError(failure.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const showList = isDesktop || !topicId;
  const showReader = isDesktop || Boolean(topicId);

  const list = (
    <div className={`${ui.card} space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto`}>
      {menu && <div className="border-b border-slate-200 pb-3 dark:border-slate-800">{menu}</div>}
      <h2 className={ui.heading}>Assuntos</h2>
      {available.length === 0 && <p className={ui.muted}>Nenhum assunto com teoria importada ainda.</p>}
      <ul className="space-y-2">
        {available.map((topic) => {
          const active = topic.id === topicId;
          return (
            <li key={topic.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setTopicId(topic.id)}
                className={active ? topicRow.active : topicRow.idle}
              >
                <span className="min-w-0">{topic.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const reader = (
    <div className={`${ui.card} space-y-4`}>
      {!isDesktop && (
        <button type="button" onClick={() => setTopicId("")} className={ui.linkButton}>
          ← Todos os assuntos
        </button>
      )}
      {!topicId && <p className={ui.muted}>Escolha um assunto para ler a teoria.</p>}
      {topicId && loading && <p className={ui.muted}>Carregando teoria…</p>}
      {error && (
        <p role="alert" className={ui.alert}>
          {error}
        </p>
      )}
      {selected && document && !loading && <Reader key={selected.id} topic={selected} document={document} onPractice={onPractice} />}
    </div>
  );

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {showList && list}
      {showReader && reader}
    </section>
  );
}
