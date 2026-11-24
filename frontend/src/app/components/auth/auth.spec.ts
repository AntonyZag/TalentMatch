import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { DocumentoDni } from '../../interfaces/registro';
import { CatalogosService } from '../../services/catalogos';
import { RegistroService } from '../../services/registro';
import { SesionService } from '../../services/sesion';
import { Auth } from './auth';

describe('Acceso y registro', () => {
  let fixture: ComponentFixture<Auth>;
  let elemento: HTMLElement;
  const registro = {
    validarDni: vi.fn(),
    validarRuc: vi.fn(),
    registrarEstudiante: vi.fn(),
    registrarEmpresa: vi.fn(),
  };
  const sesion = { login: vi.fn(), destino: vi.fn() };
  const router = { navigateByUrl: vi.fn() };
  const catalogos = {
    obtener: vi.fn(() =>
      of({
        carreras: [{ id: 4, nombre: 'Derecho' }],
        estadosAcademicos: [{ id: 1, nombre: 'En curso', pideCiclo: true }],
        sectores: [{ id: 2, nombre: 'Educación' }],
      }),
    ),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const params = convertToParamMap({ acceso: '1' });
    await TestBed.configureTestingModule({
      imports: [Auth],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(params), snapshot: { queryParamMap: params } },
        },
        { provide: RegistroService, useValue: registro },
        { provide: SesionService, useValue: sesion },
        { provide: Router, useValue: router },
        { provide: CatalogosService, useValue: catalogos },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Auth);
    await fixture.whenStable();
    elemento = fixture.nativeElement;
  });

  function boton(nombre: string) {
    return [...elemento.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === nombre,
    )!;
  }

  async function escribir(id: string, value: string, event = 'input') {
    const input = elemento.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id)!;
    input.value = value;
    input.dispatchEvent(new Event(event));
    await fixture.whenStable();
  }

  async function enviar() {
    elemento.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  it('inicia sesión y lleva al panel del rol', async () => {
    sesion.login.mockReturnValue(of({ id: 2, rol: 'EMPRESA', correo: 'ana@example.test' }));
    sesion.destino.mockReturnValue('/panel-empresa');
    await escribir('acceso-correo', 'Ana@example.test');
    await escribir('acceso-clave', 'mi-clave-de-prueba');
    elemento.querySelector<HTMLButtonElement>('.ojo')!.click();
    await fixture.whenStable();
    expect(elemento.querySelector<HTMLInputElement>('#acceso-clave')!.type).toBe('text');
    await enviar();
    expect(sesion.login).toHaveBeenCalledWith('ana@example.test', 'mi-clave-de-prueba');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/panel-empresa');
    expect(catalogos.obtener).not.toHaveBeenCalled();
  });

  it('consulta el DNI únicamente al pulsar validar y registra con los campos del backend', async () => {
    registro.validarDni.mockReturnValue(
      of({ nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: 'Luz' }),
    );
    registro.registrarEstudiante.mockReturnValue(
      of({ id: 1, rol: 'ESTUDIANTE', correo: 'ana@example.test' }),
    );
    boton('Registrarse').click();
    await fixture.whenStable();
    await escribir('registro-documento', '0123');
    expect(boton('Validar DNI').disabled).toBe(true);
    await escribir('registro-documento', '01234567');
    expect(registro.validarDni).not.toHaveBeenCalled();
    boton('Validar DNI').click();
    await fixture.whenStable();
    expect(registro.validarDni).toHaveBeenCalledExactlyOnceWith('01234567');
    expect(elemento.querySelector<HTMLInputElement>('#registro-nombres')!.value).toBe(
      'Ana Pérez Luz',
    );
    await escribir('registro-carrera', '4', 'change');
    await escribir('registro-estado', '1', 'change');
    await escribir('registro-ciclo', '3');
    await escribir('acceso-correo', 'ana@example.test');
    await escribir('acceso-clave', 'mi-clave-de-prueba');
    await enviar();
    expect(registro.registrarEstudiante).toHaveBeenCalledWith({
      dni: '01234567',
      correo: 'ana@example.test',
      contrasena: 'mi-clave-de-prueba',
      carreraId: 4,
      estadoAcademicoId: 1,
      ciclo: 3,
    });
    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Cuenta creada');
  });

  it('consulta el RUC mediante botón, completa razón social y dirección y registra la empresa', async () => {
    registro.validarRuc.mockReturnValue(
      of({ razonSocial: 'Empresa SAC', direccion: 'Av. Lima 1', estadoSunat: 'ACTIVO' }),
    );
    registro.registrarEmpresa.mockReturnValue(
      of({ id: 2, rol: 'EMPRESA', correo: 'info@example.test' }),
    );
    boton('Registrarse').click();
    await fixture.whenStable();
    boton('Soy Empresa').click();
    await fixture.whenStable();
    await escribir('registro-documento', '20123456789');
    expect(registro.validarRuc).not.toHaveBeenCalled();
    boton('Validar RUC').click();
    await fixture.whenStable();
    expect(registro.validarRuc).toHaveBeenCalledExactlyOnceWith('20123456789');
    expect(elemento.querySelector<HTMLInputElement>('#registro-razon')!.value).toBe('Empresa SAC');
    expect(elemento.querySelector<HTMLInputElement>('#registro-direccion')!.value).toBe(
      'Av. Lima 1',
    );
    await escribir('registro-sector', '2', 'change');
    await escribir('acceso-correo', 'info@example.test');
    await escribir('acceso-clave', 'mi-clave-de-prueba');
    await enviar();
    expect(registro.registrarEmpresa).toHaveBeenCalledWith({
      ruc: '20123456789',
      correo: 'info@example.test',
      contrasena: 'mi-clave-de-prueba',
      sectorId: 2,
    });
  });

  it('descarta una respuesta antigua si se edita el documento durante la validación', async () => {
    const pendiente = new Subject<DocumentoDni>();
    registro.validarDni.mockReturnValue(pendiente);
    boton('Registrarse').click();
    await fixture.whenStable();
    await escribir('registro-documento', '01234567');
    boton('Validar DNI').click();
    await escribir('registro-documento', '01234568');
    pendiente.next({ nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: null });
    await fixture.whenStable();
    expect(elemento.querySelector('#registro-nombres')).toBeNull();
    expect(registro.validarDni).toHaveBeenCalledTimes(1);
    await escribir('acceso-correo', 'ana@example.test');
    await escribir('acceso-clave', 'mi-clave-de-prueba');
    await enviar();
    expect(registro.registrarEstudiante).not.toHaveBeenCalled();
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('Valida tu DNI');
  });

  it('permite reintentar una consulta que falló', async () => {
    registro.validarDni.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: { detail: 'APISPERU no está disponible temporalmente.' },
          }),
      ),
    );
    boton('Registrarse').click();
    await fixture.whenStable();
    await escribir('registro-documento', '01234567');
    boton('Validar DNI').click();
    await fixture.whenStable();
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('APISPERU');
    expect(boton('Validar DNI').disabled).toBe(false);
  });
});
