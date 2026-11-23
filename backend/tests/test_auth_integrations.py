import bcrypt
import httpx
import jwt
import pytest

from backend.services.errors import Conflict


STUDENT = {
    "correo": "  ESTUDIANTE@example.test ", "contrasena": "prueba-123", "dni": "01234567",
    "carreraId": 1, "estadoAcademicoId": 1, "ciclo": 5,
}
COMPANY = {
    "correo": "empresa@example.test", "contrasena": "prueba-123", "ruc": "01234567890",
    "sectorId": 2,
}


def test_dni_ruc_normalized_and_cached(client, upstream):
    for _ in range(2):
        dni = client.get("/api/integraciones/dni/01234567")
        assert dni.status_code == 200
        assert dni.headers["cache-control"] == "no-store"
        assert dni.json() == {"nombres": "Ana María", "apellidoPat": "Pérez", "apellidoMat": "Díaz"}

        ruc = client.get("/api/integraciones/ruc/01234567890")
        assert ruc.status_code == 200
        assert ruc.json()["razonSocial"] == "Universidad SAC"
        assert ruc.json()["estadoSunat"] == "ACTIVO"
        assert ruc.json()["direccion"] == "Av. Lima 123"

    requests = [call.args[0] for call in upstream.call_args_list]
    assert [str(r.url) for r in requests] == [
        "https://example.test/api/v1/dni/01234567",
        "https://example.test/api/v1/ruc/01234567890",
    ]
    assert all(request.headers["Authorization"] == "Bearer apitoken" for request in requests)


@pytest.mark.parametrize(("kind", "value"), [
    ("dni", "1234567"), ("dni", "１２３４５６７８"), ("ruc", "12345678a90"), ("ruc", "1234567890"),
])
def test_document_format_rejected_before_lookup(client, upstream, kind, value):
    assert client.get(f"/api/integraciones/{kind}/{value}").status_code == 400
    upstream.assert_not_called()


def test_not_found_is_cached(client, upstream):
    upstream.side_effect = None
    upstream.return_value = httpx.Response(404)
    url = "/api/integraciones/dni/00000000"
    for _ in range(2):
        assert client.get(url).status_code == 404
    assert upstream.call_count == 1


def test_timeout_retries_on_next_request(client, upstream):
    upstream.side_effect = [httpx.ReadTimeout("timeout"), httpx.Response(404)]
    url = "/api/integraciones/ruc/00000000000"
    assert client.get(url).status_code == 503
    assert client.get(url).status_code == 404
    assert upstream.call_count == 2


def test_provider_token_missing(client, settings, upstream):
    settings.apisperu_token = None
    assert client.get("/api/integraciones/dni/00000000").status_code == 503
    upstream.assert_not_called()


def test_provider_malformed_payload(client, upstream):
    upstream.side_effect = None
    upstream.return_value = httpx.Response(200, json={"message": "incomplete"})
    assert client.get("/api/integraciones/dni/00000000").status_code == 502


@pytest.mark.parametrize(("role", "slug", "payload", "field"), [
    ("ESTUDIANTE", "estudiante", STUDENT, "dni"), ("EMPRESA", "empresa", COMPANY, "ruc"),
])
def test_registration_bcrypt_uses_same_identity_cache(client, repos, upstream, role, slug, payload, field):
    repo = repos["auth"]
    normalized = payload["correo"].strip().lower()
    repo.register.return_value = {"id": 12, "rol": role, "correo": normalized}

    assert client.get(f"/api/integraciones/{field}/{payload[field]}").status_code == 200
    result = client.post(f"/api/auth/registro/{slug}", json=payload)

    assert result.status_code == 201
    assert result.json() == {"id": 12, "rol": role, "correo": normalized}
    repo.check_registration.assert_called_once_with(role, normalized, payload[field])
    sent_role, email, encoded, profile = repo.register.call_args.args
    assert (sent_role, email) == (role, normalized)
    assert bcrypt.checkpw(payload["contrasena"].encode(), encoded.encode())
    assert profile[field] == payload[field] and profile[field + "_validado"] is True
    assert "contrasena" not in profile
    assert upstream.call_count == 1


def test_duplicate_short_circuits_provider(client, repos, upstream):
    repos["auth"].check_registration.side_effect = Conflict("El correo o documento ya está registrado.")
    assert client.post("/api/auth/registro/estudiante", json=STUDENT).status_code == 409
    upstream.assert_not_called()
    repos["auth"].register.assert_not_called()


@pytest.mark.parametrize(("slug", "payload", "bad_fields"), [
    ("estudiante", STUDENT, {"rol": "ADMIN"}),
    ("estudiante", STUDENT, {"dni": "1234567"}),
    ("estudiante", STUDENT, {"dni": 12345678}),
    ("estudiante", STUDENT, {"contrasena": "é" * 37}),
    ("empresa", COMPANY, {"ruc": "12345678901X"}),
    ("empresa", COMPANY, {"sectorId": -1}),
])
def test_registration_strict_payload(client, upstream, slug, payload, bad_fields):
    response = client.post(f"/api/auth/registro/{slug}", json=payload | bad_fields)
    assert response.status_code == 422
    assert all("input" not in error for error in response.json()["detail"])
    upstream.assert_not_called()


def test_jwt_login_current_session_and_revocation(client, settings, users, repos, tokens):
    response = client.post("/api/auth/login", json={
        "correo": "ADMIN@example.test", "contrasena": "prueba-123",
    })
    assert response.status_code == 200
    account = response.json()
    assert account["rol"] == "ADMIN" and account["tokenType"] == "Bearer"
    payload = jwt.decode(
        account["accessToken"], settings.jwt_secret.get_secret_value(),
        algorithms=["HS256"], issuer="talentmatch",
    )
    assert payload["sub"] == "3" and payload["exp"] - payload["iat"] == 120 * 60
    headers = {"Authorization": f"Bearer {account['accessToken']}"}
    assert client.get("/api/auth/me", headers=headers).json() == {
        "id": 3, "correo": "admin@example.test", "rol": "ADMIN", "perfil": None,
    }
    users["ADMIN"]["activo"] = False
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.get("/api/auth/me").headers["www-authenticate"] == "Bearer"
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer malformed"}).status_code == 401
    assert client.post("/api/auth/login", json={
        "correo": "empresa@example.test", "contrasena": "incorrecta",
    }).status_code == 401
