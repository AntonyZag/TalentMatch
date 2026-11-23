from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from backend.config import Settings
from backend.repositories.auth import AuthRepository
from backend.repositories.common import Row
from backend.schemas.auth import CompanyCreate, Login, StudentCreate
from backend.schemas.common import Role
from backend.services.errors import Forbidden, NotFound, TemporarilyUnavailable, Unauthorized, Unprocessable
from backend.services.integrations import IdentityService

_DUMMY_HASH = bcrypt.hashpw(b"talentmatch-dummy-password", bcrypt.gensalt())
_ROLES = {"ESTUDIANTE", "EMPRESA", "ADMIN"}
_ISSUER = "talentmatch"


@dataclass(frozen=True, slots=True)
class Actor:
    id: int
    correo: str
    rol: Role
    estudiante_id: int | None
    empresa_id: int | None

    def require(self, role: Role) -> None:
        if self.rol != role:
            raise Forbidden("Tu cuenta no tiene permiso para esta operación.")

    def student_id(self) -> int:
        self.require("ESTUDIANTE")
        if self.estudiante_id is None:
            raise Forbidden("Tu cuenta no tiene un perfil de estudiante.")
        return self.estudiante_id

    def company_id(self) -> int:
        self.require("EMPRESA")
        if self.empresa_id is None:
            raise Forbidden("Tu cuenta no tiene un perfil de empresa.")
        return self.empresa_id

    def public_account(self) -> Row:
        return dict(id=self.id, correo=self.correo, rol=self.rol)


class AuthService:
    def __init__(self, repository: AuthRepository, settings: Settings):
        self.repository = repository
        self.settings = settings

    def _secret(self) -> str:
        configured = self.settings.jwt_secret
        if configured is None or len(configured.get_secret_value().encode("utf-8")) < 32:
            raise TemporarilyUnavailable("La autenticación requiere un JWT_SECRET de al menos 32 bytes.")
        return configured.get_secret_value()

    def register_student(self, data: StudentCreate, identity: IdentityService) -> Row:
        self.repository.check_registration("ESTUDIANTE", data.correo, data.dni)
        try:
            document = identity.dni(data.dni)
        except NotFound as exc:
            raise Unprocessable("DNI no encontrado.") from exc
        profile = data.model_dump(exclude={"correo", "contrasena"}) | document.model_dump()
        profile["dni_validado"] = True
        return self.repository.register("ESTUDIANTE", data.correo, self._hash(data.contrasena), profile)

    def register_company(self, data: CompanyCreate, identity: IdentityService) -> Row:
        self.repository.check_registration("EMPRESA", data.correo, data.ruc)
        try:
            document = identity.ruc(data.ruc)
        except NotFound as exc:
            raise Unprocessable("RUC no encontrado.") from exc
        profile = data.model_dump(exclude={"correo", "contrasena"}) | document.model_dump()
        profile["ruc_validado"] = True
        return self.repository.register("EMPRESA", data.correo, self._hash(data.contrasena), profile)

    @staticmethod
    def _hash(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")

    @staticmethod
    def _actor(row: Row | None) -> Actor:
        if row is None or not row["activo"] or row["rol"] not in _ROLES:
            raise Unauthorized("Credenciales inválidas.")
        role = row["rol"]
        return Actor(
            row["id"], row["correo"], role,
            row["estudiante_id"] if role == "ESTUDIANTE" else None,
            row["empresa_id"] if role == "EMPRESA" else None,
        )

    def login(self, data: Login) -> Row:
        secret = self._secret()
        row = self.repository.by_email(data.correo)
        password_hash = row["password_hash"].encode("utf-8") if row else _DUMMY_HASH
        try:
            valid = bcrypt.checkpw(data.contrasena.encode("utf-8"), password_hash)
        except ValueError:
            valid = False
        if not valid:
            raise Unauthorized("Credenciales inválidas.")
        actor = self._actor(row)
        now = datetime.now(UTC)
        token = jwt.encode(
            {"sub": str(actor.id), "iss": _ISSUER, "iat": now,
             "exp": now + timedelta(minutes=self.settings.jwt_expire_minutes)},
            secret,
            algorithm="HS256",
        )
        return actor.public_account() | {"access_token": token}

    def current_user(self, token: str) -> Actor:
        secret = self._secret()
        try:
            claims = jwt.decode(
                token, secret, algorithms=["HS256"], issuer=_ISSUER,
                options={"require": ["sub", "iat", "exp", "iss"]},
            )
            account_id = int(claims["sub"])
            if not 1 <= account_id <= 2_147_483_647:
                raise ValueError
        except (jwt.InvalidTokenError, ValueError) as exc:
            raise Unauthorized("Token inválido o vencido.") from exc
        return self._actor(self.repository.by_id(account_id))
