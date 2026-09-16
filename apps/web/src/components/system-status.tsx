"use client";

import { useEffect, useState } from "react";

type ConnectionState = "checking" | "online" | "offline";

export function SystemStatus() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [service, setService] = useState("vira-api");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, cache: "no-store", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha na verificação da API");
        const payload = (await response.json()) as { service?: string; status?: string };
        setService(payload.service ?? "vira-api");
        setState(payload.status === "ok" ? "online" : "offline");
      })
      .catch(() => setState("offline"));

    return () => controller.abort();
  }, []);

  const copy = {
    checking: { label: "verificando", dot: "bg-amber-300 animate-pulse", tone: "text-amber-300" },
    online: { label: "disponível", dot: "bg-emerald-300", tone: "text-emerald-300" },
    offline: { label: "indisponível", dot: "bg-slate-500", tone: "text-slate-400" },
  }[state];

  return (
    <footer className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-slate-800/80 px-4 py-5 text-xs sm:px-6 lg:px-8" aria-label="Informações do sistema">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500">
        <span className="font-semibold text-slate-300">© 2026 VIRA.AI</span>
        <span aria-hidden="true">·</span>
        <span>Ambiente de desenvolvimento</span>
        <span aria-hidden="true">·</span>
        <span>v0.1</span>
      </div>
      <div className="flex items-center gap-2" aria-live="polite" aria-label={`${service}: API ${copy.label}`}>
        <span className={`h-2 w-2 rounded-full ${copy.dot}`} aria-hidden="true" />
        <span className={copy.tone}>API {copy.label}</span>
      </div>
    </footer>
  );
}
