"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGate } from "@/components/auth-gate";
import { PreferencesMenu } from "@/components/preferences-menu";
import { SiteFooter } from "@/components/site-footer";
import { logout as logoutSession } from "@/lib/auth-api";

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
    <AuthGate>
      <div className="min-h-screen bg-slate-950">
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 py-3 backdrop-blur-xl lg:py-3.5">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" aria-expanded={mobileMenuOpen} aria-controls="vira-mobile-menu" aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMobileMenuOpen((current) => !current)} className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 transition hover:border-cyan-400/60 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-cyan-200 lg:hidden">
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileMenuOpen ? "opacity-0" : ""}`} />
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
              </button>
              <Brand compact />
            </div>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2 lg:flex" aria-label="Navegação principal">
              {navigation.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return <NavItem key={item.href} {...item} active={active} compact />;
              })}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-3">
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
          </aside>
        </>}

        <main className="mx-auto max-w-[1440px] px-4 pb-7 pt-0 sm:px-6 sm:py-10 lg:px-8">{children}</main>
        <SiteFooter />
      </div>
    </AuthGate>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`flex shrink-0 items-center gap-3 ${compact ? "px-0" : "px-3"}`}>
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
      await logoutSession();
    } finally {
      window.location.assign("/login");
    }
  }

  return <button type="button" onClick={() => void logout()} disabled={loading} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-400/60 hover:bg-slate-900 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:cursor-wait disabled:opacity-60">{loading ? "Saindo…" : "Sair"}</button>;
}

function NavItem({ href, label, symbol, active, compact = false }: { href: string; label: string; symbol: string; active: boolean; compact?: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`nav-item group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[-0.01em] transition ${compact ? "px-2.5 py-2" : "px-3 py-3"} ${active ? "bg-cyan-100 font-bold text-cyan-950 dark:bg-cyan-400/15 dark:text-cyan-100" : "text-slate-700 hover:bg-slate-950 hover:text-white dark:text-slate-300 dark:hover:bg-cyan-400 dark:hover:text-slate-950"}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold leading-none transition ${active ? "bg-cyan-300 text-slate-950" : "bg-white text-cyan-700 group-hover:bg-cyan-300 group-hover:text-slate-950 dark:bg-slate-800 dark:text-cyan-300 dark:group-hover:bg-slate-950 dark:group-hover:text-cyan-300"}`}>{symbol}</span>
      <span>{label}</span>
    </Link>
  );
}
