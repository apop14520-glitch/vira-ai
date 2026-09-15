# Publicação híbrida do VIRA.AI no Cloudflare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o frontend Next.js do VIRA.AI no Cloudflare Workers com OpenNext, mantendo a API FastAPI no Railway e preservando login, sessão, Business, Foursquare e rollback.

**Architecture:** O navegador continuará usando apenas rotas same-origin do frontend. O Worker Cloudflare executará o Next.js/OpenNext e encaminhará as rotas permitidas para `https://vira-api-production.up.railway.app`, enquanto o frontend já publicado no Railway permanecerá disponível para rollback. A API e o banco não serão migrados nesta etapa.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, OpenNext Cloudflare, Wrangler, FastAPI no Railway, SQLite atual, cookies HttpOnly.

**Spec:** `docs/superpowers/specs/2026-09-15-cloudflare-hybrid-deployment-design.md`

## Global Constraints

- Manter Next.js 15 durante a primeira migração; não trocar para vinext sem uma matriz de compatibilidade aprovada.
- Usar OpenNext para a aplicação Next.js existente com App Router e Route Handlers.
- Manter `API_INTERNAL_URL` exclusivamente no runtime server-side do frontend Cloudflare.
- Usar `https://vira-api-production.up.railway.app` como origem inicial, sem `/login`, `/api` ou `/health`.
- Não usar `railway.internal` no navegador ou como origem do Worker Cloudflare.
- Não versionar senha, token, chave Foursquare, `.dev.vars`, `.env` ou qualquer segredo.
- Não alterar `main`, apagar banco, remover volume, desligar Railway ou rotacionar segredos automaticamente.
- Manter o frontend Railway como rollback até a validação de produção.
- Toda mudança de comportamento deve ter teste escrito antes do código e deve passar pelo ciclo vermelho-verde-refatoração.

---

### Task 1: Tornar o proxy same-origin portátil e testável

**Files:**
- Create: `apps/web/src/app/api/proxy-utils.ts`
- Create: `apps/web/src/app/api/proxy-utils.test.ts`
- Modify: `apps/web/src/app/api/[...path]/route.ts`

**Interfaces:**
- Produces `resolveUpstreamPath(path: readonly string[]): string | null` para a allowlist de rotas.
- Produces `resolveApiOrigin(rawValue: string | undefined, runtimeEnvironment: string | undefined): URL` para validar a origem server-side.
- Produces `copySetCookieHeaders(source: Headers, target: Headers): void` para preservar cookies de sessão em runtimes Node e Workers.
- The existing `GET`, `POST`, `PUT`, `PATCH` and `DELETE` exports in `route.ts` remain unchanged for Next.js consumers.

- [ ] **Step 1: Write the failing tests for the allowlist and URL contract**

  Add tests to `apps/web/src/app/api/proxy-utils.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";

  import { copySetCookieHeaders, resolveApiOrigin, resolveUpstreamPath } from "@/app/api/proxy-utils";

  describe("contrato do proxy Cloudflare", () => {
    it("converte login para a rota de API correspondente", () => {
      expect(resolveUpstreamPath(["v1", "auth", "login"])).toBe("/api/v1/auth/login");
    });

    it("recusa uma rota fora da allowlist", () => {
      expect(resolveUpstreamPath(["v1", "admin", "secrets"])).toBeNull();
    });

    it("aceita a origem HTTPS sem acrescentar caminhos", () => {
      expect(resolveApiOrigin("https://vira-api-production.up.railway.app", "production").toString()).toBe(
        "https://vira-api-production.up.railway.app/",
      );
    });

    it("recusa origem de produção ausente ou com caminho", () => {
      expect(() => resolveApiOrigin(undefined, "production")).toThrow("API_INTERNAL_URL");
      expect(() => resolveApiOrigin("https://vira-api-production.up.railway.app/login", "production")).toThrow(
        "URL base",
      );
    });

    it("mantém o fallback local apenas fora da produção", () => {
      expect(resolveApiOrigin(undefined, "development").toString()).toBe("http://127.0.0.1:8000/");
    });

    it("copia todos os cookies de sessão para a resposta", () => {
      const source = new Headers({ "content-type": "application/json" });
      Object.defineProperty(source, "getSetCookie", {
        value: () => ["vira_admin_session=one; Path=/", "vira_admin_session=two; Path=/"],
      });
      const target = new Headers();

      copySetCookieHeaders(source, target);

      expect(target.get("set-cookie")).toContain("vira_admin_session=one");
      expect(target.get("set-cookie")).toContain("vira_admin_session=two");
    });
  });
  ```

- [ ] **Step 2: Run the focused test to verify it fails for the missing module**

  Run: `pnpm --dir apps/web exec vitest run src/app/api/proxy-utils.test.ts`

  Expected: FAIL because `@/app/api/proxy-utils` does not exist yet.

- [ ] **Step 3: Write the minimal pure helpers**

  Implement the three exported functions in `proxy-utils.ts`.

  `resolveUpstreamPath` must preserve the existing routes exactly: `/health`, `/v1/auth/login`, `/v1/auth/session`, `/v1/auth/logout`, `/v1/auth/password`, `/v1/business` and every `/v1/business/` child. It must return `null` for every other path.

  `resolveApiOrigin` must accept only `http:` or `https:`, reject credentials, query strings, fragments and non-root paths, return the local `http://127.0.0.1:8000/` fallback only when the runtime is not production, and throw a message containing `API_INTERNAL_URL` when production has no value.

  `copySetCookieHeaders` must copy `content-type`, `x-request-id`, `retry-after` and `www-authenticate` when present and append every value returned by `getSetCookie()` when that method exists. If a runtime exposes only a single `set-cookie` header, preserve that value without logging it.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm --dir apps/web exec vitest run src/app/api/proxy-utils.test.ts`

  Expected: PASS with all proxy utility tests green.

- [ ] **Step 5: Replace inline proxy logic with the tested helpers**

  Update `route.ts` so it imports the helpers, uses `resolveUpstreamPath`, obtains the runtime environment from `process.env.NODE_ENV`, calls `resolveApiOrigin(process.env.API_INTERNAL_URL, process.env.NODE_ENV)`, and returns a safe `502` response when URL validation or upstream `fetch` fails. Keep `cache: "no-store"`, `redirect: "manual"`, `credentials` out of server fetch options, and the existing request body behavior.

- [ ] **Step 6: Run the focused proxy tests again**

  Run: `pnpm --dir apps/web exec vitest run src/app/api/proxy-utils.test.ts`

  Expected: PASS with the route helper contract covered by real imported code.

- [ ] **Step 7: Commit the portable proxy boundary**

  ```text
  git add apps/web/src/app/api/proxy-utils.ts apps/web/src/app/api/proxy-utils.test.ts apps/web/src/app/api/[...path]/route.ts
  git commit -m "fix: tornar proxy same-origin portatil"
  ```

### Task 2: Corrigir mensagens de autenticação sem expor detalhes

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/api-client.test.ts`

**Interfaces:**
- `apiRequest(path, init)` keeps its current signature and still sends `credentials: "include"`.
- A `401` from `/api/v1/auth/login` produces `Usuário ou senha inválidos.`.
- A `401` from `/api/v1/auth/session` or an authenticated operation produces `Sua sessão expirou. Entre novamente para continuar.`.
- Backend error bodies remain ignored by the user-facing message mapper.

- [ ] **Step 1: Add a failing login-specific 401 test**

  Add this test to `apps/web/src/lib/api-client.test.ts`:

  ```ts
  it("mostra mensagem de credencial inválida somente no login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "detalhe interno" } }), { status: 401 }));

    await expect(apiJson("/api/v1/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 401,
      message: "Usuário ou senha inválidos.",
    });
  });
  ```

- [ ] **Step 2: Run the test to verify the current generic session message fails**

  Run: `pnpm --dir apps/web exec vitest run src/lib/api-client.test.ts -t "credencial inválida"`

  Expected: FAIL because the current status-only mapper reports the session-expired message for every `401`.

- [ ] **Step 3: Make the message mapper path-aware**

  Change the private `safeMessage` helper to receive both `status` and `path`. Return the login-specific message only when `status === 401 && path === "/api/v1/auth/login"`; preserve the existing safe messages for all other statuses and paths. Pass `path` from `apiRequest` to the mapper.

- [ ] **Step 4: Run all API client tests**

  Run: `pnpm --dir apps/web exec vitest run src/lib/api-client.test.ts`

  Expected: PASS, including session expiry, login failure and retry-after behavior.

- [ ] **Step 5: Commit the authentication message fix**

  ```text
  git add apps/web/src/lib/api-client.ts apps/web/src/lib/api-client.test.ts
  git commit -m "fix: diferenciar falha de login da sessao expirada"
  ```

### Task 3: Adicionar o runtime Cloudflare Workers com OpenNext

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Create: `apps/web/open-next.config.ts`
- Create: `apps/web/wrangler.jsonc`
- Create: `apps/web/.dev.vars.example`

**Interfaces:**
- Existing scripts `dev`, `build`, `start`, `typecheck` and `test` remain usable by Railway and local development.
- New scripts are `preview`, `deploy` and `cf-typegen` and use the OpenNext Cloudflare CLI documented for existing Next.js applications.
- Wrangler uses `.open-next/worker.js`, `.open-next/assets`, `nodejs_compat` and compatibility date `2026-09-15`.
- `API_INTERNAL_URL` is not declared in `wrangler.jsonc`; it is supplied at runtime by a Cloudflare secret or encrypted environment variable.

- [ ] **Step 1: Add the Cloudflare package contract test**

  Create `apps/web/src/lib/cloudflare-package.test.ts` with a filesystem-level assertion that reads `apps/web/package.json` and verifies the three scripts and the dependency names `@opennextjs/cloudflare` and `wrangler`. The test must not inspect a secret value.

  ```ts
  import { readFileSync } from "node:fs";
  import { fileURLToPath } from "node:url";
  import { describe, expect, it } from "vitest";

  describe("contrato de build Cloudflare", () => {
    it("declara scripts e dependências do Workers", () => {
      const packagePath = fileURLToPath(new URL("../../package.json", import.meta.url));
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      expect(packageJson.scripts?.preview).toContain("opennextjs-cloudflare preview");
      expect(packageJson.scripts?.deploy).toContain("opennextjs-cloudflare deploy");
      expect(packageJson.scripts?.["cf-typegen"]).toContain("wrangler types");
      expect(packageJson.dependencies?.["@opennextjs/cloudflare"]).toBeTruthy();
      expect(packageJson.devDependencies?.wrangler).toBeTruthy();
    });
  });
  ```

- [ ] **Step 2: Run the package contract test to verify it fails**

  Run: `pnpm --dir apps/web exec vitest run src/lib/cloudflare-package.test.ts`

  Expected: FAIL because the Cloudflare dependencies and scripts are not present.

- [ ] **Step 3: Add the OpenNext and Wrangler configuration**

  Add these exact files:

  `apps/web/open-next.config.ts`:

  ```ts
  import { defineCloudflareConfig } from "@opennextjs/cloudflare";

  export default defineCloudflareConfig();
  ```

  `apps/web/wrangler.jsonc`:

  ```jsonc
  {
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "vira-ai-web",
    "main": ".open-next/worker.js",
    "compatibility_date": "2026-09-15",
    "compatibility_flags": ["nodejs_compat"],
    "workers_dev": true,
    "assets": {
      "directory": ".open-next/assets",
      "binding": "ASSETS"
    },
    "observability": {
      "enabled": true
    }
  }
  ```

  `apps/web/.dev.vars.example`:

  ```text
  API_INTERNAL_URL=https://vira-api-production.up.railway.app
  ```

  Add `apps/web/.dev.vars`, `apps/web/cloudflare-env.d.ts` and `.open-next/` to `.gitignore`. Keep `.dev.vars.example` tracked and keep the root `.env` rules unchanged.

- [ ] **Step 4: Add the scripts and dependencies**

  Add `@opennextjs/cloudflare` to `dependencies`, `wrangler` to `devDependencies`, and add these scripts without changing the existing Railway scripts:

  ```json
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
  "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
  ```

  Run `pnpm install` from the repository root to update `pnpm-lock.yaml` with the resolved versions. Do not use a floating manual edit in the lockfile.

- [ ] **Step 5: Run package tests and the existing web checks**

  Run:

  ```text
  pnpm --dir apps/web exec vitest run src/lib/cloudflare-package.test.ts
  pnpm --dir apps/web run typecheck
  pnpm --dir apps/web run build
  ```

  Expected: the package contract test, typecheck and standard Next build pass. If the existing Vitest environment reproduces its known esbuild permission error, record that exact error and continue only with a clean targeted alternative; do not mark the test as passed.

- [ ] **Step 6: Commit the Cloudflare runtime scaffold**

  ```text
  git add apps/web/package.json apps/web/open-next.config.ts apps/web/wrangler.jsonc apps/web/.dev.vars.example pnpm-lock.yaml .gitignore
  git commit -m "feat: preparar frontend para Cloudflare Workers"
  ```

### Task 4: Validar o build OpenNext e a fronteira de segredos

**Files:**
- Create: `apps/web/scripts/check-cloudflare-artifacts.mjs`
- Modify: `apps/web/package.json`
- Test: `apps/web/src/lib/cloudflare-package.test.ts`

**Interfaces:**
- `check-cloudflare-artifacts.mjs` exits with code `0` only when `.open-next/worker.js` and `.open-next/assets` exist and no forbidden secret names or values occur in emitted text files.
- The check runs after `opennextjs-cloudflare build` and before any deploy command.
- The check never reads or prints `.dev.vars`, process secrets or Railway variables.

- [ ] **Step 1: Write the failing artifact-check test**

  Extend `cloudflare-package.test.ts` with a test that verifies the package contains a `check:cloudflare` script invoking `node scripts/check-cloudflare-artifacts.mjs`.

  ```ts
  it("verifica artefatos antes de publicar", () => {
    const packagePath = fileURLToPath(new URL("../../package.json", import.meta.url));
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.["check:cloudflare"]).toBe("node scripts/check-cloudflare-artifacts.mjs");
  });
  ```

- [ ] **Step 2: Run the package test to verify the new script assertion fails**

  Run: `pnpm --dir apps/web exec vitest run src/lib/cloudflare-package.test.ts`

  Expected: FAIL because `check:cloudflare` does not exist yet.

- [ ] **Step 3: Implement the artifact check and wire it into deploy**

  The script must recursively inspect only `.open-next/worker.js` and text files under `.open-next/assets`, fail on the names `API_ACCESS_TOKEN`, `ADMIN_ACCESS_TOKEN`, `ADMIN_INITIAL_PASSWORD`, `FOURSQUARE_API_KEY` and `NEXT_PUBLIC_API_INTERNAL_URL`, and never print matching content. Update `deploy` to run `opennextjs-cloudflare build && pnpm run check:cloudflare && opennextjs-cloudflare deploy`; keep `preview` as build plus preview so preview failures remain visible.

- [ ] **Step 4: Run the artifact check without a build to confirm its failure is honest**

  Run: `pnpm --dir apps/web run check:cloudflare`

  Expected: FAIL with a message stating that the OpenNext artifact is missing, without printing any secret or environment value.

- [ ] **Step 5: Build and run the artifact check**

  Run:

  ```text
  pnpm --dir apps/web exec opennextjs-cloudflare build
  pnpm --dir apps/web run check:cloudflare
  ```

  Expected: the build creates `.open-next/worker.js` and `.open-next/assets`, and the artifact check exits `0` without printing forbidden names or values.

- [ ] **Step 6: Run Wrangler dry-run without production credentials**

  Run: `pnpm --dir apps/web exec wrangler deploy --config wrangler.jsonc --dry-run`

  Expected: Wrangler validates the generated Worker bundle and configuration without uploading or requiring a production secret. If the dry-run reports an adapter-generated configuration mismatch, fix the configuration and rerun the command before proceeding.

- [ ] **Step 7: Commit the pre-deploy safety check**

  ```text
  git add apps/web/scripts/check-cloudflare-artifacts.mjs apps/web/package.json apps/web/src/lib/cloudflare-package.test.ts
  git commit -m "chore: validar artefatos antes do deploy Cloudflare"
  ```

### Task 5: Documentar publicação, variáveis e rollback

**Files:**
- Modify: `docs/deployment/CLOUDFLARE.md`
- Modify: `README.md`

**Interfaces:**
- Documentation names the Cloudflare Worker as `vira-ai-web` and the Railway API as `vira-api`.
- Documentation tells the operator to use the GitHub branch `feat/admin-ui-cloudflare` for preview and to keep `main` unchanged until acceptance.
- Documentation specifies `API_INTERNAL_URL=https://vira-api-production.up.railway.app` as a server-side secret for Cloudflare.
- Documentation explicitly prohibits `railway.internal` in the browser, `/login` in `API_INTERNAL_URL`, and secrets in GitHub.

- [ ] **Step 1: Add documentation tests for the deployment contract**

  Extend `cloudflare-package.test.ts` with this repository-root path and assertion:

  ```ts
  it("documenta o contrato de publicação e rollback", () => {
    const guidePath = fileURLToPath(new URL("../../../../docs/deployment/CLOUDFLARE.md", import.meta.url));
    const guide = readFileSync(guidePath, "utf8");

    for (const requiredText of [
      "vira-ai-web",
      "API_INTERNAL_URL",
      "vira-api-production.up.railway.app",
      "feat/admin-ui-cloudflare",
      "rollback",
      "railway.internal",
    ]) {
      expect(guide).toContain(requiredText);
    }
  });
  ```

- [ ] **Step 2: Run the documentation contract test to verify the new requirements are missing**

  Run: `pnpm --dir apps/web exec vitest run src/lib/cloudflare-package.test.ts`

  Expected: FAIL for at least the branch/Worker/rollback statements that are not yet in the current compatibility-only guide.

- [ ] **Step 3: Update the Cloudflare guide**

  Replace the current future-only checklist with an operational guide containing:

  1. Cloudflare Workers project creation connected to the GitHub repository.
  2. Build from repository root with `pnpm install --frozen-lockfile && pnpm --dir apps/web run deploy`.
  3. Preview branch `feat/admin-ui-cloudflare`.
  4. Runtime secret `API_INTERNAL_URL` on the Worker only.
  5. No `NEXT_PUBLIC_API_INTERNAL_URL` and no `railway.internal` in browser code.
  6. Manual verification of `/login`, `/api/health`, session cookie, Business and Foursquare.
  7. Production promotion only after Railway rollback verification.
  8. Rollback by keeping the Railway domain active and pausing/removing the Cloudflare domain, without database deletion.
  9. A separate future section for FastAPI Python Workers and D1, explicitly outside the first migration.

  Keep the official Cloudflare links for Next.js/OpenNext and FastAPI and explain that Cloudflare authentication is performed manually in the dashboard; no token is pasted into chat or committed.

- [ ] **Step 4: Update the root README deployment matrix**

  Add a short section that maps `vira-ai-web` to Cloudflare Workers and `vira-api` to Railway, names the public API origin, identifies `API_INTERNAL_URL` as server-only, and states that `ADMIN_INITIAL_PASSWORD` does not reset an existing credential.

- [ ] **Step 5: Run the documentation contract test**

  Run: `pnpm --dir apps/web exec vitest run src/lib/cloudflare-package.test.ts`

  Expected: PASS with all Cloudflare package and documentation assertions.

- [ ] **Step 6: Commit the deployment guide**

  ```text
  git add docs/deployment/CLOUDFLARE.md README.md apps/web/src/lib/cloudflare-package.test.ts
  git commit -m "docs: orientar deploy hibrido no Cloudflare"
  ```

### Task 6: Executar validação local completa e publicar somente após confirmação

**Files:**
- Modify: `docs/deployment/CLOUDFLARE.md` only if a verified command or output needs correction.
- Modify: `README.md` only if a verified service boundary needs correction.

**Interfaces:**
- No Railway variable, deployment, database, volume or production domain is changed by local validation.
- A Cloudflare deployment is attempted only after the local build, typecheck, tests and Wrangler dry-run pass.
- The Cloudflare preview uses the exact Railway API base URL and does not receive API tokens in the client bundle.

- [ ] **Step 1: Run the focused regression suite**

  Run:

  ```text
  pnpm --dir apps/web exec vitest run src/app/api/proxy-utils.test.ts src/lib/api-client.test.ts src/lib/cloudflare-package.test.ts
  ```

  Expected: all selected tests pass. If the environment reproduces the known esbuild permission failure, capture the complete error and do not claim this step passed.

- [ ] **Step 2: Run the full existing web checks**

  Run:

  ```text
  pnpm --dir apps/web run typecheck
  pnpm --dir apps/web run build
  python -m pytest apps/api/tests
  ```

  Expected: typecheck, Next build and API tests exit with code `0`.

- [ ] **Step 3: Build, inspect and dry-run the Cloudflare artifact**

  Run:

  ```text
  pnpm --dir apps/web exec opennextjs-cloudflare build
  pnpm --dir apps/web run check:cloudflare
  pnpm --dir apps/web exec wrangler deploy --config wrangler.jsonc --dry-run
  git diff --check
  git status --short --branch
  ```

  Expected: the artifact exists, the secret scan is clean, Wrangler validates the Worker, whitespace is clean, and only planned files are modified.

- [ ] **Step 4: Publish a Cloudflare preview manually**

  In Cloudflare Workers, connect the repository and authenticate manually. Use the branch `feat/admin-ui-cloudflare`, configure the build command from Task 5, and add the encrypted runtime variable `API_INTERNAL_URL` with the public Railway API base URL. Do not add a `NEXT_PUBLIC_*` copy and do not expose API tokens.

  If the Cloudflare dashboard is not authenticated, stop and ask the user to log in manually; do not request or store a token in the repository or chat.

- [ ] **Step 5: Verify the preview behavior**

  Check the Cloudflare preview URL in this order:

  1. `GET /login` returns the VIRA.AI login screen.
  2. `GET /api/health` returns a successful proxy response from `vira-api`.
  3. An invalid login returns the generic invalid-credential message and no session.
  4. A valid login creates an HttpOnly cookie and opens `/business`.
  5. Business list, status change, deletion and Foursquare search operate through same-origin `/api` paths.
  6. Logout invalidates the session and the login screen returns on the next protected request.
  7. Browser source and built assets contain no API origin, token, password or Foursquare key.

- [ ] **Step 6: Record preview result and keep Railway as rollback**

  Update `docs/deployment/CLOUDFLARE.md` with the verified preview URL pattern and any runtime-specific command correction, without recording cookies, credentials or tokens. Do not promote the Cloudflare preview to the main domain until the user explicitly approves after reviewing the test result.

- [ ] **Step 7: Commit only verified documentation corrections**

  ```text
  git add docs/deployment/CLOUDFLARE.md README.md
  git commit -m "docs: registrar validacao do preview Cloudflare"
  ```

## Final verification checklist

- [ ] `pnpm --dir apps/web exec vitest run src/app/api/proxy-utils.test.ts src/lib/api-client.test.ts src/lib/cloudflare-package.test.ts` was run and its exit code was `0`.
- [ ] `pnpm --dir apps/web run typecheck` was run and its exit code was `0`.
- [ ] `pnpm --dir apps/web run build` was run and its exit code was `0`.
- [ ] `pnpm --dir apps/web exec opennextjs-cloudflare build` was run and produced `.open-next/worker.js`.
- [ ] `pnpm --dir apps/web run check:cloudflare` found no forbidden secret names or values in emitted artifacts.
- [ ] `pnpm --dir apps/web exec wrangler deploy --config wrangler.jsonc --dry-run` was run successfully before any real deploy.
- [ ] `python -m pytest apps/api/tests` was run and its exit code was `0`.
- [ ] Railway remained available and no database, volume, main branch or production secret was changed.
- [ ] Cloudflare preview login, session, Business, Foursquare and rollback were manually verified.
