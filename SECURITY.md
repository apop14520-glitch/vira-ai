# Segurança

## Escopo

Este repositório contém a fundação técnica do VIRA.AI. No estado atual não existem autenticação, scraping, coleta de dados pessoais, integrações pagas ou clientes de provedores de IA.

## Regras essenciais

- Nunca versione secrets, tokens, chaves de API, certificados ou credenciais.
- Use `.env` local ou um gerenciador de secrets para valores sensíveis.
- Não adicione dados pessoais reais a fixtures, logs, testes ou documentação.
- Colete somente o mínimo necessário para uma finalidade documentada e aprovada.
- Mantenha dados pessoais segregados de dados empresariais em modelos, permissões e armazenamento.
- Conceda o menor privilégio possível a processos, usuários e integrações.
- Registre eventos de segurança de forma auditável, sem registrar conteúdo sensível desnecessário.

## Reporte responsável

Não publique detalhes de uma vulnerabilidade antes de uma correção ou coordenação adequada. Para um reporte privado, abra uma comunicação aos mantenedores do projeto com o impacto, passos para reprodução, evidências mínimas e uma sugestão de mitigação. Não envie dados pessoais reais nem secrets.

## Referências internas

- [`docs/security/SECURITY_ARCHITECTURE.md`](docs/security/SECURITY_ARCHITECTURE.md)
- [`docs/privacy/LGPD.md`](docs/privacy/LGPD.md)

