import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Pagina } from '../interfaces/comun';
import { Postulacion } from '../interfaces/estudiante';
import {
  Empresa,
  EmpresaDatos,
  FiltrosVacantes,
  Postulante,
  Vacante,
  VacanteDatos,
} from '../interfaces/vacante';

@Injectable({ providedIn: 'root' })
export class VacantesService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl + '/api';

  // Sección: exploración pública y postulación del estudiante.
  listar(filtros: FiltrosVacantes, pagina: number) {
    let params = new HttpParams().set('pagina', pagina).set('tamano', 12);
    for (const [campo, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== '') params = params.set(campo, valor);
    }
    return this.http.get<Pagina<Vacante>>(this.api + '/vacantes', { params });
  }

  detalle(id: number) {
    return this.http.get<Vacante>(this.api + '/vacantes/' + id);
  }

  postular(vacanteId: number, proyectoId: number | null, mensaje: string | null) {
    return this.http.post<Postulacion>(this.api + '/postulaciones', {
      vacanteId,
      proyectoId,
      mensaje,
    });
  }

  // Sección: perfil de empresa y sus convocatorias.
  empresa() {
    return this.http.get<Empresa>(this.api + '/empresas/me');
  }

  actualizarEmpresa(datos: Partial<EmpresaDatos>) {
    return this.http.patch<Empresa>(this.api + '/empresas/me', datos);
  }

  propias(pagina: number) {
    return this.http.get<Pagina<Vacante>>(this.api + '/empresas/me/vacantes', {
      params: { pagina, tamano: 12 },
    });
  }

  crear(datos: VacanteDatos) {
    return this.http.post<Vacante>(this.api + '/vacantes', datos);
  }

  editar(id: number, datos: Partial<VacanteDatos>) {
    return this.http.patch<Vacante>(this.api + '/vacantes/' + id, datos);
  }

  cambiarEstadoVacante(id: number, estadoId: number) {
    return this.http.patch<Vacante>(this.api + '/vacantes/' + id + '/estado', { estadoId });
  }

  // Sección: evaluación de postulantes de una vacante propia.
  postulantes(id: number, pagina: number) {
    return this.http.get<Pagina<Postulante>>(this.api + '/vacantes/' + id + '/postulaciones', {
      params: { pagina, tamano: 12 },
    });
  }

  cambiarEstadoPostulacion(id: number, estadoId: number, nota: string | null) {
    return this.http.patch<Postulacion>(this.api + '/postulaciones/' + id + '/estado', {
      estadoId,
      nota,
    });
  }
}
