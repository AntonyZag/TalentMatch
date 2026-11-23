import re
from collections import OrderedDict
from threading import Lock
from time import monotonic

import httpx
from pydantic import ValidationError

from backend.config import Settings
from backend.schemas.auth import DniRead, RucRead
from backend.services.errors import BadRequest, NotFound, TemporarilyUnavailable, UpstreamError

_CACHE_SIZE = 4096
_FOUND_TTL = 30 * 24 * 60 * 60
_NOT_FOUND_TTL = 300


class IdentityService:
    def __init__(self, settings: Settings, client: httpx.Client):
        self.settings = settings
        self.client = client
        self.cache: OrderedDict[tuple[str, str], tuple[float, DniRead | RucRead | None]] = OrderedDict()
        self.cache_lock = Lock()
        self.lookup_locks = tuple(Lock() for _ in range(32))

    def dni(self, document: str) -> DniRead:
        return self._lookup("dni", document, 8, DniRead)

    def ruc(self, document: str) -> RucRead:
        return self._lookup("ruc", document, 11, RucRead)

    def _lookup[T: (DniRead, RucRead)](
        self, kind: str, document: str, length: int, model: type[T]
    ) -> T:
        if re.fullmatch(r"[0-9]{" + str(length) + "}", document) is None:
            raise BadRequest(f"El {kind.upper()} debe contener exactamente {length} dígitos.")
        key = kind, document

        # A simultaneous lookup for the same document reuses the completed request.
        with self.lookup_locks[hash(key) % len(self.lookup_locks)]:
            with self.cache_lock:
                cached = self.cache.get(key)
                if cached and cached[0] > monotonic():
                    self.cache.move_to_end(key)
                    if cached[1] is None:
                        raise NotFound("Documento no encontrado.")
                    return cached[1]
            result = self._request(kind, document, model)
            with self.cache_lock:
                ttl = _FOUND_TTL if result is not None else _NOT_FOUND_TTL
                self.cache[key] = (monotonic() + ttl, result)
                self.cache.move_to_end(key)
                if len(self.cache) > _CACHE_SIZE:
                    self.cache.popitem(last=False)
        if result is None:
            raise NotFound("Documento no encontrado.")
        return result

    def _request[T: (DniRead, RucRead)](
        self, kind: str, document: str, model: type[T]
    ) -> T | None:
        token = self.settings.apisperu_token
        base_url = self.settings.apisperu_base_url.rstrip("/")
        if token is None or not base_url:
            raise TemporarilyUnavailable("La consulta de identidad no está configurada.")
        try:
            response = self.client.get(
                f"{base_url}/{kind}/{document}",
                headers={"Authorization": f"Bearer {token.get_secret_value()}"},
            )
        except (httpx.TransportError, httpx.InvalidURL) as exc:
            raise TemporarilyUnavailable("APISPERU no está disponible temporalmente.") from exc

        if response.status_code == 404:
            return None
        if response.status_code in (401, 403, 408, 429) or response.status_code >= 500:
            raise TemporarilyUnavailable("APISPERU no está disponible temporalmente.")
        if not response.is_success:
            raise UpstreamError("APISPERU devolvió una respuesta inesperada.")

        try:
            body = response.json()
        except ValueError as exc:
            raise UpstreamError("APISPERU devolvió una respuesta inválida.") from exc
        if not isinstance(body, dict):
            raise UpstreamError("APISPERU devolvió una respuesta inválida.")
        if body.get("success") is False:
            message = str(body.get("message", body.get("mensaje", ""))).casefold()
            if any(phrase in message for phrase in ("no se encontró", "no existe", "no encontrado")):
                return None
            raise UpstreamError("APISPERU no pudo confirmar el documento.")
        returned_document = body.get(kind)
        if returned_document is not None and returned_document != document:
            raise UpstreamError("APISPERU devolvió un documento distinto.")

        names = (
            {"nombres": "nombres", "apellido_pat": "apellidoPaterno", "apellido_mat": "apellidoMaterno"}
            if kind == "dni" else
            {"razon_social": "razonSocial", "nombre_comercial": "nombreComercial",
             "estado_sunat": "estado", "direccion": "direccion"}
        )
        fields = {}
        for field, source in names.items():
            value = body.get(source)
            fields[field] = (" ".join(value.split()) or None) if isinstance(value, str) else value
        try:
            return model.model_validate(fields)
        except ValidationError as exc:
            raise UpstreamError("APISPERU devolvió datos de identidad inválidos.") from exc
