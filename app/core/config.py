"""Application configuration using pydantic-settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings loaded from environment or .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # API Keys & Environment
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    app_env: str = Field(default="development", alias="APP_ENV")
    host: str = Field(default="127.0.0.1", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    # Security & CORS
    cors_allowed_origins: str = Field(
        default="http://localhost:8000,http://127.0.0.1:8000",
        alias="CORS_ALLOWED_ORIGINS",
    )
    rate_limit_per_minute: int = Field(default=20, alias="RATE_LIMIT_PER_MINUTE")
    redis_url: str | None = Field(default=None, alias="REDIS_URL")
    trusted_proxies: str = Field(
        default="127.0.0.1,::1,testclient,localhost",
        alias="TRUSTED_PROXIES",
    )
    trust_all_proxies: bool = Field(default=False, alias="TRUST_ALL_PROXIES")
    max_request_body_bytes: int = Field(
        default=1_048_576, alias="MAX_REQUEST_BODY_BYTES"
    )

    # LLM Settings
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")
    llm_timeout_seconds: float = Field(default=10.0, alias="LLM_TIMEOUT_SECONDS")
    llm_max_retries: int = Field(default=2, alias="LLM_MAX_RETRIES")
    cache_ttl_seconds: int = Field(default=3600, alias="CACHE_TTL_SECONDS")

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a trimmed list of strings."""
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton instance of Settings."""
    return Settings()
