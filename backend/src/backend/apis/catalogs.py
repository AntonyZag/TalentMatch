from fastapi import APIRouter

from backend.apis.dependencies import Admin, CatalogDep
from backend.schemas.common import AcademicStatus, ApplicationStatus, CatalogItem, Catalogs, ImpactMetrics, Level, Skill

catalogs = APIRouter(prefix="/api/catalogos", tags=["Catálogos"])
metrics = APIRouter(prefix="/api/metricas", tags=["Métricas"])
admin = APIRouter(prefix="/api/admin", tags=["Administración"])


@catalogs.get("", response_model=Catalogs)
def all_catalogs(repo: CatalogDep):
    return repo.all()


@catalogs.get("/{nombre}", response_model=list[Skill | AcademicStatus | ApplicationStatus | Level | CatalogItem])
def catalog(nombre: str, repo: CatalogDep):
    return repo.items(nombre)


@metrics.get("/impacto", response_model=ImpactMetrics)
@admin.get("/metricas-impacto", response_model=ImpactMetrics)
def impact(actor: Admin, repo: CatalogDep):
    return repo.impact()
