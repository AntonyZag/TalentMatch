import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  catchError,
  combineLatest,
  EMPTY,
  expand,
  finalize,
  firstValueFrom,
  forkJoin,
  of,
  reduce,
  Subject,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { Catalogos, ElementoCatalogo, Pagina } from '../../interfaces/comun';
import { Proyecto } from '../../interfaces/estudiante';
import { FiltrosVacantes, Vacante } from '../../interfaces/vacante';
import { CatalogosService } from '../../services/catalogos';
import { errorApi } from '../../services/error-api';
import { EstudianteService } from '../../services/estudiante';
import { SesionService } from '../../services/sesion';
import { VacantesService } from '../../services/vacantes';

function filtrosIniciales(): FiltrosVacantes {
  return { q: '', carreraId: null, modalidadId: null, habilidadId: null };
}

function idValido(valor: string | null): number | null {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

@Component({
  selector: 'app-vacantes',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './vacantes.html',
  styleUrl: './vacantes.css',
})
export class Vacantes implements OnInit {
  private readonly api = inject(VacantesService);
  private readonly catalogosApi = inject(CatalogosService);
  private readonly estudiantes = inject(EstudianteService);
  private readonly sesion = inject(SesionService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly plataforma = inject(PLATFORM_ID);
  private readonly destruir = inject(DestroyRef);
  private readonly reintentos = new Subject<void>();
  private readonly seleccionProyectos = new Subject<number>();

  readonly catalogos = signal<Catalogos | null>(null);
  readonly pagina = signal<Pagina<Vacante> | null>(null);
  readonly detalle = signal<Vacante | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly estudiante = computed(() => this.sesion.usuario()?.rol === 'ESTUDIANTE');
  readonly visitante = computed(() => !this.sesion.usuario());
  filtros = filtrosIniciales();

  readonly formulario = signal(false);
  readonly proyectos = signal<Proyecto[]>([]);
  readonly cargandoProyectos = signal(false);
  readonly errorProyectos = signal('');
  readonly enviando = signal(false);
  readonly enviado = signal(false);
  readonly errorPostular = signal('');
  proyectoId: number | null = null;
  mensaje = '';

  ngOnInit() {
    if (!isPlatformBrowser(this.plataforma)) return;
    this.seleccionProyectos
      .pipe(
        switchMap(() =>
          this.estudiantes.proyectos(1, 100).pipe(
            expand((p) =>
              p.pagina * p.tamano < p.total && p.items.length > 0
                ? this.estudiantes.proyectos(p.pagina + 1, 100)
                : EMPTY,
            ),
            reduce((todos, p) => todos.concat(p.items), [] as Proyecto[]),
            catchError((e) => {
              this.errorProyectos.set(errorApi(e));
              return of([] as Proyecto[]);
            }),
            finalize(() => this.cargandoProyectos.set(false)),
          ),
        ),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe((items) => this.proyectos.set(items));

    // Sección: la URL conserva los filtros y la página al volver desde el detalle.
    combineLatest([this.ruta.paramMap, this.ruta.queryParamMap])
      .pipe(
        switchMap(([params, query]) => {
          this.filtros = {
            q: query.get('q') || '',
            carreraId: idValido(query.get('carreraId')),
            modalidadId: idValido(query.get('modalidadId')),
            habilidadId: idValido(query.get('habilidadId')),
          };
          const pagina = idValido(query.get('pagina')) ?? 1;
          const rawId = params.get('id');
          this.reiniciarPostulacion();
          return this.reintentos.pipe(
            startWith(undefined),
            switchMap(() => {
              this.cargando.set(true);
              this.error.set('');
              this.pagina.set(null);
              this.detalle.set(null);
              const peticion =
                rawId === null
                  ? this.api.listar(this.filtros, pagina).pipe(tap((p) => this.pagina.set(p)))
                  : this.api.detalle(idValido(rawId) ?? 0).pipe(tap((v) => this.detalle.set(v)));
              return forkJoin({ catalogos: this.catalogosApi.obtener(), datos: peticion }).pipe(
                tap(({ catalogos }) => this.catalogos.set(catalogos)),
                catchError((e) => {
                  this.error.set(errorApi(e));
                  return EMPTY;
                }),
                finalize(() => this.cargando.set(false)),
              );
            }),
          );
        }),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe();
  }

  buscar(pagina = 1) {
    const queryParams = {
      ...this.filtros,
      q: this.filtros.q.trim() || null,
      pagina: pagina > 1 ? pagina : null,
    };
    this.router.navigate(['/vacantes'], { queryParams });
  }

  limpiar() {
    this.filtros = filtrosIniciales();
    this.buscar();
  }

  reintentar() {
    this.reintentos.next();
  }

  regresoDespuesDelAcceso(): string {
    return this.router.url;
  }

  nombre(items: ElementoCatalogo[] | undefined, id: number | null) {
    return items?.find((item) => item.id === id)?.nombre ?? 'Sin especificar';
  }

  // Sección: adjuntar un proyecto propio es opcional.
  abrirPostulacion() {
    this.formulario.set(true);
    this.cargandoProyectos.set(true);
    this.errorProyectos.set('');
    this.seleccionProyectos.next(1);
  }

  private reiniciarPostulacion() {
    this.formulario.set(false);
    this.enviado.set(false);
    this.errorPostular.set('');
    this.proyectoId = null;
    this.mensaje = '';
  }

  async postular(vacante: Vacante) {
    if (!this.estudiante() || this.enviando() || this.enviado()) return;
    this.enviando.set(true);
    this.errorPostular.set('');
    try {
      await firstValueFrom(
        this.api.postular(vacante.id, this.proyectoId, this.mensaje.trim() || null),
      );
      if (this.detalle()?.id === vacante.id) {
        this.enviado.set(true);
        this.formulario.set(false);
      }
    } catch (e) {
      if (this.detalle()?.id === vacante.id) this.errorPostular.set(errorApi(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
