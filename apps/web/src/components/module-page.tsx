import { AppShell } from "@/components/app-shell";
import type { ProductModule } from "@/lib/modules";

const toneClasses = {
  cyan: "from-cyan-400/20 to-blue-500/5 text-cyan-200 border-cyan-400/20",
  emerald: "from-emerald-400/20 to-teal-500/5 text-emerald-200 border-emerald-400/20",
  violet: "from-violet-400/20 to-fuchsia-500/5 text-violet-200 border-violet-400/20",
  amber: "from-amber-400/20 to-orange-500/5 text-amber-200 border-amber-400/20",
} as const;

export function ModulePage({ module }: { module: ProductModule }) {
  return (
    <AppShell>
      <div className="density-stack space-y-6">
        <section className={`density-surface overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8 ${toneClasses[module.tone]}`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/60 text-lg font-bold">{module.symbol}</span>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{module.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{module.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{module.description}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {module.capabilities.map((capability) => (
            <div key={capability} className="density-card rounded-2xl border border-slate-800 bg-slate-900/45 p-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Boundary</span>
              <h2 className="mt-3 text-base font-semibold text-white">{capability}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Interface reservada para uma evolução futura do módulo.</p>
            </div>
          ))}
        </section>

        <section className="density-surface rounded-2xl border border-dashed border-slate-700 bg-slate-900/25 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Próximo passo</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Este módulo está delimitado, ainda não ativado</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">A fundação mantém o espaço pronto para receber a primeira feature com finalidade, dados, permissões e critérios de privacidade documentados antes da implementação.</p>
        </section>
      </div>
    </AppShell>
  );
}
