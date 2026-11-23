from typing import Any

from psycopg import Cursor, sql

from backend.services.errors import NotFound

type Row = dict[str, Any]


def found(row: Row | None, message: str) -> Row:
    if row is None:
        raise NotFound(message)
    return row


def page(items: list[Row], total: int, pagina: int, tamano: int) -> Row:
    return dict(items=items, total=total, pagina=pagina, tamano=tamano)


def insert(cur: Cursor[Row], table: str, fields: Row) -> int:
    query = sql.SQL("INSERT INTO public.{} ({}) VALUES ({}) RETURNING id").format(
        sql.Identifier(table),
        sql.SQL(", ").join(map(sql.Identifier, fields)),
        sql.SQL(", ").join(sql.Placeholder() for _ in fields),
    )
    cur.execute(query, tuple(fields.values()))
    return cur.fetchone()["id"]


def update(cur: Cursor[Row], table: str, row_id: int, fields: Row) -> None:
    if fields:
        assignments = sql.SQL(", ").join(
            sql.SQL("{} = %s").format(sql.Identifier(field)) for field in fields
        )
        query = sql.SQL("UPDATE public.{} SET {} WHERE id = %s").format(
            sql.Identifier(table), assignments
        )
        cur.execute(query, (*fields.values(), row_id))


def project_fields(alias: str) -> str:
    # The alias is specified only by repository code.
    return f"""
        {alias}.*,
        ARRAY(SELECT ph.habilidad_id FROM public.proyecto_habilidad ph
              WHERE ph.proyecto_id = {alias}.id ORDER BY ph.habilidad_id) AS habilidad_ids
    """
