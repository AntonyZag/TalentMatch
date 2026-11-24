import { HttpErrorResponse } from '@angular/common/http';

// Sección: mensajes que se muestran junto al formulario o la lista.
export function errorApi(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrió un problema. Inténtalo de nuevo.';
  }
  const detail: unknown = error.error?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (error.status === 0)
    return 'No se pudo conectar con TalentMatch. Revisa tu conexión y vuelve a intentar.';
  if (error.status === 401) return 'Tu sesión venció. Vuelve a iniciar sesión.';
  if (error.status === 403) return 'Tu cuenta no tiene permiso para esta acción.';
  if (error.status === 404) return 'No se encontró el registro solicitado.';
  if (error.status === 409)
    return 'El registro cambió o ya existe. Actualiza la vista y vuelve a intentar.';
  if (error.status === 400 || error.status === 422)
    return 'Revisa los campos del formulario y vuelve a intentar.';
  return 'El servicio no está disponible en este momento. Vuelve a intentar.';
}
