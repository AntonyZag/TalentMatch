from typing import Annotated

from fastapi import APIRouter, Query

from backend.apis.dependencies import Admin, Company, CurrentUser, HiringDep, OptionalUser, Pagination, Student
from backend.schemas.common import Id, Page
from backend.schemas.hiring import (
    ApplicantRead, ApplicationCreate, ApplicationDetails, ApplicationRead, ApplicationUpdate,
    ApplicationWithdrawal, HistoryRead, MatchRead, OwnApplicationRead, VacancyCreate,
    VacancyRead, VacancyStatusUpdate, VacancyUpdate,
)

vacancies = APIRouter(prefix="/api/vacantes", tags=["Vacantes"])
applications = APIRouter(prefix="/api/postulaciones", tags=["Postulaciones"])
student_applications = APIRouter(prefix="/api/estudiantes", tags=["Estudiantes"])
admin_applications = APIRouter(prefix="/api/admin", tags=["Administración"])


@vacancies.get("", response_model=Page[VacancyRead])
def list_vacancies(
    actor: OptionalUser,
    pagination: Pagination,
    repo: HiringDep,
    carrera_id: Annotated[Id | None, Query(alias="carreraId")] = None,
    modalidad_id: Annotated[Id | None, Query(alias="modalidadId")] = None,
    tipo_id: Annotated[Id | None, Query(alias="tipoId")] = None,
    habilidad_id: Annotated[Id | None, Query(alias="habilidadId")] = None,
    q: Annotated[str | None, Query(max_length=160)] = None,
):
    filters = dict(carrera_id=carrera_id, modalidad_id=modalidad_id, tipo_id=tipo_id,
                   habilidad_id=habilidad_id, q=q.strip() if q else None)
    return repo.vacancies(filters, *pagination, student_id=actor.estudiante_id if actor else None)


@vacancies.get("/{id}", response_model=VacancyRead)
def vacancy(id: Id, actor: OptionalUser, repo: HiringDep):
    return repo.vacancy(
        id,
        student_id=actor.estudiante_id if actor else None,
        owner_id=actor.empresa_id if actor else None,
    )


@vacancies.get("/{id}/match", response_model=MatchRead)
def match(id: Id, actor: Student, repo: HiringDep):
    row = repo.vacancy(id, student_id=actor.student_id())
    return {"match_pct": row["match_pct"]}


@vacancies.post("", response_model=VacancyRead, status_code=201)
def create_vacancy(data: VacancyCreate, actor: Company, repo: HiringDep):
    return repo.create_vacancy(actor.company_id(), data.model_dump())


@vacancies.patch("/{id}", response_model=VacancyRead)
def update_vacancy(id: Id, data: VacancyUpdate, actor: Company, repo: HiringDep):
    return repo.update_vacancy(actor.company_id(), id, data.model_dump(exclude_unset=True))


@vacancies.patch("/{id}/estado", response_model=VacancyRead)
def update_vacancy_status(id: Id, data: VacancyStatusUpdate, actor: Company, repo: HiringDep):
    return repo.update_vacancy(actor.company_id(), id, data.model_dump())


@applications.post("", response_model=ApplicationRead, status_code=201)
def apply(data: ApplicationCreate, actor: Student, repo: HiringDep):
    return repo.apply(actor.student_id(), data.vacante_id, data.proyecto_id, data.mensaje)


@vacancies.post("/{id}/postulaciones", response_model=ApplicationRead, status_code=201)
def apply_to_vacancy(id: Id, data: ApplicationDetails, actor: Student, repo: HiringDep):
    return repo.apply(actor.student_id(), id, data.proyecto_id, data.mensaje)


@applications.get("/mias", response_model=Page[OwnApplicationRead])
@student_applications.get("/me/postulaciones", response_model=Page[OwnApplicationRead])
def my_applications(actor: Student, pagination: Pagination, repo: HiringDep):
    return repo.own_applications(actor.student_id(), *pagination)


@vacancies.get("/{id}/postulaciones", response_model=Page[ApplicantRead])
def applicants(id: Id, actor: Company, pagination: Pagination, repo: HiringDep):
    return repo.applicants(id, actor.company_id(), *pagination)


@applications.get("/{id}/historial", response_model=list[HistoryRead])
def history(id: Id, actor: CurrentUser, repo: HiringDep):
    return repo.history(id, student_id=actor.estudiante_id, company_id=actor.empresa_id,
                        admin=actor.rol == "ADMIN")


@applications.patch("/{id}/estado", response_model=ApplicationRead)
def update_application(id: Id, data: ApplicationUpdate, actor: Company, repo: HiringDep):
    return repo.set_application_status(id, data.estado_id, actor.id, data.nota)


@admin_applications.patch("/postulaciones/{id}/estado", response_model=ApplicationRead)
def admin_update(id: Id, data: ApplicationUpdate, actor: Admin, repo: HiringDep):
    return repo.set_application_status(id, data.estado_id, actor.id, data.nota)


@applications.post("/{id}/retiro", response_model=ApplicationRead)
def withdraw(id: Id, actor: Student, repo: HiringDep, data: ApplicationWithdrawal | None = None):
    return repo.set_application_status(id, None, actor.id, data.nota if data else None)
