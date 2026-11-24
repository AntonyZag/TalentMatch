import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { MetricasImpacto } from '../../interfaces/estudiante';
import { errorApi } from '../../services/error-api';
import { ImpactoService } from '../../services/impacto';

@Component({
  selector: 'app-impacto',
  templateUrl: './impacto.html',
  styleUrl: './impacto.css',
})
export class Impacto implements OnInit {
  private readonly api = inject(ImpactoService);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  readonly metricas = signal<MetricasImpacto | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');

  ngOnInit() {
    if (this.navegador) this.cargar();
  }

  // Sección: indicadores del backend
  cargar() {
    if (this.cargando()) return;
    this.error.set('');
    this.cargando.set(true);
    this.api
      .obtener()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: (metricas) => this.metricas.set(metricas),
        error: (err) => this.error.set(errorApi(err)),
      });
  }
}
