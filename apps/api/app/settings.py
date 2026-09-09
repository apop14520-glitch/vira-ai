"""Environment-backed application settings.

Settings are intentionally centralized so secrets and deployment configuration
are supplied by the runtime instead of being embedded in source code.
"""

from functools import lru_cache
from uuid import UUID

from pydantic import SecretStr
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
    foursquare_api_key: SecretStr | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return one cached settings object per process."""

    return Settings()
