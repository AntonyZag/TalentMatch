import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { ElementoCatalogo, Pagina } from '../../interfaces/comun';
import { PostulacionPropia } from '../../interfaces/estudiante';
import { CatalogosService } from '../../services/catalogos';
import { errorApi } from '../../services/error-api';
import { EstudianteService } from '../../services/estudiante';

@Component({
  selector: 'app-mis-postulaciones',
  imports: [FormsModule, RouterLink],
  templateUrl: './mis-postulaciones.html',
  styleUrl: './mis-postulaciones.css',
})
export class MisPostulaciones implements OnInit {
  private readonly api = inject(EstudianteService);
  private readonly catalogos = inject(CatalogosService);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly formatoFecha = new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Lima',
  });
  readonly pagina = signal<Pagina<PostulacionPropia> | null>(null);
  readonly estados = signal<ElementoCatalogo[]>([]);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly retiroId = signal<number | null>(null);
  nota = '';

  ngOnInit() {
    if (this.navegador) this.cargar();
  }

  // Sección: historial y paginación
  cargar(numero = 1) {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    this.retiroId.set(null);
    forkJoin({ postulaciones: this.api.postulaciones(numero), catalogos: this.catalogos.obtener() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: ({ postulaciones, catalogos }) => {
          this.pagina.set(postulaciones);
          this.estados.set(catalogos.estadosPostulacion);
        },
        error: (err) => this.error.set(errorApi(err)),
      });
  }

  nombreEstado(id: number) {
    return this.estados().find((e) => e.id === id)?.nombre ?? 'Estado ' + id;
  }

  fecha(valor: string) {
    return this.formatoFecha.format(new Date(valor));
  }

  // Sección: confirmación de retiro
  iniciarRetiro(id: number) {
    this.nota = '';
    this.aviso.set('');
    this.retiroId.set(id);
  }

  retirar(id: number) {
    if (this.enviando() || this.retiroId() !== id) return;
    this.enviando.set(true);
    this.error.set('');
    this.api
      .retirarPostulacion(id, this.nota.trim() || null)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: () => {
          this.aviso.set('Tu postulación ha sido retirada.');
          this.cargar(this.pagina()?.pagina);
        },
        error: (err) => this.error.set(errorApi(err)),
      });
  }
}
