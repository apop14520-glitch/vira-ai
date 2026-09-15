"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Não foi possível entrar agora.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-lg font-black text-slate-950 shadow-lg shadow-cyan-500/20">V</span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">VIRA<span className="text-cyan-300">.AI</span></p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acesso administrativo</p>
          </div>
        </div>
        <div className="mt-8">
          <h1 className="text-2xl font-bold text-white">Entrar no painel</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Use as credenciais privadas do administrador para continuar.</p>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold text-slate-200">Usuário<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" /></label>
          <label className="block text-sm font-semibold text-slate-200">Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" /></label>
          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm font-semibold text-red-200">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 disabled:cursor-wait disabled:opacity-60">{submitting ? "Validando…" : "Entrar"}</button>
        </form>
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">O acesso é protegido por sessão segura e expira automaticamente.</p>
      </section>
    </main>
  );
}

