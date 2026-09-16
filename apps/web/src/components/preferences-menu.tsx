"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAdminSession } from "@/components/auth-gate";
import { businessApi, FoursquareStatus } from "@/lib/business-api";
import { changePassword, logout } from "@/lib/auth-api";
import type { AdminSession } from "@/lib/auth-api";

type ThemeChoice = "system" | "light" | "dark";
type SectionId = "appearance" | "connections" | "security";

const themeLabels: Record<ThemeChoice, string> = { system: "Sistema", light: "Claro", dark: "Escuro" };
const PASSWORD_MIN_LENGTH = 12;

const menuGroups: Array<{ label: string; items: Array<{ id: SectionId; label: string; description: string; icon: string }> }> = [
  { label: "Preferências", items: [{ id: "appearance", label: "Aparência", description: "Tema e idioma", icon: "◐" }] },
  { label: "Operação", items: [{ id: "connections", label: "Conexões", description: "Integrações e saúde", icon: "⌘" }] },
  { label: "Acesso", items: [{ id: "security", label: "Segurança", description: "Sessão e senha", icon: "◆" }] },
];

const sectionCopy: Record<SectionId, { title: string; description: string }> = {
  appearance: { title: "Aparência", description: "Tema, idioma e região do VIRA.AI." },
  connections: { title: "Conexões", description: "Integrações externas e saúde dos serviços locais." },
  security: { title: "Segurança", description: "Sessão administrativa, senha e controles ativos." },
};

function applyTheme(choice: ThemeChoice) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = choice === "system" ? (prefersDark ? "dark" : "light") : choice;
}

export function PreferencesMenu() {
  const router = useRouter();
  const session = useAdminSession();
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [foursquareStatus, setFoursquareStatus] = useState<FoursquareStatus | null>(null);
  const [foursquareKey, setFoursquareKey] = useState("");
  const [savingFoursquareKey, setSavingFoursquareKey] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityMessageTone, setSecurityMessageTone] = useState<"error" | "success">("error");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vira-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setChoice(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme("system");
    }
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

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validatePasswordChange(currentPassword, newPassword, passwordConfirmation);
    if (validationMessage) {
      setSecurityMessageTone("error");
      setSecurityMessage(validationMessage);
      return;
    }
    setSavingPassword(true);
    setSecurityMessage(null);
    try {
      await changePassword(currentPassword, newPassword, passwordConfirmation);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setSecurityMessageTone("success");
      setSecurityMessage("Senha alterada. Entre novamente com a nova senha.");
      router.replace("/login");
    } catch (error) {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setSecurityMessageTone("error");
      setSecurityMessage(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally { setSavingPassword(false); }
  }

  async function signOut() {
    setSecurityMessageTone("error");
    setSecurityMessage(null);
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" aria-label="Configurações" title="Configurações" onClick={() => setOpen((current) => !current)} className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 p-0 text-sm font-bold text-cyan-800 transition hover:border-cyan-400/70 hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 dark:text-cyan-200">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">V</span>
      </button>

      {open && <div role="dialog" aria-label="Configurações do VIRA.AI" className="settings-panel settings-panel--bounded absolute right-0 top-12 z-50 grid w-[min(94vw,680px)] grid-cols-[128px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-950 shadow-2xl shadow-slate-950/25 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:grid-cols-[190px_minmax(0,1fr)]">
        <nav aria-label="Categorias de configuração" className="settings-nav overflow-y-auto border-r border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/70 sm:p-3">
          <div className="settings-nav-header px-2 py-2"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Painel de controle</p><p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">VIRA.AI local</p></div>
          {menuGroups.map((group) => <div key={group.label} className="settings-nav-group mt-2.5"><p className="settings-nav-group-label px-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.label}</p>{group.items.map((item) => <button key={item.id} type="button" role="menuitem" onClick={() => setActiveSection(item.id)} className={`mb-1 flex w-full items-start gap-2 rounded-xl px-2 py-2.5 text-left transition ${activeSection === item.id ? "bg-cyan-100 text-cyan-950 dark:bg-cyan-400/15 dark:text-cyan-100" : "text-slate-700 hover:bg-slate-200 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"}`}><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-cyan-700 shadow-sm dark:bg-slate-800 dark:text-cyan-300">{item.icon}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold sm:text-sm">{item.label}</span><span className="hidden truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:block">{item.description}</span></span></button>)}</div>)}
        </nav>
        <section className="settings-content flex min-h-0 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800 sm:px-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Configuração</p><h2 className="mt-1 text-lg font-semibold sm:text-xl">{sectionCopy[activeSection].title}</h2><p className="mt-1 text-sm font-medium leading-5 text-slate-600 dark:text-slate-400">{sectionCopy[activeSection].description}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar configurações" className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white">×</button></header>
          <div className="settings-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 pb-10 sm:p-4 sm:pb-10">{activeSection === "appearance" && <AppearanceAndLocaleSection choice={choice} selectTheme={selectTheme} />}{activeSection === "connections" && <ConnectionsAndHealthSection status={foursquareStatus} keyValue={foursquareKey} setKeyValue={setFoursquareKey} saving={savingFoursquareKey} message={integrationMessage} save={saveFoursquareKey} clear={clearFoursquareKey} />}{activeSection === "security" && <SecuritySection session={session} currentPassword={currentPassword} newPassword={newPassword} confirmation={passwordConfirmation} setCurrentPassword={setCurrentPassword} setNewPassword={setNewPassword} setConfirmation={setPasswordConfirmation} saving={savingPassword} message={securityMessage} messageTone={securityMessageTone} submit={submitPassword} signOut={signOut} />}</div>
        </section>
      </div>}
    </div>
  );
}

function AppearanceAndLocaleSection({ choice, selectTheme }: { choice: ThemeChoice; selectTheme: (choice: ThemeChoice) => void }) {
  return <div className="space-y-4"><SettingCard title="Tema da interface" description="A escolha é aplicada a todas as páginas do VIRA.AI."><div className="grid grid-cols-3 gap-2">{(Object.keys(themeLabels) as ThemeChoice[]).map((theme) => <button key={theme} type="button" onClick={() => selectTheme(theme)} aria-pressed={choice === theme} className={`rounded-xl border px-2 py-3 text-sm font-semibold transition ${choice === theme ? "border-cyan-500 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-400/10 dark:text-cyan-200" : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{themeLabels[theme]}</button>)}</div></SettingCard><LocaleSection /></div>;
}

function LocaleSection() { return <SettingCard title="Idioma e região" description="Todos os textos operacionais estão em português do Brasil."><div className="grid gap-2 sm:grid-cols-2"><ReadOnlyValue label="Idioma" value="Português (Brasil)" /><ReadOnlyValue label="Fuso horário" value="America/Manaus" /></div></SettingCard>; }

function IntegrationsSection({ status, keyValue, setKeyValue, saving, message, save, clear }: { status: FoursquareStatus | null; keyValue: string; setKeyValue: (value: string) => void; saving: boolean; message: string | null; save: (event: FormEvent<HTMLFormElement>) => void; clear: () => void }) {
  return <div className="space-y-4"><SettingCard title="Foursquare Places" description="Pesquisa de estabelecimentos para o VIRA Business, limitada a 20 resultados."><div className="mb-4 flex items-center justify-between gap-3"><span className="text-base font-semibold">Estado da conexão</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status?.configured ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{status?.configured ? "Configurada" : "Não configurada"}</span></div><form onSubmit={save} className="space-y-3"><label className="block text-sm font-semibold">Chave de serviço<input type="password" value={keyValue} onChange={(event) => setKeyValue(event.target.value)} autoComplete="off" maxLength={2048} placeholder={status?.configured ? "Digite para substituir" : "Cole sua chave aqui"} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><button type="submit" disabled={saving || !keyValue.trim()} className="w-full rounded-xl bg-slate-950 px-3 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">{saving ? "Salvando…" : "Salvar chave"}</button></form>{status?.configured && <button type="button" disabled={saving} onClick={() => void clear()} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Remover chave da sessão</button>}{message && <p aria-live="polite" className="mt-3 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">{message}</p>}</SettingCard><InfoBanner>A chave é enviada ao backend, nunca retorna para a interface e não é salva no navegador. Em produção, use um gerenciador de segredos.</InfoBanner></div>;
}

function ConnectionsAndHealthSection(props: Parameters<typeof IntegrationsSection>[0]) { return <div className="space-y-4"><IntegrationsSection {...props} /><HealthSection /></div>; }

function SecuritySection({ session, currentPassword, newPassword, confirmation, setCurrentPassword, setNewPassword, setConfirmation, saving, message, messageTone, submit, signOut }: { session: AdminSession | null; currentPassword: string; newPassword: string; confirmation: string; setCurrentPassword: (value: string) => void; setNewPassword: (value: string) => void; setConfirmation: (value: string) => void; saving: boolean; message: string | null; messageTone: "error" | "success"; submit: (event: FormEvent<HTMLFormElement>) => void; signOut: () => void }) {
  const newPasswordTooShort = Boolean(newPassword) && (newPassword.length < PASSWORD_MIN_LENGTH || !newPassword.trim());
  const reusesCurrentPassword = Boolean(currentPassword && newPassword) && currentPassword === newPassword;
  const confirmationMismatch = Boolean(confirmation) && newPassword !== confirmation;
  const passwordInvalid = !currentPassword || newPasswordTooShort || reusesCurrentPassword || !confirmation || confirmationMismatch;

  return <div className="space-y-4"><SettingCard title="Sessão atual" description="A sessão é protegida por cookie e expira automaticamente após oito horas."><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Administrador</p><p className="mt-1 text-sm font-semibold">{session?.username ?? "Sessão não identificada"}</p></div><button type="button" onClick={() => void signOut()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-rose-400/50 dark:hover:bg-rose-400/10 dark:hover:text-rose-200">Sair</button></div></SettingCard><SettingCard title="Alterar senha" description="Defina uma nova senha administrativa sem expor os dados atuais."><div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-sm leading-5 text-cyan-950 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100"><p className="font-semibold">Requisitos da nova senha</p><p className="mt-1">Use pelo menos {PASSWORD_MIN_LENGTH} caracteres, confirme a mesma senha e escolha uma diferente da atual.</p></div><form onSubmit={submit} className="mt-4 space-y-4"><PasswordField id="current-password" label="Senha atual" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><PasswordField id="new-password" label="Nova senha" value={newPassword} onChange={setNewPassword} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} error={newPasswordTooShort || reusesCurrentPassword} hint={newPasswordTooShort ? `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` : reusesCurrentPassword ? "A nova senha precisa ser diferente da senha atual." : undefined} /><PasswordField id="password-confirmation" label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} autoComplete="new-password" error={confirmationMismatch} hint={confirmationMismatch ? "A confirmação não corresponde à nova senha." : undefined} /><button type="submit" disabled={saving || passwordInvalid} className="w-full rounded-xl bg-cyan-500 px-3 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Alterando…" : "Alterar senha"}</button></form>{message && <p role={messageTone === "error" ? "alert" : "status"} aria-live={messageTone === "error" ? "assertive" : "polite"} className={`mt-3 rounded-xl border px-3.5 py-3 text-sm font-medium leading-6 ${messageTone === "error" ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100" : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100"}`}>{message}</p>}</SettingCard><SettingCard title="Controles ativos" description="Proteções aplicadas desde a fundação técnica."><StatusRow label="Sessões opacas e HttpOnly" value="Ativo" /><StatusRow label="Menor privilégio" value="Obrigatório" /><StatusRow label="Auditoria sem segredos" value="Ativa" /><StatusRow label="Dados pessoais no Business" value="Não coletados" /></SettingCard></div>;
}

function PasswordField({ id, label, value, onChange, autoComplete, minLength, error, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; minLength?: number; error?: boolean; hint?: string }) {
  const [visible, setVisible] = useState(false);
  const hintId = `${id}-hint`;

  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-semibold">{label}</label><div className="relative"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} minLength={minLength} aria-invalid={error || undefined} aria-describedby={hint ? hintId : undefined} required className={`w-full rounded-xl border bg-white px-3.5 py-3 pr-20 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-500 dark:bg-slate-950 dark:text-white ${error ? "border-rose-400 focus:border-rose-500" : "border-slate-300 dark:border-slate-700"}`} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} className="absolute inset-y-0 right-2 my-1 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-cyan-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-cyan-300">{visible ? "Ocultar" : "Mostrar"}</button></div>{hint && <p id={hintId} className={`text-xs font-medium leading-5 ${error ? "text-rose-700 dark:text-rose-200" : "text-slate-500 dark:text-slate-400"}`}>{hint}</p>}</div>;
}

function validatePasswordChange(currentPassword: string, newPassword: string, confirmation: string): string | null {
  if (!currentPassword) return "Informe a senha atual.";
  if (!newPassword.trim() || newPassword.length < PASSWORD_MIN_LENGTH) return `A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (newPassword !== confirmation) return "A confirmação não corresponde à nova senha.";
  if (newPassword === currentPassword) return "A nova senha precisa ser diferente da senha atual.";
  return null;
}

function HealthSection() { const [state, setState] = useState("Verificando…"); useEffect(() => { fetch("/api/health", { credentials: "include" }).then((response) => setState(response.ok ? "API disponível" : "API indisponível")).catch(() => setState("API indisponível")); }, []); return <SettingCard title="Saúde do sistema" description="Leitura em tempo real dos serviços do ambiente."><StatusRow label="API FastAPI" value={state} /><StatusRow label="Banco de desenvolvimento" value="SQLite" /><StatusRow label="Frontend" value="Next.js" /></SettingCard>; }

function SettingCard({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50"><h3 className="text-base font-semibold">{title}</h3><p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">{description}</p><div className="mt-4">{children}</div></section>; }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span><span className="text-right text-sm font-semibold text-cyan-800 dark:text-cyan-300">{value}</span></div>; }
function ReadOnlyValue({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function InfoBanner({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-sm font-medium leading-6 text-cyan-950 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">{children}</div>; }
