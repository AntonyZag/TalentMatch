import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { Catalogos, ElementoCatalogo } from '../../interfaces/comun';
import {
  DatosPerfil,
  HabilidadEstudiante,
  PerfilEstudianteLectura,
} from '../../interfaces/estudiante';
import { CatalogosService } from '../../services/catalogos';
import { errorApi } from '../../services/error-api';
import { EstudianteService } from '../../services/estudiante';

@Component({
  selector: 'app-perfil-estudiante',
  imports: [FormsModule, RouterLink],
  templateUrl: './perfil-estudiante.html',
  styleUrl: './perfil-estudiante.css',
})
export class PerfilEstudiante implements OnInit {
  private readonly estudiantes = inject(EstudianteService);
  private readonly catalogosApi = inject(CatalogosService);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly perfil = signal<PerfilEstudianteLectura | null>(null);
  readonly catalogos = signal<Catalogos | null>(null);
  readonly habilidades = signal<HabilidadEstudiante[]>([]);
  readonly cargando = signal(true);
  readonly guardandoPerfil = signal(false);
  readonly guardandoHabilidades = signal(false);
  readonly errorCarga = signal('');
  readonly errorPerfil = signal('');
  readonly errorHabilidades = signal('');
  readonly avisoPerfil = signal('');
  readonly avisoHabilidades = signal('');
  // El formulario aparece tras cargar los datos del perfil.
  datos!: DatosPerfil;
  habilidadId: number | null = null;
  nivelId: number | null = null;

  ngOnInit() {
    if (this.navegador) this.cargar();
  }

  // Sección: datos académicos y de contacto
  cargar() {
    this.errorCarga.set('');
    this.cargando.set(true);
    forkJoin({ perfil: this.estudiantes.perfil(), catalogos: this.catalogosApi.obtener() })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: ({ perfil, catalogos }) => {
          this.catalogos.set(catalogos);
          this.datos = {
            carreraId: perfil.carreraId,
            estadoAcademicoId: perfil.estadoAcademicoId,
            ciclo: perfil.ciclo,
            anioEgreso: perfil.anioEgreso,
            telefono: perfil.telefono,
            bio: perfil.bio,
            githubUrl: perfil.githubUrl,
            linkedinUrl: perfil.linkedinUrl,
          };
          this.habilidades.set(perfil.habilidades);
          this.perfil.set(perfil);
        },
        error: (err) => this.errorCarga.set(errorApi(err)),
      });
  }

  pideCiclo(): boolean {
    return (
      this.catalogos()?.estadosAcademicos.find((e) => e.id === this.datos.estadoAcademicoId)
        ?.pideCiclo ?? false
    );
  }

  guardarPerfil(form: NgForm) {
    if (this.guardandoPerfil()) return;
    this.avisoPerfil.set('');
    this.errorPerfil.set('');
    if (form.invalid || (this.pideCiclo() && this.datos.ciclo == null)) {
      form.control.markAllAsTouched();
      this.errorPerfil.set('Revisa los campos marcados y los enlaces ingresados.');
      return;
    }
    const datos = {
      ...this.datos,
      ciclo: this.pideCiclo() ? this.datos.ciclo : null,
      telefono: this.datos.telefono?.trim() || null,
      bio: this.datos.bio?.trim() || null,
      githubUrl: this.datos.githubUrl?.trim() || null,
      linkedinUrl: this.datos.linkedinUrl?.trim() || null,
    };
    this.guardandoPerfil.set(true);
    this.estudiantes
      .actualizarPerfil(datos)
      .pipe(finalize(() => this.guardandoPerfil.set(false)))
      .subscribe({
        next: (perfil) => {
          this.perfil.set(perfil);
          this.avisoPerfil.set('Perfil guardado.');
        },
        error: (err) => this.errorPerfil.set(errorApi(err)),
      });
  }

  // Sección: selección del nivel por habilidad
  nombre(lista: ElementoCatalogo[], id: number) {
    return lista.find((item) => item.id === id)?.nombre ?? 'Sin detalle';
  }

  agregarHabilidad() {
    this.errorHabilidades.set('');
    this.avisoHabilidades.set('');
    if (!this.habilidadId || !this.nivelId) {
      this.errorHabilidades.set('Elige una habilidad y su nivel.');
      return;
    }
    if (this.habilidades().some((h) => h.habilidadId === this.habilidadId)) {
      this.errorHabilidades.set('Esta habilidad ya está en tu lista. Puedes cambiar su nivel.');
      return;
    }
    this.habilidades.update((lista) => [
      ...lista,
      { habilidadId: this.habilidadId!, nivelId: this.nivelId! },
    ]);
    this.habilidadId = this.nivelId = null;
  }

  cambiarNivel(habilidadId: number, nivelId: number) {
    this.avisoHabilidades.set('');
    this.habilidades.update((lista) =>
      lista.map((h) => (h.habilidadId === habilidadId ? { habilidadId, nivelId } : h)),
    );
  }

  quitarHabilidad(id: number) {
    this.avisoHabilidades.set('');
    this.habilidades.update((lista) => lista.filter((h) => h.habilidadId !== id));
  }

  guardarHabilidades() {
    if (this.guardandoHabilidades()) return;
    this.errorHabilidades.set('');
    this.avisoHabilidades.set('');
    this.guardandoHabilidades.set(true);
    this.estudiantes
      .guardarHabilidades(this.habilidades())
      .pipe(finalize(() => this.guardandoHabilidades.set(false)))
      .subscribe({
        next: (lista) => {
          this.habilidades.set(lista);
          this.avisoHabilidades.set('Habilidades guardadas.');
        },
        error: (err) => this.errorHabilidades.set(errorApi(err)),
      });
  }
}
