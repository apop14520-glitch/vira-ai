"use client";

export type ApiErrorPayload = { error?: { code?: string; message?: string; request_id?: string } };

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(
    message: string,
    options: { status: number; code?: string; requestId?: string; retryAfter?: number },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
  }
}

function safeMessage(status: number, path: string): string {
  if (status === 401 && path === "/api/v1/auth/login") return "Usuário ou senha inválidos.";
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if (status === 403) return "Você não tem permissão para realizar esta ação.";
  if (status === 404) return "O recurso solicitado não foi encontrado.";
  if (status === 409 && path === "/api/v1/auth/setup") {
    return "O acesso administrativo já foi criado. Entre com suas credenciais.";
  }
  if (status === 409) return "A alteração entrou em conflito com outro registro.";
  if (status === 412 && path === "/api/v1/auth/setup") {
    return "O código de ativação ainda não foi configurado no servidor.";
  }
  if (status === 412) return "A operação depende de uma configuração válida.";
  if (status === 429) return "Muitas tentativas. Aguarde antes de tentar novamente.";
  if (status >= 500) return "O serviço está temporariamente indisponível.";
  return "Não foi possível concluir esta operação.";
}

function requestId(): string | undefined {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return undefined;
}

export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith("/api/")) throw new Error("As requisições do cliente devem usar caminhos same-origin.");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("X-Request-ID")) {
    const id = requestId();
    if (id) headers.set("X-Request-ID", id);
  }
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  if (response.ok) return response;

  const payload = (await response.clone().json().catch(() => null)) as ApiErrorPayload | null;
  const retryAfterValue = response.headers.get("Retry-After");
  const retryAfter = retryAfterValue ? Number.parseInt(retryAfterValue, 10) : undefined;
  throw new ApiClientError(safeMessage(response.status, path), {
    status: response.status,
    code: payload?.error?.code,
    requestId: payload?.error?.request_id ?? response.headers.get("X-Request-ID") ?? undefined,
    retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
