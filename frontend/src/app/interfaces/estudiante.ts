// Sección: perfil académico
export interface HabilidadEstudiante {
  habilidadId: number;
  nivelId: number;
}

export interface DatosPerfil {
  carreraId: number;
  estadoAcademicoId: number;
  ciclo: number | null;
  anioEgreso: number | null;
  telefono: string | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
}

export interface PerfilEstudianteLectura extends DatosPerfil {
  id: number;
  dni: string;
  nombres: string;
  apellidoPat: string;
  apellidoMat: string | null;
  dniValidado: boolean;
  habilidades: HabilidadEstudiante[];
}

// Sección: proyectos de portafolio
export interface ProyectoDatos {
  titulo: string;
  descripcion: string;
  fecha: string;
  curso: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  imagenUrl: string | null;
  visible: boolean;
  habilidadIds: number[];
}

export interface Proyecto extends ProyectoDatos {
  id: number;
  estudianteId: number;
}

// Sección: postulaciones e historial
export interface Postulacion {
  id: number;
  vacanteId: number;
  estudianteId: number;
  estadoId: number;
  estado: string;
  proyectoId: number | null;
  mensaje: string | null;
  matchPct: number;
  creadoEn: string;
}

export interface EventoPostulacion {
  id: number;
  postulacionId: number;
  estadoAnteriorId: number | null;
  estadoNuevoId: number;
  usuarioId: number;
  nota: string | null;
  fecha: string;
}

export interface PostulacionPropia extends Postulacion {
  vacante: string;
  historial: EventoPostulacion[];
}

export interface MetricasImpacto {
  estudiantesVerificados: number;
  empresasVerificadas: number;
  proyectos: number;
  vacantesAbiertas: number;
  estudiantesAceptados: number;
}
