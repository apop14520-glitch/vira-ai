# Integração de Engenharia de IA no VIRA.AI

## Finalidade

O arquivo `ai-engineering-from-scratch-2026.09.zip` foi analisado como uma
referência de engenharia. Ele reúne um currículo de Engenharia de IA com
ênfase em LLMs, RAG, ferramentas, MCP, agentes, avaliação, observabilidade e
segurança.

O VIRA.AI não importa o site, as lições ou as dependências completas desse
currículo. A primeira integração mantém implementações próprias, pequenas e
testáveis, alinhadas ao AI Gateway vendor-neutral do monorepo.

O material de referência declara licença MIT. Qualquer reutilização futura de
código ou texto original deverá manter o aviso de copyright e a licença. Nesta
fundação foram usados conceitos e contratos próprios; nenhum segredo, prompt
real, resposta de usuário ou conteúdo privado foi importado.

## Mapa de aplicação

| Prática de Engenharia de IA | VIRA.AI | Uso planejado |
| --- | --- | --- |
| Saídas estruturadas | AI Gateway e VIRA Business | Validar extrações antes de alterar leads ou dados empresariais |
| RAG com proveniência | VIRA Concursos | Consultar somente Manual de TI, editais e documentos autorizados, preservando fonte e versão |
| Avaliação determinística | Plataforma e VIRA Studio | Detectar regressões de formato, segurança, latência e qualidade antes de publicar |
| Guardrails | Todos os módulos de IA | Classificar entradas e saídas antes de permitir uma ação |
| Contratos de ferramentas | VIRA Studio | Declarar finalidade, esquema, permissões, limites e cancelamento |
| MCP e integrações | VIRA Studio e coletores autorizados | Conectar ferramentas somente após autenticação, escopo e revisão de supply chain |
| Observabilidade | Plataforma | Correlacionar request, organização, custo, latência e resultado agregado |
| Gestão de segredos | AI Gateway e deploy | Manter chaves em runtime/secret manager e nunca em código, fixtures ou frontend |

## Fundação implementada

Os contratos em `core/providers/ai/` agora podem carregar, de forma opcional:

- `request_id` para correlação técnica;
- `source_ids` para futura proveniência de documentos;
- `metadata` não sensível para contexto de superfície, finalidade ou versão;
- `SafetyAction` e `SafetyVerdict` para decisões `allow`, `warn` e `block`.

`guardrails.py` contém um inspetor inicial, sem dependências externas, que
normaliza caracteres de controle e identifica famílias explícitas de
substituição de instruções, bypass de segurança, troca de papel e sondagem do
system prompt. O inspetor não guarda o texto correspondente à regra.

`evaluation.py` executa fixtures offline e mede acertos, falsos positivos,
falsos negativos, precisão e recall, mantendo os resultados na mesma ordem das
entradas. A avaliação não faz chamada de rede e não registra o prompt.

Esses componentes são sinais de segurança e qualidade. Eles não substituem
autorização, isolamento por organização, revisão humana, moderação completa ou
uma análise de ameaça.

## Limites para a próxima etapa

Antes de habilitar um provider ou RAG em produção, será necessário definir:

1. finalidade e base legal do dado processado;
2. classificação de dados e política de retenção;
3. esquema de entrada e saída versionado;
4. conjunto de avaliação representativo, com casos benignos e adversariais;
5. política de fallback, timeout, custo e rate limit;
6. autorização por organização, módulo e ferramenta;
7. trilha de auditoria sem conteúdo sensível;
8. revisão humana para alterações em concursos, leads ou documentos publicados;
9. rotação de segredos e verificação de supply chain;
10. plano de rollback e evidência de teste em ambiente de pré-produção.

## Sequência de evolução

### VIRA Studio

O Studio consumirá os contratos para criar workflows com finalidade explícita,
ferramentas permitidas, limite de etapas, orçamento e cancelamento. Um agente
não receberá permissão por interpretar uma instrução textual do usuário; a
permissão virá da política do módulo e da organização.

### VIRA Concursos

O primeiro RAG deverá operar sobre documentos autorizados e versionados. A
resposta deverá carregar as fontes recuperadas e ser marcada para revisão
quando não houver evidência suficiente. A coleta automática continuará
separada do índice de estudo e não será ativada por esta fundação.

### VIRA Business

Extrações estruturadas poderão sugerir normalização de empresas e oportunidades,
mas a alteração persistida continuará passando pelos repositórios, regras de
tenancy e auditoria do módulo.

## O que não fazer

- Não colocar `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, tokens ou senhas no código.
- Não enviar `API_INTERNAL_URL` ou credenciais administrativas para o browser.
- Não tratar texto recuperado da web como instrução confiável para um agente.
- Não publicar uma resposta gerada por IA como gabarito oficial sem revisão.
- Não instalar todas as dependências do currículo no runtime da aplicação.
- Não habilitar scraping, MCP remoto ou agentes autônomos sem uma especificação
  própria, análise de risco, testes e autorização explícita.

## Referência

- Arquivo analisado: `ai-engineering-from-scratch-2026.09.zip`.
- Projeto de origem indicado pelo material:
  `https://github.com/rohitg00/ai-engineering-from-scratch`.
- Design desta integração:
  `docs/superpowers/specs/2026-09-17-ai-engineering-foundation-design.md`.
