import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Proyecto } from '../../interfaces/estudiante';
import { CatalogosService } from '../../services/catalogos';
import { EstudianteService } from '../../services/estudiante';
import { Proyectos } from './proyectos';

describe('Proyectos', () => {
  const proyecto: Proyecto = {
    id: 8,
    estudianteId: 4,
    titulo: 'Biblioteca digital',
    descripcion: 'Catálogo universitario',
    fecha: '2026-06-12',
    curso: null,
    repoUrl: 'https://github.com/talentmatch/biblioteca',
    demoUrl: 'https://drive.google.com/ejemplo',
    imagenUrl: null,
    visible: true,
    habilidadIds: [3],
  };
  const pagina = { items: [proyecto], pagina: 1, tamano: 12, total: 1 };
  const api = {
    proyectos: vi.fn(() => of(pagina)),
    portafolio: vi.fn(() => of(pagina)),
    crearProyecto: vi.fn(() => of(proyecto)),
    eliminarProyecto: vi.fn(() => of(undefined)),
  };
  const paramMap = new BehaviorSubject(convertToParamMap({}));
  let fixture: ComponentFixture<Proyectos>;
  let vista: HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    paramMap.next(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [Proyectos],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: EstudianteService, useValue: api },
        {
          provide: CatalogosService,
          useValue: {
            obtener: () =>
              of({
                habilidades: [{ id: 3, nombre: 'Angular' }],
              }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Proyectos);
    await fixture.whenStable();
    vista = fixture.nativeElement;
  });

  function pulsar(texto: string) {
    [...vista.querySelectorAll<HTMLButtonElement>('button')]
      .find((boton) => boton.textContent?.trim() === texto)!
      .click();
  }

  it('crea un proyecto con su enlace y sus habilidades', async () => {
    pulsar('Nuevo proyecto');
    await fixture.whenStable();
    for (const [nombre, valor] of Object.entries({
      titulo: proyecto.titulo,
      descripcion: proyecto.descripcion,
      fecha: proyecto.fecha,
      repo: proyecto.repoUrl!,
    })) {
      const campo = vista.querySelector<HTMLInputElement>('[name="' + nombre + '"]')!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    }
    vista.querySelector<HTMLInputElement>('input[type=checkbox]:not([name])')!.click();
    vista.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(api.crearProyecto).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: proyecto.titulo,
        repoUrl: proyecto.repoUrl,
        habilidadIds: [3],
      }),
    );
    expect(vista.textContent).toContain('Proyecto creado.');
  });

  it('pide confirmación antes de borrar un proyecto', async () => {
    pulsar('Eliminar');
    await fixture.whenStable();
    expect(api.eliminarProyecto).not.toHaveBeenCalled();
    pulsar('Sí, eliminar');
    await fixture.whenStable();
    expect(api.eliminarProyecto).toHaveBeenCalledExactlyOnceWith(8);
    expect(vista.textContent).toContain('Proyecto eliminado.');
  });

  it('muestra enlaces en el portafolio público y omite los botones de edición', async () => {
    paramMap.next(convertToParamMap({ id: '4' }));
    await fixture.whenStable();
    expect(api.portafolio).toHaveBeenCalledWith(4, 1);
    expect(vista.querySelector('a[href="' + proyecto.repoUrl + '"]')).not.toBeNull();
    expect(vista.textContent).not.toContain('Nuevo proyecto');
  });
});
