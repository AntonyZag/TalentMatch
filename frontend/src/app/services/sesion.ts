import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Acceso, Rol, UsuarioSesion } from '../interfaces/comun';

const STORAGE_KEY = 'talentmatch.sesion';
const AUTH_URL = environment.apiUrl + '/api/auth';

function vencimiento(token: string): number {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return Number(JSON.parse(atob(parte)).exp) * 1000;
  } catch {
    return 0;
  }
}

@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly acceso = signal<Acceso | null>(null);
  readonly usuario = computed<UsuarioSesion | null>(() => {
    const actual = this.acceso();
    return actual ? { id: actual.id, correo: actual.correo, rol: actual.rol } : null;
  });
  private confirmada = false;
  private verificacion?: Observable<UsuarioSesion | null>;

  constructor() {
    // Sección: recuperar una sesión local solo al abrir la página en el navegador.
    if (!this.navegador) return;
    try {
      const guardada: Acceso | null = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (guardada && this.vigente(guardada)) this.acceso.set(guardada);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Se puede usar la sesión en memoria si el navegador restringe el almacenamiento.
    }
  }

  private vigente(acceso: Acceso): boolean {
    return (
      typeof acceso.accessToken === 'string' &&
      vencimiento(acceso.accessToken) > Date.now() &&
      ['ESTUDIANTE', 'EMPRESA', 'ADMIN'].includes(acceso.rol) &&
      typeof acceso.correo === 'string' &&
      Number.isInteger(acceso.id)
    );
  }

  token(): string | null {
    const acceso = this.acceso();
    if (acceso && this.vigente(acceso)) return acceso.accessToken;
    if (acceso) this.cerrar();
    return null;
  }

  login(correo: string, contrasena: string): Observable<UsuarioSesion> {
    return this.http.post<Acceso>(AUTH_URL + '/login', { correo, contrasena }).pipe(
      tap((acceso) => {
        this.guardar(acceso);
        this.confirmada = true;
        this.verificacion = undefined;
      }),
      map(({ id, correo, rol }) => ({ id, correo, rol })),
    );
  }

  // Sección: comprobar el rol en el servidor antes de abrir una vista privada.
  verificar(): Observable<UsuarioSesion | null> {
    const actual = this.acceso();
    if (!this.token() || !actual) return of(null);
    if (this.confirmada) return of(this.usuario());
    if (!this.verificacion) {
      this.verificacion = this.http.get<UsuarioSesion>(AUTH_URL + '/me').pipe(
        map(({ id, correo, rol }) => ({ id, correo, rol })),
        tap((usuario) => {
          if (this.token() === actual.accessToken) {
            this.guardar({ ...actual, ...usuario });
            this.confirmada = true;
          }
        }),
        catchError((error: HttpErrorResponse) => {
          this.verificacion = undefined;
          if (error.status === 401 && this.token() === actual.accessToken) this.cerrar();
          // Una caída temporal permite abrir la vista y mostrar el error de sus datos.
          return of(this.usuario());
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.verificacion;
  }

  private guardar(acceso: Acceso): void {
    this.acceso.set(acceso);
    if (this.navegador) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(acceso));
      } catch {
        /* Sesión en memoria. */
      }
    }
  }

  cerrar(): void {
    this.acceso.set(null);
    this.confirmada = false;
    this.verificacion = undefined;
    if (this.navegador) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* Sesión en memoria. */
      }
    }
  }

  destino(rol: Rol): string {
    if (rol === 'EMPRESA') return '/panel-empresa';
    return rol === 'ADMIN' ? '/impacto' : '/vacantes';
  }
}
