"use client";

import { FilterGroup } from "@/components/concursos-filter";
import { isExamTopic } from "@/components/concursos-shared";
import { ui } from "@/components/concursos-ui";
import type { Topic } from "@/lib/concursos-api";

type TopicPickerProps = {
  topics: Topic[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  legend: string;
};

const asOption = (topic: Topic) => ({ id: topic.id, label: topic.name, count: topic.question_count });

/** Escolha de assuntos em dois grupos de filtro: os assuntos do manual e, agrupadas à parte, as questões dos simulados. */
export function TopicPicker({ topics, selectedIds, onChange, legend }: TopicPickerProps) {
  const available = topics.filter((topic) => topic.question_count > 0);
  const subjects = available.filter((topic) => !isExamTopic(topic));
  const exams = available.filter(isExamTopic);

  const changeGroup = (group: Topic[]) => (next: string[]) => {
    const groupIds = new Set(group.map((topic) => topic.id));
    onChange([...selectedIds.filter((id) => !groupIds.has(id)), ...next]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className={ui.heading}>{legend}</h3>
        <div className="flex gap-4">
          <button type="button" onClick={() => onChange(available.map((topic) => topic.id))} className={ui.linkButton}>
            Marcar todos
          </button>
          <button type="button" onClick={() => onChange([])} className={ui.linkButton}>
            Limpar seleção
          </button>
        </div>
      </div>
      {available.length === 0 && <p className={ui.muted}>Nenhum tópico com questões cadastradas.</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2">
        {subjects.length > 0 && (
          <FilterGroup
            title="Assuntos"
            searchPlaceholder="Buscar assunto"
            options={subjects.map(asOption)}
            selected={selectedIds.filter((id) => subjects.some((topic) => topic.id === id))}
            onChange={changeGroup(subjects)}
          />
        )}
        {exams.length > 0 && (
          <FilterGroup
            title="Simulados"
            options={exams.map(asOption)}
            selected={selectedIds.filter((id) => exams.some((topic) => topic.id === id))}
            onChange={changeGroup(exams)}
          />
        )}
      </div>
    </div>
  );
}
