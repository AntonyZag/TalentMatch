from typing import Protocol

from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.repositories.common import Row
from backend.services.errors import NotFound

CATALOG_COLUMNS = {
    "carreras": ("id", "nombre"),
    "modalidades": ("id", "nombre"),
    "sectores": ("id", "nombre"),
    "estados_academicos": ("id", "nombre", "pide_ciclo"),
    "niveles": ("id", "nombre", "peso"),
    "categorias_habilidad": ("id", "nombre"),
    "habilidades": ("id", "nombre", "categoria_id"),
    "tipos_vacante": ("id", "nombre"),
    "estados_vacante": ("id", "nombre"),
    "estados_postulacion": ("id", "nombre", "orden"),
}


class CatalogRepository(Protocol):
    def all(self) -> Row: ...
    def items(self, name: str) -> list[Row]: ...
    def impact(self) -> Row: ...


class PostgresCatalogRepository:
    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    @staticmethod
    def _items(cur, name: str) -> list[Row]:
        fields = CATALOG_COLUMNS.get(name)
        if fields is None:
            raise NotFound("Catálogo no encontrado.")
        order = {"niveles": "peso", "estados_postulacion": "orden"}.get(name, "nombre")
        cur.execute(sql.SQL("SELECT {} FROM public.{} ORDER BY {}").format(
            sql.SQL(", ").join(map(sql.Identifier, fields)), sql.Identifier(name), sql.Identifier(order)
        ))
        return cur.fetchall()

    def all(self) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            return {name: self._items(cur, name) for name in CATALOG_COLUMNS}

    def items(self, name: str) -> list[Row]:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            return self._items(cur, name)

    def impact(self) -> Row:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM public.fn_metricas_impacto()")
            return cur.fetchone()
