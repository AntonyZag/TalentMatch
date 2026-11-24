# AGENTS.md

Frontend de TalentMatch con Angular 22, componentes standalone, ejecución zoneless, SSR con prerenderizado y pruebas Vitest. Usa npm y conserva `package-lock.json`. El alcance del producto está en [PRD.md](../PRD.md).

## Alcance y diseño

`main` contiene la bienvenida temporal «TalentMatch — Base inicial». Las pantallas de producto se implementarán en la rama `frontend`.

**Al iniciar la rama `frontend`, pregunta al estudiante por sus preferencias visuales minimalistas antes de maquetar. Espera su respuesta para definir la paleta, la tipografía y las referencias visuales.**

Usa Bootstrap **5.3.3** con el enlace CDN de `src/index.html`. Prioriza su rejilla, utilidades y componentes para un diseño minimalista, adaptable y accesible. Mantén el CSS propio acotado. Añade el bundle de Bootstrap únicamente si se requiere algún componente interactivo.

## Comandos

Ejecuta los comandos desde `frontend/`.

- `npm ci` instala el árbol fijado por el lockfile. El proyecto declara npm `11.19.0`. Usa una versión de Node compatible con la versión del CLI instalada.
- `npm start` inicia el servidor de desarrollo en `http://localhost:4200`.
- `npm run build` compila, comprueba tipos y plantillas y genera el resultado para navegador y SSR en `dist/frontend/`.
- `npm run serve:ssr:frontend` sirve el resultado SSR tras compilar. Usa `PORT` o el puerto `4000` por defecto.
- `npm test -- --no-watch` ejecuta Vitest una sola vez. Para un archivo, añade `--include src/app/app.spec.ts`.
- Prettier usa comillas simples, ancho de 100 columnas y el parser de Angular para HTML. Formatea solo los archivos que edites.

## Estructura modular

- Escribe cada opción fija del menú lateral, del pie y de las pestañas directamente en el HTML, en el orden en que aparece. Los bloques principales también deben ser fáciles de mover. Usa comentarios cortos en español para ubicarlos, por ejemplo `<!-- Opción: Vacantes -->` en HTML, `/* Sección: Perfil */` en CSS y `// Sección: Proyectos` en TypeScript. Reserva los bucles para datos que cambian, como vacantes o habilidades.
- Cuida la cuota de APISPERU. Consulta `/api/integraciones/dni/{dni}` o `/api/integraciones/ruc/{ruc}` únicamente cuando la persona pulse **Validar DNI** o **Validar RUC**. Mientras escribe, comprueba solo el formato en el navegador.
- Coloca cada componente standalone en `src/app/components/<nombre>/` con `<nombre>.ts`, `<nombre>.html`, `<nombre>.css` y `<nombre>.spec.ts`, sin sufijo `.component`. Usa `templateUrl` y `styleUrl`.
- `navbar`, `footer` y `banner` son componentes compartidos. `auth` reúne el acceso y el registro. `vacantes` reúne el catálogo y el detalle. `perfil-estudiante`, `proyectos` y `mis-postulaciones` cubren el perfil, el portafolio y el seguimiento. `panel-empresa` reúne la gestión de vacantes y candidaturas.
- Usa `src/app/services/` para el acceso a la API y `src/app/interfaces/` para los contratos tipados. Mantén los archivos de arranque y las rutas de Angular bajo `src/app/`.
- `provideHttpClient()` ya está configurado en `app.config.ts`. Los servicios inyectan `HttpClient` y usan `environment.apiUrl`, definido en `src/environments/`. Los componentes consumen los servicios. Los entornos del navegador solo contienen configuración pública.

## Renderizado y pruebas

- El arranque del navegador está en `src/main.ts`. El arranque SSR usa `src/main.server.ts` y `src/server.ts`. `app.routes.server.ts` prerenderiza la raíz y define el modo de renderizado de las rutas futuras.
- Protege los accesos a `window`, `document` y `localStorage` con `afterNextRender` o `isPlatformBrowser`. Las pantallas prerenderizadas cargan datos dinámicos en el navegador. Usa `RenderMode.Server` para rutas que deban renderizarse en cada solicitud.
- Usa signals para representar estado de la interfaz. En pruebas de componentes, espera `fixture.whenStable()` antes de consultar el DOM. Verifica formularios, mensajes de error y controles por rol con servicios simulados.
- Respeta los presupuestos de producción de `angular.json`. Los límites actuales son 1 MB para la carga inicial y 8 kB por estilo de componente.
- En la fase de integración, TestSprite de UI apunta a la URL de Angular. Los casos HTTP de API apuntan a FastAPI.
