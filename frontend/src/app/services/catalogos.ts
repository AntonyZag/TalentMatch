import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { Catalogos } from '../interfaces/comun';

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  // Sección: reutilizar los mismos catálogos en formularios y filtros.
  private readonly catalogos = this.http
    .get<Catalogos>(environment.apiUrl + '/api/catalogos')
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

  obtener() {
    return this.catalogos;
  }
}
