import Link from "next/link";

import type { ProductModule } from "@/lib/modules";

const toneClasses = {
  cyan: "bg-cyan-400/10 text-cyan-200 ring-cyan-400/20",
  emerald: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
  violet: "bg-violet-400/10 text-violet-200 ring-violet-400/20",
  amber: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
} as const;

export function ModuleCard({ module }: { module: ProductModule }) {
  return (
    <Link href={`/${module.slug}`} className="group rounded-2xl border border-slate-800 bg-slate-900/45 p-4 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-slate-950/40 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold ring-1 ${toneClasses[module.tone]}`}>{module.symbol}</span>
        <span className="rounded-full border border-slate-700/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Preparado</span>
      </div>
      <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{module.eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-white group-hover:text-cyan-200">{module.title}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{module.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {module.capabilities.map((capability) => <span key={capability} className="rounded-md bg-slate-950/70 px-2 py-1 text-[11px] text-slate-500">{capability}</span>)}
      </div>
      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-500 transition group-hover:text-cyan-300"><span>Explorar módulo</span><span className="transition group-hover:translate-x-1">→</span></div>
    </Link>
  );
}
