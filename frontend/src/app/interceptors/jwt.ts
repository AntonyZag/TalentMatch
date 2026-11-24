import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SesionService } from '../services/sesion';

export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  // Sección: enviar la sesión exclusivamente a la API de TalentMatch.
  const prefijo = environment.apiUrl + '/api/';
  if (!request.url.startsWith(prefijo)) return next(request);
  const recurso = request.url.slice(prefijo.length);
  if (
    recurso === 'auth/login' ||
    recurso.startsWith('auth/registro/') ||
    recurso.startsWith('integraciones/')
  ) {
    return next(request);
  }
  const sesion = inject(SesionService);
  const router = inject(Router);
  const token = sesion.token();
  if (!token) return next(request);
  return next(request.clone({ setHeaders: { Authorization: 'Bearer ' + token } })).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && sesion.token() === token) {
        sesion.cerrar();
        void router.navigate(['/'], { queryParams: { acceso: 1, returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
