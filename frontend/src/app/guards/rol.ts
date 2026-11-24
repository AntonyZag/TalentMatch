import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Rol } from '../interfaces/comun';
import { SesionService } from '../services/sesion';

// Sección: elegir qué roles pueden abrir la pantalla.
export function requiereRol(rol: Rol): CanActivateFn {
  return (_ruta, estado) => {
    const sesion = inject(SesionService);
    const router = inject(Router);
    return sesion.verificar().pipe(
      map((usuario) => {
        if (!usuario)
          return router.createUrlTree(['/'], { queryParams: { acceso: 1, returnUrl: estado.url } });
        return usuario.rol === rol || router.parseUrl(sesion.destino(usuario.rol));
      }),
    );
  };
}
