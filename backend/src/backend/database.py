from psycopg_pool import ConnectionPool

DB_TIMEOUT = 5


def create_pool(database_url: str) -> ConnectionPool:
    return ConnectionPool(
        conninfo=database_url,
        kwargs={"connect_timeout": DB_TIMEOUT},
        min_size=1,
        max_size=4,
        timeout=DB_TIMEOUT,
        open=False,
        check=ConnectionPool.check_connection,
    )
