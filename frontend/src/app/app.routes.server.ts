import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  // Sección: cargar la sesión y los datos de las vistas internas en el navegador.
  { path: '**', renderMode: RenderMode.Client },
];
