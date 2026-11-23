from typing import Annotated

from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg_pool import ConnectionPool

from backend.repositories.auth import AuthRepository, PostgresAuthRepository
from backend.repositories.catalogs import CatalogRepository, PostgresCatalogRepository
from backend.repositories.hiring import HiringRepository, PostgresHiringRepository
from backend.repositories.profiles import PostgresProfileRepository, ProfileRepository
from backend.schemas.common import Role
from backend.services.auth import Actor, AuthService
from backend.services.errors import TemporarilyUnavailable, Unauthorized
from backend.services.integrations import IdentityService

bearer = HTTPBearer(auto_error=False)


def require_pool(request: Request) -> ConnectionPool:
    pool = request.app.state.pool
    if pool is None:
        raise TemporarilyUnavailable("La base de datos no está configurada.")
    return pool


def get_auth_repository(request: Request) -> AuthRepository | None:
    pool = request.app.state.pool
    return PostgresAuthRepository(pool) if pool is not None else None


def get_profile_repository(request: Request) -> ProfileRepository:
    return PostgresProfileRepository(require_pool(request))


def get_hiring_repository(request: Request) -> HiringRepository:
    return PostgresHiringRepository(require_pool(request))


def get_catalog_repository(request: Request) -> CatalogRepository:
    return PostgresCatalogRepository(require_pool(request))


def get_identity_service(request: Request) -> IdentityService:
    return request.app.state.identity


ProfileDep = Annotated[ProfileRepository, Depends(get_profile_repository)]
HiringDep = Annotated[HiringRepository, Depends(get_hiring_repository)]
CatalogDep = Annotated[CatalogRepository, Depends(get_catalog_repository)]
IdentityDep = Annotated[IdentityService, Depends(get_identity_service)]
AuthRepositoryDep = Annotated[AuthRepository | None, Depends(get_auth_repository)]


def get_auth_service(request: Request, repository: AuthRepositoryDep) -> AuthService:
    if repository is None:
        raise TemporarilyUnavailable("La base de datos no está configurada.")
    return AuthService(repository, request.app.state.settings)


def get_optional_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    repository: AuthRepositoryDep,
) -> Actor | None:
    if credentials is None:
        if request.headers.get("Authorization"):
            raise Unauthorized("Usa un token Bearer válido.")
        return None
    return get_auth_service(request, repository).current_user(credentials.credentials)


OptionalUser = Annotated[Actor | None, Depends(get_optional_user)]


def get_current_user(actor: OptionalUser) -> Actor:
    if actor is None:
        raise Unauthorized("Se requiere autenticación.")
    return actor


CurrentUser = Annotated[Actor, Depends(get_current_user)]
AuthDep = Annotated[AuthService, Depends(get_auth_service)]


def require_role(role: Role):
    def check(actor: CurrentUser) -> Actor:
        actor.require(role)
        return actor
    return check


Student = Annotated[Actor, Depends(require_role("ESTUDIANTE"))]
Company = Annotated[Actor, Depends(require_role("EMPRESA"))]
Admin = Annotated[Actor, Depends(require_role("ADMIN"))]


def pagination(
    pagina: Annotated[int, Query(ge=1, le=2_147_483_647)] = 1,
    tamano: Annotated[int, Query(ge=1, le=100)] = 20,
) -> tuple[int, int]:
    return pagina, tamano


Pagination = Annotated[tuple[int, int], Depends(pagination)]
