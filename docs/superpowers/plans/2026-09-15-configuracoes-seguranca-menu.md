# Configurações, segurança e menu administrativo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Remover a configuração de densidade que não traz valor operacional, enxugar o menu suspenso para três áreas compreensíveis e implementar um fluxo real de acesso administrativo local. O resultado deve proteger as telas administrativas, persistir a credencial de forma segura, permitir troca de senha com revogação de sessões e manter a integração do Business funcionando pelo mesmo cliente de API.

## Approved design

- O menu administrativo terá apenas `Aparência`, `Conexões` e `Segurança`.
- `Aparência` reunirá tema e idioma/região; não haverá estado, seletor, atributo HTML ou regra CSS de densidade.
- `Conexões` reunirá Foursquare e saúde do sistema.
- `Segurança` reunirá sessão administrativa, alteração de senha, política de acesso e resumo de auditoria.
- O backend continuará aceitando o bearer token técnico existente para integrações internas e testes locais, mas as páginas administrativas usarão uma sessão web separada.
- A sessão web usará cookie opaco `HttpOnly`, `SameSite=Lax`, `Secure` fora de desenvolvimento e validade de oito horas. O banco guardará somente o hash SHA-256 do token.
- A senha administrativa usará PBKDF2-HMAC-SHA256 com salt aleatório por senha e 600.000 iterações. A senha inicial virá de configuração de ambiente e nunca será escrita em código, log ou resposta HTTP.
- A aplicação web chamará somente rotas `/api/*` do próprio Next.js; o proxy server-side encaminhará as rotas permitidas para a API local configurada por `API_INTERNAL_URL`.

## Architecture

O módulo `apps/api/app/modules/identity` será o limite de domínio para credenciais administrativas e sessões. Ele dependerá de portas (`CredentialRepository`, `SessionRepository`, `PasswordHasher`, `SessionTokenGenerator`, `Clock`) e de uma implementação SQLite. A composição ocorrerá em `apps/api/app/main.py`, que já inicializa o banco e os serviços da aplicação.

`apps/api/app/security/auth.py` manterá o principal técnico existente e ganhará dependências explícitas para resolver uma sessão administrativa pelo cookie. As rotas Business e Foursquare não receberão uma organização fixa quando acessadas pela sessão: o principal autenticado fornecerá a organização/tenant que será usada nas consultas e auditorias.

O frontend terá um cliente same-origin com `credentials: "include"`, uma rota catch-all de proxy com allowlist e um `AuthGate` que redireciona para `/login` quando uma página administrativa não tem sessão. O `PreferencesMenu` continuará sendo um componente de apresentação/controle, mas suas seções passarão a consumir o estado de sessão e as ações de autenticação da API.

## Tech stack and conventions

- Backend: Python 3.11+, FastAPI, Pydantic Settings, SQLite via `sqlite3` e `pytest`.
- Hashing: somente biblioteca padrão (`hashlib`, `hmac`, `secrets`); não adicionar dependência criptográfica desnecessária.
- Frontend: Next.js 15 App Router, React 19, TypeScript e Tailwind CSS.
- Testes web: Vitest com Testing Library; adicionar somente as dependências mínimas necessárias ao workspace `apps/web`.
- Rotas de identidade: `/api/v1/auth/login`, `/api/v1/auth/session`, `/api/v1/auth/logout` e `/api/v1/auth/password`.
- Nomes de domínio, textos de interface e mensagens exibidas ao usuário permanecerão em português do Brasil.

## Constraints and invariants

- Não colocar secrets ou API keys no código, fixtures, snapshots, mensagens de erro, HTML, localStorage ou logs.
- Não migrar nem duplicar a chave Foursquare para o frontend; a tela continuará exibindo apenas estado e campo de substituição transitório.
- Não introduzir coleta de dados pessoais; o identificador do administrador será o mínimo necessário para autenticação e auditoria.
- Aplicar purpose limitation, data minimization, least privilege, secure by default e tenant scoping nas novas rotas.
- Alteração de senha deverá invalidar todas as sessões existentes, inclusive a sessão que executou a alteração.
- Erros de login não revelarão se o usuário existe, se a senha está correta ou se a credencial foi inicializada.
- Login e alteração de senha terão limitação por IP/identificador em memória no processo local; a documentação deixará explícita a necessidade de um limitador compartilhado antes de escalar horizontalmente.
- O modo de bypass de autenticação existente permanecerá limitado ao desenvolvimento local e não poderá ser habilitado quando `ENVIRONMENT` for produção.
- O adapter de persistência continuará substituível por PostgreSQL sem mudar os contratos do domínio.
- Alterações de segurança já presentes no working tree pertencem ao usuário: não descartá-las e não misturá-las em commits desta implementação.

## Execution order

As tarefas abaixo são sequenciais onde existe dependência de contrato e independentes apenas dentro de cada tarefa. Cada tarefa começa pelos testes que demonstram o comportamento desejado, depois implementa o mínimo necessário e termina com a verificação indicada.

## Task 1 — Criar primitivas de senha sem dependências externas

**Arquivos:**

- `apps/api/app/security/passwords.py` (novo)
- `apps/api/tests/test_passwords.py` (novo)

- [ ] Escrever primeiro os testes para `validate_new_password`, `create_password_hash` e `verify_password`.
- [ ] Definir `PASSWORD_HASH_ALGORITHM = "sha256"`, `PASSWORD_ITERATIONS = 600_000` e uma senha administrativa mínima de 12 caracteres.
- [ ] Definir `PasswordHash` como dataclass imutável com `algorithm`, `iterations`, `salt_b64` e `digest_b64`. A representação persistível deverá conter somente metadados, salt e digest codificados em Base64.
- [ ] Implementar `validate_new_password(password: str) -> None`, rejeitando senha vazia ou com menos de 12 caracteres por `ValueError` sem incluir a senha na mensagem.
- [ ] Implementar `create_password_hash(password: str, *, iterations: int = PASSWORD_ITERATIONS) -> PasswordHash` usando `secrets.token_bytes(16)`, `hashlib.pbkdf2_hmac("sha256", ...)` e o tamanho de digest apropriado ao SHA-256.
- [ ] Implementar `verify_password(password: str, password_hash: PasswordHash) -> bool` usando `hmac.compare_digest`; entradas inválidas ou algoritmo/iterações incompatíveis deverão resultar em `False`, sem exceção que revele detalhes internos.
- [ ] Testar senha correta, senha incorreta, salts diferentes, rejeição de senha curta e ausência do texto da senha nos campos persistíveis.
- [ ] Executar `pytest -q apps/api/tests/test_passwords.py` e confirmar que os testes ficam verdes.
- [ ] Fazer um commit isolado: `feat(security): adiciona hash seguro para credencial administrativa`.

## Task 2 — Adicionar persistência SQLite para credenciais e sessões

**Arquivos:**

- `apps/api/app/modules/identity/__init__.py` (novo)
- `apps/api/app/modules/identity/domain.py` (novo)
- `apps/api/app/modules/identity/ports.py` (novo)
- `apps/api/app/modules/identity/repository.py` (novo)
- `apps/api/tests/test_identity_repository.py` (novo)

- [ ] Escrever primeiro os testes de schema, credencial, sessão ativa, expiração e revogação.
- [ ] Definir em `domain.py` as dataclasses imutáveis `AdminCredential` e `AdminSession`:
  - `AdminCredential(username: str, organization_id: str, password_hash: PasswordHash, password_changed_at: datetime, updated_at: datetime)`.
  - `AdminSession(session_id: str, token_hash: str, username: str, organization_id: str, created_at: datetime, expires_at: datetime, revoked_at: datetime | None = None)`.
- [ ] Definir em `ports.py` os protocolos `CredentialRepository` e `SessionRepository` com os contratos `get_credential`, `save_credential`, `create_session`, `get_active_session`, `revoke_session` e `revoke_all_sessions`.
- [ ] Implementar `SQLiteIdentityRepository` em `repository.py`, recebendo a porta `Database` existente em vez de abrir conexões diretamente por caminho de arquivo.
- [ ] Criar as tabelas `identity_admin_credentials` e `identity_admin_sessions` dentro de `initialize_schema`. Armazenar o hash da senha em colunas separadas (`password_algorithm`, `password_iterations`, `password_salt_b64`, `password_digest_b64`) e armazenar somente `token_hash` na sessão.
- [ ] Adicionar constraints e índices para username, `token_hash`, `expires_at` e `revoked_at`; timestamps serão ISO-8601 em UTC, convertidos para `datetime` nos limites do módulo.
- [ ] Fazer `get_active_session` filtrar no banco por token hash, `revoked_at IS NULL` e `expires_at > now`; nunca retornar uma sessão revogada ou vencida.
- [ ] Fazer `revoke_all_sessions` revogar todas as sessões da organização do administrador e retornar a quantidade afetada.
- [ ] Usar nos testes valores `datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)` e outros horários fixos, sem depender do relógio real.
- [ ] Testar que uma credencial pode ser salva e recuperada, que o token bruto não aparece em nenhuma coluna e que sessões vencidas/revogadas não são encontradas.
- [ ] Executar `pytest -q apps/api/tests/test_identity_repository.py` e confirmar que os testes ficam verdes.
- [ ] Fazer um commit isolado: `feat(identity): persiste credenciais e sessoes administrativas`.

## Task 3 — Integrar configurações e resolução de sessão ao backend

**Arquivos:**

- `apps/api/app/settings.py`
- `apps/api/app/security/auth.py`
- `apps/api/app/security/sessions.py` (novo)
- `apps/api/app/main.py`
- `apps/api/tests/test_admin_session_auth.py` (novo)
- `.env.example`

- [ ] Escrever primeiro os testes para criação inicial da credencial, criação de sessão, sessão inválida, sessão expirada e bloqueio do bypass fora do desenvolvimento.
- [ ] Adicionar ao settings os campos `admin_username`, `admin_initial_password: str | None`, `admin_session_cookie_name`, `admin_session_ttl_seconds` (padrão 28.800), `admin_login_rate_limit` (padrão 5), `admin_login_rate_window_seconds` (padrão 300) e `web_origin`/origens CORS compatíveis com o frontend local.
- [ ] Validar nas configurações que `allow_development_auth_bypass` só pode ser verdadeiro quando `environment` for `development` ou `test`; em produção, falhar no startup com mensagem sem secrets.
- [ ] Implementar em `sessions.py` um serviço explícito com `ensure_initial_credential`, `authenticate`, `create_session`, `resolve_session` e `change_password`. O serviço receberá repositórios, settings, um relógio injetável e gerador de token injetável nos testes.
- [ ] Criar credencial inicial somente quando não existir e `ADMIN_INITIAL_PASSWORD` estiver configurada. Depois da primeira criação, alterações posteriores não deverão sobrescrever a senha persistida quando a variável de ambiente mudar.
- [ ] Gerar o token bruto somente em memória com `secrets.token_urlsafe(32)`, persistir `sha256(token_bruto)` e devolver o bruto apenas ao chamador que criará o cookie.
- [ ] Acrescentar em `auth.py` uma dependência `get_current_session_principal` que leia o cookie configurado, resolva a sessão e produza um `Principal` com organização e papel `admin`. Essa dependência não usará o bypass de desenvolvimento nem o bearer token técnico.
- [ ] Manter `get_admin_principal` para compatibilidade das integrações internas, mas permitir que as rotas protegidas recebam organização e ator do principal autenticado em vez de depender de uma organização fixa.
- [ ] Compor `SQLiteIdentityRepository` e o serviço no lifespan de `main.py`, chamar `initialize_schema` e `ensure_initial_credential`, e expor os objetos pelo `app.state` sem colocar senha ou token no estado serializável.
- [ ] Configurar CORS com `allow_credentials=True` somente para origens explicitamente configuradas; manter `/health` público.
- [ ] Atualizar `.env.example` com `ADMIN_USERNAME`, `ADMIN_INITIAL_PASSWORD`, `ADMIN_SESSION_COOKIE_NAME`, `ADMIN_SESSION_TTL_SECONDS`, `WEB_ORIGIN` e instruções para substituir o valor inicial imediatamente; não preencher uma senha real.
- [ ] Executar `pytest -q apps/api/tests/test_admin_session_auth.py` e a suíte backend existente; confirmar que o bypass local continua funcionando apenas nos testes/desenvolvimento autorizados.
- [ ] Fazer um commit isolado: `feat(api): integra sessoes administrativas ao ciclo da aplicacao`.

## Task 4 — Expor login, sessão, logout e troca de senha

**Arquivos:**

- `apps/api/app/modules/identity/schemas.py` (novo)
- `apps/api/app/modules/identity/router.py` (novo)
- `apps/api/app/api/v1/router.py`
- `apps/api/tests/test_identity_routes.py` (novo)

- [ ] Escrever primeiro os testes HTTP para os quatro endpoints, usando uma aplicação de teste com banco SQLite temporário e relógio controlado.
- [ ] Criar os modelos Pydantic `LoginRequest(username, password)`, `PasswordChangeRequest(current_password, new_password, confirmation)` e respostas sem tokens, hashes ou segredos.
- [ ] Implementar `POST /api/v1/auth/login`: validar credencial, aplicar limitador, criar sessão e configurar o cookie opaco com `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28.800` e `Secure` conforme o ambiente. A resposta conterá somente estado autenticado e identificador administrativo não sensível.
- [ ] Implementar `GET /api/v1/auth/session`: exigir o cookie de sessão e retornar `authenticated`, `username` e `organization_id`; sem sessão, responder 401 com mensagem genérica em português.
- [ ] Implementar `POST /api/v1/auth/logout`: revogar a sessão corrente, limpar o cookie com os mesmos atributos e retornar 204. A operação deverá ser idempotente para cookie ausente ou já revogado.
- [ ] Implementar `PUT /api/v1/auth/password`: exigir sessão administrativa, validar senha atual e confirmação da nova senha, salvar o novo hash, revogar todas as sessões e limpar o cookie da sessão usada. Não aceitar a senha inicial por ambiente como senha de troca depois que a credencial existir.
- [ ] Usar respostas de erro genéricas para credencial inexistente, senha incorreta e sessão inválida; não devolver mensagens diferentes que permitam enumeração do usuário.
- [ ] Gerar ou propagar `X-Request-ID` no limite HTTP e passá-lo ao registro de auditoria. Registrar `admin_login_succeeded`, `admin_login_failed`, `admin_logout` e `admin_password_changed` com ator, organização e request id, sem senha, token ou chave Foursquare.
- [ ] Aplicar o limitador antes da verificação de senha e responder 429 com `Retry-After` quando excedido. Os contadores serão mantidos em memória e a documentação explicará o limite para uso local/single-process.
- [ ] Incluir o router de identidade em `apps/api/app/api/v1/router.py` sob o prefixo `/auth` e tags `identity`.
- [ ] Testar login correto com cookie, login incorreto sem vazamento, 429, sessão válida, logout, troca de senha, revogação de todas as sessões e ausência de segredo em respostas/auditoria.
- [ ] Executar `pytest -q apps/api/tests/test_identity_routes.py` e confirmar que todos os testes ficam verdes.
- [ ] Fazer um commit isolado: `feat(api): adiciona endpoints de acesso administrativo`.

## Task 5 — Criar cliente same-origin, proxy seguro e guarda de acesso no web

**Arquivos:**

- `apps/web/src/lib/api-client.ts` (novo)
- `apps/web/src/lib/auth-api.ts` (novo)
- `apps/web/src/app/api/[...path]/route.ts` (novo)
- `apps/web/src/app/login/page.tsx` (novo)
- `apps/web/src/components/auth-gate.tsx` (novo)
- `apps/web/src/lib/api-client.test.ts` (novo)
- `apps/web/src/components/auth-gate.test.tsx` (novo)
- `apps/web/vitest.config.ts` (novo)
- `apps/web/package.json`
- `apps/web/next.config.ts` ou `apps/web/next.config.mjs` (o arquivo existente)
- `apps/web/src/lib/business-api.ts`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/app/layout.tsx`

- [ ] Escrever primeiro os testes do cliente para `credentials: "include"`, tratamento de 401/429 e mensagens de erro sem expor payload bruto; escrever o teste do `AuthGate` para estado carregando, sessão válida e redirecionamento para `/login`.
- [ ] Adicionar Vitest, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` e os tipos estritamente necessários; criar scripts `test` e `test:watch` sem alterar os scripts de desenvolvimento existentes.
- [ ] Implementar `api-client.ts` com funções `apiRequest<T>(path, init?)` e `apiJson<T>(path, init?)` que chamem caminhos same-origin `/api/...`, enviem `Content-Type` quando houver corpo, incluam `credentials: "include"`, preservem `X-Request-ID` e traduzam falhas conhecidas para mensagens em pt-BR.
- [ ] Implementar `auth-api.ts` com `getSession`, `login`, `logout` e `changePassword`, sem armazenar sessão, senha ou token em localStorage, sessionStorage, cookies JavaScript ou variáveis `NEXT_PUBLIC_*`.
- [ ] Implementar o catch-all do Next.js para encaminhar somente `api/health`, `api/v1/auth/login`, `api/v1/auth/session`, `api/v1/auth/logout`, `api/v1/auth/password` e `api/v1/business/*`. Rejeitar qualquer outra rota com 404, remover headers de hop-by-hop e encaminhar apenas headers HTTP necessários.
- [ ] Usar exclusivamente `API_INTERNAL_URL` no servidor para o destino upstream. O proxy deverá encaminhar o cookie de sessão ao backend, devolver `Set-Cookie` ao navegador e não expor a URL interna no bundle.
- [ ] Atualizar `business-api.ts` para usar `apiJson` sem mudar os contratos de domínio ou colocar chave Foursquare no cliente.
- [ ] Criar `/login` com formulário acessível de usuário e senha, estados de envio/erro, foco no primeiro campo e mensagem clara para senha inicial não configurada. Após login, redirecionar para a rota pretendida ou `/`.
- [ ] Criar `AuthGate` para buscar a sessão uma vez, renderizar estado de carregamento acessível e redirecionar páginas administrativas sem sessão. Manter `/login` e o healthcheck fora da guarda.
- [ ] Integrar `AuthGate` e o contexto mínimo de sessão ao `AppShell`, preservando o menu móvel, o tema e a navegação existentes.
- [ ] Remover o uso direto de `NEXT_PUBLIC_API_BASE_URL` no código executado pelo navegador; deixar a configuração interna do upstream somente no servidor.
- [ ] Executar `pnpm --filter @vira-ai/web test`, `pnpm --filter @vira-ai/web run typecheck` e `pnpm --filter @vira-ai/web run build`; confirmar que os testes ficam verdes e que o build não inclui `API_INTERNAL_URL`.
- [ ] Fazer um commit isolado: `feat(web): adiciona acesso administrativo same-origin`.

## Task 6 — Simplificar o menu e remover a densidade de toda a interface

**Arquivos:**

- `apps/web/src/components/preferences-menu.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/business-dashboard.tsx`
- `apps/web/src/components/metric-card.tsx`
- `apps/web/src/components/module-card.tsx`
- `apps/web/src/components/module-page.tsx`
- `apps/web/src/components/system-status.tsx`
- `apps/web/src/components/preferences-menu.test.tsx` (novo)
- `apps/web/src/app/layout.tsx`

- [ ] Escrever primeiro os testes do menu para confirmar que existem somente as seções `Aparência`, `Conexões` e `Segurança`, que `Densidade` não aparece e que o botão de fechar funciona.
- [ ] Remover `SectionId` antigos e grupos de `Workspace`, `Organizações`, `Proteção de dados`, `Recursos` e `Acesso e permissões` como submenus independentes. Incorporar somente os textos necessários de segurança, privacidade, auditoria e limites dentro da seção `Segurança`.
- [ ] Manter em `Aparência` apenas tema e idioma/região, usando as opções já existentes e textos curtos em pt-BR.
- [ ] Manter em `Conexões` o formulário transitório da chave Foursquare e a saúde dos serviços, com explicação de que a chave nunca retorna ao navegador; não alterar o contrato de busca de locais.
- [ ] Em `Segurança`, mostrar sessão atual, nome do administrador, formulário `Senha atual`, `Nova senha` e `Confirmar nova senha`, ação de sair, requisitos de senha e resumo curto de auditoria/política. Usar `changePassword` da Task 5 e limpar o estado dos campos após sucesso ou erro.
- [ ] Remover `applyDensity`, estado `density`, `localStorage` `vira-density`, atributo `data-density`, classes `density-main`, `density-stack`, `density-surface` e `density-card`, suas regras CSS e qualquer referência restante no layout/dashboard/cards.
- [ ] Substituir a altura fixa do modal por uma área claramente rolável com `max-h-[min(720px,calc(100dvh-2rem))]`, `min-h-0`, `overflow-y-auto`, `overscroll-contain` e `scrollbar-gutter: stable`; no celular, usar painel quase integral com cabeçalho fixo e conteúdo rolável.
- [ ] Revisar classes de tema e contraste para que texto, borda, hover, campos, selects e cartões sigam os tokens claro/escuro em todas as páginas, sem `text-white` ou `text-slate-*` conflitantes fora dos tokens globais.
- [ ] Preservar o hover invertido da navegação: item não ativo ganha fundo de destaque e texto branco no modo claro; item ativo e ícone permanecem legíveis nos dois temas.
- [ ] Atualizar `layout.tsx` para remover a leitura de `vira-density`, manter somente a inicialização de `vira-theme` e garantir metadata/icon sem indicadores de desenvolvimento.
- [ ] Executar os testes do menu, `pnpm --filter @vira-ai/web run typecheck` e `pnpm --filter @vira-ai/web run build`; confirmar por busca que não restam referências a `density` no código de interface.
- [ ] Fazer um commit isolado: `refactor(web): simplifica configuracoes e remove densidade`.

## Task 7 — Documentar, verificar integração e preparar entrega

**Arquivos:**

- `README.md`
- `SECURITY.md`
- `.env.example`
- `docs/architecture/ARCHITECTURE.md`
- `docs/security/SECURITY_ARCHITECTURE.md`
- `docs/privacy/LGPD.md`
- `docs/legal/DATA_SOURCES.md`
- `docs/superpowers/specs/2026-09-15-configuracoes-seguranca-menu-design.md`
- `docs/architecture/ADMIN_SESSIONS.md` (novo)

- [ ] Documentar no README o fluxo local: configurar `ADMIN_INITIAL_PASSWORD`, iniciar API e web, entrar em `/login`, trocar a senha inicial e acessar Business.
- [ ] Documentar em `ADMIN_SESSIONS.md` o modelo de cookie, hash de token, PBKDF2, expiração, revogação, rate limit, tenant scoping, limitações do processo local e requisitos para produção.
- [ ] Atualizar `SECURITY.md` e `SECURITY_ARCHITECTURE.md` com threat model resumido, ausência de secrets no cliente, proteção contra enumeração, auditoria sem dados desnecessários e necessidade de gerenciador de secrets/limitador distribuído antes da publicação.
- [ ] Atualizar os documentos de LGPD e fontes de dados para registrar finalidade limitada da conta administrativa, retenção mínima de sessões/auditoria, segregação entre dados empresariais e dados pessoais e ausência de scraping/coleta pessoal nesta etapa.
- [ ] Conferir que `.env.example` contém somente exemplos não operacionais e que nenhum `.env`, token, chave Foursquare, senha ou cookie foi adicionado ao Git.
- [ ] Rodar `python -m pytest -q` em `apps/api` e `pnpm --filter @vira-ai/web test`, `pnpm --filter @vira-ai/web run typecheck`, `pnpm --filter @vira-ai/web run build` na raiz do monorepo.
- [ ] Fazer `git diff --check` e buscas de segurança: `rg -n "ADMIN_INITIAL_PASSWORD|API_INTERNAL_URL|NEXT_PUBLIC_.*(KEY|TOKEN|SECRET)|vira-density|data-density|density-"` nos arquivos versionados, confirmando que só aparecem documentação/configuração prevista e que não há segredo real.
- [ ] Iniciar a API com configuração local de teste, chamar `GET http://127.0.0.1:8000/health` e confirmar exatamente `{ "status": "ok", "service": "vira-api" }`; chamar login/sessão em seguida e confirmar cookie, troca de senha e revogação.
- [ ] Iniciar o web, abrir `/login` e `/business`, confirmar redirecionamento sem sessão, login com a senha configurada, menu reduzido, rolagem no celular e alternância de tema sem textos apagados.
- [ ] Registrar no relatório final os comandos executados, os resultados, os arquivos alterados e qualquer limitação que permaneça antes de exposição remota.
- [ ] Fazer um commit final somente dos arquivos desta implementação: `docs: documenta acesso administrativo e verificacao`.

## Definition of done

- [ ] Backend e frontend passam em suas suítes de testes, typecheck e build.
- [ ] `GET /health` continua respondendo o contrato exigido.
- [ ] Sem sessão, páginas administrativas redirecionam para login; com sessão válida, Business e configurações funcionam.
- [ ] Troca de senha revoga sessões anteriores e não expõe senha, token ou chave.
- [ ] Menu contém somente três áreas, não possui densidade e tem rolagem interna utilizável em telas pequenas.
- [ ] Nenhuma referência de densidade ou endpoint upstream direto permanece no cliente.
- [ ] Documentação descreve LGPD, privacy by design/default, minimização, finalidade, least privilege, auditoria e limites para produção.
- [ ] O working tree preserva alterações preexistentes não relacionadas e os commits da implementação não incluem esses arquivos por acidente.
