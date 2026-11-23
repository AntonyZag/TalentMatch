from typing import Protocol

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.repositories.common import Row, found, insert, page, project_fields, update
from backend.services.errors import BadRequest, Forbidden, NotFound

_STUDENT = """
    SELECT e.id, e.dni, e.nombres, e.apellido_pat, e.apellido_mat, e.dni_validado,
           e.telefono, e.carrera_id, e.estado_academico_id, e.ciclo, e.anio_egreso,
           e.bio, e.github_url, e.linkedin_url,
           COALESCE((
               SELECT jsonb_agg(to_jsonb(h) - 'estudiante_id' ORDER BY h.habilidad_id)
               FROM public.estudiante_habilidad h WHERE h.estudiante_id = e.id
           ), '[]'::jsonb) AS habilidades
    FROM public.estudiantes e WHERE e.id = %s
"""

_COMPANY = """
    SELECT id, ruc, razon_social, nombre_comercial, direccion, estado_sunat,
           ruc_validado, sector_id, telefono, web, descripcion
    FROM public.empresas WHERE id = %s
"""

_PROJECT = f"SELECT {project_fields('p')} FROM public.proyectos p"


def check_academic_cycle(cur, status_id: int, cycle: int | None) -> None:
    cur.execute("SELECT pide_ciclo FROM public.estados_academicos WHERE id = %s", (status_id,))
    status = cur.fetchone()
    if status is None:
        raise BadRequest("El estado académico no existe.")
    if status["pide_ciclo"] and cycle is None:
        raise BadRequest("El estado académico requiere indicar el ciclo.")


class ProfileRepository(Protocol):
    def student(self, student_id: int) -> Row: ...
    def update_student(self, student_id: int, changes: Row) -> Row: ...
    def replace_student_skills(self, student_id: int, skills: list[Row]) -> list[Row]: ...
    def company(self, company_id: int) -> Row: ...
    def update_company(self, company_id: int, changes: Row) -> Row: ...
    def projects(self, student_id: int, pagina: int, tamano: int, *, public: bool = False) -> Row: ...
    def project(self, student_id: int, project_id: int) -> Row: ...
    def create_project(self, student_id: int, fields: Row) -> Row: ...
    def update_project(self, student_id: int, project_id: int, changes: Row) -> Row: ...
    def delete_project(self, student_id: int, project_id: int) -> None: ...


class PostgresProfileRepository:
    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    @staticmethod
    def _student(cur, student_id: int) -> Row:
        cur.execute(_STUDENT, (student_id,))
        return found(cur.fetchone(), "Estudiante no encontrado.")

    @staticmethod
    def _company(cur, company_id: int) -> Row:
        cur.execute(_COMPANY, (company_id,))
        return found(cur.fetchone(), "Empresa no encontrada.")

    @staticmethod
    def _lock_student(cur, student_id: int) -> Row:
        cur.execute(
            "SELECT estado_academico_id, ciclo FROM public.estudiantes WHERE id = %s FOR UPDATE",
            (student_id,),
        )
        return found(cur.fetchone(), "Estudiante no encontrado.")

    def student(self, student_id: int) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            return self._student(cur, student_id)

    def update_student(self, student_id: int, changes: Row) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            academic = self._lock_student(cur, student_id) | changes
            check_academic_cycle(cur, academic["estado_academico_id"], academic["ciclo"])
            update(cur, "estudiantes", student_id, changes)
            return self._student(cur, student_id)

    def replace_student_skills(self, student_id: int, skills: list[Row]) -> list[Row]:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            self._lock_student(cur, student_id)
            cur.execute("DELETE FROM public.estudiante_habilidad WHERE estudiante_id = %s", (student_id,))
            cur.executemany(
                """
                INSERT INTO public.estudiante_habilidad (estudiante_id, habilidad_id, nivel_id)
                VALUES (%s, %s, %s)
                """,
                [(student_id, skill["habilidad_id"], skill["nivel_id"]) for skill in skills],
            )
            return self._student(cur, student_id)["habilidades"]

    def company(self, company_id: int) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            return self._company(cur, company_id)

    def update_company(self, company_id: int, changes: Row) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            update(cur, "empresas", company_id, changes)
            return self._company(cur, company_id)

    def projects(self, student_id: int, pagina: int, tamano: int, *, public: bool = False) -> Row:
        where = " WHERE p.estudiante_id = %s"
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            if public:
                cur.execute("""
                    SELECT 1 FROM public.estudiantes e JOIN public.usuarios u ON u.id = e.usuario_id
                    WHERE e.id = %s AND u.activo
                    """, (student_id,))
                if cur.fetchone() is None:
                    raise NotFound("Estudiante no encontrado.")
                where += " AND p.visible"
            cur.execute("SELECT count(*) AS total FROM public.proyectos p" + where, (student_id,))
            total = cur.fetchone()["total"]
            cur.execute(
                _PROJECT + where + " ORDER BY p.fecha DESC, p.id DESC LIMIT %s OFFSET %s",
                (student_id, tamano, (pagina - 1) * tamano),
            )
            return page(cur.fetchall(), total, pagina, tamano)

    @staticmethod
    def _project(cur, project_id: int) -> Row:
        cur.execute(_PROJECT + " WHERE p.id = %s", (project_id,))
        return found(cur.fetchone(), "Proyecto no encontrado.")

    @staticmethod
    def _owned_project(cur, student_id: int, project_id: int) -> None:
        cur.execute("SELECT estudiante_id FROM public.proyectos WHERE id = %s FOR UPDATE", (project_id,))
        row = found(cur.fetchone(), "Proyecto no encontrado.")
        if row["estudiante_id"] != student_id:
            raise Forbidden("El proyecto pertenece a otro estudiante.")

    @staticmethod
    def _replace_project_skills(cur, project_id: int, skill_ids: list[int]) -> None:
        cur.execute("DELETE FROM public.proyecto_habilidad WHERE proyecto_id = %s", (project_id,))
        cur.executemany(
            "INSERT INTO public.proyecto_habilidad (proyecto_id, habilidad_id) VALUES (%s, %s)",
            [(project_id, skill_id) for skill_id in skill_ids],
        )

    def project(self, student_id: int, project_id: int) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            row = self._project(cur, project_id)
            if row["estudiante_id"] != student_id:
                raise Forbidden("El proyecto pertenece a otro estudiante.")
            return row

    def create_project(self, student_id: int, fields: Row) -> Row:
        data = fields.copy()
        skills = data.pop("habilidad_ids")
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            project_id = insert(cur, "proyectos", dict(estudiante_id=student_id, **data))
            self._replace_project_skills(cur, project_id, skills)
            return self._project(cur, project_id)

    def update_project(self, student_id: int, project_id: int, changes: Row) -> Row:
        fields = changes.copy()
        skills = fields.pop("habilidad_ids", None)
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            self._owned_project(cur, student_id, project_id)
            update(cur, "proyectos", project_id, fields)
            if skills is not None:
                self._replace_project_skills(cur, project_id, skills)
            return self._project(cur, project_id)

    def delete_project(self, student_id: int, project_id: int) -> None:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            self._owned_project(cur, student_id, project_id)
            cur.execute("DELETE FROM public.proyectos WHERE id = %s", (project_id,))
