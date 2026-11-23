from datetime import UTC, datetime
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.apis.dependencies import (
    get_auth_repository, get_catalog_repository, get_hiring_repository,
    get_identity_service, get_profile_repository,
)
from backend.config import Settings
from backend.main import create_app
from backend.repositories.auth import AuthRepository
from backend.repositories.catalogs import CatalogRepository
from backend.repositories.hiring import HiringRepository
from backend.repositories.profiles import ProfileRepository
from backend.services.auth import AuthService
from backend.services.integrations import IdentityService


@pytest.fixture
def settings():
    return Settings(
        _env_file=None, database_url=None, cors_origins=["http://localhost:4200"],
        apisperu_base_url="https://example.test/api/v1",
        apisperu_token="apitoken", jwt_secret="a-fake-test-key-of-at-least-32-bytes",
    )


@pytest.fixture
def repos():
    return {
        "auth": Mock(spec=AuthRepository), "profile": Mock(spec=ProfileRepository),
        "hiring": Mock(spec=HiringRepository), "catalog": Mock(spec=CatalogRepository),
    }


@pytest.fixture
def users():
    return {
        "ESTUDIANTE": dict(id=1, correo="estudiante@example.test", rol="ESTUDIANTE", activo=True,
                           estudiante_id=11, empresa_id=None),
        "EMPRESA": dict(id=2, correo="empresa@example.test", rol="EMPRESA", activo=True,
                        estudiante_id=None, empresa_id=22),
        "ADMIN": dict(id=3, correo="admin@example.test", rol="ADMIN", activo=True,
                      estudiante_id=None, empresa_id=None),
    }


@pytest.fixture
def tokens(settings, repos, users):
    password_hash = AuthService._hash("prueba-123")
    for user in users.values():
        user["password_hash"] = password_hash
    repos["auth"].by_id.side_effect = lambda user_id: next(
        (user for user in users.values() if user["id"] == user_id), None
    )
    repos["auth"].by_email.side_effect = lambda email: next(
        (user for user in users.values() if user["correo"] == email), None
    )
    auth = AuthService(repos["auth"], settings)
    from backend.schemas.auth import Login

    return {
        role: {"Authorization": "Bearer " + auth.login(Login(
            correo=user["correo"], contrasena="prueba-123"
        ))["access_token"]}
        for role, user in users.items()
    }


@pytest.fixture
def upstream():
    def send(request):
        if request.url.path.startswith("/api/v1/dni/"):
            return httpx.Response(200, json={
                "dni": request.url.path.rsplit("/", 1)[1], "nombres": "  Ana   María ",
                "apellidoPaterno": " Pérez ", "apellidoMaterno": " Díaz ",
            })
        return httpx.Response(200, json={
            "ruc": request.url.path.rsplit("/", 1)[1], "razonSocial": " Universidad  SAC ",
            "estado": "ACTIVO", "direccion": " Av. Lima 123 ",
        })

    return Mock(side_effect=send)


@pytest.fixture
def client(settings, repos, upstream):
    app = create_app(settings)
    app.dependency_overrides[get_auth_repository] = lambda: repos["auth"]
    app.dependency_overrides[get_profile_repository] = lambda: repos["profile"]
    app.dependency_overrides[get_hiring_repository] = lambda: repos["hiring"]
    app.dependency_overrides[get_catalog_repository] = lambda: repos["catalog"]

    with httpx.Client(transport=httpx.MockTransport(upstream)) as transport:
        identity = IdentityService(settings, transport)
        app.dependency_overrides[get_identity_service] = lambda: identity
        with TestClient(app) as test_client:
            yield test_client


@pytest.fixture
def now():
    return datetime(2026, 11, 23, 15, 0, tzinfo=UTC)
