import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ImpactoService } from '../../services/impacto';
import { Impacto } from './impacto';

describe('Impacto social', () => {
  it('muestra cinco indicadores recibidos y permite actualizarlos', async () => {
    const metricas = {
      estudiantesVerificados: 14,
      empresasVerificadas: 6,
      proyectos: 21,
      vacantesAbiertas: 11,
      estudiantesAceptados: 8,
    };
    const obtener = vi.fn(() => of(metricas));
    await TestBed.configureTestingModule({
      imports: [Impacto],
      providers: [{ provide: ImpactoService, useValue: { obtener } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Impacto);
    await fixture.whenStable();
    const vista: HTMLElement = fixture.nativeElement;
    expect(
      [...vista.querySelectorAll('.indicadores strong')].map((valor) => valor.textContent),
    ).toEqual(['8', '14', '6', '21', '11']);
    obtener.mockReturnValue(of({ ...metricas, estudiantesAceptados: 9 }));
    vista.querySelector('button')!.click();
    await fixture.whenStable();
    expect(vista.querySelector('.indicadores strong')?.textContent).toBe('9');
    expect(obtener).toHaveBeenCalledTimes(2);
  });
});
