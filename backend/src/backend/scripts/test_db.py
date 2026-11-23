"""Diagnóstico de solo lectura para el PostgreSQL configurado en backend/.env."""

from psycopg import Error, connect
from psycopg.rows import dict_row

from backend.config import get_settings
from backend.database import DB_TIMEOUT

TABLES = (
    "roles", "usuarios", "carreras", "estados_academicos", "sectores", "modalidades",
    "tipos_vacante", "estados_vacante", "estados_postulacion", "categorias_habilidad",
    "habilidades", "niveles", "estudiantes", "empresas", "proyectos", "vacantes",
    "estudiante_habilidad", "proyecto_habilidad", "vacante_habilidad", "postulaciones",
    "historial_postulacion",
)
ROUTINES = {
    "public.fn_calcular_match(integer,integer)": "f",
    "public.fn_registrar_postulacion(integer,integer,integer,text)": "f",
    "public.sp_cambiar_estado_postulacion(integer,integer,integer,text)": "p",
    "public.fn_metricas_impacto()": "f",
}
CATEGORIES = {
    "Desarrollo de software": 1, "Datos y analítica": 2, "Contabilidad y finanzas": 5
}


def main() -> int:
    database_url = get_settings().database_url
    if database_url is None:
        print("No se configuró DATABASE_URL.")
        return 1
    try:
        with connect(database_url.get_secret_value(), connect_timeout=DB_TIMEOUT) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                cur.execute("SHOW server_version")
                print("PostgreSQL:", cur.fetchone()["server_version"])
                cur.execute(
                    """
                    SELECT tablename FROM pg_catalog.pg_tables
                    WHERE schemaname = 'public' AND tablename = ANY(%s)
                    """,
                    (list(TABLES),),
                )
                missing_tables = set(TABLES) - {row["tablename"] for row in cur.fetchall()}
                print(f"Tablas de TalentMatch: {len(TABLES) - len(missing_tables)}/{len(TABLES)}")
                cur.execute(
                    """
                    SELECT r.signature, p.prokind
                    FROM unnest(%s::text[]) AS r(signature)
                    JOIN pg_catalog.pg_proc p ON p.oid = pg_catalog.to_regprocedure(r.signature)
                    JOIN pg_catalog.pg_language l ON l.oid = p.prolang AND l.lanname = 'plpgsql'
                    WHERE pg_catalog.has_function_privilege(p.oid, 'EXECUTE')
                    """,
                    (list(ROUTINES),),
                )
                actual = {row["signature"]: row["prokind"] for row in cur.fetchall()}
                missing_routines = {key for key, kind in ROUTINES.items() if actual.get(key) != kind}
                print(f"Rutinas PL/pgSQL ejecutables: {len(ROUTINES) - len(missing_routines)}/{len(ROUTINES)}")
                if missing_tables:
                    print("Tablas faltantes:", ", ".join(sorted(missing_tables)))
                if missing_routines:
                    print("Rutinas faltantes o sin permiso:", ", ".join(sorted(missing_routines)))
                if "categorias_habilidad" not in missing_tables:
                    cur.execute(
                        "SELECT id, nombre FROM public.categorias_habilidad WHERE nombre = ANY(%s)",
                        (list(CATEGORIES),),
                    )
                    ids = {row["nombre"]: row["id"] for row in cur.fetchall()}
                    print("Categorías del seed extra:", ", ".join(
                        f"{name}={ids.get(name, 'ausente')}" for name in CATEGORIES
                    ))
                return int(bool(missing_tables or missing_routines))
    except Error as exc:
        print(f"No se pudo completar el diagnóstico ({type(exc).__name__}, SQLSTATE {exc.sqlstate or 'N/D'}).")
        print("Revisa el Session Pooler, las credenciales, la conectividad y los permisos.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
