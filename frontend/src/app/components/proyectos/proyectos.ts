import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin, Subscription } from 'rxjs';

import { Catalogos, Pagina } from '../../interfaces/comun';
import { Proyecto, ProyectoDatos } from '../../interfaces/estudiante';
import { CatalogosService } from '../../services/catalogos';
import { errorApi } from '../../services/error-api';
import { EstudianteService } from '../../services/estudiante';

function nuevoProyecto(): ProyectoDatos {
  return {
    titulo: '',
    descripcion: '',
    curso: null,
    fecha: '',
    repoUrl: null,
    demoUrl: null,
    imagenUrl: null,
    habilidadIds: [],
    visible: true,
  };
}

@Component({
  selector: 'app-proyectos',
  imports: [FormsModule],
  templateUrl: './proyectos.html',
  styleUrl: './proyectos.css',
})
export class Proyectos implements OnInit {
  private readonly estudiantes = inject(EstudianteService);
  private readonly catalogosApi = inject(CatalogosService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private lectura?: Subscription;
  readonly publicoId = signal<number | null>(null);
  readonly pagina = signal<Pagina<Proyecto> | null>(null);
  readonly catalogos = signal<Catalogos | null>(null);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly errorCarga = signal('');
  readonly errorEdicion = signal('');
  readonly aviso = signal('');
  readonly editorAbierto = signal(false);
  readonly editarId = signal<number | null>(null);
  readonly eliminarId = signal<number | null>(null);
  borrador = nuevoProyecto();

  ngOnInit() {
    if (!this.navegador) return;
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.publicoId.set(id === null ? null : Number(id));
      this.cerrarEditor();
      this.eliminarId.set(null);
      this.pagina.set(null);
      this.aviso.set('');
      this.cargar();
    });
  }

  // Sección: página propia o portafolio público
  cargar(numero = 1) {
    this.lectura?.unsubscribe();
    const titular = this.publicoId();
    if (titular !== null && (!Number.isInteger(titular) || titular <= 0)) {
      this.cargando.set(false);
      this.errorCarga.set('El enlace de este portafolio es inválido.');
      return;
    }
    this.errorCarga.set('');
    this.cargando.set(true);
    const proyectos =
      titular === null
        ? this.estudiantes.proyectos(numero)
        : this.estudiantes.portafolio(titular, numero);

    this.lectura = forkJoin({ proyectos, catalogos: this.catalogosApi.obtener() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: ({ proyectos, catalogos }) => {
          this.pagina.set(proyectos);
          this.catalogos.set(catalogos);
        },
        error: (err) => this.errorCarga.set(errorApi(err)),
      });
  }

  habilidad(id: number) {
    return this.catalogos()?.habilidades.find((h) => h.id === id)?.nombre ?? 'Habilidad ' + id;
  }

  // Sección: creación, edición y visibilidad
  abrirEditor(proyecto?: Proyecto) {
    this.aviso.set('');
    this.errorEdicion.set('');
    this.eliminarId.set(null);
    this.editarId.set(proyecto?.id ?? null);
    if (proyecto) {
      const { id, estudianteId, ...datos } = proyecto;
      this.borrador = { ...datos, habilidadIds: [...datos.habilidadIds] };
    } else {
      this.borrador = nuevoProyecto();
    }
    this.editorAbierto.set(true);
  }

  cerrarEditor() {
    this.editorAbierto.set(false);
    this.editarId.set(null);
    this.errorEdicion.set('');
  }

  seleccionarHabilidad(id: number, seleccionada: boolean) {
    this.borrador.habilidadIds = seleccionada
      ? [...new Set([...this.borrador.habilidadIds, id])]
      : this.borrador.habilidadIds.filter((item) => item !== id);
  }

  private enlaceValido(valor: string | null) {
    if (!valor?.trim()) return true;
    try {
      const url = new URL(valor.trim());
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  guardar(form: NgForm) {
    if (this.enviando() || this.publicoId() !== null) return;
    this.errorEdicion.set('');
    if (form.invalid || !this.borrador.titulo.trim() || !this.borrador.descripcion.trim()) {
      form.control.markAllAsTouched();
      this.errorEdicion.set(
        'Completa el título, la fecha y la descripción. Revisa los enlaces indicados.',
      );
      return;
    }
    const datos = {
      ...this.borrador,
      titulo: this.borrador.titulo.trim(),
      descripcion: this.borrador.descripcion.trim(),
      curso: this.borrador.curso?.trim() || null,
      repoUrl: this.borrador.repoUrl?.trim() || null,
      demoUrl: this.borrador.demoUrl?.trim() || null,
      imagenUrl: this.borrador.imagenUrl?.trim() || null,
    };
    if (![datos.repoUrl, datos.demoUrl, datos.imagenUrl].every((url) => this.enlaceValido(url))) {
      this.errorEdicion.set(
        'Revisa los enlaces. Deben ser direcciones completas con http o https.',
      );
      return;
    }
    const id = this.editarId();
    const peticion =
      id === null
        ? this.estudiantes.crearProyecto(datos)
        : this.estudiantes.editarProyecto(id, datos);
    this.enviando.set(true);
    peticion
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: () => {
          this.cerrarEditor();
          this.aviso.set(id === null ? 'Proyecto creado.' : 'Proyecto actualizado.');
          this.cargar(id === null ? 1 : this.pagina()?.pagina);
        },
        error: (err) => this.errorEdicion.set(errorApi(err)),
      });
  }

  // Sección: confirmación de eliminación
  eliminar(proyecto: Proyecto) {
    if (this.enviando() || this.publicoId() !== null || this.eliminarId() !== proyecto.id) return;
    this.enviando.set(true);
    this.errorCarga.set('');
    this.estudiantes
      .eliminarProyecto(proyecto.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: () => {
          this.eliminarId.set(null);
          this.aviso.set('Proyecto eliminado.');
          const anterior = this.pagina();
          const pagina =
            anterior?.items.length === 1 ? Math.max(1, anterior.pagina - 1) : anterior?.pagina;
          this.cargar(pagina);
        },
        error: (err) => this.errorCarga.set(errorApi(err)),
      });
  }
}
