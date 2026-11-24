import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { environment } from '../../environments/environment';
import { Pagina } from '../interfaces/comun';
import {
  DatosPerfil,
  HabilidadEstudiante,
  PerfilEstudianteLectura,
  Postulacion,
  PostulacionPropia,
  Proyecto,
  ProyectoDatos,
} from '../interfaces/estudiante';

@Injectable({ providedIn: 'root' })
export class EstudianteService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl + '/api';

  // Sección: perfil y habilidades
  perfil() {
    return this.http.get<PerfilEstudianteLectura>(this.api + '/estudiantes/me');
  }

  actualizarPerfil(datos: Partial<DatosPerfil>) {
    return this.http.patch<PerfilEstudianteLectura>(this.api + '/estudiantes/me', datos);
  }

  guardarHabilidades(habilidades: HabilidadEstudiante[]) {
    return this.http.put<HabilidadEstudiante[]>(this.api + '/estudiantes/me/habilidades', {
      habilidades,
    });
  }

  // Sección: portafolio personal y público
  proyectos(pagina = 1, tamano = 12) {
    return this.http.get<Pagina<Proyecto>>(this.api + '/proyectos', { params: { pagina, tamano } });
  }

  portafolio(estudianteId: number, pagina = 1, tamano = 12) {
    return this.http.get<Pagina<Proyecto>>(
      this.api + '/estudiantes/' + estudianteId + '/portafolio',
      {
        params: { pagina, tamano },
      },
    );
  }

  crearProyecto(datos: ProyectoDatos) {
    return this.http.post<Proyecto>(this.api + '/proyectos', datos);
  }

  editarProyecto(id: number, datos: Partial<ProyectoDatos>) {
    return this.http.patch<Proyecto>(this.api + '/proyectos/' + id, datos);
  }

  eliminarProyecto(id: number) {
    return this.http.delete<void>(this.api + '/proyectos/' + id);
  }

  // Sección: seguimiento de postulaciones
  postulaciones(pagina = 1, tamano = 10) {
    return this.http.get<Pagina<PostulacionPropia>>(this.api + '/postulaciones/mias', {
      params: { pagina, tamano },
    });
  }

  retirarPostulacion(id: number, nota: string | null) {
    return this.http.post<Postulacion>(this.api + '/postulaciones/' + id + '/retiro', { nota });
  }
}
