"""FastAPI application entrypoint."""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="TalentMatch API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()


def run() -> None:
    """`uv run backend` — local dev server with reload."""
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8001, reload=True)
