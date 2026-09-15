"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PreferencesMenu } from "@/components/preferences-menu";

const navigation = [
  { href: "/", label: "Visão geral", symbol: "⌂" },
  { href: "/business", label: "Business", symbol: "B" },
  { href: "/sites", label: "Sites", symbol: "S" },
  { href: "/studio", label: "Studio", symbol: "✦" },
  { href: "/concursos", label: "Concursos", symbol: "C" },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname() ?? "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileMenuOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-800/80 bg-slate-950/95 px-4 py-5 lg:flex">
        <Brand />
        <div className="mt-10 px-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Workspace</div>
        <nav className="mt-3 space-y-1" aria-label="Navegação principal">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <NavItem key={item.href} {...item} active={active} />;
          })}
        </nav>
        <div className="mt-auto space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-sm font-semibold text-cyan-200">V</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">Workspace local</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Desenvolvimento</p>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800/80 pt-4">
            <p className="px-3 text-xs font-semibold leading-5 text-slate-300">© 2026 VIRA.AI</p>
            <p className="px-3 text-[11px] font-medium leading-5 text-slate-500">Sistema SaaS modular brasileiro</p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10 lg:py-4">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <button type="button" aria-expanded={mobileMenuOpen} aria-controls="vira-mobile-menu" aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMobileMenuOpen((current) => !current)} className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 transition hover:border-cyan-400/60 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-cyan-200">
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileMenuOpen ? "opacity-0" : ""}`} />
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
              </button>
              <Brand compact />
            </div>
            <div className="hidden items-center gap-2 text-sm text-slate-500 lg:flex"><span className="text-slate-700">VIRA.AI</span><span>/</span><span className="text-slate-300">{navigation.find((item) => item.href === pathname)?.label ?? "Módulo"}</span></div>
            <div className="ml-auto flex items-center gap-3">
              <PreferencesMenu />
              <LogoutButton />
            </div>
          </div>
        </header>

        {mobileMenuOpen && <>
          <button type="button" aria-label="Fechar menu lateral" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px] lg:hidden" />
          <aside id="vira-mobile-menu" className="fixed inset-y-0 left-0 z-40 flex w-[min(86vw,320px)] flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 shadow-2xl shadow-slate-950/40 lg:hidden" aria-label="Menu lateral móvel">
            <div className="flex items-center justify-between gap-3">
              <Brand />
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu lateral" className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-900 hover:text-white">×</button>
            </div>
            <div className="mt-10 px-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Workspace</div>
            <nav className="mt-3 space-y-1" aria-label="Navegação principal móvel" onClick={() => setMobileMenuOpen(false)}>
              {navigation.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return <NavItem key={item.href} {...item} active={active} />;
              })}
            </nav>
            <div className="mt-auto space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-sm font-semibold text-cyan-200">V</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">Workspace local</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Desenvolvimento</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-800/80 pt-4">
                <p className="px-3 text-xs font-semibold leading-5 text-slate-300">© 2026 VIRA.AI</p>
                <p className="px-3 text-[11px] font-medium leading-5 text-slate-500">Sistema SaaS modular brasileiro</p>
              </div>
            </div>
          </aside>
        </>}

        <main className="density-main mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-10 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-3 ${compact ? "px-0" : "px-3"}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-base font-black text-slate-950 shadow-lg shadow-cyan-500/20">V</span>
      <span className="text-lg font-semibold tracking-tight text-white">VIRA<span className="text-cyan-300">.AI</span></span>
    </Link>
  );
}

function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return <button type="button" onClick={() => void logout()} disabled={loading} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-400/60 hover:bg-slate-900 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:cursor-wait disabled:opacity-60">{loading ? "Saindo…" : "Sair"}</button>;
}

function NavItem({ href, label, symbol, active, compact = false }: { href: string; label: string; symbol: string; active: boolean; compact?: boolean }) {
  return (
    <Link href={href} className={`nav-item group flex shrink-0 items-center gap-3 rounded-xl text-sm font-semibold tracking-[-0.01em] transition ${compact ? "px-3 py-2.5" : "px-3 py-3"} ${active ? "bg-cyan-100 font-bold text-cyan-950 dark:bg-cyan-400/15 dark:text-cyan-100" : "text-slate-700 hover:bg-slate-950 hover:text-white dark:text-slate-300 dark:hover:bg-cyan-400 dark:hover:text-slate-950"}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold transition ${active ? "bg-cyan-300 text-slate-950" : "bg-white text-cyan-700 group-hover:bg-cyan-300 group-hover:text-slate-950 dark:bg-slate-800 dark:text-cyan-300 dark:group-hover:bg-slate-950 dark:group-hover:text-cyan-300"}`}>{symbol}</span>
      <span>{label}</span>
    </Link>
  );
}
