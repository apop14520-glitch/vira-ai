# Arquitetura de segurança

## Postura padrão

O sistema deve ser secure by default: negar acessos não necessários, validar entradas, limitar saídas, minimizar logs e exigir configuração explícita para integrações externas.

## Controles desde a fundação

- Configuração por ambiente através de `.env` local ou secret manager.
- `.gitignore` cobrindo arquivos de ambiente, bancos locais, caches e artefatos de runtime.
- Interfaces para banco e providers, evitando acoplamento e facilitando testes.
- Endpoint de healthcheck sem detalhes internos, credenciais ou dados de usuário.
- Separação de dados pessoais e empresariais como requisito de modelagem futura.
- Documentação de fontes, finalidade e riscos antes de integrações.

## Menor privilégio

Cada módulo, job e integração futura deve receber somente as permissões necessárias para sua finalidade. Credenciais deverão ser específicas por ambiente e serviço, com rotação, expiração e auditoria quando suportadas.

## Auditoria e observabilidade

Eventos de segurança devem ter ator técnico, ação, recurso, resultado e timestamp. Logs não devem conter tokens, prompts completos, documentos, identificadores pessoais ou payloads sensíveis sem justificativa documentada.

## Ameaças a considerar antes de produção

- exposição de secrets e variáveis de ambiente;
- abuso de endpoints e ausência de autenticação/autorização;
- injeção em integrações, scraping e prompts;
- exfiltração via logs ou providers de IA;
- acesso cruzado entre tenants e entre dados pessoais/empresariais;
- indisponibilidade, corrupção e recuperação de banco;
- fontes de dados sem finalidade, base legal ou rastreabilidade.

Antes de produção, estes riscos exigem threat modeling, controles de identidade, gestão de secrets, rate limiting, backups, testes de segurança e plano de resposta a incidentes.

