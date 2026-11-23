from datetime import date

import psycopg

from backend.repositories.common import page
from backend.services.errors import Forbidden, NotFound


def test_student_skills_and_profile(client, repos, tokens):
    auth = tokens["ESTUDIANTE"]
    repo = repos["profile"]
    repo.update_student.return_value = {
        "id": 11, "dni": "01234567", "nombres": "Ana", "apellido_pat": "Díaz", "apellido_mat": None,
        "dni_validado": True, "carrera_id": 1, "estado_academico_id": 1, "ciclo": 2,
        "anio_egreso": None, "telefono": None, "bio": "Perfil", "github_url": None,
        "linkedin_url": None, "habilidades": [],
    }
    profile = client.patch("/api/estudiantes/me", headers=auth, json={"bio": "Perfil"})
    assert profile.status_code == 200
    assert profile.json()["dniValidado"] is True
    repo.update_student.assert_called_once_with(11, {"bio": "Perfil"})
    repo.replace_student_skills.return_value = [{"habilidad_id": 2, "nivel_id": 3}]
    payload = {"habilidades": [{"habilidadId": 2, "nivelId": 3}]}
    assert client.put("/api/estudiantes/me/habilidades", headers=auth, json=payload).json() == payload["habilidades"]
    repo.replace_student_skills.assert_called_once_with(11, [{"habilidad_id": 2, "nivel_id": 3}])
    assert client.put("/api/estudiantes/me/habilidades", headers=auth, json={
        "habilidades": payload["habilidades"] * 2,
    }).status_code == 422


def test_project_crud_links_aliases_and_owner(client, repos, tokens):
    auth = tokens["ESTUDIANTE"]
    repo = repos["profile"]
    row = dict(
        id=30, estudiante_id=11, titulo="Portafolio", descripcion="Demo", curso=None,
        repo_url="https://drive.google.com/example", demo_url=None, imagen_url=None,
        fecha=date(2026, 11, 23), visible=True, habilidad_ids=[3],
    )
    repo.create_project.return_value = repo.project.return_value = row
    repo.update_project.return_value = row | {"visible": False}
    repo.projects.return_value = page([row], 1, 1, 20)
    payload = {
        "titulo": "Portafolio", "descripcion": "Demo", "repoUrl": row["repo_url"],
        "fecha": "2026-11-23", "habilidadIds": [3],
    }

    response = client.post("/api/proyectos", headers=auth, json=payload)
    assert response.status_code == 201 and response.json()["habilidadIds"] == [3]
    student_id, data = repo.create_project.call_args.args
    assert student_id == 11 and data["fecha"] == row["fecha"] and data["repo_url"] == row["repo_url"]
    assert client.get("/api/proyectos/30", headers=auth).json()["id"] == 30
    assert client.get("/api/proyectos", headers=auth).json()["total"] == 1
    assert client.get("/api/estudiantes/11/portafolio").json()["total"] == 1
    repo.projects.assert_called_with(11, 1, 20, public=True)

    assert client.patch("/api/proyectos/30", headers=auth, json={"visible": False}).json()["visible"] is False
    repo.update_project.assert_called_once_with(11, 30, {"visible": False})
    assert client.patch("/api/proyectos/30", headers=auth, json={"titulo": None}).status_code == 422
    assert client.post("/api/proyectos", headers=auth, json=payload | {"repoUrl": "javascript:foo"}).status_code == 422
    assert client.delete("/api/proyectos/30", headers=auth).status_code == 204
    repo.delete_project.assert_called_once_with(11, 30)
    repo.project.side_effect = Forbidden("El proyecto pertenece a otro estudiante.")
    assert client.get("/api/proyectos/30", headers=auth).status_code == 403
    assert client.get("/api/proyectos", headers=tokens["EMPRESA"]).status_code == 403


def vacancy(now):
    return dict(
        id=5, empresa_id=22, empresa="Empresa", tipo_id=1, modalidad_id=1, estado_id=1,
        estado="Abierta", carrera_id=3, titulo="Asistente", descripcion="Convocatoria",
        ubicacion=None, sueldo=None, cupos=1, fecha_cierre=date(2026, 11, 25),
        creado_en=now, habilidades=[{"habilidad_id": 2, "nivel_min_id": 3, "obligatoria": True}],
    )


def test_vacancy_filters_and_student_match(client, repos, tokens, now):
    repo = repos["hiring"]
    row = vacancy(now)
    repo.vacancies.return_value = page([row], 1, 2, 5)
    result = client.get("/api/vacantes?carreraId=3&modalidadId=1&tipoId=1&habilidadId=2&q=Asistente&pagina=2&tamano=5")
    assert result.status_code == 200
    assert result.json()["items"][0]["habilidades"][0]["nivelMinId"] == 3
    repo.vacancies.assert_called_once_with(
        dict(carrera_id=3, modalidad_id=1, tipo_id=1, habilidad_id=2, q="Asistente"),
        2, 5, student_id=None,
    )
    repo.vacancy.return_value = row | {"match_pct": 66.67}
    viewer = tokens["ESTUDIANTE"]
    assert client.get("/api/vacantes/5", headers=viewer).json()["matchPct"] == 66.67
    repo.vacancy.assert_called_with(5, student_id=11, owner_id=None)
    assert client.get("/api/vacantes/5/match", headers=viewer).json() == {"matchPct": 66.67}
    assert client.get("/api/vacantes/5/match").status_code == 401
    assert client.get("/api/vacantes/0").status_code == 422


def test_company_vacancy_writes(client, repos, tokens, now):
    repo = repos["hiring"]
    row = vacancy(now)
    repo.create_vacancy.return_value = row
    repo.update_vacancy.return_value = row | {"estado_id": 3, "estado": "Cerrada"}
    payload = {
        "tipoId": 1, "modalidadId": 1, "carreraId": 3, "titulo": "Asistente",
        "descripcion": "Convocatoria", "cupos": 1, "fechaCierre": "2026-11-25",
        "habilidades": [{"habilidadId": 2, "nivelMinId": 3}],
    }
    assert client.post("/api/vacantes", headers=tokens["ESTUDIANTE"], json=payload).status_code == 403
    company = tokens["EMPRESA"]
    assert client.post("/api/vacantes", headers=company, json=payload).status_code == 201
    assert repo.create_vacancy.call_args.args[0] == 22
    assert client.patch("/api/vacantes/5/estado", headers=company, json={"estadoId": 3}).json()["estado"] == "Cerrada"
    repo.update_vacancy.assert_called_once_with(22, 5, {"estado_id": 3})
    repo.update_vacancy.side_effect = Forbidden("La vacante pertenece a otra empresa.")
    assert client.patch("/api/vacantes/5", headers=company, json={"cupos": 2}).status_code == 403


def test_applications_roles_conflicts_and_history(client, repos, tokens, now):
    repo = repos["hiring"]
    row = dict(
        id=9, vacante_id=5, estudiante_id=11, estado_id=1, estado="Pendiente",
        proyecto_id=None, mensaje="Hola", match_pct=82.3, creado_en=now,
    )
    student = tokens["ESTUDIANTE"]
    company = tokens["EMPRESA"]
    repo.apply.return_value = row
    repo.history.return_value = [dict(
        id=17, postulacion_id=9, estado_anterior_id=None, estado_nuevo_id=1,
        usuario_id=1, nota=None, fecha=now,
    )]
    repo.own_applications.return_value = page(
        [row | {"vacante": "Asistente", "historial": repo.history.return_value}], 1, 1, 20
    )
    repo.applicants.return_value = page(
        [row | dict(nombres="Ana", apellido_pat="Díaz", apellido_mat=None, habilidades=[], proyectos=[])],
        1, 1, 20,
    )
    repo.set_application_status.return_value = row | {"estado_id": 4, "estado": "Aceptada"}

    response = client.post("/api/postulaciones", headers=student, json={"vacanteId": 5, "mensaje": "Hola"})
    assert response.status_code == 201 and response.json()["matchPct"] == 82.3
    repo.apply.assert_called_once_with(11, 5, None, "Hola")
    repo.apply.side_effect = psycopg.errors.UniqueViolation("Private duplicate detail")
    duplicate = client.post("/api/postulaciones", headers=student, json={"vacanteId": 5})
    assert duplicate.status_code == 409 and "Private" not in duplicate.text
    assert client.post("/api/postulaciones", headers=company, json={"vacanteId": 5}).status_code == 403
    assert client.get("/api/postulaciones/mias", headers=student).json()["items"][0]["historial"][0]["id"] == 17
    assert client.get("/api/postulaciones/9/historial", headers=student).json()[0]["estadoNuevoId"] == 1
    assert client.get("/api/vacantes/5/postulaciones", headers=company).json()["items"][0]["nombres"] == "Ana"
    repo.applicants.assert_called_once_with(5, 22, 1, 20)
    assert client.get("/api/vacantes/5/postulaciones", headers=student).status_code == 403
    assert client.patch("/api/postulaciones/9/estado", headers=student, json={"estadoId": 4}).status_code == 403
    assert client.patch("/api/postulaciones/9/estado", headers=company, json={"estadoId": 4}).json()["estado"] == "Aceptada"
    repo.set_application_status.assert_called_once_with(9, 4, 2, None)
    assert client.post("/api/postulaciones/9/retiro", headers=student).status_code == 200
    repo.set_application_status.assert_called_with(9, None, 1, None)


def test_public_catalog_and_admin_metrics(client, repos, tokens):
    repo = repos["catalog"]
    repo.items.return_value = [{"id": 1, "nombre": "Básico", "peso": 1}]
    assert client.get("/api/catalogos/niveles").json() == repo.items.return_value
    repo.items.side_effect = NotFound("Catálogo no encontrado.")
    assert client.get("/api/catalogos/usuarios").status_code == 404
    repo.impact.return_value = dict(
        estudiantes_verificados=2, empresas_verificadas=1, proyectos=4,
        vacantes_abiertas=3, estudiantes_aceptados=1,
    )
    assert client.get("/api/metricas/impacto").status_code == 401
    assert client.get("/api/metricas/impacto", headers=tokens["EMPRESA"]).status_code == 403
    assert client.get("/api/metricas/impacto", headers=tokens["ADMIN"]).json()["estudiantesAceptados"] == 1
    repo.impact.assert_called_once_with()
