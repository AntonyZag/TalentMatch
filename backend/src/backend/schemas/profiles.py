from datetime import date
from typing import Annotated, ClassVar

from pydantic import Field, HttpUrl, StringConstraints, field_validator

from backend.schemas.common import Dni, Id, Phone, Ruc, Schema, Update

Cycle = Annotated[int, Field(ge=1, le=12)]
GraduationYear = Annotated[int, Field(ge=1900, le=9999)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class StudentSkill(Schema):
    habilidad_id: Id
    nivel_id: Id


class StudentSkillsUpdate(Schema):
    habilidades: list[StudentSkill]

    @field_validator("habilidades")
    @classmethod
    def unique_skills(cls, items: list[StudentSkill]) -> list[StudentSkill]:
        if len({item.habilidad_id for item in items}) != len(items):
            raise ValueError("Cada habilidad debe aparecer una sola vez.")
        return items


class StudentUpdate(Update):
    non_nullable = frozenset({"carrera_id", "estado_academico_id"})
    carrera_id: Id | None = None
    estado_academico_id: Id | None = None
    ciclo: Cycle | None = None
    anio_egreso: GraduationYear | None = None
    telefono: Phone | None = None
    bio: str | None = None
    github_url: HttpUrl | None = None
    linkedin_url: HttpUrl | None = None


class StudentRead(Schema):
    id: Id
    dni: Dni
    nombres: str
    apellido_pat: str
    apellido_mat: str | None
    dni_validado: bool
    telefono: str | None
    carrera_id: Id
    estado_academico_id: Id
    ciclo: Cycle | None
    anio_egreso: GraduationYear | None
    bio: str | None
    github_url: str | None
    linkedin_url: str | None
    habilidades: list[StudentSkill]


class CompanyUpdate(Update):
    non_nullable = frozenset({"sector_id"})
    nombre_comercial: Annotated[str, Field(max_length=160)] | None = None
    sector_id: Id | None = None
    telefono: Phone | None = None
    web: HttpUrl | None = None
    descripcion: str | None = None


class CompanyRead(Schema):
    id: Id
    ruc: Ruc
    razon_social: str
    nombre_comercial: str | None
    direccion: str | None
    estado_sunat: str | None
    ruc_validado: bool
    sector_id: Id
    telefono: str | None
    web: str | None
    descripcion: str | None


class ProjectFields(Schema):
    curso: Annotated[str, Field(max_length=120)] | None = None
    repo_url: HttpUrl | None = None
    demo_url: HttpUrl | None = None
    imagen_url: HttpUrl | None = None
    habilidad_ids: list[Id] = Field(default_factory=list)

    @field_validator("habilidad_ids")
    @classmethod
    def unique_skills(cls, items: list[int]) -> list[int]:
        if len(set(items)) != len(items):
            raise ValueError("Cada habilidad debe aparecer una sola vez.")
        return items


class ProjectCreate(ProjectFields):
    titulo: Title
    descripcion: Description
    fecha: date
    visible: bool = True


class ProjectUpdate(ProjectFields, Update):
    non_nullable: ClassVar[frozenset[str]] = frozenset(
        {"titulo", "descripcion", "fecha", "visible", "habilidad_ids"}
    )
    titulo: Title | None = None
    descripcion: Description | None = None
    fecha: date | None = None
    visible: bool | None = None


class ProjectRead(Schema):
    id: Id
    estudiante_id: Id
    titulo: str
    descripcion: str
    curso: str | None
    repo_url: str | None
    demo_url: str | None
    imagen_url: str | None
    fecha: date
    visible: bool
    habilidad_ids: list[Id]
