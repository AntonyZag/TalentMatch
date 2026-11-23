class DomainError(Exception):
    status_code = 500


class BadRequest(DomainError):
    status_code = 400


class Unauthorized(DomainError):
    status_code = 401


class Forbidden(DomainError):
    status_code = 403


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409


class Unprocessable(DomainError):
    status_code = 422


class UpstreamError(DomainError):
    status_code = 502


class TemporarilyUnavailable(DomainError):
    status_code = 503
