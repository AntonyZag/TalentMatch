from typing import Annotated

from pydantic import Field, field_validator

from backend.schemas.common import Dni, Id, Role, Ruc, Schema
from backend.schemas.profiles import CompanyRead, Cycle, StudentRead


class Login(Schema):
    correo: Annotated[str, Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    contrasena: Annotated[str, Field(min_length=1, max_length=72, repr=False)]

    @field_validator("correo", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("contrasena")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("La contraseña admite hasta 72 bytes UTF-8.")
        return value


class Registration(Login):
    contrasena: Annotated[str, Field(min_length=8, max_length=72, repr=False)]


class StudentCreate(Registration):
    dni: Dni
    carrera_id: Id
    estado_academico_id: Id
    ciclo: Cycle | None = None


class CompanyCreate(Registration):
    ruc: Ruc
    sector_id: Id


class AccountRead(Schema):
    id: Id
    rol: Role
    correo: str


class SessionRead(AccountRead):
    perfil: StudentRead | CompanyRead | None


class TokenRead(AccountRead):
    access_token: str
    token_type: str = "Bearer"


class DniRead(Schema):
    nombres: Annotated[str, Field(min_length=1, max_length=120)]
    apellido_pat: Annotated[str, Field(min_length=1, max_length=80)]
    apellido_mat: Annotated[str, Field(max_length=80)] | None = None


class RucRead(Schema):
    razon_social: Annotated[str, Field(min_length=1, max_length=160)]
    nombre_comercial: Annotated[str, Field(max_length=160)] | None = None
    estado_sunat: Annotated[str, Field(max_length=40)] | None = None
    direccion: str | None = None
