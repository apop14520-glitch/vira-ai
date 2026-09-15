"""Environment-backed application settings.

Settings are intentionally centralized so secrets and deployment configuration
are supplied by the runtime instead of being embedded in source code.
"""

from functools import lru_cache
from uuid import UUID

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration with safe local-development defaults."""

    environment: str = "development"
    log_level: str = "INFO"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    database_url: str = "sqlite:///./database/dev.db"
    ai_provider: str = "none"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    development_organization_id: UUID = UUID("00000000-0000-4000-8000-000000000001")
    development_actor_id: UUID = UUID("00000000-0000-4000-8000-000000000002")
    auth_organization_id: UUID | None = None
    api_actor_id: UUID = UUID("00000000-0000-4000-8000-000000000003")
    admin_actor_id: UUID = UUID("00000000-0000-4000-8000-000000000004")
    api_access_token: SecretStr | None = None
    admin_access_token: SecretStr | None = None
    allow_development_auth_bypass: bool | None = None
    admin_username: str = Field(default="admin", min_length=1, max_length=128)
    admin_initial_password: SecretStr | None = None
    admin_session_cookie_name: str = Field(default="vira_admin_session", min_length=1, max_length=64)
    admin_session_ttl_seconds: int = Field(default=28_800, ge=300, le=86_400)
    admin_login_rate_limit: int = Field(default=5, ge=1, le=100)
    admin_login_rate_window_seconds: int = Field(default=300, ge=1, le=86_400)
    web_origin: str = "http://127.0.0.1:3000"
    foursquare_rate_limit: int = Field(default=30, ge=1, le=10_000)
    foursquare_rate_limit_window_seconds: int = Field(default=60, ge=1, le=86_400)
    foursquare_api_key: SecretStr | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_defaults(self) -> "Settings":
        environment = self.environment.strip().casefold()
        if self.allow_development_auth_bypass is None:
            self.allow_development_auth_bypass = environment == "development"
        if not self.admin_username.strip():
            raise ValueError("ADMIN_USERNAME não pode ser vazio.")
        if self.allow_development_auth_bypass and environment not in {"development", "test"}:
            raise ValueError("O bypass de autenticação só pode ser ativado em desenvolvimento ou teste.")
        if environment not in {"development", "test"}:
            missing = []
            if self.api_access_token is None:
                missing.append("API_ACCESS_TOKEN")
            if self.admin_access_token is None:
                missing.append("ADMIN_ACCESS_TOKEN")
            if self.auth_organization_id is None:
                missing.append("AUTH_ORGANIZATION_ID")
            if missing:
                raise ValueError(f"Autenticação fora do desenvolvimento exige: {', '.join(missing)}")
        if environment in {"development", "test"} and self.allow_development_auth_bypass:
            if self.api_host not in {"127.0.0.1", "localhost", "::1"}:
                raise ValueError("O bypass de autenticação só pode usar um host local.")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return one cached settings object per process."""

    return Settings()
