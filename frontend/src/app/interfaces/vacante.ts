import { HabilidadEstudiante, Postulacion, Proyecto } from './estudiante';

export interface Requisito {
  habilidadId: number;
  nivelMinId: number;
  obligatoria: boolean;
}

export interface VacanteDatos {
  titulo: string;
  descripcion: string;
  tipoId: number | null;
  modalidadId: number | null;
  carreraId: number | null;
  ubicacion: string | null;
  sueldo: number | null;
  cupos: number;
  fechaCierre: string;
  habilidades: Requisito[];
}

export interface Vacante extends VacanteDatos {
  id: number;
  empresaId: number;
  empresa: string;
  tipoId: number;
  modalidadId: number;
  estadoId: number;
  estado: string;
  creadoEn: string;
  matchPct: number | null;
}

export interface FiltrosVacantes {
  q: string;
  carreraId: number | null;
  modalidadId: number | null;
  habilidadId: number | null;
}

export interface EmpresaDatos {
  nombreComercial: string | null;
  sectorId: number;
  telefono: string | null;
  web: string | null;
  descripcion: string | null;
}

export interface Empresa extends EmpresaDatos {
  id: number;
  ruc: string;
  razonSocial: string;
  direccion: string | null;
  estadoSunat: string | null;
  rucValidado: boolean;
}

export interface Postulante extends Postulacion {
  nombres: string;
  apellidoPat: string;
  apellidoMat: string | null;
  habilidades: HabilidadEstudiante[];
  proyectos: Proyecto[];
}
