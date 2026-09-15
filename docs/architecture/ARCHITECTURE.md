# Arquitetura

## Objetivo

Estabelecer uma fundação modular para o VIRA.AI, reduzindo acoplamento entre produto, infraestrutura e integrações externas.

## Monorepo

- `apps/web`: experiência web em Next.js, TypeScript e Tailwind CSS.
- `apps/api`: API em FastAPI, com configuração e portas de infraestrutura.
- `modules`: módulos de domínio/produto, sem dependência direta de vendors externos.
- `core`: contratos compartilhados, agentes, workflows, segurança, privacidade e providers.
- `integrations`: adapters para sistemas externos, isolados atrás de interfaces.
- `database`: decisões e artefatos de persistência.
- `docs`: documentação normativa e decisões arquiteturais.

## Portabilidade de runtime

O frontend mantém as chamadas externas atrás de um proxy same-origin em
`apps/web/src/app/api/[...path]/route.ts`. A API interna não é exposta no
bundle do navegador, o que mantém o contrato compatível com uma futura camada
de edge sem acoplar o desenvolvimento local a um vendor.

O Railway permanece o ambiente remoto atual. A compatibilidade com Cloudflare
é documentada em [`docs/deployment/CLOUDFLARE.md`](../deployment/CLOUDFLARE.md),
mas nenhuma migração ou configuração de deploy é ativada nesta etapa.

## Fronteiras

Fluxo esperado:

```text
web -> api -> módulos -> portas -> adapters (integrações/banco)
                    \-> core (privacidade, segurança, providers, workflows)
```

Módulos não devem importar SDKs de vendors diretamente. A API não deve expor credenciais, detalhes de conexão ou dados desnecessários em respostas de sistema.

## Persistência

O ambiente local usa SQLite por meio de uma porta de banco. A URL é configurável e a seleção do adapter está centralizada. PostgreSQL será adicionado como novo adapter após definição de migrações, pool, observabilidade, backup, criptografia e estratégia de compatibilidade.

## Estado da fundação

O Business possui uma fronteira inicial de autenticação e autorização: principal
local restrito ao desenvolvimento loopback e bearer tokens obrigatórios em
ambientes não locais. Ainda não existem scraping, coleta de dados pessoais,
integrações pagas ou persistência de domínio além do pipeline local. O endpoint
`/health` confirma somente que o processo da API está ativo.
