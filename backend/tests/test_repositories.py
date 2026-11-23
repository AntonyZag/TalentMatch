from unittest.mock import MagicMock

import pytest

from backend.repositories.auth import PostgresAuthRepository
from backend.repositories.catalogs import PostgresCatalogRepository
from backend.repositories.hiring import PostgresHiringRepository
from backend.repositories.profiles import PostgresProfileRepository
from backend.services.errors import BadRequest, Forbidden


@pytest.fixture
def postgres():
    pool = MagicMock()
    transaction = pool.connection.return_value
    connection = transaction.__enter__.return_value
    cursor = connection.cursor.return_value.__enter__.return_value
    return pool, transaction, cursor


def test_register_student_uses_one_transaction_and_parameterized_inserts(postgres):
    pool, transaction, cur = postgres
    cur.fetchone.side_effect = [
        {"duplicated": False}, {"pide_ciclo": True}, {"id": 1}, {"id": 10}, {"id": 20}
    ]
    profile = {
        "dni": "01234567", "nombres": "Ana", "apellido_pat": "Díaz",
        "dni_validado": True, "carrera_id": 1, "estado_academico_id": 2, "ciclo": 3,
    }
    result = PostgresAuthRepository(pool).register("ESTUDIANTE", "a@example.test", "hash", profile)
    assert result == {"id": 10, "correo": "a@example.test", "rol": "ESTUDIANTE"}
    _, _, _, account, student = [call.args for call in cur.execute.call_args_list]
    assert 'INSERT INTO public."usuarios"' in account[0].as_string()
    assert account[1] == (1, "a@example.test", "hash")
    assert 'INSERT INTO public."estudiantes"' in student[0].as_string()
    assert student[1] == (10, *profile.values())
    pool.connection.assert_called_once_with()
    transaction.__exit__.assert_called_once_with(None, None, None)


def test_registration_requires_cycle_before_inserting(postgres):
    pool, transaction, cur = postgres
    cur.fetchone.side_effect = [{"duplicated": False}, {"pide_ciclo": True}]
    with pytest.raises(BadRequest, match="requiere indicar el ciclo"):
        PostgresAuthRepository(pool).register(
            "ESTUDIANTE", "a@example.test", "hash",
            {"dni": "01234567", "estado_academico_id": 1, "ciclo": None},
        )
    assert cur.execute.call_count == 2
    assert transaction.__exit__.call_args.args[0] is BadRequest


def test_required_routines_are_called_with_parameters(postgres):
    pool, _, cur = postgres
    repo = PostgresHiringRepository(pool)

    cur.fetchone.side_effect = [{"match_pct": 75}]
    assert repo.vacancy(5, student_id=20) == {"match_pct": 75}
    sql, params = cur.execute.call_args.args
    assert "public.fn_calcular_match(%s, v.id)" in sql
    assert params == (20, 20, 5, None)

    cur.fetchone.side_effect = [{"exists": 1}, {"id": 6}, {"id": 6}]
    repo.apply(20, 5, None, "mensaje")
    assert cur.execute.call_args_list[-2].args == (
        "SELECT public.fn_registrar_postulacion(%s, %s, %s, %s) AS id",
        (20, 5, None, "mensaje"),
    )

    cur.fetchone.side_effect = [{"exists": 1}, {"exists": 1}, {"id": 6}]
    repo.set_application_status(6, 4, 10, "nota")
    assert cur.execute.call_args_list[-2].args == (
        "CALL public.sp_cambiar_estado_postulacion(%s, %s, %s, %s)",
        (6, 4, 10, "nota"),
    )

    cur.fetchone.side_effect = [{"proyectos": 1}]
    assert PostgresCatalogRepository(pool).impact() == {"proyectos": 1}
    cur.execute.assert_called_with("SELECT * FROM public.fn_metricas_impacto()")


def test_vacancy_and_project_ownership_checked_before_writes(postgres):
    pool, _, cur = postgres
    cur.fetchone.side_effect = [{"empresa_id": 2}, {"estudiante_id": 3}]
    with pytest.raises(Forbidden):
        PostgresHiringRepository(pool).update_vacancy(1, 5, {"titulo": "Otro"})
    with pytest.raises(Forbidden):
        PostgresProfileRepository(pool).update_project(1, 5, {"titulo": "Otro"})
    assert cur.execute.call_count == 2
    assert all("FOR UPDATE" in call.args[0] for call in cur.execute.call_args_list)
