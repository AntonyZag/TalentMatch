from fastapi import APIRouter, Response

from backend.apis.dependencies import Company, HiringDep, Pagination, ProfileDep, Student
from backend.schemas.common import Id, Page
from backend.schemas.hiring import VacancyRead
from backend.schemas.profiles import (
    CompanyRead, CompanyUpdate, ProjectCreate, ProjectRead, ProjectUpdate,
    StudentRead, StudentSkill, StudentSkillsUpdate, StudentUpdate,
)

students = APIRouter(prefix="/api/estudiantes", tags=["Estudiantes"])
projects = APIRouter(prefix="/api/proyectos", tags=["Proyectos"])
companies = APIRouter(prefix="/api/empresas", tags=["Empresas"])


@students.get("/me", response_model=StudentRead)
def student_profile(actor: Student, repo: ProfileDep):
    return repo.student(actor.student_id())


@students.patch("/me", response_model=StudentRead)
def update_student(data: StudentUpdate, actor: Student, repo: ProfileDep):
    return repo.update_student(actor.student_id(), data.model_dump(exclude_unset=True, mode="json"))


@students.get("/me/habilidades", response_model=list[StudentSkill])
def student_skills(actor: Student, repo: ProfileDep):
    return repo.student(actor.student_id())["habilidades"]


@students.put("/me/habilidades", response_model=list[StudentSkill])
def replace_skills(data: StudentSkillsUpdate, actor: Student, repo: ProfileDep):
    return repo.replace_student_skills(
        actor.student_id(), [skill.model_dump() for skill in data.habilidades]
    )


@students.get("/{id}/portafolio", response_model=Page[ProjectRead])
def portfolio(id: Id, pagination: Pagination, repo: ProfileDep):
    return repo.projects(id, *pagination, public=True)


@companies.get("/me", response_model=CompanyRead)
def company_profile(actor: Company, repo: ProfileDep):
    return repo.company(actor.company_id())


@companies.patch("/me", response_model=CompanyRead)
def update_company(data: CompanyUpdate, actor: Company, repo: ProfileDep):
    return repo.update_company(actor.company_id(), data.model_dump(exclude_unset=True, mode="json"))


@companies.get("/me/vacantes", response_model=Page[VacancyRead])
def company_vacancies(actor: Company, pagination: Pagination, repo: HiringDep):
    return repo.vacancies({}, *pagination, owner_id=actor.company_id())


@projects.get("", response_model=Page[ProjectRead])
def my_projects(actor: Student, pagination: Pagination, repo: ProfileDep):
    return repo.projects(actor.student_id(), *pagination)


def project_fields(data: ProjectCreate | ProjectUpdate, *, partial: bool = False) -> dict:
    fields = data.model_dump(exclude_unset=partial)
    for key in ("repo_url", "demo_url", "imagen_url"):
        if fields.get(key) is not None:
            fields[key] = str(fields[key])
    return fields


@projects.post("", response_model=ProjectRead, status_code=201)
def create_project(data: ProjectCreate, actor: Student, repo: ProfileDep):
    return repo.create_project(actor.student_id(), project_fields(data))


@projects.get("/{id}", response_model=ProjectRead)
def project(id: Id, actor: Student, repo: ProfileDep):
    return repo.project(actor.student_id(), id)


@projects.patch("/{id}", response_model=ProjectRead)
def update_project(id: Id, data: ProjectUpdate, actor: Student, repo: ProfileDep):
    return repo.update_project(actor.student_id(), id, project_fields(data, partial=True))


@projects.delete("/{id}", status_code=204)
def delete_project(id: Id, actor: Student, repo: ProfileDep):
    repo.delete_project(actor.student_id(), id)
    return Response(status_code=204)
