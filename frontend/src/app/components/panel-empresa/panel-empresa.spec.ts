import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Empresa, Postulante, Vacante } from '../../interfaces/vacante';
import { CatalogosService } from '../../services/catalogos';
import { VacantesService } from '../../services/vacantes';
import { PanelEmpresa } from './panel-empresa';

describe('Panel de empresa', () => {
  const empresa: Empresa = {
    id: 1,
    ruc: '20000000001',
    razonSocial: 'Biblioteca SAC',
    nombreComercial: null,
    direccion: null,
    estadoSunat: 'ACTIVO',
    rucValidado: true,
    sectorId: 1,
    telefono: null,
    web: null,
    descripcion: null,
  };
  const vacante: Vacante = {
    id: 5,
    empresaId: 1,
    empresa: empresa.razonSocial,
    titulo: 'Practicante de soporte',
    descripcion: 'Apoya al equipo de tecnología.',
    ubicacion: null,
    sueldo: null,
    tipoId: 1,
    modalidadId: 1,
    estadoId: 1,
    estado: 'Abierta',
    carreraId: null,
    cupos: 2,
    fechaCierre: '2026-12-10',
    creadoEn: '2026-11-20T10:00:00Z',
    habilidades: [],
    matchPct: null,
  };
  const primera: Postulante = {
    id: 9,
    vacanteId: 5,
    estudianteId: 4,
    estadoId: 1,
    estado: 'Pendiente',
    proyectoId: 8,
    mensaje: null,
    matchPct: 88,
    creadoEn: '2026-11-21T10:00:00Z',
    nombres: 'Lucía',
    apellidoPat: 'Díaz',
    apellidoMat: null,
    habilidades: [{ habilidadId: 2, nivelId: 1 }],
    proyectos: [
      {
        id: 8,
        estudianteId: 4,
        titulo: 'Biblioteca digital',
        descripcion: 'Catálogo universitario',
        fecha: '2026-11-12',
        curso: null,
        repoUrl: 'https://github.com/talentmatch/biblioteca',
        demoUrl: null,
        imagenUrl: null,
        visible: true,
        habilidadIds: [2],
      },
    ],
  };
  const segunda: Postulante = {
    ...primera,
    id: 10,
    estudianteId: 7,
    nombres: 'Diego',
    matchPct: 67,
    proyectos: [],
  };
  const api = {
    empresa: () => of(empresa),
    propias: () => of({ items: [vacante], pagina: 1, tamano: 12, total: 1 }),
    postulantes: vi.fn(() => of({ items: [segunda, primera], pagina: 1, tamano: 12, total: 2 })),
    cambiarEstadoVacante: vi.fn(() => of({ ...vacante, estadoId: 2, estado: 'Cancelada' })),
    cambiarEstadoPostulacion: vi.fn(() => of({ ...primera, estadoId: 2, estado: 'En revisión' })),
  };
  let fixture: ComponentFixture<PanelEmpresa>;
  let vista: HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PanelEmpresa],
      providers: [
        { provide: VacantesService, useValue: api },
        {
          provide: CatalogosService,
          useValue: {
            obtener: () =>
              of({
                estadosVacante: [
                  { id: 1, nombre: 'Abierta' },
                  { id: 2, nombre: 'Cancelada' },
                ],
                estadosPostulacion: [
                  { id: 1, nombre: 'Pendiente' },
                  { id: 2, nombre: 'En revisión' },
                ],
                modalidades: [{ id: 1, nombre: 'Remota' }],
                tiposVacante: [{ id: 1, nombre: 'Práctica' }],
                habilidades: [{ id: 2, nombre: 'Angular' }],
                niveles: [{ id: 1, nombre: 'Básico' }],
              }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PanelEmpresa);
    await fixture.whenStable();
    vista = fixture.nativeElement;
  });

  function pulsar(nombre: string, raiz: ParentNode = vista) {
    [...raiz.querySelectorAll<HTMLButtonElement>('button')]
      .find((boton) => boton.textContent?.trim() === nombre)!
      .click();
  }

  async function guardarSegundoEstado(raiz: ParentNode = vista) {
    const select = raiz.querySelector<HTMLSelectElement>('form select[name=estado]')!;
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    pulsar('Guardar estado', raiz);
    await fixture.whenStable();
  }

  it('cancela una vacante usando el catálogo de estados', async () => {
    pulsar('Cambiar estado');
    await fixture.whenStable();
    await guardarSegundoEstado();
    expect(api.cambiarEstadoVacante).toHaveBeenCalledExactlyOnceWith(5, 2);
    expect(vista.textContent).toContain('Estado de vacante actualizado.');
  });

  it('ordena postulantes, muestra el proyecto y actualiza la candidatura elegida', async () => {
    pulsar('Ver postulantes');
    await fixture.whenStable();
    expect(api.postulantes).toHaveBeenCalledExactlyOnceWith(5, 1);
    const tarjetas = vista.querySelectorAll('article');
    expect(tarjetas[0].textContent).toContain('Lucía');
    expect(tarjetas[1].textContent).toContain('Diego');
    pulsar('Ver portafolio', tarjetas[0]);
    await fixture.whenStable();
    expect(tarjetas[0].querySelector('a')?.href).toBe(primera.proyectos[0].repoUrl);
    pulsar('Cambiar estado', tarjetas[0]);
    await fixture.whenStable();
    await guardarSegundoEstado(tarjetas[0]);
    expect(api.cambiarEstadoPostulacion).toHaveBeenCalledExactlyOnceWith(9, 2, null);
    expect(tarjetas[0].textContent).toContain('En revisión');
  });
});
