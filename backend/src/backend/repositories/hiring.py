from typing import Protocol

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.repositories.common import Row, found, insert, page, project_fields, update
from backend.services.errors import BadRequest, Forbidden, NotFound, TemporarilyUnavailable

_VACANCY_FROM = """
    FROM public.vacantes v
    JOIN public.estados_vacante ev ON ev.id = v.estado_id
    JOIN public.empresas e ON e.id = v.empresa_id
    JOIN public.usuarios u ON u.id = e.usuario_id
"""
_PUBLIC = """
    ev.nombre = 'Abierta' AND v.cupos > 0 AND u.activo
    AND v.fecha_cierre >= (statement_timestamp() AT TIME ZONE 'America/Lima')::date
"""
_VACANCY_FIELDS = """
    SELECT v.*, COALESCE(NULLIF(e.nombre_comercial, ''), e.razon_social) AS empresa,
           ev.nombre AS estado,
           CASE WHEN %s::integer IS NOT NULL THEN public.fn_calcular_match(%s, v.id) END AS match_pct,
           COALESCE((
               SELECT jsonb_agg(to_jsonb(h) - 'vacante_id' ORDER BY h.habilidad_id)
               FROM public.vacante_habilidad h WHERE h.vacante_id = v.id
           ), '[]'::jsonb) AS habilidades
"""
_APP_FROM = """
    FROM public.postulaciones a
    JOIN public.estados_postulacion ep ON ep.id = a.estado_id
    JOIN public.vacantes v ON v.id = a.vacante_id
"""
_APP_FIELDS = "a.*, ep.nombre AS estado"
_APPLICANT_PROJECTS = project_fields("p")


class HiringRepository(Protocol):
    def vacancies(self, filters: Row, pagina: int, tamano: int, *,
                  student_id: int | None = None, owner_id: int | None = None) -> Row: ...
    def vacancy(self, vacancy_id: int, *, student_id: int | None = None,
                owner_id: int | None = None) -> Row: ...
    def create_vacancy(self, company_id: int, fields: Row) -> Row: ...
    def update_vacancy(self, company_id: int, vacancy_id: int, changes: Row) -> Row: ...
    def apply(self, student_id: int, vacancy_id: int, project_id: int | None,
              message: str | None) -> Row: ...
    def own_applications(self, student_id: int, pagina: int, tamano: int) -> Row: ...
    def applicants(self, vacancy_id: int, company_id: int, pagina: int, tamano: int) -> Row: ...
    def history(self, application_id: int, *, student_id: int | None,
                company_id: int | None, admin: bool) -> list[Row]: ...
    def set_application_status(self, application_id: int, state_id: int | None,
                               account_id: int, note: str | None) -> Row: ...


class PostgresHiringRepository:
    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    def vacancies(self, filters: Row, pagina: int, tamano: int, *,
                  student_id: int | None = None, owner_id: int | None = None) -> Row:
        predicates = [_PUBLIC] if owner_id is None else ["v.empresa_id = %s"]
        params = [] if owner_id is None else [owner_id]
        for column in ("carrera_id", "modalidad_id", "tipo_id"):
            if filters.get(column) is not None:
                predicates.append(f"v.{column} = %s")
                params.append(filters[column])

        if filters.get("habilidad_id") is not None:
            predicates.append("""
                EXISTS (SELECT 1 FROM public.vacante_habilidad vh
                        WHERE vh.vacante_id = v.id AND vh.habilidad_id = %s)
            """)
            params.append(filters["habilidad_id"])
        if text := filters.get("q"):
            predicates.append(
                "(strpos(lower(v.titulo), lower(%s)) > 0 OR strpos(lower(v.descripcion), lower(%s)) > 0)"
            )
            params.extend((text, text))

        where = " WHERE " + " AND ".join(predicates)
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT count(*) AS total" + _VACANCY_FROM + where, params)
            total = cur.fetchone()["total"]
            cur.execute(
                _VACANCY_FIELDS + _VACANCY_FROM + where
                + " ORDER BY v.creado_en DESC, v.id DESC LIMIT %s OFFSET %s",
                (student_id, student_id, *params, tamano, (pagina - 1) * tamano),
            )
            return page(cur.fetchall(), total, pagina, tamano)

    @staticmethod
    def _vacancy(cur, vacancy_id: int, student_id: int | None, owner_id: int | None) -> Row:
        cur.execute(
            _VACANCY_FIELDS + _VACANCY_FROM
            + " WHERE v.id = %s AND (v.empresa_id = %s OR (" + _PUBLIC + "))",
            (student_id, student_id, vacancy_id, owner_id),
        )
        return found(cur.fetchone(), "Vacante no encontrada.")

    def vacancy(self, vacancy_id: int, *, student_id: int | None = None,
                owner_id: int | None = None) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            return self._vacancy(cur, vacancy_id, student_id, owner_id)

    @staticmethod
    def _owned_vacancy(cur, company_id: int, vacancy_id: int, *, lock: bool) -> None:
        query = "SELECT empresa_id FROM public.vacantes WHERE id = %s"
        cur.execute(query + (" FOR UPDATE" if lock else ""), (vacancy_id,))
        row = found(cur.fetchone(), "Vacante no encontrada.")
        if row["empresa_id"] != company_id:
            raise Forbidden("La vacante pertenece a otra empresa.")

    @staticmethod
    def _replace_vacancy_skills(cur, vacancy_id: int, skills: list[Row]) -> None:
        cur.execute("DELETE FROM public.vacante_habilidad WHERE vacante_id = %s", (vacancy_id,))
        cur.executemany(
            """
            INSERT INTO public.vacante_habilidad (vacante_id, habilidad_id, nivel_min_id, obligatoria)
            VALUES (%s, %s, %s, %s)
            """,
            [(vacancy_id, h["habilidad_id"], h["nivel_min_id"], h["obligatoria"]) for h in skills],
        )

    def create_vacancy(self, company_id: int, fields: Row) -> Row:
        data = fields.copy()
        skills = data.pop("habilidades")
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            if data["estado_id"] is None:
                cur.execute("SELECT id FROM public.estados_vacante WHERE nombre = %s", ("Abierta",))
                state = cur.fetchone()
                if state is None:
                    raise TemporarilyUnavailable("El catálogo de estados de vacante no está disponible.")
                data["estado_id"] = state["id"]
            vacancy_id = insert(cur, "vacantes", dict(empresa_id=company_id, **data))
            self._replace_vacancy_skills(cur, vacancy_id, skills)
            return self._vacancy(cur, vacancy_id, None, company_id)

    def update_vacancy(self, company_id: int, vacancy_id: int, changes: Row) -> Row:
        fields = changes.copy()
        skills = fields.pop("habilidades", None)
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            self._owned_vacancy(cur, company_id, vacancy_id, lock=True)
            update(cur, "vacantes", vacancy_id, fields)
            if skills is not None:
                self._replace_vacancy_skills(cur, vacancy_id, skills)
            return self._vacancy(cur, vacancy_id, None, company_id)

    @staticmethod
    def _application(cur, application_id: int) -> Row:
        cur.execute(
            "SELECT " + _APP_FIELDS + _APP_FROM + " WHERE a.id = %s",
            (application_id,),
        )
        return found(cur.fetchone(), "Postulación no encontrada.")

    def apply(self, student_id: int, vacancy_id: int, project_id: int | None,
              message: str | None) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT 1 FROM public.vacantes WHERE id = %s", (vacancy_id,))
            if cur.fetchone() is None:
                raise NotFound("Vacante no encontrada.")

            cur.execute(
                "SELECT public.fn_registrar_postulacion(%s, %s, %s, %s) AS id",
                (student_id, vacancy_id, project_id, message),
            )
            return self._application(cur, cur.fetchone()["id"])

    def own_applications(self, student_id: int, pagina: int, tamano: int) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT count(*) AS total FROM public.postulaciones WHERE estudiante_id = %s",
                (student_id,),
            )
            total = cur.fetchone()["total"]
            cur.execute(
                "SELECT " + _APP_FIELDS + """, v.titulo AS vacante,
                    COALESCE((
                        SELECT jsonb_agg(to_jsonb(h) ORDER BY h.fecha, h.id)
                        FROM public.historial_postulacion h WHERE h.postulacion_id = a.id
                    ), '[]'::jsonb) AS historial
                """ + _APP_FROM + """
                WHERE a.estudiante_id = %s ORDER BY a.creado_en DESC, a.id DESC LIMIT %s OFFSET %s
                """,
                (student_id, tamano, (pagina - 1) * tamano),
            )
            return page(cur.fetchall(), total, pagina, tamano)

    def applicants(self, vacancy_id: int, company_id: int, pagina: int, tamano: int) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            self._owned_vacancy(cur, company_id, vacancy_id, lock=False)
            cur.execute(
                "SELECT count(*) AS total FROM public.postulaciones WHERE vacante_id = %s",
                (vacancy_id,),
            )
            total = cur.fetchone()["total"]
            cur.execute(
                f"""
                SELECT a.id, a.vacante_id, a.estudiante_id, a.estado_id, a.mensaje,
                       a.match_pct, a.creado_en, ep.nombre AS estado,
                       s.nombres, s.apellido_pat, s.apellido_mat,
                       (SELECT p.id FROM public.proyectos p
                        WHERE p.id = a.proyecto_id AND p.visible) AS proyecto_id,
                       COALESCE((
                           SELECT jsonb_agg(to_jsonb(h) - 'estudiante_id' ORDER BY h.habilidad_id)
                           FROM public.estudiante_habilidad h WHERE h.estudiante_id = s.id
                       ), '[]'::jsonb) AS habilidades,
                       COALESCE((
                           SELECT jsonb_agg(to_jsonb(project) ORDER BY project.fecha DESC, project.id DESC)
                           FROM (SELECT {_APPLICANT_PROJECTS} FROM public.proyectos p
                                 WHERE p.estudiante_id = s.id AND p.visible) AS project
                       ), '[]'::jsonb) AS proyectos
                """ + _APP_FROM + """
                JOIN public.estudiantes s ON s.id = a.estudiante_id
                WHERE a.vacante_id = %s AND v.empresa_id = %s
                ORDER BY a.match_pct DESC, a.creado_en, a.id LIMIT %s OFFSET %s
                """,
                (vacancy_id, company_id, tamano, (pagina - 1) * tamano),
            )
            return page(cur.fetchall(), total, pagina, tamano)

    def history(self, application_id: int, *, student_id: int | None,
                company_id: int | None, admin: bool) -> list[Row]:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT a.estudiante_id, v.empresa_id" + _APP_FROM + " WHERE a.id = %s",
                (application_id,),
            )
            row = found(cur.fetchone(), "Postulación no encontrada.")
            if not (admin or row["estudiante_id"] == student_id or row["empresa_id"] == company_id):
                raise Forbidden("No tienes acceso al historial de esta postulación.")
            cur.execute(
                """
                SELECT id, postulacion_id, estado_anterior_id, estado_nuevo_id, usuario_id, nota, fecha
                FROM public.historial_postulacion WHERE postulacion_id = %s ORDER BY fecha, id
                """,
                (application_id,),
            )
            return cur.fetchall()

    def set_application_status(self, application_id: int, state_id: int | None,
                               account_id: int, note: str | None) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT 1 FROM public.postulaciones WHERE id = %s", (application_id,))
            if cur.fetchone() is None:
                raise NotFound("Postulación no encontrada.")
            if state_id is None:
                cur.execute("SELECT id FROM public.estados_postulacion WHERE nombre = %s", ("Retirada",))
                state = cur.fetchone()
                if state is None:
                    raise TemporarilyUnavailable("El estado Retirada no está disponible.")
                state_id = state["id"]
            else:
                cur.execute("SELECT 1 FROM public.estados_postulacion WHERE id = %s", (state_id,))
                if cur.fetchone() is None:
                    raise BadRequest("El estado de postulación no existe.")
            cur.execute(
                "CALL public.sp_cambiar_estado_postulacion(%s, %s, %s, %s)",
                (application_id, state_id, account_id, note),
            )
            return self._application(cur, application_id)
