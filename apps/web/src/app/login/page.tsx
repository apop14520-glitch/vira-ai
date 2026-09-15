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
    <main className="login-page">
      <div className="login-background" aria-hidden="true">
        <img src="/brand/vira-ai-logo.png" alt="" />
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="login-brand-mark">V</span>
          <div>
            <p className="login-brand-name">VIRA<span>.AI</span></p>
            <p className="login-brand-kicker">Acesso administrativo</p>
          </div>
        </div>
        <div className="login-heading">
          <p className="login-eyebrow">Área restrita</p>
          <h1 id="login-title" className="login-title">Entrar no painel</h1>
          <p className="login-description">Use as credenciais privadas do administrador para continuar.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label className="login-field">Usuário<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required /></label>
          <label className="login-field">Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
          {error && <p role="alert" className="login-error">{error}</p>}
          <button type="submit" disabled={submitting} className="login-submit">{submitting ? "Validando…" : "Entrar"}</button>
        </form>
        <p className="login-security-note">Sessão protegida e encerrada automaticamente após 8 horas.</p>
      </section>
    </main>
  );
}
