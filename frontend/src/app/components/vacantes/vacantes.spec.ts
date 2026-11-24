import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { UsuarioSesion } from '../../interfaces/comun';
import { Vacante } from '../../interfaces/vacante';
import { CatalogosService } from '../../services/catalogos';
import { EstudianteService } from '../../services/estudiante';
import { SesionService } from '../../services/sesion';
import { VacantesService } from '../../services/vacantes';
import { Vacantes } from './vacantes';

describe('Vacantes', () => {
  const vacante: Vacante = {
    id: 5,
    empresaId: 1,
    empresa: 'Biblioteca SAC',
    titulo: 'Practicante de soporte',
    descripcion: 'Apoya al equipo de tecnología.',
    ubicacion: 'Lima',
    sueldo: null,
    tipoId: 1,
    modalidadId: 1,
    estadoId: 1,
    estado: 'Abierta',
    carreraId: 3,
    cupos: 2,
    fechaCierre: '2026-12-10',
    creadoEn: '2026-11-20T10:00:00Z',
    habilidades: [],
    matchPct: 79.5,
  };
  const usuario = signal<UsuarioSesion | null>(null);
  const api = {
    listar: vi.fn(() => of({ items: [vacante], pagina: 1, tamano: 12, total: 1 })),
    detalle: vi.fn(() => of(vacante)),
    postular: vi.fn(() => of({ id: 9 })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usuario.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'vacantes', component: Vacantes },
          { path: 'vacantes/:id', component: Vacantes },
        ]),
        { provide: SesionService, useValue: { usuario } },
        { provide: VacantesService, useValue: api },
        {
          provide: EstudianteService,
          useValue: {
            proyectos: () => of({ items: [], pagina: 1, tamano: 100, total: 0 }),
          },
        },
        {
          provide: CatalogosService,
          useValue: {
            obtener: () =>
              of({
                carreras: [{ id: 3, nombre: 'Ingeniería' }],
                tiposVacante: [{ id: 1, nombre: 'Práctica' }],
                modalidades: [{ id: 1, nombre: 'Remota' }],
                habilidades: [{ id: 2, nombre: 'Angular' }],
              }),
          },
        },
      ],
    });
  });

  it('usa los filtros de la URL y devuelve al invitado al detalle tras iniciar sesión', async () => {
    const harness = await RouterTestingHarness.create(
      '/vacantes?q=soporte&carreraId=3&modalidadId=1&habilidadId=2',
    );
    await harness.fixture.whenStable();
    expect(api.listar).toHaveBeenCalledWith(
      {
        q: 'soporte',
        carreraId: 3,
        modalidadId: 1,
        habilidadId: 2,
      },
      1,
    );
    expect(harness.routeNativeElement?.querySelector('article h3')?.textContent).toBe(
      vacante.titulo,
    );
    expect(harness.routeNativeElement?.querySelector('progress')).toBeNull();
    await harness.navigateByUrl('/vacantes/5?q=soporte');
    await harness.fixture.whenStable();
    const acceso = harness.routeNativeElement?.querySelector('a.btn-primary')?.getAttribute('href');
    expect(acceso).toBeTruthy();
    const url = TestBed.inject(Router).parseUrl(acceso!);
    expect(url.queryParamMap.get('returnUrl')).toBe('/vacantes/5?q=soporte');
  });

  it('muestra el porcentaje y permite postular sin adjuntar un proyecto', async () => {
    usuario.set({ id: 4, correo: 'lucia@example.test', rol: 'ESTUDIANTE' });
    const harness = await RouterTestingHarness.create('/vacantes/5');
    await harness.fixture.whenStable();
    const vista = harness.routeNativeElement!;
    expect(vista.querySelector('progress')?.value).toBe(79.5);
    vista.querySelector<HTMLButtonElement>('button.btn-primary')!.click();
    await harness.fixture.whenStable();
    vista.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    expect(api.postular).toHaveBeenCalledExactlyOnceWith(5, null, null);
    expect(vista.textContent).toContain('Postulación registrada.');
  });
});
