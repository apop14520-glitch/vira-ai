"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";

import { businessApi, FoursquareStatus } from "@/lib/business-api";

type ThemeChoice = "system" | "light" | "dark";
type SectionId = "appearance" | "connections" | "workspace" | "governance" | "capabilities";

const themeLabels: Record<ThemeChoice, string> = { system: "Sistema", light: "Claro", dark: "Escuro" };

const menuGroups: Array<{ label: string; items: Array<{ id: SectionId; label: string; description: string; icon: string }> }> = [
  { label: "Preferências", items: [{ id: "appearance", label: "Aparência", description: "Tema, idioma e região", icon: "◐" }] },
  { label: "Operação", items: [{ id: "connections", label: "Conexões", description: "Integrações e saúde", icon: "⌘" }] },
  { label: "Administração mestre", items: [{ id: "workspace", label: "Workspace", description: "Ambiente e organizações", icon: "▣" }, { id: "governance", label: "Proteção de dados", description: "Acesso, segurança e LGPD", icon: "◆" }] },
  { label: "Sistema", items: [{ id: "capabilities", label: "Recursos", description: "Uso e capacidades", icon: "◈" }] },
];

const sectionCopy: Record<SectionId, { title: string; description: string }> = {
  appearance: { title: "Aparência", description: "Tema, idioma, densidade e formato regional." },
  connections: { title: "Conexões", description: "Integrações externas e saúde dos serviços locais." },
  workspace: { title: "Workspace", description: "Identidade do ambiente e organizações." },
  governance: { title: "Proteção de dados", description: "Acesso, segurança, auditoria e LGPD." },
  capabilities: { title: "Recursos", description: "Capacidades disponíveis e limites operacionais." },
};

function applyTheme(choice: ThemeChoice) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = choice === "system" ? (prefersDark ? "dark" : "light") : choice;
}

function applyDensity(nextDensity: string) {
  document.documentElement.dataset.density = nextDensity === "compacta" ? "compact" : "comfortable";
}

export function PreferencesMenu() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [foursquareStatus, setFoursquareStatus] = useState<FoursquareStatus | null>(null);
  const [foursquareKey, setFoursquareKey] = useState("");
  const [savingFoursquareKey, setSavingFoursquareKey] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null);
  const [density, setDensity] = useState("confortável");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vira-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setChoice(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme("system");
    }
    const savedDensity = localStorage.getItem("vira-density");
    const nextDensity = savedDensity === "compacta" || savedDensity === "confortável" ? savedDensity : "confortável";
    setDensity(nextDensity);
    applyDensity(nextDensity);
    const onSystemThemeChange = () => { if (!localStorage.getItem("vira-theme")) applyTheme("system"); };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  useEffect(() => {
    businessApi.foursquareStatus().then(setFoursquareStatus).catch(() => setFoursquareStatus(null));
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  function selectTheme(nextChoice: ThemeChoice) {
    setChoice(nextChoice);
    if (nextChoice === "system") localStorage.removeItem("vira-theme"); else localStorage.setItem("vira-theme", nextChoice);
    applyTheme(nextChoice);
  }

  function selectDensity(nextDensity: string) {
    setDensity(nextDensity);
    localStorage.setItem("vira-density", nextDensity);
    applyDensity(nextDensity);
  }

  function publishFoursquareStatus(status: FoursquareStatus) {
    setFoursquareStatus(status);
    window.dispatchEvent(new CustomEvent<FoursquareStatus>("vira-foursquare-status", { detail: status }));
  }

  async function saveFoursquareKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!foursquareKey.trim()) return;
    setSavingFoursquareKey(true);
    setIntegrationMessage(null);
    try {
      publishFoursquareStatus(await businessApi.saveFoursquareKey(foursquareKey));
      setFoursquareKey("");
      setIntegrationMessage("Chave configurada nesta sessão local.");
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? error.message : "Não foi possível configurar a chave.");
    } finally { setSavingFoursquareKey(false); }
  }

  async function clearFoursquareKey() {
    setSavingFoursquareKey(true);
    setIntegrationMessage(null);
    try {
      publishFoursquareStatus(await businessApi.clearFoursquareKey());
      setIntegrationMessage("Chave removida da sessão local.");
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? error.message : "Não foi possível remover a chave.");
    } finally { setSavingFoursquareKey(false); }
  }

  return (
    <div ref={menuRef} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" aria-label="Configurações" title="Configurações" onClick={() => setOpen((current) => !current)} className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 p-0 text-sm font-bold text-cyan-800 transition hover:border-cyan-400/70 hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 dark:text-cyan-200">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">V</span>
      </button>

      {open && <div role="dialog" aria-label="Configurações do VIRA.AI" className="absolute right-0 top-12 z-50 grid max-h-[calc(100vh-5rem)] w-[min(94vw,720px)] grid-cols-[142px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-950 shadow-2xl shadow-slate-950/25 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:grid-cols-[204px_minmax(0,1fr)]">
        <nav aria-label="Categorias de configuração" className="overflow-y-auto border-r border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/70 sm:p-3">
          <div className="px-2 py-2"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Painel de controle</p><p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">VIRA.AI local</p></div>
          {menuGroups.map((group) => <div key={group.label} className="mt-2.5"><p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">{group.label}</p>{group.items.map((item) => <button key={item.id} type="button" role="menuitem" onClick={() => setActiveSection(item.id)} className={`mb-1 flex w-full items-start gap-2 rounded-xl px-2 py-2.5 text-left transition ${activeSection === item.id ? "bg-cyan-100 text-cyan-950 dark:bg-cyan-400/15 dark:text-cyan-100" : "text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"}`}><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-cyan-700 shadow-sm dark:bg-slate-800 dark:text-cyan-300">{item.icon}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold sm:text-sm">{item.label}</span><span className="hidden truncate text-[11px] font-medium text-slate-500 dark:text-slate-500 sm:block">{item.description}</span></span></button>)}</div>)}
        </nav>
        <section className="flex min-h-0 flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Configuração</p><h2 className="mt-1 text-lg font-semibold sm:text-xl">{sectionCopy[activeSection].title}</h2><p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">{sectionCopy[activeSection].description}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar configurações" className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white">×</button></header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">{activeSection === "appearance" && <AppearanceAndLocaleSection choice={choice} selectTheme={selectTheme} density={density} selectDensity={selectDensity} />}{activeSection === "connections" && <ConnectionsAndHealthSection status={foursquareStatus} keyValue={foursquareKey} setKeyValue={setFoursquareKey} saving={savingFoursquareKey} message={integrationMessage} save={saveFoursquareKey} clear={clearFoursquareKey} />}{activeSection === "workspace" && <WorkspaceAndOrganizationsSection />}{activeSection === "governance" && <GovernanceSection />}{activeSection === "capabilities" && <FeaturesSection />}</div>
        </section>
      </div>}
    </div>
  );
}

function AppearanceSection({ choice, selectTheme, density, selectDensity }: { choice: ThemeChoice; selectTheme: (choice: ThemeChoice) => void; density: string; selectDensity: (density: string) => void }) {
  return <div className="space-y-5"><SettingCard title="Tema da interface" description="A escolha é aplicada a todas as páginas do VIRA.AI."><div className="grid grid-cols-3 gap-2">{(Object.keys(themeLabels) as ThemeChoice[]).map((theme) => <button key={theme} type="button" onClick={() => selectTheme(theme)} aria-pressed={choice === theme} className={`rounded-xl border px-2 py-3 text-sm font-semibold transition ${choice === theme ? "border-cyan-500 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-400/10 dark:text-cyan-200" : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{themeLabels[theme]}</button>)}</div></SettingCard><SettingCard title="Densidade" description="Escolha o espaçamento da interface: confortável para leitura ou compacta para ver mais itens."><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => selectDensity("confortável")} aria-pressed={density === "confortável"} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${density === "confortável" ? "border-cyan-500 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-400/10 dark:text-cyan-200" : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"}`}>Confortável</button><button type="button" onClick={() => selectDensity("compacta")} aria-pressed={density === "compacta"} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${density === "compacta" ? "border-cyan-500 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-400/10 dark:text-cyan-200" : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"}`}>Compacta</button></div><p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">Confortável aumenta respiros e alturas dos cartões. Compacta reduz esses espaços para facilitar a leitura de listas e painéis.</p></SettingCard><InfoBanner>Indicadores flutuantes de desenvolvimento estão ocultos nesta configuração local.</InfoBanner></div>;
}

function AppearanceAndLocaleSection({ choice, selectTheme, density, selectDensity }: { choice: ThemeChoice; selectTheme: (choice: ThemeChoice) => void; density: string; selectDensity: (density: string) => void }) {
  return <div className="space-y-4"><AppearanceSection choice={choice} selectTheme={selectTheme} density={density} selectDensity={selectDensity} /><LocaleSection /></div>;
}

function LocaleSection() { return <div className="space-y-4"><SettingCard title="Idioma da interface" description="Todos os textos operacionais estão em português."><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3.5 dark:border-slate-800 dark:bg-slate-950/60"><span className="text-base font-semibold">Português (Brasil)</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">Ativo</span></div></SettingCard><SettingCard title="Região e horário" description="Usados para datas e eventos locais."><div className="grid gap-2 sm:grid-cols-2"><ReadOnlyValue label="Região" value="Brasil (pt-BR)" /><ReadOnlyValue label="Fuso horário" value="America/Manaus" /></div></SettingCard></div>; }

function IntegrationsSection({ status, keyValue, setKeyValue, saving, message, save, clear }: { status: FoursquareStatus | null; keyValue: string; setKeyValue: (value: string) => void; saving: boolean; message: string | null; save: (event: FormEvent<HTMLFormElement>) => void; clear: () => void }) {
  return <div className="space-y-4"><SettingCard title="Foursquare Places" description="Pesquisa de estabelecimentos para o VIRA Business, limitada a 20 resultados."><div className="mb-4 flex items-center justify-between gap-3"><span className="text-base font-semibold">Estado da conexão</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status?.configured ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{status?.configured ? "Configurada" : "Não configurada"}</span></div><form onSubmit={save} className="space-y-3"><label className="block text-sm font-semibold">Chave de serviço<input type="password" value={keyValue} onChange={(event) => setKeyValue(event.target.value)} autoComplete="off" maxLength={2048} placeholder={status?.configured ? "Digite para substituir" : "Cole sua chave aqui"} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><button type="submit" disabled={saving || !keyValue.trim()} className="w-full rounded-xl bg-slate-950 px-3 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">{saving ? "Salvando…" : "Salvar chave"}</button></form>{status?.configured && <button type="button" disabled={saving} onClick={() => void clear()} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Remover chave da sessão</button>}{message && <p aria-live="polite" className="mt-3 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">{message}</p>}</SettingCard><InfoBanner>A chave é enviada ao backend, nunca retorna para a interface e não é salva no navegador. Em produção, use um gerenciador de segredos.</InfoBanner></div>;
}

function ConnectionsAndHealthSection({ status, keyValue, setKeyValue, saving, message, save, clear }: { status: FoursquareStatus | null; keyValue: string; setKeyValue: (value: string) => void; saving: boolean; message: string | null; save: (event: FormEvent<HTMLFormElement>) => void; clear: () => void }) {
  return <div className="space-y-4"><IntegrationsSection status={status} keyValue={keyValue} setKeyValue={setKeyValue} saving={saving} message={message} save={save} clear={clear} /><HealthSection /></div>;
}

function WorkspaceSection() { return <div className="space-y-4"><SettingCard title="Ambiente atual" description="Identidade técnica do workspace em execução."><div className="grid gap-2 sm:grid-cols-2"><ReadOnlyValue label="Nome" value="Workspace local" /><ReadOnlyValue label="Ambiente" value="Desenvolvimento" /><ReadOnlyValue label="Versão" value="Fundação v0.1" /><ReadOnlyValue label="Arquitetura" value="Monólito modular" /></div></SettingCard><InfoBanner>Alterações de nome e ambiente serão persistidas depois da camada de identidade e configurações do workspace.</InfoBanner></div>; }

function OrganizationsSection() { return <div className="space-y-4"><SettingCard title="Tenancy" description="A estrutura já está reservada para separar organizações e dados."><StatusRow label="Organização local" value="Ativa" /><StatusRow label="Isolamento por organização" value="Preparado" /><StatusRow label="Troca de organização" value="Aguardando identidade" /></SettingCard><InfoBanner>O contexto autenticado será obrigatório antes de permitir criação, convite ou troca de organizações.</InfoBanner></div>; }

function WorkspaceAndOrganizationsSection() { return <div className="space-y-4"><WorkspaceSection /><OrganizationsSection /></div>; }

function AccessSection() { return <div className="space-y-4"><SettingCard title="Controle de acesso" description="Configurações mestras que serão aplicadas por papel."><StatusRow label="Autenticação" value="Ainda não ativada" /><StatusRow label="Papéis e permissões" value="Estrutura reservada" /><StatusRow label="Princípio do menor privilégio" value="Obrigatório" /></SettingCard><InfoBanner>Por segurança, estas opções são somente informativas enquanto a autenticação não estiver implementada.</InfoBanner></div>; }

function SecuritySection() { return <div className="space-y-4"><SettingCard title="Controles ativos" description="Proteções aplicadas desde a fundação técnica."><StatusRow label="Cabeçalhos de segurança" value="Ativos" /><StatusRow label="IDs de correlação" value="Ativos" /><StatusRow label="Chaves fora do código" value="Obrigatório" /><StatusRow label="Auditoria do VIRA Business" value="Ativa" /></SettingCard><SettingCard title="Eventos" description="O pipeline registra criação e mudanças de estágio sem conteúdo pessoal."><InfoBanner>Retenção, exportação e consulta por administradores serão definidos junto com a política de auditoria.</InfoBanner></SettingCard></div>; }

function PrivacySection() { return <div className="space-y-4"><SettingCard title="Princípios de tratamento" description="Regras mestras do ecossistema VIRA.AI."><StatusRow label="Minimização de dados" value="Ativa" /><StatusRow label="Limitação de finalidade" value="Ativa" /><StatusRow label="Dados pessoais no Business" value="Não coletados" /><StatusRow label="Privacidade por padrão" value="Ativa" /></SettingCard><InfoBanner>Qualquer novo campo passa por revisão de finalidade, retenção, base legal e necessidade.</InfoBanner></div>; }

function GovernanceSection() { return <div className="space-y-4"><AccessSection /><SecuritySection /><PrivacySection /></div>; }

function FeaturesSection() { return <div className="space-y-4"><SettingCard title="Capacidades do ambiente" description="Estado das principais áreas da plataforma."><StatusRow label="VIRA Business" value="Operacional" /><StatusRow label="Foursquare Places" value="Opcional" /><StatusRow label="Scraping" value="Desativado" /><StatusRow label="Provedores de IA" value="Preparados" /><StatusRow label="Cobrança" value="Desativada" /></SettingCard><InfoBanner>Sinalizadores por organização e limites de uso serão ativados com a camada de tenancy.</InfoBanner></div>; }

function HealthSection() { const [state, setState] = useState("Verificando…"); useEffect(() => { fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}/health`).then((response) => setState(response.ok ? "API online" : "API indisponível")).catch(() => setState("API indisponível")); }, []); return <div className="space-y-4"><SettingCard title="Serviços locais" description="Leitura em tempo real dos serviços do ambiente."><StatusRow label="API FastAPI" value={state} /><StatusRow label="Banco de desenvolvimento" value="SQLite" /><StatusRow label="Frontend" value="Next.js" /></SettingCard><InfoBanner>Este diagnóstico não exibe dados de usuários, chaves ou conteúdo do banco.</InfoBanner></div>; }

function SettingCard({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50"><h3 className="text-base font-semibold">{title}</h3><p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">{description}</p><div className="mt-4">{children}</div></section>; }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span><span className="text-right text-sm font-semibold text-cyan-800 dark:text-cyan-300">{value}</span></div>; }
function ReadOnlyValue({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function InfoBanner({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-sm font-medium leading-6 text-cyan-950 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">{children}</div>; }
