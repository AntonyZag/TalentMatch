import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { jwtInterceptor } from '../interceptors/jwt';
import { requiereRol } from '../guards/rol';
import { SesionService } from './sesion';
import { firstValueFrom, Observable } from 'rxjs';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';

describe('Sesión, interceptor y permisos', () => {
  let http: HttpTestingController;
  let sesion: SesionService;
  const url = environment.apiUrl + '/api';
  const token =
    'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 })) + '.prueba';
  const respuesta = {
    id: 7,
    correo: 'alumna@example.test',
    rol: 'ESTUDIANTE',
    accessToken: token,
    tokenType: 'Bearer',
  };

  function guardia(rol: 'ADMIN' | 'ESTUDIANTE') {
    const resultado = TestBed.runInInjectionContext(() =>
      requiereRol(rol)({} as ActivatedRouteSnapshot, { url: '/impacto' } as RouterStateSnapshot),
    );
    return firstValueFrom(resultado as Observable<boolean | UrlTree>);
  }

  beforeEach(() => {
    localStorage.removeItem('talentmatch.sesion');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem('talentmatch.sesion');
  });

  it('mantiene la sesión y envía el JWT solo a TalentMatch', async () => {
    const login = firstValueFrom(sesion.login(respuesta.correo, 'prueba'));
    const req = http.expectOne(url + '/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(respuesta);
    await login;
    expect(sesion.usuario()?.rol).toBe('ESTUDIANTE');
    const client = TestBed.inject(HttpClient);
    client.get(url + '/proyectos').subscribe();
    const propio = http.expectOne(url + '/proyectos');
    expect(propio.request.headers.get('Authorization')).toBe('Bearer ' + token);
    propio.flush([]);
    client.get('https://externo.example.test/perfil').subscribe();
    const externo = http.expectOne('https://externo.example.test/perfil');
    expect(externo.request.headers.has('Authorization')).toBe(false);
    externo.flush({});
    expect(await guardia('ESTUDIANTE')).toBe(true);
    expect(TestBed.inject(Router).serializeUrl((await guardia('ADMIN')) as UrlTree)).toBe(
      '/vacantes',
    );
    sesion.cerrar();
    expect(sesion.usuario()).toBeNull();
    expect(localStorage.getItem('talentmatch.sesion')).toBeNull();
  });

  it('guarda el regreso al pedir acceso a una ruta privada sin sesión', async () => {
    const destino = (await guardia('ADMIN')) as UrlTree;
    expect(destino.queryParamMap.get('acceso')).toBe('1');
    expect(destino.queryParams['returnUrl']).toBe('/impacto');
  });
});
