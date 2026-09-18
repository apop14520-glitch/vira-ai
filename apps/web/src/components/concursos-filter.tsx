"use client";

import { useId, useState } from "react";

import { filter as tone } from "@/components/concursos-ui";

export type FilterOption = { id: string; label: string; count?: number };

type FilterGroupProps = {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Quando informado, mostra o campo de busca com este texto. */
  searchPlaceholder?: string;
  /** Aberto ou fechado ao montar. */
  defaultOpen?: boolean;
  emptyMessage?: string;
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-5 w-5 shrink-0 transition-transform ${tone.chevron} ${open ? "" : "rotate-180"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5-5 5 5" />
    </svg>
  );
}

/** Grupo de filtro por caixas de marcação: título recolhível, busca opcional e lista rolável. */
export function FilterGroup({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder,
  defaultOpen = true,
  emptyMessage = "Nenhuma opção encontrada.",
}: FilterGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const bodyId = useId();

  const needle = normalize(query.trim());
  const visible = needle ? options.filter((option) => normalize(option.label).includes(needle)) : options;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  return (
    <section className={tone.card}>
      <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((current) => !current)} className={tone.header}>
        <span className={tone.title}>
          {title}
          {selected.length > 0 && (
            <span className={tone.badge} aria-label={`${selected.length} selecionados`}>
              {selected.length}
            </span>
          )}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div id={bodyId}>
          {searchPlaceholder && (
            <div className={tone.searchWrap}>
              <svg aria-hidden="true" viewBox="0 0 20 20" className={tone.searchIcon} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className={tone.search}
              />
            </div>
          )}
          <ul className={tone.list}>
            {visible.length === 0 && <li className="px-1.5 py-2 text-sm text-slate-600 dark:text-slate-400">{emptyMessage}</li>}
            {visible.map((option) => (
              <li key={option.id}>
                <label className={tone.option}>
                  <input
                    type="checkbox"
                    checked={selected.includes(option.id)}
                    onChange={() => toggle(option.id)}
                    className={tone.checkbox}
                  />
                  <span className="min-w-0">{option.label}</span>
                  {option.count !== undefined && <span className={tone.count}>{option.count}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
