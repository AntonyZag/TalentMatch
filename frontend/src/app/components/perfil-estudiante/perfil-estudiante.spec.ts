import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PerfilEstudianteLectura } from '../../interfaces/estudiante';
import { CatalogosService } from '../../services/catalogos';
import { EstudianteService } from '../../services/estudiante';
import { PerfilEstudiante } from './perfil-estudiante';

describe('Perfil del estudiante', () => {
  let fixture: ComponentFixture<PerfilEstudiante>;
  let vista: HTMLElement;
  const perfil: PerfilEstudianteLectura = {
    id: 4,
    dni: '12345678',
    nombres: 'Lucía',
    apellidoPat: 'Díaz',
    apellidoMat: null,
    dniValidado: true,
    carreraId: 2,
    estadoAcademicoId: 1,
    ciclo: 3,
    anioEgreso: null,
    telefono: null,
    bio: null,
    githubUrl: null,
    linkedinUrl: null,
    habilidades: [],
  };
  const api = {
    perfil: () => of(perfil),
    actualizarPerfil: vi.fn((datos) => of({ ...perfil, ...datos })),
    guardarHabilidades: vi.fn((habilidades) => of(habilidades)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PerfilEstudiante],
      providers: [
        provideRouter([]),
        { provide: EstudianteService, useValue: api },
        {
          provide: CatalogosService,
          useValue: {
            obtener: () =>
              of({
                carreras: [{ id: 2, nombre: 'Derecho' }],
                estadosAcademicos: [{ id: 1, nombre: 'En curso', pideCiclo: true }],
                habilidades: [{ id: 3, nombre: 'Angular' }],
                niveles: [
                  { id: 1, nombre: 'Básico' },
                  { id: 2, nombre: 'Intermedio' },
                ],
              }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PerfilEstudiante);
    await fixture.whenStable();
    vista = fixture.nativeElement;
  });

  it('actualiza el ciclo y confirma el guardado', async () => {
    const ciclo = vista.querySelector<HTMLInputElement>('input[name=ciclo]')!;
    ciclo.value = '4';
    ciclo.dispatchEvent(new Event('input'));
    vista.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(api.actualizarPerfil).toHaveBeenCalledWith(expect.objectContaining({ ciclo: 4 }));
    expect(vista.textContent).toContain('Perfil guardado.');
  });

  it('agrega una habilidad con su nivel y envía el cambio', async () => {
    const [habilidad, nivel] = vista.querySelectorAll<HTMLSelectElement>('.skill-editor select');
    habilidad.selectedIndex = 1;
    habilidad.dispatchEvent(new Event('change'));
    nivel.selectedIndex = 2;
    nivel.dispatchEvent(new Event('change'));
    vista.querySelector<HTMLButtonElement>('.skill-editor button')!.click();
    await fixture.whenStable();
    expect(vista.querySelector('.skill-list')?.textContent).toContain('Angular');
    vista.querySelector<HTMLButtonElement>('.skills-panel .btn-primary')!.click();
    await fixture.whenStable();
    expect(api.guardarHabilidades).toHaveBeenCalledWith([{ habilidadId: 3, nivelId: 2 }]);
    expect(vista.textContent).toContain('Habilidades guardadas.');
  });
});
