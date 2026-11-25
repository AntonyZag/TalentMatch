import { Component, computed, inject } from '@angular/core';
import { TemaService } from '../../services/tema';

@Component({
  selector: 'app-tema',
  templateUrl: './tema.html',
  styleUrl: './tema.css',
})
export class Tema {
  protected readonly temas = inject(TemaService);
  protected readonly oscuro = computed(() => this.temas.tema() === 'dark');
  protected readonly etiqueta = computed(() =>
    this.oscuro() ? 'Activar modo claro' : 'Activar modo oscuro',
  );
}
