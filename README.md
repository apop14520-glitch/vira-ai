# VIRA.AI

Fundação técnica de um ecossistema brasileiro de software SaaS, organizado como um monorepo. O projeto já contém um primeiro fluxo operacional do VIRA Business para organizar oportunidades empresariais locais.

## Escopo inicial

- Frontend em Next.js, TypeScript e Tailwind CSS.
- Backend em Python e FastAPI.
- SQLite como banco exclusivo para desenvolvimento local.
- Porta de banco preparada para uma futura implementação PostgreSQL.
- Interfaces de providers de IA preparadas para OpenAI, Anthropic, xAI e Ollama, sem clientes ou chamadas de API.
- Documentação inicial de arquitetura, privacidade, segurança e fontes de dados.
- Healthcheck em `GET /health`.
- Acesso administrativo local por sessão HttpOnly, com login em `/login` e
  troca de senha no menu de segurança.
- Pipeline local de empresas no VIRA Business, com auditoria e pesquisa
  opcional de estabelecimentos pela Foursquare Places, limitada a 20 resultados.

## Fora do escopo desta fundação

Não há scraping, coleta de dados pessoais, integrações de IA, importação de
contatos ou armazenamento persistente de chaves da Foursquare. A API já possui
uma fronteira inicial de autenticação: o desenvolvimento usa um principal
local limitado ao loopback; ambientes não locais exigem tokens de runtime.
O primeiro fluxo de Business usa dados empresariais mínimos e uma busca externa
explicitamente acionada pelo operador.

## Estrutura

```text
vira-ai/
├── apps/
│   ├── web/                 # Next.js + TypeScript + Tailwind
│   └── api/                 # FastAPI
├── platform/                # VIRA Platform: tenancy, audit, privacy, usage...
├── modules/                 # Domínios de produto futuros
├── core/                    # Domínio, eventos, agents, workflows e contratos
├── integrations/            # Adaptadores externos futuros
├── database/                # Artefatos e decisões de persistência
├── tests/                   # Testes unitários e de integração
└── docs/                    # Arquitetura, privacidade, segurança e legal
```

## Desenvolvimento local

### Backend

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item ..\..\.env.example .env
uvicorn app.main:app --reload
```

O endpoint ficará disponível em `http://127.0.0.1:8000/health`.

A API versionada está reservada em `http://127.0.0.1:8000/api/v1/`.

### Primeiro acesso administrativo local

Antes de iniciar a API pela primeira vez, abra `apps/api/.env` e informe uma
senha inicial exclusiva em `ADMIN_INITIAL_PASSWORD`. A senha é usada somente
para criar a credencial local; ela não é versionada, não aparece nos logs e
não substitui uma senha já persistida.

Depois de iniciar a API e o frontend, acesse `http://localhost:3000/login`,
entre com o usuário definido em `ADMIN_USERNAME` e troque a senha no menu
superior, em `Configurações` → `Segurança`. Se a base local já tiver uma
credencial criada, a variável de senha inicial não será reaplicada.

Como alternativa para uma instalação sem administrador, deixe
`ADMIN_INITIAL_PASSWORD` vazio e configure `ADMIN_SETUP_TOKEN` somente na API.
Ao abrir `/login`, o formulário de ativação solicita usuário, senha com pelo
menos 12 caracteres, confirmação e o código de ativação. Após a criação única,
o sistema abre a sessão e a página volta ao login normal. O código não é a
senha administrativa e deve ser removido ou rotacionado após a ativação.

### Sistema web inicial

O painel web possui as seguintes áreas navegáveis:

- `/`: visão geral do ecossistema e status da API;
- `/business`: VIRA Business;
- `/sites`: VIRA Sites;
- `/studio`: VIRA Studio;
- `/concursos`: VIRA Concursos.

O VIRA Business é o primeiro fluxo operacional. As demais áreas continuam como
shell e estados de módulo; cobrança, scraping e processamento de dados pessoais
permanecem desativados.

### Frontend

```powershell
npm install
npm run dev:web
```

O frontend ficará disponível em `http://localhost:3000`.

No Windows, também é possível usar os atalhos `setup-web.cmd` e `start-web.cmd`. Eles localizam automaticamente `pnpm` ou `npm`; isso evita depender de `pnpm` estar previamente configurado no PATH.

O navegador conversa com a API por um proxy same-origin em `/api/...`; a URL
interna fica somente em `API_INTERNAL_URL` no servidor. Isso mantém o frontend
independente do endereço local ou remoto da API.

### Topologia de produção

| Serviço | Onde roda | Função | URL/origem |
| --- | --- | --- | --- |
| `vira-ai-web` | Cloudflare Workers + OpenNext | Frontend e proxy same-origin | `https://vira-ai-web.apop14520.workers.dev` |
| `vira-api` | VM Oracle Cloud (systemd + Nginx) | FastAPI, autenticação, Business, Concursos e integrações | `https://137-131-255-128.nip.io` |
| PostgreSQL | VM Oracle Cloud (local) | Persistência, sobrevive a deploy e reboot | `127.0.0.1:5432` (não exposto) |

O Worker usa somente a variável server-side `API_INTERNAL_URL`; ela não é
`NEXT_PUBLIC_*` e não aparece no navegador. Os scripts `preview`, `deploy`,
`cf-typegen` e `check:cloudflare` ficam em `apps/web/package.json`.

O frontend é publicado pelo Cloudflare Workers Builds: cada merge na branch
`main` gera uma versão e a coloca em produção. Consulte
[`docs/deployment/CLOUDFLARE.md`](docs/deployment/CLOUDFLARE.md) e
[`docs/deployment/CLOUDFLARE-BUILD.md`](docs/deployment/CLOUDFLARE-BUILD.md)
para o guia operacional.

### Configuração da API na VM

As variáveis da API ficam no arquivo `/opt/vira-ai/apps/api/.env` da VM, lido
pelo serviço `vira-api`. Depois de alterá-lo, reinicie com
`sudo systemctl restart vira-api`. Use os nomes canônicos abaixo:

```text
ADMIN_USERNAME=admin
ADMIN_INITIAL_PASSWORD=<senha inicial exclusiva com pelo menos 12 caracteres>
# Alternativa à senha inicial: ADMIN_SETUP_TOKEN=<código aleatório exclusivo>
ENVIRONMENT=production
API_ACCESS_TOKEN=<token de integração da API>
ADMIN_ACCESS_TOKEN=<token administrativo diferente>
AUTH_ORGANIZATION_ID=<UUID estável da organização>
CORS_ORIGINS=<domínio público do frontend>
DATABASE_URL=postgresql://vira_api:<senha>@127.0.0.1:5432/vira_api
FOURSQUARE_API_KEY=<chave da busca de lugares do Business>
```

No Worker Cloudflare, configure apenas o destino server-side da API:

```text
API_INTERNAL_URL=https://137-131-255-128.nip.io
```

`API_INTERNAL_URL` não deve ficar no frontend como `NEXT_PUBLIC_*` e não deve
terminar em `/login`, `/api` ou `/health`. Os tokens não são a senha do
formulário de login. `ADMIN_INITIAL_PASSWORD` serve somente para criar a
primeira credencial; se uma credencial já existir no banco, ela não será
substituída automaticamente.

Para usar a ativação pela página, defina `ADMIN_SETUP_TOKEN` no `.env` da VM e
deixe `ADMIN_INITIAL_PASSWORD` sem valor. Nunca defina o código, usuário,
senha ou chave Foursquare no Worker Cloudflare. O banco é o PostgreSQL local da
VM, então um novo deploy da API não apaga a credencial. Remova ou rotacione o
código de ativação após o primeiro acesso.

Por compatibilidade com uma configuração antiga, o backend também reconhece
`SENHA_INICIAL_DO_ADMINISTRADOR`, `NOME_DE_USUÁRIO_DO_ADMINISTRADOR`,
`AMBIENTE` e `ORIGENS_CORS`, mas os nomes em inglês são o contrato recomendado.
Não coloque valores reais no repositório.

## Princípios de engenharia

O projeto adota desde a fundação: LGPD, privacy by design, privacy by default, minimização de dados, limitação de finalidade, menor privilégio, configurações seguras por padrão, auditabilidade e segregação entre dados pessoais e empresariais. Secrets e chaves de API nunca devem ser armazenados no código ou versionados.

Consulte [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md), [`docs/privacy/LGPD.md`](docs/privacy/LGPD.md) e [`docs/security/SECURITY_ARCHITECTURE.md`](docs/security/SECURITY_ARCHITECTURE.md) antes de adicionar novas capacidades.
