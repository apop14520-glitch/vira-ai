// Estilos do módulo Concursos. Seguem a linguagem do restante do app (destaque ciano,
// claro por padrão com variantes `dark:`). Cada estado é uma string completa e
// independente: o Tailwind não resolve conflitos pela ordem das classes.

export const ui = {
  cardAccent:
    "rounded-3xl border border-cyan-400/20 bg-white p-6 shadow-xl shadow-cyan-950/5 dark:bg-slate-900/60 sm:p-8",
  card: "rounded-3xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:p-6",
  panel: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50",
  eyebrow: "text-xs font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300",
  pageTitle: "mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl",
  title: "text-lg font-black text-slate-950 dark:text-white",
  heading: "text-sm font-black text-slate-950 dark:text-white",
  body: "text-sm leading-6 text-slate-700 dark:text-slate-300",
  muted: "text-sm text-slate-600 dark:text-slate-400",
  pill: "inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-900 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200",
  info: "rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm font-semibold text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100",
  alert:
    "rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
  focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
  primaryButton:
    "rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50",
  secondaryButton:
    "rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-800 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200",
  linkButton:
    "text-xs font-bold text-cyan-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:text-cyan-300",
  control:
    "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white",
  accent: "accent-cyan-600 dark:accent-cyan-400",
} as const;

const rowLayout =
  "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60";

export const topicRow = {
  idle: `${rowLayout} border-slate-300 bg-white text-slate-800 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200`,
  active: `${rowLayout} border-cyan-500 bg-cyan-100 text-cyan-950 dark:border-cyan-400/60 dark:bg-cyan-400/15 dark:text-cyan-100`,
  count: {
    idle: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    active: "rounded-full bg-cyan-500 px-2 py-0.5 text-[11px] font-bold text-slate-950",
  },
} as const;

const tabLayout =
  "min-h-11 rounded-xl border px-3 py-2 text-center text-sm font-bold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60";

export const tab = {
  idle: `${tabLayout} border-slate-300 bg-white text-slate-800 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200`,
  active: `${tabLayout} border-cyan-500 bg-cyan-100 text-cyan-950 dark:border-cyan-400/60 dark:bg-cyan-400/15 dark:text-cyan-100`,
} as const;

const choiceLayout =
  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm leading-6 transition focus-within:ring-2 focus-within:ring-cyan-400/60";

export const choice = {
  idle: `${choiceLayout} border-slate-300 bg-white text-slate-800 hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10`,
  selected: `${choiceLayout} border-cyan-500 bg-cyan-100 text-cyan-950 dark:border-cyan-400/60 dark:bg-cyan-400/15 dark:text-cyan-100`,
  correct: `${choiceLayout} border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-400/60 dark:bg-emerald-400/10 dark:text-emerald-200`,
  wrong: `${choiceLayout} border-red-400 bg-red-50 text-red-900 dark:border-red-400/60 dark:bg-red-400/10 dark:text-red-200`,
  muted: `${choiceLayout} border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-500`,
} as const;

const letterLayout = "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-black";

export const letter = {
  idle: `${letterLayout} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`,
  selected: `${letterLayout} bg-cyan-500 text-slate-950`,
  correct: `${letterLayout} bg-emerald-500 text-slate-50`,
  wrong: `${letterLayout} bg-red-500 text-slate-50`,
  muted: `${letterLayout} bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500`,
} as const;

export const verdict = {
  correct:
    "rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100",
  wrong:
    "rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100",
} as const;

export const reviewCard = {
  correct: "rounded-2xl border border-l-4 border-slate-200 border-l-emerald-500 bg-white p-4 dark:border-slate-800 dark:border-l-emerald-400 dark:bg-slate-950/50",
  wrong: "rounded-2xl border border-l-4 border-slate-200 border-l-red-500 bg-white p-4 dark:border-slate-800 dark:border-l-red-400 dark:bg-slate-950/50",
  blank: "rounded-2xl border border-l-4 border-slate-200 border-l-slate-400 bg-white p-4 dark:border-slate-800 dark:border-l-slate-500 dark:bg-slate-950/50",
} as const;

export const scoreTone = {
  good: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100",
  fair: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100",
  poor: "border-red-300 bg-red-50 text-red-950 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100",
} as const;

export const theory = {
  prose: "text-base leading-7 text-slate-800 dark:text-slate-200",
  heading: "text-lg font-black tracking-tight text-slate-950 dark:text-white",
  chapterTitle: "text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl",
  objective:
    "rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100",
  definition:
    "rounded-xl border border-l-4 border-slate-200 border-l-cyan-500 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 dark:border-slate-800 dark:border-l-cyan-400 dark:bg-slate-950/50 dark:text-slate-200",
  callout:
    "rounded-xl border border-l-4 border-amber-300 border-l-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:border-l-amber-400 dark:bg-amber-400/10 dark:text-amber-100",
  tableWrap: "overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700",
  tableCaption: "mb-2 text-sm font-black text-slate-950 dark:text-white",
  th: "bg-slate-100 px-2 py-2 text-left text-xs font-black sm:px-3 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300",
  tr: "border-t border-slate-200 odd:bg-white even:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/30 dark:even:bg-slate-900/40",
  td: "px-2 py-2 align-top text-[13px] leading-5 text-slate-800 dark:text-slate-200 sm:px-3 sm:text-sm",
  tdLabel: "px-2 py-2 align-top text-[13px] font-bold leading-5 text-slate-950 dark:text-white sm:px-3 sm:text-sm",
  review: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50",
  chip: {
    idle: "min-h-9 shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-800 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200",
    active:
      "min-h-9 shrink-0 rounded-full border border-cyan-500 bg-cyan-500 px-3 py-1 text-xs font-black text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
  },
} as const;

export const timerTone = {
  calm: "text-cyan-800 dark:text-cyan-200",
  warning: "text-amber-700 dark:text-amber-300",
  critical: "text-red-700 dark:text-red-300",
} as const;
