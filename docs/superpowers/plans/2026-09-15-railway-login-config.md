# Railway Login Configuration Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deployed Railway configuration accept the variable names already used by the project owner while preserving the secure canonical configuration and clearly documenting the API/web service boundary.

**Architecture:** Keep `Settings` as the single environment boundary. Canonical English variable names remain the public contract; the four Portuguese names visible in the Railway screenshot are accepted only as backward-compatible validation aliases, with canonical names taking precedence when both exist. Deployment documentation will describe which values belong to `vira-api` and `vira-web`; no Railway project or secret will be changed by the code push.

**Tech Stack:** Python 3.11, Pydantic Settings, pytest, Next.js server-side route handler, Markdown documentation, Git.

**Spec:** `docs/superpowers/specs/2026-09-15-configuracoes-seguranca-menu-design.md`

## Global Constraints

- Secrets and passwords remain runtime-only and are never committed or returned by the API.
- `ADMIN_INITIAL_PASSWORD` is bootstrap-only and never overwrites an existing persisted credential.
- Production still requires `API_ACCESS_TOKEN`, `ADMIN_ACCESS_TOKEN`, and `AUTH_ORGANIZATION_ID`.
- `API_INTERNAL_URL` remains server-only on the web service and is never renamed to a `NEXT_PUBLIC_*` variable.
- No Railway deployment, database deletion, volume change, or production secret rotation is performed from the repository.

---

### Task 1: Lock the Railway variable compatibility contract with tests

**Files:**
- Create: `apps/api/tests/test_settings.py`
- Modify: `apps/api/app/settings.py` only after the failing tests are observed

**Interfaces:**
- Consumes: `Settings` from `app.settings`.
- Produces: Regression coverage proving canonical names, Portuguese compatibility aliases, canonical precedence, and production requirements.

- [x] **Step 1: Write the failing tests**

```python
from pydantic import SecretStr

from app.settings import Settings


def test_settings_accepts_the_portuguese_railway_variable_names(monkeypatch) -> None:
    monkeypatch.setenv("SENHA_INICIAL_DO_ADMINISTRADOR", "senha-railway-2026!")
    monkeypatch.setenv("NOME_DE_USUÁRIO_DO_ADMINISTRADOR", "operador")
    monkeypatch.setenv("AMBIENTE", "production")
    monkeypatch.setenv("ORIGENS_CORS", "https://web.example")
    monkeypatch.setenv("API_ACCESS_TOKEN", "api-token")
    monkeypatch.setenv("ADMIN_ACCESS_TOKEN", "admin-token")
    monkeypatch.setenv("AUTH_ORGANIZATION_ID", "00000000-0000-4000-8000-000000000001")

    settings = Settings(_env_file=None)

    assert isinstance(settings.admin_initial_password, SecretStr)
    assert settings.admin_initial_password.get_secret_value() == "senha-railway-2026!"
    assert settings.admin_username == "operador"
    assert settings.environment == "production"
    assert settings.cors_origins == "https://web.example"


def test_canonical_variable_names_take_precedence_over_compatibility_aliases(monkeypatch) -> None:
    monkeypatch.setenv("ADMIN_INITIAL_PASSWORD", "canonical-password-2026!")
    monkeypatch.setenv("SENHA_INICIAL_DO_ADMINISTRADOR", "legacy-password-2026!")
    monkeypatch.setenv("ADMIN_USERNAME", "canonical-admin")
    monkeypatch.setenv("NOME_DE_USUÁRIO_DO_ADMINISTRADOR", "legacy-admin")
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("AMBIENTE", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://canonical.example")
    monkeypatch.setenv("ORIGENS_CORS", "https://legacy.example")

    settings = Settings(_env_file=None)

    assert settings.admin_initial_password.get_secret_value() == "canonical-password-2026!"
    assert settings.admin_username == "canonical-admin"
    assert settings.environment == "test"
    assert settings.cors_origins == "https://canonical.example"
```

- [x] **Step 2: Run the focused tests to verify they fail for the expected reason**

Run: `python -m pytest -q apps/api/tests/test_settings.py`

Expected: FAIL because `Settings` does not yet map the four Portuguese environment names to its canonical fields.

- [x] **Step 3: Implement the minimal compatibility aliases**

Use Pydantic `AliasChoices` on these fields only:

```python
admin_username: str = Field(
    default="admin",
    min_length=1,
    max_length=128,
    validation_alias=AliasChoices("ADMIN_USERNAME", "NOME_DE_USUÁRIO_DO_ADMINISTRADOR"),
)
admin_initial_password: SecretStr | None = Field(
    default=None,
    validation_alias=AliasChoices("ADMIN_INITIAL_PASSWORD", "SENHA_INICIAL_DO_ADMINISTRADOR"),
)
environment: str = Field(
    default="development",
    validation_alias=AliasChoices("ENVIRONMENT", "AMBIENTE"),
)
cors_origins: str = Field(
    default="http://localhost:3000,http://127.0.0.1:3000",
    validation_alias=AliasChoices("CORS_ORIGINS", "ORIGENS_CORS"),
)
```

Import `AliasChoices` from `pydantic`. Do not add aliases for access tokens, database URLs, or `API_INTERNAL_URL` because those names are already canonical and security-sensitive deployment boundaries should remain explicit.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `python -m pytest -q apps/api/tests/test_settings.py`

Expected: 2 passed.

### Task 2: Document the two Railway services and safe deployment order

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment/CLOUDFLARE.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: The canonical `Settings` names and the existing Next.js server-only proxy contract.
- Produces: Portuguese deployment instructions that identify `vira-api` versus `vira-web`, distinguish login credentials from bearer tokens, and explain the bootstrap-only password behavior.

- [x] **Step 1: Add documentation examples without real secrets**

Document the following service matrix:

```text
vira-api:
  ADMIN_USERNAME
  ADMIN_INITIAL_PASSWORD
  ENVIRONMENT=production
  API_ACCESS_TOKEN
  ADMIN_ACCESS_TOKEN
  AUTH_ORGANIZATION_ID
  CORS_ORIGINS=<dominio-publico-do-vira-web>

vira-web:
  API_INTERNAL_URL=<url-base-do-vira-api>
```

State that `API_INTERNAL_URL` must not contain `/login`, `/api`, or `/health`, that the two bearer tokens are not entered into the login form, and that setting `ADMIN_INITIAL_PASSWORD` does not overwrite an existing database credential. Mention the four Portuguese aliases only as migration compatibility and keep the English names recommended for new deployments.

- [x] **Step 2: Verify documentation does not contain real secrets**

Run: `rg -n --hidden --glob '!**/.git/**' --glob '!**/node_modules/**' "(ADMIN_INITIAL_PASSWORD|ADMIN_ACCESS_TOKEN|API_ACCESS_TOKEN|FOURSQUARE_API_KEY|OPENAI_API_KEY)=" README.md .env.example docs/deployment/CLOUDFLARE.md`

Expected: only placeholders, comments, and variable names are found; no credential value is present.

### Task 3: Run the complete verification and publish the branch

**Files:**
- Modify: only files from Tasks 1–2

**Interfaces:**
- Consumes: Passing backend tests, web typecheck/build, and a clean diff.
- Produces: A Git commit pushed to the current feature branch without touching Railway.

- [ ] **Step 1: Run backend tests**

Run from `apps/api`: `python -m pytest -q`

Expected: zero failures.

- [ ] **Step 2: Run web typecheck and production build**

Run from the repository root:

```powershell
apps/web/node_modules/.bin/tsc.cmd --noEmit -p apps/web/tsconfig.json
Push-Location apps/web
apps/web/node_modules/.bin/next.cmd build
Pop-Location
```

Expected: both commands exit successfully.

- [ ] **Step 3: Review the diff and branch state**

Run: `git diff --check` and `git status --short --branch`

Expected: no whitespace errors, no unintentional secret files, and only the planned files changed.

- [ ] **Step 4: Commit and push the current branch**

Run:

```powershell
git add apps/api/app/settings.py apps/api/tests/test_settings.py README.md .env.example docs/deployment/CLOUDFLARE.md docs/superpowers/plans/2026-09-15-railway-login-config.md
git commit -m "fix: alinhar configuracao de login no Railway"
git push origin HEAD
```

Expected: the current feature branch is updated on GitHub; no merge into `main` and no Railway deploy is triggered by this task.

---

## Self-review checklist

- The code accepts the exact variable names visible in the Railway screenshot without exposing any secret.
- Canonical English names win when both forms exist.
- Production token requirements remain enforced.
- `API_INTERNAL_URL` remains a web-service/server-only variable.
- The first credential remains bootstrap-only; no reset or database deletion is introduced.
- Railway changes remain a separate manual deployment action.
