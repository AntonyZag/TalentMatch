from fastapi import APIRouter

from backend.apis.dependencies import AuthDep, CurrentUser, IdentityDep, ProfileDep
from backend.schemas.auth import AccountRead, CompanyCreate, Login, SessionRead, StudentCreate, TokenRead

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/registro/estudiante", response_model=AccountRead, status_code=201)
def register_student(data: StudentCreate, auth: AuthDep, identity: IdentityDep):
    return auth.register_student(data, identity)


@router.post("/registro/empresa", response_model=AccountRead, status_code=201)
def register_company(data: CompanyCreate, auth: AuthDep, identity: IdentityDep):
    return auth.register_company(data, identity)


@router.post("/login", response_model=TokenRead)
def login(data: Login, auth: AuthDep):
    return auth.login(data)


@router.get("/me", response_model=SessionRead)
def me(actor: CurrentUser, profiles: ProfileDep):
    profile = None
    if actor.rol == "ESTUDIANTE":
        profile = profiles.student(actor.student_id())
    elif actor.rol == "EMPRESA":
        profile = profiles.company(actor.company_id())
    return actor.public_account() | {"perfil": profile}
