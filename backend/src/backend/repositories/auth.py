from typing import Literal, Protocol

from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.repositories.common import Row, insert
from backend.repositories.profiles import check_academic_cycle
from backend.schemas.common import Role
from backend.services.errors import Conflict, TemporarilyUnavailable

RegistrationRole = Literal["ESTUDIANTE", "EMPRESA"]

_ACCOUNT = """
    SELECT u.id, u.correo, u.password_hash, u.activo, r.nombre AS rol,
           e.id AS estudiante_id, emp.id AS empresa_id
    FROM public.usuarios u
    JOIN public.roles r ON r.id = u.rol_id
    LEFT JOIN public.estudiantes e ON e.usuario_id = u.id
    LEFT JOIN public.empresas emp ON emp.usuario_id = u.id
"""
_DOCUMENTS = {"ESTUDIANTE": ("estudiantes", "dni"), "EMPRESA": ("empresas", "ruc")}


class AuthRepository(Protocol):
    def by_email(self, email: str) -> Row | None: ...
    def by_id(self, account_id: int) -> Row | None: ...
    def check_registration(self, role: RegistrationRole, email: str, document: str) -> None: ...
    def register(self, role: RegistrationRole, email: str, password_hash: str, profile: Row) -> Row: ...


class PostgresAuthRepository:
    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    def by_email(self, email: str) -> Row | None:
        return self._account("WHERE lower(u.correo) = %s ORDER BY u.id LIMIT 1", email)

    def by_id(self, account_id: int) -> Row | None:
        return self._account("WHERE u.id = %s", account_id)

    def _account(self, where: str, value: str | int) -> Row | None:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_ACCOUNT + where, (value,))
            return cur.fetchone()

    def check_registration(self, role: RegistrationRole, email: str, document: str) -> None:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            self._check_registration(cur, role, email, document)

    @staticmethod
    def _check_registration(cur, role: RegistrationRole, email: str, document: str) -> None:
        table, column = _DOCUMENTS[role]
        query = sql.SQL("""
            SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE lower(correo) = %s)
                OR EXISTS(SELECT 1 FROM public.{} WHERE {} = %s) AS duplicated
        """).format(sql.Identifier(table), sql.Identifier(column))
        cur.execute(query, (email, document))
        if cur.fetchone()["duplicated"]:
            raise Conflict("El correo o documento ya está registrado.")

    def register(self, role: RegistrationRole, email: str, password_hash: str, profile: Row) -> Row:
        table, column = _DOCUMENTS[role]
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            self._check_registration(cur, role, email, profile[column])
            if role == "ESTUDIANTE":
                check_academic_cycle(cur, profile["estado_academico_id"], profile["ciclo"])
            cur.execute("SELECT id FROM public.roles WHERE nombre = %s", (role,))
            role_row = cur.fetchone()
            if role_row is None:
                raise TemporarilyUnavailable("El catálogo de roles no está disponible.")
            account_id = insert(cur, "usuarios", dict(
                rol_id=role_row["id"], correo=email, password_hash=password_hash
            ))
            insert(cur, table, dict(usuario_id=account_id, **profile))
            return dict(id=account_id, correo=email, rol=role)
