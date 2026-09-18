# Semgrep — SAST no VIRA.AI

## Objetivo

Camada de Static Application Security Testing (SAST) para detectar padrões
inseguros no backend (FastAPI/Python) e no frontend (Next.js/React/TypeScript),
sem substituir revisão humana, testes ou outras camadas de segurança do projeto.

## Instalação (local)

O Semgrep é isolado num virtualenv próprio, para não se misturar com o
ambiente de execução da API (`apps/api`, Python `>=3.11`) nem exigir Node
além do já usado pelo `apps/web`:

```bash
py -m venv .venv-semgrep
.venv-semgrep\Scripts\python.exe -m pip install semgrep
```

`.venv-semgrep/` está no `.gitignore` e não deve ser versionado.

## Agent Skills

Instaladas via o mecanismo oficial do projeto `semgrep/skills`:

```bash
npx skills add semgrep/skills
```

Isso instala três skills (`semgrep`, `code-security`, `llm-security`) em
`.agents/skills/`, com symlink para uso pelo Claude Code em `.claude/skills/`.
As skills não substituem o binário `semgrep` — elas ensinam o agente a usá-lo
e a interpretar achados corretamente.

## Execução local

Comando de baseline (o mesmo usado na auditoria inicial):

```bash
.venv-semgrep\Scripts\semgrep.exe --config auto . \
  --exclude node_modules --exclude .next --exclude .open-next \
  --exclude .venv-semgrep --exclude .agents --exclude .claude \
  --exclude dist --exclude out
```

## Tratamento de findings

1. Nenhum finding é corrigido sem antes ser classificado (severidade,
   exploitability, confidence, possibilidade de falso positivo).
2. Findings confirmados recebem o menor patch possível — sem alterar
   comportamento funcional.
3. Falsos positivos **não são silenciados sem justificativa**. Quando uma
   regra é suprimida com `# nosemgrep: <rule-id>`, o comentário no código
   deve explicar por que o padrão é seguro naquele ponto específico.

## Exceções documentadas (auditoria de 2026-09-17)

- `apps/api/app/modules/business/repository.py` (`_ensure_column`, `list`)
- `apps/api/app/modules/concursos/repository.py` (`list_questions`)

Regra: `python.sqlalchemy.security.sqlalchemy-execute-raw-query` (e
`python.lang.security.audit.formatted-sql-query` no caso de `_ensure_column`).

Motivo: nesses pontos, o f-string interpola apenas texto fixo controlado pelo
próprio código (nomes de coluna/tabela literais em `_ensure_column`, ou
cláusulas `WHERE` fixas como `"status = ?"` nos métodos `list`/`list_questions`).
O valor efetivamente vindo do usuário sempre é passado como parâmetro `?`
vinculado (bound), nunca interpolado na string SQL. SQLite não oferece
placeholder para identificadores (nomes de tabela/coluna), então a
interpolação de string é o método padrão para migrações aditivas com
identificadores fixos no código.

Risco residual: nenhum caminho de dado do usuário alcança a sintaxe SQL
nesses pontos. Reavaliar se `_ensure_column` ou os filtros de busca
passarem a aceitar `table`/`column`/cláusulas vindas de fora do código-fonte.

## Recomendação de CI/CD (ainda não implementada)

```
PUSH / PR
  → LINT
  → TYPECHECK
  → TESTS
  → SEMGREP (novo)
  → BUILD
  → CODE REVIEW
  → SECURITY REVIEW
  → MERGE
```

Sugestão de job a adicionar em `.github/workflows/ci.yml` quando aprovado:

```yaml
  semgrep:
    name: Semgrep SAST
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: returntocorp/semgrep-action@<sha> # avaliar versão fixada antes de adotar
        with:
          config: auto
```

Esta integração de CI **não foi aplicada** nesta auditoria — está registrada
aqui como recomendação, pendente de decisão explícita (ver item 17 do escopo
da auditoria original).

## Rulesets usados

`--config auto` — conjunto público do Semgrep Registry, detectado
automaticamente por linguagem (Python, TypeScript, JS, YAML, JSON, além de
regras multi-linguagem para GitHub Actions e gerenciadores de pacote).

## Responsabilidades

- Quem roda o scan decide a classificação inicial (CONFIRMED/FALSE_POSITIVE/
  NEEDS_VALIDATION) e documenta a decisão neste arquivo ou em comentário
  `nosemgrep` no código.
- Nenhum finding CRITICAL/HIGH confirmado deve ser mesclado em `main` sem
  correção ou exceção documentada.
