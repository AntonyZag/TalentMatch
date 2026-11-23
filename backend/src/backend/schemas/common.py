from typing import Annotated, ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

Id = Annotated[int, Field(gt=0, le=2_147_483_647)]
Role = Literal["ESTUDIANTE", "EMPRESA", "ADMIN"]
Dni = Annotated[str, Field(strict=True, pattern=r"^[0-9]{8}$")]
Ruc = Annotated[str, Field(strict=True, pattern=r"^[0-9]{11}$")]
Phone = Annotated[str, Field(max_length=25)]


class Schema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


class Update(Schema):
    non_nullable: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="after")
    def check_patch(self):
        if not self.model_fields_set:
            raise ValueError("Envía al menos un campo para actualizar.")
        for field in self.model_fields_set & self.non_nullable:
            if getattr(self, field) is None:
                raise ValueError(f"{to_camel(field)} no admite null.")
        return self


class Page[T](Schema):
    items: list[T]
    pagina: int
    tamano: int
    total: int


class CatalogItem(Schema):
    id: Id
    nombre: str


class AcademicStatus(CatalogItem):
    pide_ciclo: bool


class Skill(CatalogItem):
    categoria_id: Id


class Level(CatalogItem):
    peso: int


class ApplicationStatus(CatalogItem):
    orden: int


class Catalogs(Schema):
    carreras: list[CatalogItem]
    modalidades: list[CatalogItem]
    sectores: list[CatalogItem]
    estados_academicos: list[AcademicStatus]
    niveles: list[Level]
    categorias_habilidad: list[CatalogItem]
    habilidades: list[Skill]
    tipos_vacante: list[CatalogItem]
    estados_vacante: list[CatalogItem]
    estados_postulacion: list[ApplicationStatus]


class ImpactMetrics(Schema):
    estudiantes_verificados: int
    empresas_verificadas: int
    proyectos: int
    vacantes_abiertas: int
    estudiantes_aceptados: int
