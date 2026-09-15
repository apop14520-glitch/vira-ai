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
    checking: { label: "Verificando", detail: "Consultando a API local", dot: "bg-amber-300 animate-pulse" },
    online: { label: "Disponível", detail: "Verificação respondendo", dot: "bg-emerald-300" },
    offline: { label: "Indisponível", detail: "Inicie a API local para conectar", dot: "bg-slate-500" },
  }[state];

  return (
    <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/45 p-4 xl:mt-10 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sistema</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Saúde da plataforma</h2>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${copy.dot}`} />
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:mt-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-300">{service}</span>
          <span className={`text-xs font-medium ${state === "online" ? "text-emerald-300" : state === "checking" ? "text-amber-300" : "text-slate-500"}`}>{copy.label}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{copy.detail}</p>
      </div>
      <div className="mt-5 space-y-3 text-xs">
        <StatusRow label="API versionada" value="/api/v1/" />
        <StatusRow label="Banco local" value="SQLite" />
        <StatusRow label="Provedores de IA" value="Preparados" />
      </div>
    </aside>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-slate-500">{label}</span><span className="text-slate-300">{value}</span></div>;
}
