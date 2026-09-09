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

Não existem autenticação, autorização de usuário, scraping, coleta de dados pessoais, integrações pagas ou persistência de domínio. O endpoint `/health` confirma somente que o processo da API está ativo.

