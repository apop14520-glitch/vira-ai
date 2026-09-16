from pydantic import SecretStr

from app.settings import Settings


def test_settings_accepts_the_portuguese_railway_variable_names(monkeypatch) -> None:
    monkeypatch.delenv("ADMIN_INITIAL_PASSWORD", raising=False)
    monkeypatch.delenv("ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
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


def test_settings_accepts_legacy_admin_token_and_organization_names(monkeypatch) -> None:
    monkeypatch.delenv("ADMIN_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("AUTH_ORGANIZATION_ID", raising=False)
    monkeypatch.setenv("TOKEN_DE_ACESSO_DE_ADMINISTRADOR", "legacy-admin-token")
    monkeypatch.setenv("ID_DA_ORGANIZAÇÃO_AUTENTICADA", "00000000-0000-4000-8000-000000000001")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("API_ACCESS_TOKEN", "api-token")

    settings = Settings(_env_file=None)

    assert settings.admin_access_token.get_secret_value() == "legacy-admin-token"
    assert str(settings.auth_organization_id) == "00000000-0000-4000-8000-000000000001"
