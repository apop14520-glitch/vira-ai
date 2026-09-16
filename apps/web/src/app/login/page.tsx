"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { InteractiveLoginStage } from "@/components/interactive-login-stage";
import { getInitialSetupStatus, login, setupInitialAdmin, type InitialSetupStatus } from "@/lib/auth-api";
import { ApiClientError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [setupStatus, setSetupStatus] = useState<InitialSetupStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested?.startsWith("/")) setNextPath(requested);
    let active = true;
    getInitialSetupStatus()
      .then((status) => { if (active) setSetupStatus(status); })
      .catch(() => { if (active) setStatusError("Não foi possível verificar a configuração inicial. Você ainda pode tentar entrar."); });
    return () => { active = false; };
  }, []);

  const isSetup = setupStatus?.required === true;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isSetup) {
        await setupInitialAdmin(username.trim(), password, confirmation, setupToken);
      } else {
        await login(username.trim(), password);
      }
      router.replace(nextPath);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar agora.");
      setPassword("");
      setConfirmation("");
      setSetupToken("");
      if (isSetup && reason instanceof ApiClientError && reason.status === 409) {
        setSetupStatus({ required: false, configured: true });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page min-h-screen">
      <InteractiveLoginStage>
        <section className="login-panel w-full max-w-[440px] rounded-[1.75rem] border p-6 shadow-2xl sm:p-8" aria-labelledby="login-title">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-lg font-black text-slate-950 shadow-lg shadow-cyan-500/25">V</span>
            <div>
              <p className="text-base font-semibold tracking-tight">VIRA<span className="text-cyan-300">.AI</span></p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Acesso administrativo</p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Área restrita</p>
            <h1 id="login-title" className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">{isSetup ? "Criar acesso administrativo" : "Entrar no painel"}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{isSetup ? "Defina o primeiro acesso usando o código de ativação configurado no servidor." : "Use as credenciais privadas do administrador para continuar."}</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="admin-username" className="text-sm font-semibold text-slate-200">Usuário</label>
              <input id="admin-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Digite o usuário configurado" required className="login-input mt-2" />
            </div>
            <div>
              <label htmlFor="admin-password" className="text-sm font-semibold text-slate-200">Senha</label>
              <input id="admin-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSetup ? "new-password" : "current-password"} minLength={isSetup ? 12 : undefined} required className="login-input mt-2" />
            </div>
            {isSetup && (
              <>
                <div>
                  <label htmlFor="admin-confirmation" className="text-sm font-semibold text-slate-200">Confirmar senha</label>
                  <input id="admin-confirmation" name="confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required className="login-input mt-2" />
                </div>
                <div>
                  <label htmlFor="admin-setup-token" className="text-sm font-semibold text-slate-200">Código de ativação</label>
                  <input id="admin-setup-token" name="setup-token" type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} autoComplete="off" required className="login-input mt-2" />
                </div>
              </>
            )}
            {statusError && <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-3 text-sm leading-5 text-amber-100">{statusError}</p>}
            {isSetup && !setupStatus?.configured && <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-3 text-sm leading-5 text-amber-100">O código de ativação ainda não foi configurado no servidor.</p>}
            {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-3 text-sm font-medium leading-5 text-rose-100">{error}</p>}
            <button type="submit" disabled={submitting || !username.trim() || !password || (isSetup && (!confirmation || !setupToken || !setupStatus?.configured))} className="login-submit mt-1 w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60">{submitting ? (isSetup ? "Criando…" : "Entrando…") : (isSetup ? "Criar acesso" : "Entrar")}</button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>Sessão protegida por 8 horas.</span>
            <Link href="/" className="text-cyan-300 transition hover:text-cyan-200">Voltar</Link>
          </div>
        </section>
      </InteractiveLoginStage>
    </main>
  );
}
