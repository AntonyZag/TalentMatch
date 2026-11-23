# AGENTS.md

Backend de TalentMatch con FastAPI, Python 3.13 y `uv`. Comparte el repositorio raíz con Angular en `../frontend`. El alcance del producto y los contratos previstos están en [PRD.md](../PRD.md).

## Alcance de `main`

La base inicial expone `GET /health` y configura CORS. La conexión a PostgreSQL, el cliente de APISPERU y las rutas de negocio se implementarán en la rama `backend`.

## Comandos

Ejecuta estos comandos desde `backend/` para que la configuración encuentre el `.env` local.

- `uv run backend` inicia Uvicorn con recarga en `0.0.0.0:8001`.
- `uv run uvicorn backend.main:app --reload --port 8001` inicia el mismo servidor de forma explícita. Usa la cadena de importación para que funcione la recarga.
- `uv run pytest` ejecuta la suite. `pytest` y `httpx` ya están declarados como dependencias de desarrollo. La prueba de `/health` usa `fastapi.testclient.TestClient`.
- Usa `uv run` para ejecutar comandos de Python en el entorno del proyecto. Cuando corresponda actualizar dependencias, usa `uv add` para sincronizar `pyproject.toml` y `uv.lock`.

## Configuración y estructura

- `src/backend/main.py` contiene `create_app()`, registra CORS y expone `app` para Uvicorn. `config.py` carga ajustes con `pydantic-settings`. Las variables del proceso prevalecen sobre `.env` y luego se aplican los valores por defecto.
- `CORS_ORIGINS` acepta orígenes exactos separados por comas, por ejemplo `http://localhost:4200,http://127.0.0.1:4200`. Incluye el esquema y el puerto, sin barra final. El valor por defecto es una lista vacía. Con credenciales habilitadas, usa orígenes explícitos.
- `get_settings()` usa `lru_cache`. Reinicia el servidor tras cambiar el entorno y ejecuta `get_settings.cache_clear()` en las pruebas que sustituyan variables de configuración.
- Organiza el código bajo `src/backend/` como paquete `backend.*`. `apis/` aloja routers, `schemas/` modelos Pydantic, `services/` reglas de negocio e integraciones externas y `repositories/` el acceso a datos. Mantén los `__init__.py` para el empaquetado con `uv_build`.

## Base de datos

- En la rama `backend`, usa PostgreSQL en Supabase y `psycopg` v3 con `row_factory=dict_row`. Parametriza los valores con marcadores `%s` y pásalos por separado a `execute()`. Usa transacciones para los cambios relacionados.
- Guarda `DATABASE_URL` en `backend/.env` local con la cadena del **Session Pooler** de Supabase. Configúrala mediante variables del entorno en despliegue. Mantén las credenciales fuera de Git y de las respuestas de la API.
- La fuente de verdad exacta es `D:\CONTINENTAL\TalentMatch_BD\`. `01_schema.sql` define las 21 tablas en 3FN, `02_functions.sql` define las cuatro rutinas PL/pgSQL y los permisos y `03_seed.sql` carga los catálogos iniciales. Respeta ese orden cuando corresponda preparar una base de pruebas.
- Usa las rutinas validadas para calcular el match, registrar postulaciones, cambiar su estado y generar métricas. FastAPI controla los permisos de la aplicación y es el único acceso desde la interfaz.

## API Externa (APISPERU)

- En la rama `backend`, integra APISPERU exclusivamente desde FastAPI. Carga `APISPERU_TOKEN` desde `backend/.env` local o el entorno de despliegue.
- Valida el formato antes de llamar al proveedor. El DNI tiene exactamente 8 dígitos y el RUC exactamente 11. Trátalos como cadenas para preservar ceros iniciales.
- Distingue una consulta sin coincidencia de una falla del proveedor. Registra como verificado solo un resultado confirmado. Mantén el token y los documentos completos fuera de los logs.

## Flujo de trabajo

- Antes de cambiar de rama o usar GitHub Desktop, Supabase, TestSprite u otra herramienta externa, indícale al estudiante paso a paso qué debe hacer.
- Para GitHub Desktop, indica cómo seleccionar `D:\TalentMatch`, verificar los archivos incluidos, publicar `main` y crear o seleccionar la rama correspondiente desde `main`.
- Para Supabase, indica cómo seleccionar el proyecto y el entorno correctos, verificar el orden de los SQL y guardar localmente la cadena de conexión sin compartirla. Para TestSprite, indica cómo iniciar el servicio de la capa que se probará, elegir su URL y cargar datos de prueba.
- Usa `backend` para datos, validaciones y API. Reserva `frontend` para la interfaz Angular. Integra con commits descriptivos, pull requests y las verificaciones previstas en el PRD.
