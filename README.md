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
- Pipeline local de empresas no VIRA Business, com auditoria e pesquisa
  opcional de estabelecimentos pela Foursquare Places, limitada a 20 resultados.

## Fora do escopo desta fundação

Não há scraping, coleta de dados pessoais, autenticação, integrações de IA,
importação de contatos ou armazenamento persistente de chaves da Foursquare.
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

### Sistema web inicial

O painel web possui as seguintes áreas navegáveis:

- `/`: visão geral do ecossistema e status da API;
- `/business`: VIRA Business;
- `/sites`: VIRA Sites;
- `/studio`: VIRA Studio;
- `/concursos`: VIRA Concursos.

O VIRA Business é o primeiro fluxo operacional. As demais áreas continuam como
shell e estados de módulo; autenticação, cobrança, scraping e processamento de
dados pessoais permanecem desativados.

### Frontend

```powershell
npm install
npm run dev:web
```

O frontend ficará disponível em `http://localhost:3000`.

No Windows, também é possível usar os atalhos `setup-web.cmd` e `start-web.cmd`. Eles localizam automaticamente `pnpm` ou `npm`; isso evita depender de `pnpm` estar previamente configurado no PATH.

## Princípios de engenharia

O projeto adota desde a fundação: LGPD, privacy by design, privacy by default, minimização de dados, limitação de finalidade, menor privilégio, configurações seguras por padrão, auditabilidade e segregação entre dados pessoais e empresariais. Secrets e chaves de API nunca devem ser armazenados no código ou versionados.

Consulte [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md), [`docs/privacy/LGPD.md`](docs/privacy/LGPD.md) e [`docs/security/SECURITY_ARCHITECTURE.md`](docs/security/SECURITY_ARCHITECTURE.md) antes de adicionar novas capacidades.
