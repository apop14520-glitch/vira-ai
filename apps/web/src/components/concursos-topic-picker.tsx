"use client";

import type { Topic } from "@/lib/concursos-api";

type TopicPickerProps = {
  topics: Topic[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  legend: string;
};

export function TopicPicker({ topics, selectedIds, onChange, legend }: TopicPickerProps) {
  const available = topics.filter((topic) => topic.question_count > 0);

  const toggle = (topicId: string) => {
    onChange(selectedIds.includes(topicId) ? selectedIds.filter((id) => id !== topicId) : [...selectedIds, topicId]);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold text-white">{legend}</legend>
      <div className="flex gap-3 text-xs">
        <button type="button" onClick={() => onChange(available.map((topic) => topic.id))} className="text-amber-300 underline">
          Marcar todos
        </button>
        <button type="button" onClick={() => onChange([])} className="text-slate-400 underline">
          Limpar seleção
        </button>
      </div>
      {available.length === 0 && <p className="text-sm text-slate-500">Nenhum tópico com questões cadastradas.</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {available.map((topic) => (
          <li key={topic.id}>
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-300 hover:border-slate-700">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={selectedIds.includes(topic.id)} onChange={() => toggle(topic.id)} />
                {topic.name}
              </span>
              <span className="text-xs text-slate-500">{topic.question_count}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
