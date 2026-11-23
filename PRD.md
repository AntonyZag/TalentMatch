# TalentMatch

## Visión e impacto social

TalentMatch es una plataforma peruana que conecta a estudiantes y egresados con prácticas preprofesionales, prácticas profesionales y primeros empleos junior. Permite demostrar habilidades con proyectos académicos y ofrece a las empresas una forma transparente de evaluar la afinidad de cada candidatura. Su objetivo es facilitar la transición al empleo formal para quienes cuentan con poca experiencia laboral.

El impacto se observará mediante estudiantes con DNI verificado, empresas con RUC verificado, proyectos registrados, vacantes abiertas con cupos y plazo vigente, y estudiantes distintos con una postulación aceptada. La aceptación mide un resultado del proceso en la plataforma. Una contratación efectiva requeriría evidencia adicional.

## Alcance y fases

| Rama o fase | Entregable |
| --- | --- |
| `main` inicial | Monorepositorio preparado para publicarse. FastAPI con CORS y `GET /health`, Angular con bienvenida temporal, documentación base y verificaciones locales. |
| `backend` | Validaciones de identidad, autenticación, API REST, integración con PostgreSQL y APISPERU y pruebas de backend. |
| `frontend` | Interfaz Angular responsiva por rol, integración con FastAPI y pruebas de UI. Antes de maquetar se consultan las preferencias visuales del estudiante. |
| Integración final | Pull requests a `main`, verificaciones de GitHub Actions, despliegue accesible y sustentación individual. |

Las rutas de negocio de este documento son contratos propuestos para las ramas de implementación. El núcleo del producto abarca portafolios, vacantes y postulaciones hasta su resultado.

## Actores y casos de uso

| Actor | Casos de uso |
| --- | --- |
| Visitante | Explorar vacantes vigentes y consultar el detalle público. Consultar proyectos visibles de un portafolio. Iniciar el registro como estudiante o empresa. |
| `ESTUDIANTE` | Registrarse con DNI, iniciar sesión, completar datos académicos y habilidades, administrar proyectos, consultar afinidad, postular con un proyecto propio opcional y revisar el historial. Puede solicitar el retiro de su postulación. |
| `EMPRESA` | Registrarse con RUC, iniciar sesión, mantener su perfil, publicar vacantes con requisitos, consultar candidaturas de sus vacantes y cambiar estados. |
| `ADMIN` | Iniciar sesión con una cuenta provisionada, consultar métricas agregadas y gestionar estados de postulación cuando se requiera intervención. |

## Requisitos funcionales y criterios de aceptación

| ID | Requisito | Criterios de aceptación |
| --- | --- | --- |
| RF-01 | Registro y acceso por rol | FastAPI valida DNI de 8 dígitos y RUC de 11 antes de consultar APISPERU. La verificación exitosa registra el indicador correspondiente. Documento o correo duplicado devuelve `409`. Una falla del proveedor deja el registro sin confirmar y permite reintentar. El acceso válido identifica el rol de la cuenta activa. El registro público admite `ESTUDIANTE` y `EMPRESA`. |
| RF-02 | Perfil y habilidades del estudiante | El titular consulta y actualiza sus datos. El estado académico determina si se exige ciclo, que debe estar entre 1 y 12 cuando se informa. Cada habilidad se registra una vez por estudiante, con un nivel de catálogo. |
| RF-03 | Portafolio académico | El estudiante crea, edita, elimina y cambia la visibilidad de sus proyectos. Puede asociar habilidades y enlaces de repositorio o demo. Solo el propietario modifica el proyecto. El portafolio público incluye únicamente proyectos visibles y sus campos de presentación. Si se elimina un proyecto adjunto, la postulación se conserva y su referencia queda vacía. |
| RF-04 | Gestión y consulta de vacantes | Una empresa activa gestiona sus propias vacantes con tipo, modalidad, fecha de cierre, cupos, requisitos y carrera opcional. El catálogo público muestra vacantes `Abierta` con cupos y fecha de cierre vigente. Admite filtros por carrera, modalidad y tipo. El servidor rechaza ediciones de empresas ajenas. |
| RF-05 | Afinidad de habilidades | `fn_calcular_match` devuelve 0–100 con dos decimales. Un requisito obligatorio pesa el doble que uno opcional del mismo nivel mínimo. El nivel parcial aporta crédito hasta el máximo exigido y una habilidad ausente aporta cero. Una vacante sin requisitos devuelve `100.00`. |
| RF-06 | Registro de postulaciones | Un estudiante activo puede postular una sola vez por vacante abierta con cupo. Se incluye la fecha de cierre en `America/Lima`. Si envía un proyecto, debe pertenecerle. Se registra `Pendiente`, se guarda el match calculado y se crea el evento inicial de historial en la misma transacción. |
| RF-07 | Seguimiento, evaluación y cupos | El estudiante ve sus postulaciones e historial y puede solicitar `Retirada` para una propia. La empresa titular o `ADMIN` pueden cambiar estados. Repetir el estado actual omite un evento duplicado. `Aceptada` es definitiva y consume un cupo en vacantes abiertas o en evaluación. La última aceptación cierra la vacante, incluso con solicitudes concurrentes. |
| RF-08 | Métricas y auditoría | `ADMIN` consulta las cinco métricas de `fn_metricas_impacto`. El conteo de aceptados usa estudiantes distintos. Cada cambio efectivo de una postulación registra estado anterior y nuevo, actor, fecha y nota opcional. |

## Arquitectura

1. **Angular 22** ofrece componentes standalone y zoneless, Bootstrap 5.3.3 y formularios con validación y mensajes por campo. Los servicios HTTP toman la URL de FastAPI de `environment.apiUrl`. SSR y prerenderizado se configuran por ruta.
2. **FastAPI** organiza routers, esquemas Pydantic, servicios y repositorios. Resuelve autenticación, autorización y propiedad de recursos. Aplica CORS con orígenes explícitos y publica OpenAPI para el contrato.
3. **PostgreSQL en Supabase** aloja las tablas, restricciones y rutinas. FastAPI se conecta mediante el Session Pooler con `DATABASE_URL` y `psycopg` v3. Emplea `row_factory=dict_row`, parámetros `%s` y transacciones.
4. **APISPERU** recibe consultas de DNI y RUC exclusivamente desde FastAPI con `APISPERU_TOKEN`. Se limita el tiempo de espera y se distingue un documento sin coincidencia de una falla de integración.

El navegador se comunica con FastAPI. El servidor autoriza cada operación y realiza el acceso a PostgreSQL o al proveedor externo. Las credenciales se definen en `backend/.env` para desarrollo y en las variables del entorno de despliegue para producción.

## Requisitos no funcionales

| ID | Requisito | Criterio verificable |
| --- | --- | --- |
| RNF-01 | Diseño responsivo y accesibilidad | Formularios y navegación utilizables con teclado, foco visible, etiquetas asociadas y errores comprensibles. Verificar los flujos principales en móvil y escritorio, con estados de carga, vacío y error. |
| RNF-02 | Seguridad y privacidad | HTTPS en el despliegue, contraseñas con hash seguro, autorización por rol y titularidad en el servidor y credenciales fuera de Git. Los registros y respuestas públicas excluyen documentos completos, hashes y tokens de integración. |
| RNF-03 | Integridad y concurrencia | Las restricciones y transacciones mantienen unicidad y referencias. Una prueba con dos aceptaciones para el último cupo produce una sola aceptación válida, cupos en cero e historial consistente. |
| RNF-04 | Rendimiento y recuperación | Listados paginados y filtrados en el servidor. El frontend respeta los presupuestos del build. Una falla o demora del proveedor se convierte en una respuesta controlada y la interfaz ofrece reintento. |
| RNF-05 | Calidad y mantenimiento | Separación de capas, contratos revisables en OpenAPI, pruebas automatizadas, commits descriptivos, pull requests y GitHub Actions con pruebas y build en la fase de integración. |
| RNF-06 | Disponibilidad de la entrega | La aplicación desplegada es accesible por HTTPS desde una sesión nueva. La instancia de FastAPI responde a `GET /health` y los flujos de demostración completan el recorrido Angular → FastAPI → PostgreSQL. |

## Modelo de datos

La fuente de verdad es `D:\CONTINENTAL\TalentMatch_BD\`. `01_schema.sql` define 21 tablas en tercera forma normal (3FN), `02_functions.sql` define cuatro rutinas PL/pgSQL y los permisos, y `03_seed.sql` carga los catálogos. El orden de aplicación es esquema, rutinas y semilla.

| Área | Tablas |
| --- | --- |
| Identidad | `roles`, `usuarios` |
| Catálogos académicos | `carreras`, `estados_academicos` |
| Catálogos laborales | `sectores`, `modalidades`, `tipos_vacante`, `estados_vacante`, `estados_postulacion` |
| Catálogos de habilidades | `categorias_habilidad`, `habilidades`, `niveles` |
| Perfiles | `estudiantes`, `empresas` |
| Portafolio y oferta | `proyectos`, `vacantes` |
| Relaciones de habilidades | `estudiante_habilidad`, `proyecto_habilidad`, `vacante_habilidad` |
| Candidaturas y auditoría | `postulaciones`, `historial_postulacion` |

Los catálogos se referencian mediante claves foráneas. Los perfiles tienen relación uno a uno con `usuarios`. Las relaciones muchos a muchos de habilidades se representan con claves compuestas. La combinación de estudiante y vacante es única en `postulaciones`. `match_pct` conserva el resultado al postular para trazabilidad. Los SQL habilitan RLS en las 21 tablas y revocan el acceso directo al pseudorol `PUBLIC` y a los roles `anon` y `authenticated`.

`03_seed.sql` carga los tres roles, los catálogos académicos y laborales, las categorías de habilidades y los pesos de Básico, Intermedio y Avanzado. Los estados de vacante son `Abierta`, `En evaluación`, `Cerrada` y `Cancelada`. Los estados de postulación son `Pendiente`, `En revisión`, `Entrevista`, `Aceptada`, `Rechazada` y `Retirada`. El orden del catálogo organiza la presentación.

| Rutina | Responsabilidad |
| --- | --- |
| `fn_calcular_match(estudiante_id, vacante_id)` | Calcula el porcentaje ponderado de afinidad entre habilidades y niveles. |
| `fn_registrar_postulacion(estudiante_id, vacante_id, proyecto_id, mensaje)` | Bloquea y verifica la vacante, valida el proyecto opcional, guarda la candidatura y el evento inicial y devuelve el ID. |
| `sp_cambiar_estado_postulacion(postulacion_id, estado_id, usuario_id, nota)` | Autoriza al actor, bloquea vacante y candidatura, aplica estado y cupos y registra el historial de cambios efectivos. |
| `fn_metricas_impacto()` | Devuelve los cinco conteos de impacto, incluido el número de estudiantes distintos aceptados. |

## Contratos REST propuestos

`GET /health` es la única ruta propia disponible en la base inicial. Devuelve `200` y `{"status":"ok"}`. Las rutas siguientes usan JSON y nombres de campos en `camelCase`. Los IDs son enteros positivos. Los campos de fecha usan `YYYY-MM-DD` y los de fecha y hora incluyen zona. Los listados devuelven `items`, `pagina`, `tamano` y `total`.

| Método y ruta | Acceso | Solicitud y resultado |
| --- | --- | --- |
| `POST /api/auth/registro/estudiante` | Público | `correo`, `contrasena`, `dni`, `carreraId`, `estadoAcademicoId` y `ciclo` cuando se requiera. Verifica el DNI, obtiene los datos mínimos y crea el perfil. `201` con ID y rol. |
| `POST /api/auth/registro/empresa` | Público | `correo`, `contrasena`, `ruc` y `sectorId`. Verifica el RUC y crea el perfil con razón social. `201` con ID y rol. |
| `POST /api/auth/login` · `GET /api/auth/me` | Público para iniciar sesión. Sesión válida para `/me` | Login con `correo` y `contrasena`. `200` con `accessToken`, tipo Bearer y rol. `/me` devuelve ID, rol y perfil asociado. |
| `GET /api/catalogos/{nombre}` | Público | `200` con registros de catálogos habilitados. El backend valida los nombres admitidos. |
| `GET`, `PATCH /api/estudiantes/me` | `ESTUDIANTE` | `200` con el perfil propio. `PATCH` actualiza los campos académicos y de contacto editables. |
| `PUT /api/estudiantes/me/habilidades` | `ESTUDIANTE` | Reemplaza la lista propia de pares `habilidadId`, `nivelId` en una transacción. `200` con el resultado. |
| `GET`, `POST /api/proyectos` | `ESTUDIANTE` | Lista proyectos propios o crea uno con `titulo`, `descripcion`, `fecha`, enlaces, `visible` y `habilidadIds`. `200` o `201`. |
| `GET`, `PATCH`, `DELETE /api/proyectos/{id}` | `ESTUDIANTE` titular | Consulta, actualiza o elimina el proyecto. `200` o `204`, según operación. |
| `GET /api/estudiantes/{id}/portafolio` | Público | `200` con una página de proyectos visibles. Incluye título, descripción, fecha, enlaces y habilidades. |
| `GET`, `PATCH /api/empresas/me` | `EMPRESA` | `200` con el perfil propio. `PATCH` actualiza campos descriptivos y de contacto editables. |
| `GET /api/vacantes` · `GET /api/vacantes/{id}` | Público para vacantes vigentes | Lista o consulta una vacante. Filtros `carreraId`, `modalidadId`, `tipoId` y paginación para la lista. `200` con el recurso o la página. |
| `GET /api/empresas/me/vacantes` | `EMPRESA` | `200` con las vacantes propias en cualquier estado. |
| `POST /api/vacantes` · `PATCH /api/vacantes/{id}` | `EMPRESA`, titular para editar | Datos de la vacante y requisitos con `habilidadId`, `nivelMinId` y `obligatoria`. `201` al crear o `200` al editar. |
| `GET /api/vacantes/{id}/match` | `ESTUDIANTE` | `200` con `matchPct` para el estudiante autenticado. |
| `POST /api/vacantes/{id}/postulaciones` | `ESTUDIANTE` | Acepta `proyectoId` y `mensaje` opcionales. `201` con `id`, `vacanteId`, `estadoId` y `matchPct`. La identidad se obtiene de la sesión. |
| `GET /api/estudiantes/me/postulaciones` | `ESTUDIANTE` | `200` con la página de postulaciones propias y su estado actual. |
| `GET /api/vacantes/{id}/postulaciones` | `EMPRESA` titular o `ADMIN` | `200` con candidaturas paginadas, match, estado, mensaje, nombre de presentación y resumen del proyecto adjunto cuando sea visible. |
| `GET /api/postulaciones/{id}/historial` | Estudiante titular, empresa titular o `ADMIN` | `200` con eventos ordenados por fecha e ID. |
| `PATCH /api/postulaciones/{id}/estado` | Empresa titular, `ADMIN` o estudiante titular para retiro | Recibe `estadoId` y `nota` opcional. El servidor toma el actor de la sesión. `200` con el estado resultante. |
| `GET /api/admin/metricas-impacto` | `ADMIN` | `200` con `estudiantesVerificados`, `empresasVerificadas`, `proyectos`, `vacantesAbiertas` y `estudiantesAceptados`. |

Las respuestas de error usan `detail`. `401` indica credenciales inválidas o ausentes, `403` un permiso insuficiente, `404` un recurso inexistente u oculto al público, `409` duplicados o conflictos de estado y `422` errores de validación, incluido un documento sin coincidencia al registrarse. `502` corresponde a una respuesta inválida del proveedor y `503` a su indisponibilidad temporal. Se traducen los errores de PostgreSQL y APISPERU a mensajes controlados.

## Estrategia de pruebas

| Nivel | Herramienta y objetivo | Casos clave |
| --- | --- | --- |
| Base inicial | `uv run pytest`, `npm run build` y `npm test -- --no-watch` | Salud de FastAPI, renderizado de la bienvenida y compilación con prerenderizado. |
| Backend unitario y HTTP local | pytest y `TestClient` de FastAPI. Dobles de repositorio y APISPERU para aislar la lógica. | Formato, validación exitosa, duplicados, sesión, permisos, recurso ajeno, errores del proveedor y contratos REST. |
| Base de datos | pytest de integración contra PostgreSQL de pruebas con los tres SQL y datos sintéticos. | Match con pesos y crédito parcial, vacante sin requisitos, fecha de cierre Lima, duplicidad concurrente, proyecto ajeno, retiro, último cupo, idempotencia y recuentos. |
| Frontend unitario | Vitest con servicios HTTP simulados y pruebas de componentes. | Validaciones, estados de carga y error, navegación por rol, listado y formularios. |
| TestSprite de API | Apunta a la URL de FastAPI del entorno de pruebas, por ejemplo `http://localhost:8001`, con OpenAPI y usuarios de prueba. | Comprueba códigos HTTP, cuerpos, permisos y ciclo de postulación desde la API. |
| TestSprite de UI | Apunta a la URL de Angular del entorno de pruebas, por ejemplo `http://localhost:4200`, configurada para usar FastAPI de pruebas. | Recorre registro, perfil, proyecto, publicación, postulación, seguimiento y aceptación con navegador. |

En pruebas automatizadas se controla APISPERU con respuestas simuladas y se usan identidades y datos sintéticos. La verificación de la integración real se realiza en un entorno autorizado con datos permitidos. La fase de integración incorpora GitHub Actions en los pull requests para ejecutar pytest, Vitest y el build. Las pruebas dependientes de infraestructura usan un entorno de pruebas separado.

## Evidencias para la rúbrica y sustentación

| Criterio de Unidad 4 | Evidencia de entrega |
| --- | --- |
| Frontend | Flujos operativos por rol, diseño responsivo con Bootstrap, formularios validados y estructura modular. |
| Backend | OpenAPI consistente, rutas organizadas, lógica de negocio probada y evidencia del consumo de APISPERU. |
| Base de datos | Diagrama relacional, explicación de 3FN y demostración de las cuatro rutinas con datos de prueba. |
| Integración, despliegue y gestión de versiones | URL funcional de la aplicación integrada, historial de ramas y commits descriptivos, pull requests y ejecuciones de GitHub Actions. |
| Sustentación | Demostración individual de registro, portafolio, publicación, postulación, aceptación y métricas. Explicación de validación, autorización, transacciones, cálculo de match y decisiones de diseño. |

Referencia académica en *Unidad 4*, pp. 1–3, Desarrollo de Aplicaciones Web, Universidad Continental.
