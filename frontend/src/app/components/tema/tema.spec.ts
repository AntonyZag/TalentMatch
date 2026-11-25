import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tema } from './tema';

const clave = 'talentmatch.tema';

describe('Selector de tema', () => {
  afterEach(() => {
    localStorage.removeItem(clave);
    document.documentElement.removeAttribute('data-bs-theme');
  });

  it('actualiza ambos selectores y guarda la elección al alternar', async () => {
    const acceso = TestBed.createComponent(Tema);
    const menu = TestBed.createComponent(Tema);
    await Promise.all([acceso.whenStable(), menu.whenStable()]);
    const botonAcceso: HTMLButtonElement = acceso.nativeElement.querySelector('button');
    const botonMenu: HTMLButtonElement = menu.nativeElement.querySelector('button');

    expect(botonAcceso.getAttribute('aria-label')).toBe('Activar modo oscuro');
    botonAcceso.click();
    await Promise.all([acceso.whenStable(), menu.whenStable()]);
    expect(botonMenu.getAttribute('aria-label')).toBe('Activar modo claro');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem(clave)).toBe('dark');

    botonMenu.click();
    await Promise.all([acceso.whenStable(), menu.whenStable()]);
    expect(botonAcceso.getAttribute('aria-label')).toBe('Activar modo oscuro');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
    expect(localStorage.getItem(clave)).toBe('light');
  });

  it('recupera el modo oscuro de una visita anterior', async () => {
    localStorage.setItem(clave, 'dark');
    const fixture = TestBed.createComponent(Tema);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.bi-sun')).not.toBeNull();
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('usa el tema claro y evita cambiar el almacenamiento en SSR', async () => {
    localStorage.setItem(clave, 'dark');
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(Tema);
    await fixture.whenStable();
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(boton.getAttribute('aria-label')).toBe('Activar modo oscuro');
    boton.click();
    await fixture.whenStable();
    expect(document.documentElement.hasAttribute('data-bs-theme')).toBe(false);
    expect(localStorage.getItem(clave)).toBe('dark');
  });
});
