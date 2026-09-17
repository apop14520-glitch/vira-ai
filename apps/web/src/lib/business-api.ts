export type LeadStatus = "novo" | "qualificado" | "em_conversa" | "proposta" | "ganho" | "perdido";
export type LeadPriority = "alta" | "normal" | "baixa";
export type LeadTemperature = "quente" | "morno" | "frio";

export type CompanyLead = {
  id: string;
  lead_number: number;
  company_name: string;
  segment: string;
  city: string;
  state: string;
  website: string | null;
  website_status: "nao_verificado" | "informado" | "ausente";
  source: string;
  purpose: string;
  status: LeadStatus;
  priority: LeadPriority;
  temperature: LeadTemperature;
  external_place_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type BusinessSummary = { total: number; by_status: Record<LeadStatus, number> };
export type CompanyLeadInput = Pick<CompanyLead, "company_name" | "segment" | "city" | "state" | "website" | "source" | "priority" | "temperature" | "external_place_id">;
export type PlaceResult = { place_id: string; name: string; segment: string; city: string; state: string; website: string | null; address: string | null; website_status: "informado" | "nao_verificado" };
export type FoursquareStatus = { configured: boolean; mode: string; message: string };
export type AuditEvent = {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  occurred_at: string;
  outcome: string;
  metadata: Record<string, unknown>;
};

import { apiJson } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(`/api/v1/business${path}`, init);
}

export const businessApi = {
  list: () => request<CompanyLead[]>("/leads"),
  summary: () => request<BusinessSummary>("/summary"),
  create: (input: CompanyLeadInput) => request<CompanyLead>("/leads", { method: "POST", body: JSON.stringify(input) }),
  updateStatus: (lead: CompanyLead, status: LeadStatus) =>
    request<CompanyLead>(`/leads/${lead.id}/status`, { method: "PATCH", body: JSON.stringify({ status, version: lead.version }) }),
  remove: (lead: CompanyLead) => request<void>(`/leads/${lead.id}`, { method: "DELETE" }),
  foursquareStatus: () => request<FoursquareStatus>("/integrations/foursquare"),
  saveFoursquareKey: (api_key: string) => request<FoursquareStatus>("/integrations/foursquare", { method: "PUT", body: JSON.stringify({ api_key }) }),
  clearFoursquareKey: () => request<FoursquareStatus>("/integrations/foursquare", { method: "PUT", body: JSON.stringify({ clear: true }) }),
  searchPlaces: (input: { establishment_name: string; city: string; state: string; quantity?: number }) =>
    request<PlaceResult[]>("/places/search", { method: "POST", body: JSON.stringify({ ...input, quantity: Math.min(input.quantity ?? 20, 20) }) }),
  auditEvents: (limit = 50) => request<AuditEvent[]>(`/audit?limit=${limit}`),
};
