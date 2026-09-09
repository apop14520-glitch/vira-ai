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

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1/business${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Não foi possível concluir esta operação.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
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
};
