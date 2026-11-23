from unittest.mock import MagicMock, Mock

from fastapi.testclient import TestClient
from psycopg_pool import PoolTimeout

from backend.main import create_app


def test_health_without_database(settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "pool": False, "database": "notConfigured"}


def test_health_pool_lifecycle(settings, monkeypatch) -> None:
    pool = MagicMock()
    settings = settings.model_copy(update={"database_url": settings.jwt_secret})
    create_pool = Mock(return_value=pool)
    monkeypatch.setattr("backend.main.create_pool", create_pool)

    with TestClient(create_app(settings)) as client:
        pool.open.assert_called_once_with()
        assert client.get("/health").json() == {"status": "ok", "pool": True, "database": "available"}
        pool.connection.return_value.__enter__.return_value.execute.assert_called_once_with("SELECT 1")
        pool.connection.side_effect = PoolTimeout("private detail")
        pool.closed = False
        unavailable = client.get("/health")
        assert unavailable.status_code == 503
        assert unavailable.json() == {"status": "degraded", "pool": True, "database": "unavailable"}
    pool.close.assert_called_once_with()
