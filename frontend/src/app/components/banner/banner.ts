import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-banner',
  imports: [RouterLink, Auth],
  templateUrl: './banner.html',
  styleUrl: './banner.css',
})
export class Banner {
  private readonly route = inject(ActivatedRoute);
  protected readonly acceso = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => params.get('acceso') === '1' || params.get('registro') === '1'),
    ),
    { initialValue: false },
  );

  private readonly botonEmpezar = viewChild.required<ElementRef<HTMLAnchorElement>>('empezar');
  private readonly panelAcceso = viewChild.required<ElementRef<HTMLElement>>('panelAcceso');
  private antes: boolean | undefined;

  constructor() {
    // Sección: acompaña el cambio de pantalla también con el teclado.
    afterRenderEffect(() => {
      const abierto = this.acceso();
      if (this.antes !== undefined && this.antes !== abierto) {
        const destino = abierto ? this.panelAcceso() : this.botonEmpezar();
        destino.nativeElement.focus({ preventScroll: true });
      }
      this.antes = abierto;
    });
  }
}
