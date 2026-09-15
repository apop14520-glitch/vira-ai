import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { ModuleCard } from "@/components/module-card";
import { SystemStatus } from "@/components/system-status";
import { productModules } from "@/lib/modules";
import Link from "next/link";

export default function Home() {
  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-cyan-950/10 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 sm:mb-5 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
              Workspace de desenvolvimento
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-5xl">
              A base para fazer o Brasil virar digital.
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:mt-4 sm:text-lg sm:leading-7">
              O VIRA.AI começa com uma plataforma modular, segura e orientada à privacidade. Explore os limites dos produtos e acompanhe o estado técnico do workspace.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link href="/business" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">Abrir VIRA Business</Link>
              <Link href="/sites" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-400/60 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">Explorar módulos</Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <MetricCard label="Produtos mapeados" value="04" detail="Módulos do ecossistema" tone="cyan" />
          <MetricCard label="Dados pessoais" value="0" detail="Nenhuma coleta ativa" tone="emerald" />
          <MetricCard label="Integrações externas" value="0" detail="Adapters preparados" tone="amber" />
          <MetricCard label="Versão da base" value="0.1" detail="Modular monolith" tone="violet" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ecossistema</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Produtos preparados para crescer</h2>
              </div>
              <span className="hidden text-sm text-slate-500 sm:block">Selecione um módulo para explorar</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {productModules.map((module) => (
                <ModuleCard key={module.slug} module={module} />
              ))}
            </div>
          </div>

          <SystemStatus />
        </section>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Próxima camada</p>
              <h2 className="mt-2 text-lg font-semibold text-white">A fundação está pronta para a primeira feature</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                As telas atuais delimitam o produto sem ativar autenticação, cobrança, scraping ou tratamento de dados pessoais. Cada módulo pode evoluir dentro da sua própria área reservada.
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              <span className="mr-2 text-cyan-300">→</span> Escolha um módulo no menu
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
