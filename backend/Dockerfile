FROM python:3.13-slim-trixie

COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never

COPY pyproject.toml uv.lock README.md .python-version ./
COPY src/ ./src/
RUN uv sync --locked --no-dev --no-editable --no-cache

USER 10001:10001
CMD ["/bin/sh", "-c", "exec /app/.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]
