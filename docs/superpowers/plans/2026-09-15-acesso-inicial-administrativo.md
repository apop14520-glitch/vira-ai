# Acesso Inicial Administrativo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a perda de `API_INTERNAL_URL` nos deploys Cloudflare e permitir a criação segura, única e autenticada do primeiro administrador pela página de acesso.

**Architecture:** O Worker OpenNext continuará como proxy same-origin para a API Railway e preservará bindings do painel com `--keep-vars`. A API FastAPI exporá status e criação inicial protegida por `ADMIN_SETUP_TOKEN`, persistirá somente o hash da senha em uma transação que garante uma única credencial e devolverá uma sessão HttpOnly. A página `/login` alternará entre ativação inicial e login normal conforme o estado informado pela API.

**Tech Stack:** Python 3, FastAPI, Pydantic Settings, SQLite, pytest, Next.js 15, React 19, TypeScript, Vitest, OpenNext e Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-09-15-acesso-inicial-administrativo-design.md`

## Global Constraints

- Nunca armazenar senha, código de ativação, tokens ou chave Foursquare no frontend, no `wrangler.jsonc`, em logs ou em auditoria.
- `API_INTERNAL_URL` deve continuar sendo uma URL base HTTPS sem `/login`, `/api` ou `/health`.
- O cadastro inicial só pode funcionar quando não existir nenhuma credencial administrativa.
- A criação precisa ser atômica para impedir dois primeiros administradores concorrentes.
- Senha mínima de 12 caracteres e comparação constante do código de ativação.
- O cadastro bem-sucedido deve criar sessão HttpOnly sem reenviar a senha.
- O método existente `ADMIN_INITIAL_PASSWORD` deve continuar compatível, mas não pode substituir credencial persistida.
- Preservar as alterações não commitadas em `globals.css`, `interactive-login-stage.tsx` e `interactive-login-stage.test.tsx`.
- Não apagar banco, volume Railway ou credenciais existentes.
- Executar comandos `pytest` a partir de `apps/api` e comandos `pnpm` a partir de `apps/web`.

---

### Task 1: Preservar a configuração de runtime do Cloudflare

**Files:**
- Create: `apps/web/src/app/api/cloudflare-deploy-config.test.ts`
- Modify: `apps/web/package.json`
- Modify: `docs/deployment/CLOUDFLARE.md`

**Interfaces:**
- Consumes: script `deploy` existente do pacote `@vira-ai/web`.
- Produces: script `deploy` que termina em `opennextjs-cloudflare deploy -- --keep-vars`.

- [ ] **Step 1: Escrever o teste que reproduz a perda das variáveis**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("publicação Cloudflare", () => {
  it("preserva as variáveis de runtime configuradas no painel", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts.deploy).toContain("opennextjs-cloudflare deploy -- --keep-vars");
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha correta**

Run: `pnpm exec vitest run src/app/api/cloudflare-deploy-config.test.ts --configLoader runner`

Expected: FAIL porque o script atual não contém `--keep-vars`.

- [ ] **Step 3: Fazer a alteração mínima no script de deploy**

```json
"deploy": "opennextjs-cloudflare build && pnpm run check:cloudflare && opennextjs-cloudflare deploy -- --keep-vars"
```

Atualizar `docs/deployment/CLOUDFLARE.md` para registrar que variáveis criadas no painel são preservadas pelo comando e que `API_INTERNAL_URL` deve aparecer na versão ativa, não apenas no histórico de versões.

- [ ] **Step 4: Executar o teste e a checagem de configuração**

Run: `pnpm exec vitest run src/app/api/cloudflare-deploy-config.test.ts --configLoader runner`

Expected: PASS.

- [ ] **Step 5: Commit isolado**

```bash
git add apps/web/package.json apps/web/src/app/api/cloudflare-deploy-config.test.ts docs/deployment/CLOUDFLARE.md
git commit -m "fix: preservar variaveis no deploy Cloudflare"
```

### Task 2: Tornar a criação da primeira credencial atômica

**Files:**
- Modify: `apps/api/app/modules/identity/ports.py`
- Modify: `apps/api/app/modules/identity/repository.py`
- Modify: `apps/api/app/security/sessions.py`
- Modify: `apps/api/tests/test_identity_repository.py`
- Modify: `apps/api/tests/test_admin_session_auth.py`

**Interfaces:**
- Produces: `CredentialRepository.get_any_credential() -> AdminCredential | None`.
- Produces: `CredentialRepository.create_initial_credential(credential: AdminCredential) -> bool`.
- Produces: `AdminSessionService.initial_setup_required() -> bool`.
- Produces: `AdminSessionService.create_initial_credential(username: str, password: str, confirmation: str, setup_token: str) -> AdminCredential`.
- Produces: exceções `InitialSetupAlreadyCompleted`, `InitialSetupNotConfigured` e `InitialSetupRejected`.

- [ ] **Step 1: Escrever testes de repositório que falham**

Adicionar testes que criem uma credencial com `create_initial_credential`, confirmem retorno `True`, tentem outra com username diferente e confirmem retorno `False`, além de verificar que `get_any_credential` retorna somente a primeira.

```python
assert repository.create_initial_credential(first) is True
assert repository.create_initial_credential(second) is False
assert repository.get_any_credential() == first
assert repository.get_credential(second.username) is None
```

- [ ] **Step 2: Executar os testes de repositório e confirmar a falha**

Run: `pytest tests/test_identity_repository.py -q`

Expected: FAIL porque os dois métodos ainda não existem.

- [ ] **Step 3: Implementar a transação SQLite mínima**

`create_initial_credential` deve abrir conexão, executar `BEGIN IMMEDIATE`, consultar `SELECT EXISTS`, inserir somente quando vazia e retornar `False` sem modificar dados quando já houver credencial. Extrair a conversão dos campos para um helper privado para não duplicar o SQL de hash.

- [ ] **Step 4: Confirmar os testes do repositório**

Run: `pytest tests/test_identity_repository.py -q`

Expected: PASS.

- [ ] **Step 5: Escrever testes de serviço que falham**

Configurar `admin_initial_password=None` e `admin_setup_token="codigo-ativacao-seguro-2026"`. Testar:

```python
assert service.initial_setup_required() is True
credential = service.create_initial_credential(
    "novo-admin",
    "Senha-segura-2026!",
    "Senha-segura-2026!",
    "codigo-ativacao-seguro-2026",
)
assert service.initial_setup_required() is False
assert service.authenticate("novo-admin", "Senha-segura-2026!") == credential
```

Adicionar casos para código incorreto, confirmação divergente, senha curta e segunda criação. Confirmar que todos lançam apenas as exceções públicas previstas, sem incluir dados secretos nas mensagens.

- [ ] **Step 6: Executar os testes de serviço e confirmar a falha**

Run: `pytest tests/test_admin_session_auth.py -q`

Expected: FAIL porque a configuração, os métodos e as exceções ainda não existem.

- [ ] **Step 7: Implementar o serviço mínimo**

Adicionar `admin_setup_token: SecretStr | None` em `Settings`. Em `AdminSessionService`, usar `hmac.compare_digest` para o código, `validate_new_password` para a senha e `create_password_hash` antes de chamar a criação atômica. `ensure_initial_credential` deve usar `get_any_credential` e o mesmo método atômico para preservar compatibilidade sem criar um segundo administrador.

- [ ] **Step 8: Executar testes de identidade do serviço e repositório**

Run: `pytest tests/test_identity_repository.py tests/test_admin_session_auth.py -q`

Expected: PASS.

- [ ] **Step 9: Commit isolado**

```bash
git add apps/api/app/modules/identity/ports.py apps/api/app/modules/identity/repository.py apps/api/app/security/sessions.py apps/api/app/settings.py apps/api/tests/test_identity_repository.py apps/api/tests/test_admin_session_auth.py
git commit -m "feat: proteger criacao inicial do administrador"
```

### Task 3: Expor status e cadastro inicial pela API

**Files:**
- Modify: `apps/api/app/modules/identity/schemas.py`
- Modify: `apps/api/app/modules/identity/router.py`
- Modify: `apps/api/tests/test_identity_routes.py`

**Interfaces:**
- Produces: `GET /api/v1/auth/setup-status` com `{ "required": boolean, "configured": boolean }`.
- Produces: `POST /api/v1/auth/setup` com `{ username, password, confirmation, setup_token }` e resposta `LoginResponse` mais cookie HttpOnly.

- [ ] **Step 1: Criar fixture de API sem credencial inicial e escrever testes que falham**

Usar banco temporário, `admin_initial_password=None` e `admin_setup_token="codigo-ativacao-seguro-2026"`. Testar status inicial, código inválido, criação bem-sucedida, cookie HttpOnly, sessão legível, segunda criação `409`, token ausente `412`, rate limit `429` e auditoria sem os valores secretos.

```python
response = client.post(
    "/api/v1/auth/setup",
    json={
        "username": "novo-admin",
        "password": "Senha-segura-2026!",
        "confirmation": "Senha-segura-2026!",
        "setup_token": "codigo-ativacao-seguro-2026",
    },
)
assert response.status_code == 200
assert response.json() == {"authenticated": True, "username": "novo-admin"}
assert "httponly" in response.headers["set-cookie"].lower()
```

- [ ] **Step 2: Executar testes de rota e confirmar a falha**

Run: `pytest tests/test_identity_routes.py -q`

Expected: FAIL com `404` nos novos endpoints.

- [ ] **Step 3: Implementar schemas e endpoints mínimos**

Criar `InitialSetupRequest`, `InitialSetupStatusResponse` e rotas antes das rotas protegidas. Reutilizar `_set_session_cookie`, `_rate_key`, `_audit` e o limiter existente com chave prefixada por `setup:`. Mapear exceções para `401`, `409` e `412`; em sucesso, criar a sessão e auditar `admin_initial_setup_succeeded` sem metadata sensível.

- [ ] **Step 4: Executar testes de rota e suíte da API**

Run: `pytest tests/test_identity_routes.py -q`

Run: `pytest -q`

Expected: todos PASS.

- [ ] **Step 5: Commit isolado**

```bash
git add apps/api/app/modules/identity/schemas.py apps/api/app/modules/identity/router.py apps/api/tests/test_identity_routes.py
git commit -m "feat: expor ativacao inicial administrativa"
```

### Task 4: Encaminhar as novas rotas pelo Worker e pelo cliente web

**Files:**
- Modify: `apps/web/src/app/api/proxy-utils.ts`
- Modify: `apps/web/src/app/api/proxy-utils.test.ts`
- Modify: `apps/web/src/lib/auth-api.ts`
- Create: `apps/web/src/lib/auth-api.test.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/api-client.test.ts`

**Interfaces:**
- Produces: `getInitialSetupStatus(): Promise<{ required: boolean; configured: boolean }>`.
- Produces: `setupInitialAdmin(username, password, confirmation, setupToken): Promise<LoginResponse>`.

- [ ] **Step 1: Escrever testes de proxy que falham**

```ts
expect(resolveUpstreamPath(["v1", "auth", "setup-status"])).toBe("/api/v1/auth/setup-status");
expect(resolveUpstreamPath(["v1", "auth", "setup"])).toBe("/api/v1/auth/setup");
```

- [ ] **Step 2: Executar o teste do proxy e confirmar a falha**

Run: `pnpm exec vitest run src/app/api/proxy-utils.test.ts --configLoader runner`

Expected: FAIL porque as rotas não estão na allowlist.

- [ ] **Step 3: Adicionar as duas rotas à allowlist**

Modificar somente `allowedAuthPaths`, preservando o bloqueio de rotas arbitrárias.

- [ ] **Step 4: Escrever testes do cliente de autenticação que falham**

Espionar `fetch` e afirmar caminhos same-origin, métodos e corpo sem URL Railway:

```ts
expect(fetchMock).toHaveBeenCalledWith(
  "/api/v1/auth/setup",
  expect.objectContaining({ method: "POST", credentials: "include" }),
);
```

Adicionar testes de mensagens específicas: `409` no setup informa que o acesso já existe; `412` informa que o código de ativação ainda não foi configurado; `502` continua informando indisponibilidade.

- [ ] **Step 5: Executar testes do cliente e confirmar a falha**

Run: `pnpm exec vitest run src/lib/auth-api.test.ts src/lib/api-client.test.ts --configLoader runner`

Expected: FAIL porque funções e mensagens específicas ainda não existem.

- [ ] **Step 6: Implementar cliente e mensagens mínimas**

Adicionar tipos `InitialSetupStatus` e funções em `auth-api.ts`. Em `safeMessage`, condicionar mensagens de `409` e `412` ao caminho `/api/v1/auth/setup`, sem mostrar o corpo interno retornado pela API.

- [ ] **Step 7: Executar testes web desta tarefa**

Run: `pnpm exec vitest run src/app/api/proxy-utils.test.ts src/lib/auth-api.test.ts src/lib/api-client.test.ts --configLoader runner`

Expected: PASS.

- [ ] **Step 8: Commit isolado**

```bash
git add apps/web/src/app/api/proxy-utils.ts apps/web/src/app/api/proxy-utils.test.ts apps/web/src/lib/auth-api.ts apps/web/src/lib/auth-api.test.ts apps/web/src/lib/api-client.ts apps/web/src/lib/api-client.test.ts
git commit -m "feat: conectar ativacao inicial ao frontend"
```

### Task 5: Exibir cadastro inicial na página de acesso

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/login/page.test.tsx`

**Interfaces:**
- Consumes: `getInitialSetupStatus` e `setupInitialAdmin` da Task 4.
- Produces: modo de ativação inicial acessível e modo de login existente.

- [ ] **Step 1: Escrever testes da interface que falham**

Mockar somente a fronteira de rede (`auth-api`) e o roteador Next. Cobrir:

```tsx
expect(await screen.findByRole("heading", { name: "Criar acesso administrativo" })).toBeInTheDocument();
expect(screen.getByLabelText("Código de ativação")).toHaveAttribute("type", "password");
```

Testar que status `{required:false}` mantém “Entrar no painel”; que cadastro envia os quatro campos; que sucesso chama `router.replace("/")`; que falha limpa senha, confirmação e código; e que status indisponível mantém o login utilizável com alerta de conexão.

- [ ] **Step 2: Executar o teste da página e confirmar a falha**

Run: `pnpm exec vitest run src/app/login/page.test.tsx --configLoader runner`

Expected: FAIL porque a página ainda não consulta nem exibe o setup.

- [ ] **Step 3: Implementar o modo de ativação mínimo**

Adicionar estados `setupStatus`, `confirmation` e `setupToken`. Consultar status no `useEffect`; usar o mesmo painel visual e inputs existentes. Não usar `localStorage`, `sessionStorage`, query string ou cookies JavaScript para senha/código. Usar `autoComplete="new-password"` nas senhas e `autoComplete="off"` no código de ativação.

- [ ] **Step 4: Executar teste da página e suíte web**

Run: `pnpm exec vitest run src/app/login/page.test.tsx --configLoader runner`

Run: `pnpm exec vitest run --configLoader runner`

Expected: todos PASS.

- [ ] **Step 5: Commit isolado**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/app/login/page.test.tsx
git commit -m "feat: criar primeiro acesso pela pagina"
```

### Task 6: Documentar configuração e validar ponta a ponta

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/deployment/CLOUDFLARE.md`

**Interfaces:**
- Consumes: `ADMIN_SETUP_TOKEN`, `API_INTERNAL_URL`, endpoints e UI das tarefas anteriores.
- Produces: instruções de implantação sem valores reais de credenciais.

- [ ] **Step 1: Atualizar exemplos e instruções operacionais**

Documentar:

```text
ADMIN_SETUP_TOKEN=<código aleatório exclusivo, armazenado somente no Railway>
API_INTERNAL_URL=https://vira-api-production.up.railway.app
```

Explicar que `ADMIN_INITIAL_PASSWORD` e o cadastro pela página são alternativas para primeira criação; nenhum deles redefine uma credencial existente. Registrar a necessidade de volume persistente no Railway e de remover/rotacionar o código após o cadastro.

- [ ] **Step 2: Executar verificações completas da API**

Run: `pytest -q`

Expected: todos PASS.

- [ ] **Step 3: Executar verificações completas do frontend**

Run: `pnpm exec vitest run --configLoader runner`

Run: `pnpm typecheck`

Expected: todos PASS.

- [ ] **Step 4: Executar build sem servidor de desenvolvimento concorrente**

Run: `pnpm build`

Run: `pnpm exec opennextjs-cloudflare build`

Run: `pnpm run check:cloudflare`

Run: `pnpm exec wrangler deploy --config wrangler.jsonc --dry-run --keep-vars`

Expected: builds concluídos, nenhum segredo nos artefatos e dry-run válido.

- [ ] **Step 5: Revisar diff e commits**

Run: `git diff --check`

Run: `git status --short`

Expected: somente as alterações visuais preexistentes permanecem fora dos commits desta implementação.

- [ ] **Step 6: Commit da documentação**

```bash
git add .env.example README.md docs/deployment/CLOUDFLARE.md
git commit -m "docs: orientar ativacao inicial segura"
```

### Task 7: Publicar com controle de risco e verificar produção

**Files:**
- No source files; deployment and verification only.

**Interfaces:**
- Consumes: branch com as Tasks 1–6 verificadas.
- Produces: API Railway e Worker Cloudflare funcionais, sem revelar segredos.

- [ ] **Step 1: Enviar a branch ao GitHub sem sobrescrever histórico remoto**

Run: `git pull --rebase --autostash origin feat/admin-ui-cloudflare`

Run: `git push origin HEAD:feat/admin-ui-cloudflare`

Expected: push aceito sem force.

- [ ] **Step 2: Configurar backend antes do frontend**

No serviço `vira-api` do Railway, adicionar `ADMIN_SETUP_TOKEN` como segredo e confirmar `DATABASE_URL` apontando para volume persistente. Não alterar `ADMIN_INITIAL_PASSWORD` para redefinir senha existente.

- [ ] **Step 3: Publicar API Railway e verificar saúde**

Validar `GET https://vira-api-production.up.railway.app/health` com status `200` e sem detalhes sensíveis.

- [ ] **Step 4: Reaplicar `API_INTERNAL_URL` e publicar Worker**

Na versão de produção do `vira-ai-web`, confirmar a associação `API_INTERNAL_URL=https://vira-api-production.up.railway.app`. Publicar pelo fluxo atualizado e confirmar que a versão ativa mantém a associação.

- [ ] **Step 5: Validar ativação e login**

No domínio Cloudflare, confirmar `/api/health`, criar o primeiro administrador somente se não existir credencial, verificar redirecionamento, cookie HttpOnly, acesso ao Business e persistência após novo deploy da API.

- [ ] **Step 6: Encerrar bootstrap**

Remover ou rotacionar `ADMIN_SETUP_TOKEN` no Railway. Confirmar que `setup-status` continua indicando cadastro concluído e que `POST /setup` retorna conflito sem modificar a conta.
