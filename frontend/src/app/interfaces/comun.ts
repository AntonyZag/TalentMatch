// Sección: sesión y roles del backend.
export type Rol = 'ESTUDIANTE' | 'EMPRESA' | 'ADMIN';

export interface UsuarioSesion {
  id: number;
  correo: string;
  rol: Rol;
}

export interface Acceso extends UsuarioSesion {
  accessToken: string;
  tokenType: string;
}

// Sección: catálogos y páginas de resultados.
export interface ElementoCatalogo {
  id: number;
  nombre: string;
}

export interface Catalogos {
  carreras: ElementoCatalogo[];
  modalidades: ElementoCatalogo[];
  sectores: ElementoCatalogo[];
  estadosAcademicos: (ElementoCatalogo & { pideCiclo: boolean })[];
  niveles: (ElementoCatalogo & { peso: number })[];
  categoriasHabilidad: ElementoCatalogo[];
  habilidades: (ElementoCatalogo & { categoriaId: number })[];
  tiposVacante: ElementoCatalogo[];
  estadosVacante: ElementoCatalogo[];
  estadosPostulacion: (ElementoCatalogo & { orden: number })[];
}

export interface Pagina<T> {
  items: T[];
  pagina: number;
  tamano: number;
  total: number;
}
