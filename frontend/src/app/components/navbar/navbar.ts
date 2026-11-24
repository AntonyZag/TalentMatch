import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SesionService } from '../../services/sesion';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Footer],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  host: { '(document:keydown.escape)': 'cerrarMenu()' },
})
export class Navbar {
  readonly sesion = inject(SesionService);
  readonly abierto = signal(false);
  private readonly router = inject(Router);

  constructor() {
    // Sección: cerrar el menú móvil al navegar.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.cerrarMenu());
  }

  cerrarMenu() {
    this.abierto.set(false);
  }

  salir() {
    this.sesion.cerrar();
    void this.router.navigate(['/']);
  }
}
