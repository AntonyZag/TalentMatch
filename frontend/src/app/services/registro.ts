import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UsuarioSesion } from '../interfaces/comun';
import { AltaEmpresa, AltaEstudiante, DocumentoDni, DocumentoRuc } from '../interfaces/registro';

@Injectable({ providedIn: 'root' })
export class RegistroService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl + '/api';

  // Sección: consultas iniciadas desde los botones de validación.
  validarDni(dni: string): Observable<DocumentoDni> {
    return this.http.get<DocumentoDni>(this.api + '/integraciones/dni/' + encodeURIComponent(dni));
  }

  validarRuc(ruc: string): Observable<DocumentoRuc> {
    return this.http.get<DocumentoRuc>(this.api + '/integraciones/ruc/' + encodeURIComponent(ruc));
  }

  registrarEstudiante(datos: AltaEstudiante): Observable<UsuarioSesion> {
    return this.http.post<UsuarioSesion>(this.api + '/auth/registro/estudiante', datos);
  }

  registrarEmpresa(datos: AltaEmpresa): Observable<UsuarioSesion> {
    return this.http.post<UsuarioSesion>(this.api + '/auth/registro/empresa', datos);
  }
}
