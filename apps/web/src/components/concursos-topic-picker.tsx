"use client";

import { ui } from "@/components/concursos-ui";
import type { Topic } from "@/lib/concursos-api";

type TopicPickerProps = {
  topics: Topic[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  legend: string;
};

const itemClass =
  "flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-cyan-400 hover:bg-cyan-50 has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-100 has-[:checked]:text-cyan-950 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:has-[:checked]:border-cyan-400/60 dark:has-[:checked]:bg-cyan-400/15 dark:has-[:checked]:text-cyan-100";

export function TopicPicker({ topics, selectedIds, onChange, legend }: TopicPickerProps) {
  const available = topics.filter((topic) => topic.question_count > 0);

  const toggle = (topicId: string) => {
    onChange(selectedIds.includes(topicId) ? selectedIds.filter((id) => id !== topicId) : [...selectedIds, topicId]);
  };

  return (
    <fieldset className="space-y-3">
      <legend className={ui.heading}>{legend}</legend>
      <div className="flex gap-4">
        <button type="button" onClick={() => onChange(available.map((topic) => topic.id))} className={ui.linkButton}>
          Marcar todos
        </button>
        <button type="button" onClick={() => onChange([])} className={ui.linkButton}>
          Limpar seleção
        </button>
      </div>
      {available.length === 0 && <p className={ui.muted}>Nenhum tópico com questões cadastradas.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {available.map((topic) => (
          <li key={topic.id}>
            <label className={itemClass}>
              <span className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(topic.id)}
                  onChange={() => toggle(topic.id)}
                  className={`h-4 w-4 shrink-0 ${ui.accent}`}
                />
                <span className="min-w-0">{topic.name}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-600 dark:text-slate-400">{topic.question_count}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
