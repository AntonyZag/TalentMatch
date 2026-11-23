"""FastAPI application entrypoint."""

import logging
import re
from contextlib import asynccontextmanager

import httpx
import psycopg
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg_pool import PoolClosed, PoolTimeout

from backend.apis import auth, catalogs, hiring, integrations, profiles
from backend.config import Settings, get_settings
from backend.database import create_pool
from backend.services.errors import DomainError
from backend.services.integrations import IdentityService


logger = logging.getLogger(__name__)
_DOCUMENT_PATH = re.compile(r"(/(?:dni|ruc)/)[^/?\s\"]+")


class DocumentLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if record.name == "uvicorn.access" and isinstance(record.args, tuple) and len(record.args) == 5:
            host, method, path, version, status = record.args
            record.args = host, method, _DOCUMENT_PATH.sub(r"\1[redactado]", path), version, status
        elif record.name == "httpx":
            record.msg = _DOCUMENT_PATH.sub(r"\1[redactado]", record.getMessage())
            record.args = ()
        return True


_document_log_filter = DocumentLogFilter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    for name in ("uvicorn.access", "httpx"):
        logging.getLogger(name).addFilter(_document_log_filter)
    database_url = app.state.settings.database_url
    pool = create_pool(database_url.get_secret_value()) if database_url is not None else None
    try:
        if pool is not None:
            pool.open()
        app.state.pool = pool
        with httpx.Client(timeout=5.0) as client:
            app.state.identity = IdentityService(app.state.settings, client)
            yield
    finally:
        if pool is not None:
            pool.close()
        app.state.pool = None


def domain_error(_: Request, exc: DomainError) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    return JSONResponse({"detail": str(exc)}, status_code=exc.status_code, headers=headers)


def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    detail = [
        {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return JSONResponse({"detail": detail}, status_code=422)


def database_error(_: Request, exc: psycopg.Error) -> JSONResponse:
    match exc.sqlstate:
        case "23505":
            status, detail = 409, "El registro ya existe."
        case "55000" | "40001" | "40P01":
            status, detail = 409, "La operación entra en conflicto con el estado actual."
        case "42501":
            status, detail = 403, "No tienes permiso para esta operación."
        case "22023" | "23503" | "23514" | "23502" | "22001" | "22003":
            status, detail = 400, "Datos inválidos o referencias inexistentes."
        case _ if isinstance(exc, (psycopg.OperationalError, PoolTimeout, PoolClosed)):
            status, detail = 503, "La base de datos no está disponible temporalmente."
        case _:
            logger.error("Error PostgreSQL (SQLSTATE %s).", exc.sqlstate)
            status, detail = 500, "Error interno de base de datos."
    return JSONResponse({"detail": detail}, status_code=status)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(title="TalentMatch API", lifespan=lifespan)
    app.state.settings = settings
    app.state.pool = None
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(DomainError, domain_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(psycopg.Error, database_error)

    for router in (
        auth.router, integrations.router, catalogs.catalogs, catalogs.metrics, catalogs.admin,
        profiles.students, profiles.projects, profiles.companies,
        hiring.vacancies, hiring.applications, hiring.student_applications, hiring.admin_applications,
    ):
        app.include_router(router)

    @app.middleware("http")
    async def prevent_caching_identity(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/integraciones/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health")
    def health(response: Response) -> dict[str, str | bool]:
        pool = app.state.pool
        if pool is None:
            return {"status": "ok", "pool": False, "database": "notConfigured"}
        try:
            with pool.connection(timeout=3) as conn:
                conn.execute("SELECT 1")
        except psycopg.Error:
            response.status_code = 503
            return {"status": "degraded", "pool": not pool.closed, "database": "unavailable"}
        return {"status": "ok", "pool": True, "database": "available"}

    return app


app = create_app()


def run() -> None:
    """`uv run backend` — local dev server with reload."""
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8001, reload=True)
