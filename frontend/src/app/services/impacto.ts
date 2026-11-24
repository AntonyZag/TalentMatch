import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { environment } from '../../environments/environment';
import { MetricasImpacto } from '../interfaces/estudiante';

@Injectable({ providedIn: 'root' })
export class ImpactoService {
  private readonly http = inject(HttpClient);

  // Sección: indicadores de administración
  obtener() {
    return this.http.get<MetricasImpacto>(environment.apiUrl + '/api/metricas/impacto');
  }
}
