import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { afterNextRender, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

const CLAVE_TEMA = 'talentmatch.tema';
type Preferencia = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly preferencia = signal<Preferencia>('light');
  readonly tema = this.preferencia.asReadonly();

  constructor() {
    // Sección: recuperar el tema después del primer render en el navegador.
    if (!this.navegador) return;
    afterNextRender(() => {
      try {
        if (this.documento.defaultView?.localStorage.getItem(CLAVE_TEMA) === 'dark') {
          this.aplicar('dark');
        }
      } catch {
        // Si el almacenamiento está bloqueado, se mantiene el tema claro inicial.
      }
    });
  }

  alternar(): void {
    if (!this.navegador) return;
    const tema = this.tema() === 'dark' ? 'light' : 'dark';
    this.aplicar(tema);
    try {
      this.documento.defaultView?.localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      // El tema sigue activo durante la sesión si no se puede guardar.
    }
  }

  private aplicar(tema: Preferencia): void {
    this.preferencia.set(tema);
    this.documento.documentElement.setAttribute('data-bs-theme', tema);
  }
}
