"use client";

import Link from "next/link";

// Cores em valores fixos de propósito: o tema claro remapeia várias classes slate/cyan do Tailwind,
// e o rodapé é uma faixa escura nos dois temas.
const platform = [
  { href: "/", label: "Visão geral" },
  { href: "/concursos", label: "Concursos" },
  { href: "/business", label: "Business" },
  { href: "/sites", label: "Sites" },
  { href: "/studio", label: "Studio" },
];

const concursos = [
  "Teoria completa, assunto por assunto",
  "Banco de questões com filtros",
  "Sessões de estudo com gabarito na hora",
  "Simulados cronometrados",
];

const linkClass =
  "rounded text-sm text-[#cbd5e1] transition hover:text-[#67e8f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/70";

export function SiteFooter() {
  return (
    <footer aria-label="Rodapé" className="mt-10 bg-[#0a1424] text-[#cbd5e1]">
      <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-[#22d3ee]/60 to-transparent" />

      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr] lg:gap-16 lg:px-8">
        <div className="max-w-md space-y-5">
          <Link href="/" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/70">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-base font-black text-[#020617] shadow-lg shadow-cyan-500/20">
              V
            </span>
            <span className="text-xl font-semibold tracking-tight text-[#f8fafc]">
              VIRA<span className="text-[#67e8f9]">.AI</span>
            </span>
          </Link>
          <p className="text-sm leading-6 text-[#94a3b8]">
            Estude para concursos com método: leia a teoria, treine com questões e teste o seu preparo em simulados, tudo
            no mesmo lugar.
          </p>
          <Link
            href="/concursos"
            className="inline-flex rounded-xl bg-[#22d3ee] px-5 py-2.5 text-sm font-black text-[#020617] transition hover:bg-[#67e8f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67e8f9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1424]"
          >
            Ir para o VIRA Concursos
          </Link>
        </div>

        <nav aria-label="Plataforma">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#67e8f9]">Plataforma</h2>
          <ul className="mt-4 space-y-3">
            {platform.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#67e8f9]">No VIRA Concursos</h2>
          <ul className="mt-4 space-y-3">
            {concursos.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-[#cbd5e1]">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[#22d3ee]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-5 text-xs text-[#94a3b8] sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} VIRA.AI. Todos os direitos reservados.</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-bold text-[#cbd5e1] transition hover:text-[#67e8f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/70"
          >
            Voltar ao topo
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5-5 5 5" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}
