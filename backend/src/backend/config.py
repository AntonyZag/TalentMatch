"""Application settings, loaded from environment variables and `.env`."""

import logging
from functools import lru_cache
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # CORS: comma-separated in the environment, e.g.
    # CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
    # Empty by default: no cross-origin request is allowed unless configured.
    cors_origins: Annotated[list[str], NoDecode] = []
    database_url: SecretStr | None = None
    apisperu_base_url: str = "https://dniruc.apisperu.com/api/v1"
    apisperu_token: SecretStr | None = None
    jwt_secret: SecretStr | None = None
    jwt_expire_minutes: int = Field(default=120, gt=0)

    @field_validator("database_url", "apisperu_token", "jwt_secret", mode="before")
    @classmethod
    def empty_secret(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    def model_post_init(self, context: object, /) -> None:
        if not self.cors_origins:
            logger.warning(
                "CORS_ORIGINS is not set: cross-origin requests will be rejected. "
                "Set it as a comma-separated list (e.g. "
                "http://localhost:4200) in .env or the environment."
            )


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance.

    Run commands from backend/ so the working directory resolves its .env.
    """
    return Settings()
