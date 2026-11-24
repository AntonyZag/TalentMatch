import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UsuarioSesion } from '../../interfaces/comun';
import { SesionService } from '../../services/sesion';
import { Navbar } from './navbar';

describe('Navbar', () => {
  it('cambia las opciones al cambiar el rol y abre el menú en celular', async () => {
    const usuario = signal<UsuarioSesion | null>(null);
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), { provide: SesionService, useValue: { usuario } }],
    });
    const fixture = TestBed.createComponent(Navbar);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const rutas = () =>
      [...root.querySelectorAll('.sidebar nav a')].map((a) => a.textContent.trim());
    expect(rutas()).toEqual(['Vacantes']);

    usuario.set({ id: 3, correo: 'estudiante@example.test', rol: 'ESTUDIANTE' });
    await fixture.whenStable();
    expect(rutas()).toContain('Mis proyectos');
    expect(rutas()).not.toContain('Panel de empresa');
    root.querySelector<HTMLButtonElement>('.menu-button')!.click();
    await fixture.whenStable();
    expect(root.querySelector('#menu-lateral')!.classList.contains('open')).toBe(true);

    usuario.set({ id: 5, correo: 'admin@example.test', rol: 'ADMIN' });
    await fixture.whenStable();
    expect(rutas()).toEqual(['Vacantes', 'Impacto social']);
  });
});
