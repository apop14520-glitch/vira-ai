"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  businessApi,
  BusinessSummary,
  CompanyLead,
  CompanyLeadInput,
  FoursquareStatus,
  LeadStatus,
  PlaceResult,
} from "@/lib/business-api";
import { BRAZILIAN_STATES, fallbackMunicipalities, fetchMunicipalities } from "@/lib/brazil-locations";

const stages: Array<{ key: LeadStatus; label: string; tone: string; dot: string }> = [
  { key: "novo", label: "Novas", tone: "border-cyan-400/40 bg-cyan-50 text-cyan-900 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200", dot: "bg-cyan-400" },
  { key: "qualificado", label: "Qualificadas", tone: "border-violet-400/40 bg-violet-50 text-violet-900 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-200", dot: "bg-violet-400" },
  { key: "em_conversa", label: "Em conversa", tone: "border-amber-400/40 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200", dot: "bg-amber-400" },
  { key: "proposta", label: "Proposta", tone: "border-orange-400/40 bg-orange-50 text-orange-900 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-200", dot: "bg-orange-400" },
  { key: "ganho", label: "Ganhos", tone: "border-emerald-400/40 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200", dot: "bg-emerald-400" },
  { key: "perdido", label: "Perdidos", tone: "border-slate-400/50 bg-slate-100 text-slate-800 dark:border-slate-500/50 dark:bg-slate-800/70 dark:text-slate-300", dot: "bg-slate-500" },
];

function createInitialForm(): CompanyLeadInput {
  return {
    company_name: "",
    segment: "",
    city: "",
    state: "",
    website: "",
    source: "manual",
    priority: "normal",
    temperature: "morno",
    external_place_id: null,
  };
}

export function BusinessDashboard() {
  const [leads, setLeads] = useState<CompanyLead[]>([]);
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [foursquareStatus, setFoursquareStatus] = useState<FoursquareStatus | null>(null);
  const [searchForm, setSearchForm] = useState({ establishment_name: "", city: "", state: "", quantity: 20 });
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [municipalitiesNotice, setMunicipalitiesNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyLeadInput | null>(null);
  const [draftAddress, setDraftAddress] = useState<string | null>(null);
  const [draftMode, setDraftMode] = useState<"place" | "manual" | null>(null);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  const reload = async () => {
    const [nextLeads, nextSummary] = await Promise.all([businessApi.list(), businessApi.summary()]);
    setLeads(nextLeads);
    setSummary(nextSummary);
  };

  useEffect(() => {
    Promise.all([reload(), businessApi.foursquareStatus().then(setFoursquareStatus)])
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onFoursquareStatus = (event: Event) => setFoursquareStatus((event as CustomEvent<FoursquareStatus>).detail);
    window.addEventListener("vira-foursquare-status", onFoursquareStatus);
    return () => window.removeEventListener("vira-foursquare-status", onFoursquareStatus);
  }, []);

  useEffect(() => {
    const state = searchForm.state;
    if (!state) {
      setMunicipalities([]);
      setMunicipalitiesLoading(false);
      setMunicipalitiesNotice(null);
      return;
    }

    const controller = new AbortController();
    setMunicipalities(fallbackMunicipalities(state));
    setMunicipalitiesLoading(true);
    setMunicipalitiesNotice(null);
    fetchMunicipalities(state, controller.signal)
      .then((items) => setMunicipalities(items))
      .catch((error: Error) => {
        if (!controller.signal.aborted) setMunicipalitiesNotice(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMunicipalitiesLoading(false);
      });

    return () => controller.abort();
  }, [searchForm.state]);

  useEffect(() => {
    if (!draftMode) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeDraft(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [draftMode]);

  const stageLeads = useMemo(() => stages.map((stage) => ({ ...stage, leads: leads.filter((lead) => lead.status === stage.key) })), [leads]);

  async function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlacesLoading(true);
    setPlacesError(null);
    setPlaces([]);
    try {
      const results = await businessApi.searchPlaces(searchForm);
      setPlaces(results);
      if (results.length === 0) setPlacesError("Nenhum local encontrado para esse estabelecimento e cidade.");
    } catch (error) {
      setPlacesError(error instanceof Error ? error.message : "Não foi possível buscar locais.");
    } finally {
      setPlacesLoading(false);
    }
  }

  function openPlace(place: PlaceResult) {
    setDraft({
      ...createInitialForm(),
      company_name: place.name,
      segment: place.segment,
      city: place.city,
      state: place.state,
      website: place.website ?? "",
      source: "Foursquare Places",
      external_place_id: place.place_id,
    });
    setDraftAddress(place.address ?? null);
    setDraftMode("place");
    setDraftError(null);
  }

  function openManual() {
    setDraft(createInitialForm());
    setDraftAddress(null);
    setDraftMode("manual");
    setDraftError(null);
  }

  function closeDraft() {
    setDraft(null);
    setDraftAddress(null);
    setDraftMode(null);
    setDraftError(null);
  }

  function updateDraft<K extends keyof CompanyLeadInput>(field: K, value: CompanyLeadInput[K]) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setDraftSubmitting(true);
    setDraftError(null);
    try {
      await businessApi.create({ ...draft, website: draft.website?.trim() || null });
      await reload();
      closeDraft();
      setMessage(draftMode === "place" ? "Local adicionado aos leads com os dados conferidos." : "Empresa adicionada aos leads.");
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Não foi possível adicionar aos leads.");
    } finally {
      setDraftSubmitting(false);
    }
  }

  async function changeStatus(lead: CompanyLead, nextStatus: LeadStatus) {
    try {
      const updated = await businessApi.updateStatus(lead, nextStatus);
      setLeads((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setSummary(await businessApi.summary());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível mover a empresa.");
      await reload();
    }
  }

  async function deleteLead(lead: CompanyLead) {
    setDeletingLeadId(lead.id);
    try {
      await businessApi.remove(lead);
      setLeads((items) => items.filter((item) => item.id !== lead.id));
      setDeleteCandidateId(null);
      setSummary(await businessApi.summary());
      setMessage(`Empresa #${String(lead.lead_number).padStart(6, "0")} excluída do acompanhamento.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir a empresa.");
    } finally {
      setDeletingLeadId(null);
    }
  }

  return (
    <div className="density-stack mx-auto max-w-[1560px] space-y-6 px-5 py-2 sm:px-8">
      <section className="density-surface rounded-3xl border border-cyan-400/20 bg-white p-6 shadow-xl shadow-cyan-950/5 dark:bg-slate-900/60 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">VIRA Business · Radar de oportunidades</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">Encontre empresas e mova oportunidades.</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">Pesquise estabelecimentos, confira os dados empresariais e adicione ao pipeline somente quando estiver pronto.</p>
          </div>
          <div className="rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 dark:border-slate-700/80 dark:bg-slate-950/70">
            <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Empresas no radar</p>
            <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{summary?.total ?? "—"}</p>
          </div>
        </div>
      </section>

      <section className="density-surface rounded-3xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Pipeline</p>
            <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Visão por estágio</h2>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Toda alteração é registrada para auditoria local.</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stageLeads.map((stage) => (
            <div key={stage.key} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-black ${stage.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />{stage.label}</span>
                <span className="text-lg font-black text-slate-950 dark:text-white">{summary?.by_status[stage.key] ?? stage.leads.length}</span>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">{stage.leads.length === 1 ? "1 empresa" : `${stage.leads.length} empresas`}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="density-surface rounded-3xl border border-cyan-400/20 bg-white p-6 shadow-sm dark:bg-slate-900/50 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Busca de locais</p>
            <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">Encontrar estabelecimentos</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-slate-700 dark:text-slate-300">Informe o estabelecimento, a cidade, o estado e quantos locais deseja conferir. Os dados só entram no pipeline depois da sua confirmação.</p>
          </div>
          <span className={`inline-flex h-fit rounded-full px-3 py-1.5 text-xs font-black ${foursquareStatus?.configured ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{foursquareStatus?.configured ? "Foursquare configurada" : "Foursquare sem chave"}</span>
        </div>

        <form onSubmit={searchPlaces} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_92px_minmax(0,1fr)_150px_auto] lg:items-end">
          <Field label="Nome do estabelecimento *" value={searchForm.establishment_name} onChange={(establishment_name) => setSearchForm({ ...searchForm, establishment_name })} placeholder="Ex.: padaria, clínica ou Norte Solar" required />
          <SearchSelectField label="UF *" value={searchForm.state} onChange={(state) => setSearchForm((current) => ({ ...current, state, city: "" }))} options={BRAZILIAN_STATES.map((state) => [state.uf, `${state.uf} — ${state.name}`] as [string, string])} placeholder="UF" required />
          <SearchSelectField label="Cidade / município *" value={searchForm.city} onChange={(city) => setSearchForm((current) => ({ ...current, city }))} options={municipalities.map((city) => [city, city] as [string, string])} placeholder={searchForm.state ? "Selecione a cidade" : "Selecione a UF primeiro"} required disabled={!searchForm.state || municipalitiesLoading} loading={municipalitiesLoading} />
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">Quantidade<span className="relative mt-1.5 block"><select value={searchForm.quantity} onChange={(event) => setSearchForm({ ...searchForm, quantity: Number(event.target.value) })} className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 font-semibold text-slate-950 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{[5, 10, 15, 20].map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}</select><SelectChevron /></span></label>
          <button type="submit" disabled={placesLoading || !foursquareStatus?.configured} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{placesLoading ? "Buscando…" : "Buscar locais"}</button>
        </form>

        {searchForm.state && <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">{municipalitiesLoading ? "Atualizando municípios do estado selecionado…" : `${municipalities.length} município(s) disponível(is) para ${searchForm.state}.`}{municipalitiesNotice ? ` ${municipalitiesNotice} A lista local de referência continua disponível.` : ""}</p>}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          {!foursquareStatus?.configured ? <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">Configure a chave em <strong>Configurações (V)</strong> → Integrações para liberar a pesquisa.</p> : <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Até 20 locais por busca. O endereço permanece apenas na conferência.</p>}
          <button type="button" onClick={openManual} className="shrink-0 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-800 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200">Adicionar manualmente</button>
        </div>

        {placesError && <p role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">{placesError}</p>}
        {places.length > 0 && <div className="mt-7 border-t border-slate-200 pt-6 dark:border-slate-800"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-black text-slate-950 dark:text-white">{places.length} local(is) encontrado(s)</p><span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Selecione um local para revisar os dados</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{places.map((place) => <PlaceCard key={place.place_id} place={place} onSelect={() => openPlace(place)} />)}</div></div>}
      </section>

      <section className="density-surface rounded-3xl border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:p-7">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Acompanhamento</p><h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Leads no pipeline</h2></div>{loading && <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">Carregando…</span>}</div>
        {message && <p aria-live="polite" className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm font-semibold text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100">{message}</p>}
        {!loading && leads.length === 0 && <p className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400">Nenhuma empresa adicionada. Faça uma busca acima e escolha um local para preencher o lead.</p>}
        {leads.length > 0 && <div className="mt-5 grid gap-3 lg:grid-cols-2">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} onStatusChange={(status) => void changeStatus(lead, status)} confirmingDelete={deleteCandidateId === lead.id} deleting={deletingLeadId === lead.id} onRequestDelete={() => setDeleteCandidateId(lead.id)} onCancelDelete={() => setDeleteCandidateId(null)} onConfirmDelete={() => void deleteLead(lead)} />)}</div>}
      </section>

      {draft && draftMode && <LeadDrawer draft={draft} mode={draftMode} address={draftAddress} submitting={draftSubmitting} error={draftError} updateDraft={updateDraft} onClose={closeDraft} onSubmit={submitDraft} />}
    </div>
  );
}

function PlaceCard({ place, onSelect }: { place: PlaceResult; onSelect: () => void }) {
  return <article className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50"><div className="flex-1"><div className="flex items-start justify-between gap-3"><h3 className="font-black text-slate-950 dark:text-white">{place.name}</h3><span className="shrink-0 rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black text-cyan-900 dark:bg-cyan-400/10 dark:text-cyan-200">Local</span></div><p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{place.segment}</p><p className="mt-2 text-xs font-medium leading-5 text-slate-600 dark:text-slate-400">{place.address ?? `${place.city}/${place.state}`}</p>{place.website && <p className="mt-1 truncate text-xs font-semibold text-cyan-800 dark:text-cyan-300">{place.website}</p>}</div><button type="button" onClick={onSelect} className="mt-4 w-full rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">Ver dados e adicionar</button></article>;
}

function LeadCard({
  lead,
  onStatusChange,
  confirmingDelete,
  deleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  lead: CompanyLead;
  onStatusChange: (status: LeadStatus) => void;
  confirmingDelete: boolean;
  deleting: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950 dark:text-white">{lead.company_name}</h3>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-900 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200">Lead #{String(lead.lead_number).padStart(6, "0")}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{lead.segment} · {lead.city}/{lead.state}</p>
          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">Origem: {lead.source} · Temperatura: <span className="font-semibold capitalize">{lead.temperature}</span></p>
        </div>
        <span className="w-fit rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold capitalize text-slate-800 dark:bg-slate-800 dark:text-slate-200">{lead.priority}</span>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-700 dark:text-slate-400">Mover para<span className="relative mt-1.5 block"><select value={lead.status} onChange={(event) => onStatusChange(event.target.value as LeadStatus)} className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select><SelectChevron /></span></label>
        {!confirmingDelete && <button type="button" onClick={onRequestDelete} className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-400/10">Excluir</button>}
      </div>
      {confirmingDelete && <div className="mt-3 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 dark:border-red-400/30 dark:bg-red-400/10 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-red-900 dark:text-red-100">Excluir este lead? Essa ação não pode ser desfeita.</p><div className="flex gap-2"><button type="button" onClick={onCancelDelete} disabled={deleting} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-400/30 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-red-400/10">Cancelar</button><button type="button" onClick={onConfirmDelete} disabled={deleting} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">{deleting ? "Excluindo…" : "Confirmar exclusão"}</button></div></div>}
    </article>
  );
}

function LeadDrawer({ draft, mode, address, submitting, error, updateDraft, onClose, onSubmit }: { draft: CompanyLeadInput; mode: "place" | "manual"; address: string | null; submitting: boolean; error: string | null; updateDraft: <K extends keyof CompanyLeadInput>(field: K, value: CompanyLeadInput[K]) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-[60] flex items-start justify-end bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-5" role="presentation"><button type="button" aria-label="Fechar painel de lead" onClick={onClose} className="absolute inset-0 cursor-default" /><section role="dialog" aria-modal="true" aria-labelledby="lead-drawer-title" className="relative flex h-full max-h-[calc(100vh-1.5rem)] w-[min(94vw,500px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-950/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:max-h-[calc(100vh-2.5rem)]"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">{mode === "place" ? "Local encontrado" : "Inclusão manual"}</p><h2 id="lead-drawer-title" className="mt-1 text-xl font-black">Adicionar aos leads</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-400">Revise os dados empresariais antes de salvar no pipeline.</p></div><button type="button" onClick={onClose} aria-label="Fechar painel" className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white">×</button></header><form onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><div className="space-y-4"><Field label="Empresa *" value={draft.company_name} onChange={(value) => updateDraft("company_name", value)} placeholder="Nome da empresa" required /><Field label="Segmento *" value={draft.segment} onChange={(value) => updateDraft("segment", value)} placeholder="Segmento" required /><div className="grid grid-cols-[1fr_76px] gap-3"><Field label="Cidade *" value={draft.city} onChange={(value) => updateDraft("city", value)} placeholder="Cidade" required /><Field label="UF *" value={draft.state} onChange={(value) => updateDraft("state", value)} placeholder="UF" required maxLength={2} /></div><Field label="Site institucional" value={draft.website ?? ""} onChange={(value) => updateDraft("website", value)} placeholder="https://empresa.com.br" /><div className="grid gap-3 sm:grid-cols-2"><SelectField label="Prioridade" value={draft.priority} onChange={(value) => updateDraft("priority", value as CompanyLeadInput["priority"])} options={[["alta", "Alta"], ["normal", "Normal"], ["baixa", "Baixa"]]} /><SelectField label="Temperatura" value={draft.temperature} onChange={(value) => updateDraft("temperature", value as CompanyLeadInput["temperature"])} options={[["quente", "Quente"], ["morno", "Morno"], ["frio", "Frio"]]} /></div><ReadOnlyValue label="Origem do dado" value={draft.source} />{address && <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3 dark:border-cyan-400/30 dark:bg-cyan-400/10"><p className="text-[10px] font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300">Endereço para conferência</p><p className="mt-1 text-xs font-semibold leading-5 text-cyan-950 dark:text-cyan-100">{address}</p><p className="mt-2 text-[11px] font-medium leading-4 text-cyan-900/80 dark:text-cyan-100/70">O endereço não é salvo no lead nesta versão.</p></div>}<p className="text-[11px] font-medium leading-4 text-slate-600 dark:text-slate-400">Somente dados empresariais mínimos são adicionados. Não há telefone, e-mail ou dados pessoais neste fluxo.</p>{error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">{error}</p>}</div><div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button><button type="submit" disabled={submitting} className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60">{submitting ? "Adicionando…" : "Adicionar aos leads"}</button></div></form></section></div>;
}

function Field({ label, value, onChange, placeholder, required, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; maxLength?: number }) {
  return <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} maxLength={maxLength} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500" /></label>;
}

function SearchSelectField({ label, value, onChange, options, placeholder, required, disabled, loading }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; placeholder: string; required?: boolean; disabled?: boolean; loading?: boolean }) {
  return <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">{label}<span className="relative mt-1.5 block"><select value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} aria-busy={loading} className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 font-semibold text-slate-950 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-900/70 dark:disabled:text-slate-500"><option value="" disabled>{loading ? "Carregando…" : placeholder}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select><SelectChevron /></span></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">{label}<span className="relative mt-1.5 block"><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 font-semibold text-slate-950 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select><SelectChevron /></span></label>;
}

function SelectChevron() {
  return <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500 dark:text-slate-400"><svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-200">{value}</p></div>;
}
