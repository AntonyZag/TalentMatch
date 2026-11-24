import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PostulacionPropia } from '../../interfaces/estudiante';
import { CatalogosService } from '../../services/catalogos';
import { EstudianteService } from '../../services/estudiante';
import { MisPostulaciones } from './mis-postulaciones';

describe('Mis postulaciones', () => {
  it('muestra el historial y solo retira tras confirmar', async () => {
    const postulacion: PostulacionPropia = {
      id: 9,
      vacanteId: 5,
      vacante: 'Practicante de soporte',
      estudianteId: 4,
      estadoId: 2,
      estado: 'En revisión',
      proyectoId: null,
      mensaje: null,
      matchPct: 79,
      creadoEn: '2026-06-12T13:00:00Z',
      historial: [
        {
          id: 6,
          postulacionId: 9,
          estadoAnteriorId: 1,
          estadoNuevoId: 2,
          usuarioId: 10,
          fecha: '2026-06-13T13:00:00Z',
          nota: 'Revisaremos tu portafolio.',
        },
      ],
    };
    const retiro = vi.fn(() => of({ ...postulacion, estado: 'Retirada' }));
    await TestBed.configureTestingModule({
      imports: [MisPostulaciones],
      providers: [
        provideRouter([]),
        {
          provide: EstudianteService,
          useValue: {
            postulaciones: () => of({ items: [postulacion], pagina: 1, tamano: 12, total: 1 }),
            retirarPostulacion: retiro,
          },
        },
        {
          provide: CatalogosService,
          useValue: {
            obtener: () =>
              of({
                estadosPostulacion: [{ id: 2, nombre: 'En revisión', orden: 2 }],
              }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MisPostulaciones);
    await fixture.whenStable();
    const vista: HTMLElement = fixture.nativeElement;
    const pulsar = (texto: string) =>
      [...vista.querySelectorAll<HTMLButtonElement>('button')]
        .find((btn) => btn.textContent?.trim() === texto)!
        .click();
    expect(vista.querySelector('h2')?.textContent).toContain(postulacion.vacante);
    expect(vista.querySelector('.historial')?.textContent).toContain('Revisaremos tu portafolio.');
    pulsar('Retirar postulación');
    await fixture.whenStable();
    expect(retiro).not.toHaveBeenCalled();
    pulsar('Confirmar retiro');
    await fixture.whenStable();
    expect(retiro).toHaveBeenCalledExactlyOnceWith(9, null);
    expect(vista.textContent).toContain('Tu postulación ha sido retirada.');
  });
});
