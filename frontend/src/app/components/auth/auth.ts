import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Observable, Subscription } from 'rxjs';
import { Catalogos } from '../../interfaces/comun';
import { DocumentoDni, DocumentoRuc } from '../../interfaces/registro';
import { CatalogosService } from '../../services/catalogos';
import { errorApi } from '../../services/error-api';
import { RegistroService } from '../../services/registro';
import { SesionService } from '../../services/sesion';

type Modo = 'login' | 'registro';
type TipoRegistro = 'ESTUDIANTE' | 'EMPRESA';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionService);
  private readonly registro = inject(RegistroService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  // Sección: acceso a la cuenta.
  protected readonly modo = signal<Modo>('login');
  protected readonly tipo = signal<TipoRegistro>('ESTUDIANTE');
  protected readonly correo = signal('');
  protected readonly contrasena = signal('');
  protected readonly mostrarClave = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal('');
  protected readonly exito = signal('');

  // Sección: validación de identidad y datos académicos.
  protected readonly documento = signal('');
  protected readonly identidadDni = signal<DocumentoDni | null>(null);
  protected readonly identidadRuc = signal<DocumentoRuc | null>(null);
  protected readonly validando = signal(false);
  protected readonly errorDocumento = signal('');
  protected readonly catalogos = signal<Catalogos | null>(null);
  protected readonly cargandoCatalogos = signal(false);
  protected readonly errorCatalogos = signal('');
  protected readonly carreraId = signal(0);
  protected readonly estadoId = signal(0);
  protected readonly ciclo = signal<number | null>(null);
  protected readonly sectorId = signal(0);
  protected readonly esEstudiante = computed(() => this.tipo() === 'ESTUDIANTE');
  protected readonly documentoValido = computed(() =>
    this.esEstudiante()
      ? /^[0-9]{8}$/.test(this.documento())
      : /^[0-9]{11}$/.test(this.documento()),
  );
  protected readonly verificado = computed(() =>
    this.esEstudiante() ? this.identidadDni() !== null : this.identidadRuc() !== null,
  );
  protected readonly pideCiclo = computed(
    () =>
      this.catalogos()?.estadosAcademicos.some(
        (estado) => estado.id === this.estadoId() && estado.pideCiclo,
      ) ?? false,
  );
  private consultaDocumento?: Subscription;

  ngOnInit(): void {
    this.ruta.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params.get('registro') === '1') {
        this.cambiarModo('registro');
      } else if (params.get('acceso') !== '1') {
        this.cambiarModo('login');
        this.cambiarDocumento('');
        this.contrasena.set('');
        this.mostrarClave.set(false);
      }
    });
  }

  protected cambiarModo(modo: Modo): void {
    if (this.enviando()) return;
    this.modo.set(modo);
    this.mostrarClave.set(false);
    this.errorEnvio.set('');
    this.exito.set('');
    if (modo === 'registro' && !this.catalogos()) this.cargarCatalogos();
  }

  protected cargarCatalogos(): void {
    if (!this.navegador || this.cargandoCatalogos()) return;
    this.errorCatalogos.set('');
    this.cargandoCatalogos.set(true);
    this.catalogosService
      .obtener()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoCatalogos.set(false)),
      )
      .subscribe({
        next: (datos) => this.catalogos.set(datos),
        error: (error) => this.errorCatalogos.set(errorApi(error)),
      });
  }

  protected cambiarTipo(tipo: TipoRegistro): void {
    if (tipo === this.tipo()) return;
    this.tipo.set(tipo);
    this.cambiarDocumento('');
  }

  protected cambiarDocumento(documento: string): void {
    this.consultaDocumento?.unsubscribe();
    this.documento.set(documento);
    this.identidadDni.set(null);
    this.identidadRuc.set(null);
    this.errorDocumento.set('');
    this.errorEnvio.set('');
  }

  // Opción: únicamente este botón puede pedir la identidad a APISPERU.
  protected validarDocumento(): void {
    if (this.validando() || this.verificado() || !this.documentoValido()) return;
    this.validando.set(true);
    this.errorDocumento.set('');
    this.errorEnvio.set('');
    const documento = this.documento();
    const consulta: Observable<DocumentoDni | DocumentoRuc> = this.esEstudiante()
      ? this.registro.validarDni(documento)
      : this.registro.validarRuc(documento);
    this.consultaDocumento = consulta
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.validando.set(false)),
      )
      .subscribe({
        next: (datos: DocumentoDni | DocumentoRuc) => {
          if ('nombres' in datos) this.identidadDni.set(datos);
          else this.identidadRuc.set(datos);
        },
        error: (error) => this.errorDocumento.set(errorApi(error)),
      });
  }

  protected enviar(event: Event): void {
    event.preventDefault();
    if (this.enviando()) return;
    this.errorEnvio.set('');
    this.exito.set('');
    const correo = this.correo().trim().toLowerCase();
    const clave = this.contrasena();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || !clave) {
      this.errorEnvio.set('Revisa tu correo y tu contraseña.');
      return;
    }
    if (new TextEncoder().encode(clave).length > 72) {
      this.errorEnvio.set('La contraseña admite hasta 72 bytes. Prueba con una más corta.');
      return;
    }
    if (this.modo() === 'login') {
      this.iniciarSesion(correo, clave);
    } else {
      this.crearCuenta(correo, clave);
    }
  }

  private iniciarSesion(correo: string, clave: string): void {
    this.enviando.set(true);
    this.sesion
      .login(correo, clave)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: (usuario) => {
          this.contrasena.set('');
          const regreso = this.ruta.snapshot.queryParamMap.get('returnUrl');
          const rutaInterna =
            regreso?.startsWith('/') && !regreso.startsWith('//') && !regreso.includes('\\');
          void this.router.navigateByUrl(rutaInterna ? regreso! : this.sesion.destino(usuario.rol));
        },
        error: (error) => this.errorEnvio.set(errorApi(error)),
      });
  }

  private crearCuenta(correo: string, clave: string): void {
    if (!this.verificado()) {
      this.errorEnvio.set(
        this.esEstudiante() ? 'Valida tu DNI para continuar.' : 'Valida tu RUC para continuar.',
      );
      return;
    }
    if (Array.from(clave).length < 8) {
      this.errorEnvio.set('Usa una contraseña de al menos 8 caracteres.');
      return;
    }
    if (
      !this.catalogos() ||
      (this.esEstudiante() ? !this.carreraId() || !this.estadoId() : !this.sectorId())
    ) {
      this.errorEnvio.set('Completa los datos de tu registro.');
      return;
    }
    const ciclo = this.pideCiclo() ? this.ciclo() : null;
    if (
      this.esEstudiante() &&
      this.pideCiclo() &&
      (!Number.isInteger(ciclo) || ciclo! < 1 || ciclo! > 12)
    ) {
      this.errorEnvio.set('Indica tu ciclo, del 1 al 12.');
      return;
    }
    this.enviando.set(true);
    const cuenta = this.esEstudiante()
      ? this.registro.registrarEstudiante({
          correo,
          contrasena: clave,
          dni: this.documento(),
          carreraId: this.carreraId(),
          estadoAcademicoId: this.estadoId(),
          ciclo,
        })
      : this.registro.registrarEmpresa({
          correo,
          contrasena: clave,
          ruc: this.documento(),
          sectorId: this.sectorId(),
        });
    cuenta
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: (resultado) => {
          this.modo.set('login');
          this.cambiarDocumento('');
          this.correo.set(resultado.correo);
          this.contrasena.set('');
          this.mostrarClave.set(false);
          this.exito.set('Cuenta creada. Ingresa con tu correo y contraseña.');
        },
        error: (error) => this.errorEnvio.set(errorApi(error)),
      });
  }
}
