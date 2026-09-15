# Arquitetura de segurança

## Postura padrão

O sistema deve ser secure by default: negar acessos não necessários, validar entradas, limitar saídas, minimizar logs e exigir configuração explícita para integrações externas.

## Controles desde a fundação

- Configuração por ambiente através de `.env` local ou secret manager.
- `.gitignore` cobrindo arquivos de ambiente, bancos locais, caches e artefatos de runtime.
- Interfaces para banco e providers, evitando acoplamento e facilitando testes.
- Endpoint de healthcheck sem detalhes internos, credenciais ou dados de usuário.
- Fronteira de autenticação no módulo Business: principal local somente no loopback durante desenvolvimento e bearer tokens obrigatórios fora dele.
- Contexto de `actor_id`, `organization_id` e `request_id` nas operações tenant-scoped e nos eventos de integração.
- Papel administrativo exigido para configurar ou remover credenciais Foursquare.
- Rate limit por ator para buscas externas.
- Separação de dados pessoais e empresariais como requisito de modelagem futura.
- Documentação de fontes, finalidade e riscos antes de integrações.

## Menor privilégio

Cada módulo, job e integração futura deve receber somente as permissões necessárias para sua finalidade. Credenciais deverão ser específicas por ambiente e serviço, com rotação, expiração e auditoria quando suportadas.

## Auditoria e observabilidade

Eventos de segurança devem ter ator técnico, organização, requisição, ação, recurso, resultado e timestamp. Logs e metadados de auditoria não devem conter tokens, prompts completos, documentos, identificadores pessoais ou payloads sensíveis sem justificativa documentada.

## Ameaças a considerar antes de produção

- exposição de secrets e variáveis de ambiente;
- abuso de endpoints e ausência de autenticação/autorização;
- injeção em integrações, scraping e prompts;
- exfiltração via logs ou providers de IA;
- acesso cruzado entre tenants e entre dados pessoais/empresariais;
- indisponibilidade, corrupção e recuperação de banco;
- fontes de dados sem finalidade, base legal ou rastreabilidade.

Antes de produção, estes riscos ainda exigem threat modeling, gestão de secrets, limiter distribuído, backups, testes de segurança, rotação de tokens e plano de resposta a incidentes. A autenticação local e o rate limit em processo desta fundação não substituem esses controles de implantação.
