from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import Field, field_validator

from backend.schemas.common import Id, Schema, Update
from backend.schemas.profiles import Description, ProjectRead, StudentSkill, Title

Salary = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]
Slots = Annotated[int, Field(ge=0, le=32767)]


class VacancySkill(Schema):
    habilidad_id: Id
    nivel_min_id: Id
    obligatoria: bool = True


class VacancyFields(Schema):
    carrera_id: Id | None = None
    ubicacion: Annotated[str, Field(max_length=160)] | None = None
    sueldo: Salary | None = None
    habilidades: list[VacancySkill] = Field(default_factory=list)

    @field_validator("habilidades")
    @classmethod
    def unique_skills(cls, items: list[VacancySkill]) -> list[VacancySkill]:
        if len({item.habilidad_id for item in items}) != len(items):
            raise ValueError("Cada habilidad debe aparecer una sola vez.")
        return items


class VacancyCreate(VacancyFields):
    tipo_id: Id
    modalidad_id: Id
    estado_id: Id | None = None
    titulo: Title
    descripcion: Description
    cupos: Slots
    fecha_cierre: date


class VacancyUpdate(VacancyFields, Update):
    non_nullable = frozenset(
        {"tipo_id", "modalidad_id", "estado_id", "titulo", "descripcion", "cupos",
         "fecha_cierre", "habilidades"}
    )
    tipo_id: Id | None = None
    modalidad_id: Id | None = None
    estado_id: Id | None = None
    titulo: Title | None = None
    descripcion: Description | None = None
    cupos: Slots | None = None
    fecha_cierre: date | None = None


class VacancyStatusUpdate(Schema):
    estado_id: Id


class MatchRead(Schema):
    match_pct: float


class VacancyRead(Schema):
    id: Id
    empresa_id: Id
    empresa: str
    tipo_id: Id
    modalidad_id: Id
    estado_id: Id
    estado: str
    carrera_id: Id | None
    titulo: str
    descripcion: str
    ubicacion: str | None
    sueldo: float | None
    cupos: Slots
    fecha_cierre: date
    creado_en: datetime
    habilidades: list[VacancySkill]
    match_pct: float | None = None


class ApplicationDetails(Schema):
    proyecto_id: Id | None = None
    mensaje: Annotated[str, Field(max_length=4000)] | None = None


class ApplicationCreate(ApplicationDetails):
    vacante_id: Id


class ApplicationUpdate(Schema):
    estado_id: Id
    nota: Annotated[str, Field(max_length=4000)] | None = None


class ApplicationWithdrawal(Schema):
    nota: Annotated[str, Field(max_length=4000)] | None = None


class HistoryRead(Schema):
    id: Id
    postulacion_id: Id
    estado_anterior_id: Id | None
    estado_nuevo_id: Id
    usuario_id: Id
    nota: str | None
    fecha: datetime


class ApplicationRead(Schema):
    id: Id
    vacante_id: Id
    estudiante_id: Id
    estado_id: Id
    estado: str
    proyecto_id: Id | None
    mensaje: str | None
    match_pct: float
    creado_en: datetime


class OwnApplicationRead(ApplicationRead):
    vacante: str
    historial: list[HistoryRead]


class ApplicantRead(ApplicationRead):
    nombres: str
    apellido_pat: str
    apellido_mat: str | None
    habilidades: list[StudentSkill]
    proyectos: list[ProjectRead]
