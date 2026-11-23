from fastapi import APIRouter

from backend.apis.dependencies import IdentityDep
from backend.schemas.auth import DniRead, RucRead

router = APIRouter(prefix="/api/integraciones", tags=["APISPERU"])


@router.get("/dni/{dni}", response_model=DniRead)
def dni(dni: str, provider: IdentityDep):
    return provider.dni(dni)


@router.get("/ruc/{ruc}", response_model=RucRead)
def ruc(ruc: str, provider: IdentityDep):
    return provider.ruc(ruc)
