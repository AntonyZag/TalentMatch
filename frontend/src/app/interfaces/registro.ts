export interface DocumentoDni {
  nombres: string;
  apellidoPat: string;
  apellidoMat: string | null;
}

export interface DocumentoRuc {
  razonSocial: string;
  nombreComercial: string | null;
  estadoSunat: string | null;
  direccion: string | null;
}

interface CredencialesRegistro {
  correo: string;
  contrasena: string;
}

export interface AltaEstudiante extends CredencialesRegistro {
  dni: string;
  carreraId: number;
  estadoAcademicoId: number;
  ciclo: number | null;
}

export interface AltaEmpresa extends CredencialesRegistro {
  ruc: string;
  sectorId: number;
}
