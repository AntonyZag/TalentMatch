import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Catalogos, ElementoCatalogo, Pagina } from '../../interfaces/comun';
import { Empresa, EmpresaDatos, Postulante, Vacante, VacanteDatos } from '../../interfaces/vacante';
import { CatalogosService } from '../../services/catalogos';
import { errorApi } from '../../services/error-api';
import { VacantesService } from '../../services/vacantes';

type VistaEmpresa = 'vacantes' | 'perfil' | 'formulario' | 'postulantes';

function vacanteNueva(): VacanteDatos {
  return {
    titulo: '',
    descripcion: '',
    tipoId: null,
    modalidadId: null,
    carreraId: null,
    ubicacion: null,
    sueldo: null,
    cupos: 1,
    fechaCierre: '',
    habilidades: [],
  };
}

function datosVacante(v: Vacante): VacanteDatos {
  return {
    titulo: v.titulo,
    descripcion: v.descripcion,
    tipoId: v.tipoId,
    modalidadId: v.modalidadId,
    carreraId: v.carreraId,
    ubicacion: v.ubicacion,
    sueldo: v.sueldo,
    cupos: v.cupos,
    fechaCierre: v.fechaCierre,
    habilidades: v.habilidades.map((h) => ({ ...h })),
  };
}

function datosEmpresa(e: Empresa): EmpresaDatos {
  return {
    nombreComercial: e.nombreComercial,
    sectorId: e.sectorId,
    telefono: e.telefono,
    web: e.web,
    descripcion: e.descripcion,
  };
}

// Envía solo los campos editados. El cupo puede haber cambiado por otra aceptación.
function cambios<T extends object>(original: T, actual: T): Partial<T> {
  const resultado: Partial<T> = {};
  for (const clave of Object.keys(actual) as (keyof T)[]) {
    if (JSON.stringify(actual[clave]) !== JSON.stringify(original[clave])) {
      resultado[clave] = actual[clave];
    }
  }
  return resultado;
}

@Component({
  selector: 'app-panel-empresa',
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './panel-empresa.html',
  styleUrl: './panel-empresa.css',
})
export class PanelEmpresa implements OnInit {
  private readonly api = inject(VacantesService);
  private readonly catalogsApi = inject(CatalogosService);
  private readonly plataforma = inject(PLATFORM_ID);

  readonly vista = signal<VistaEmpresa>('vacantes');
  readonly empresa = signal<Empresa | null>(null);
  readonly catalogos = signal<Catalogos | null>(null);
  readonly propias = signal<Pagina<Vacante> | null>(null);
  readonly candidaturas = signal<Pagina<Postulante> | null>(null);
  readonly seleccionada = signal<Vacante | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly estadoEnEdicion = signal<number | null>(null);
  readonly candidaturaEnEdicion = signal<number | null>(null);
  readonly candidaturaAbierta = signal<number | null>(null);
  perfil: EmpresaDatos | null = null;
  vacante: VacanteDatos = vacanteNueva();
  habilidadId: number | null = null;
  nivelMinId: number | null = null;
  obligatoria = true;
  estadoId: number | null = null;
  nota = '';

  ngOnInit() {
    if (isPlatformBrowser(this.plataforma)) void this.iniciar();
  }

  async iniciar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const datos = await firstValueFrom(
        forkJoin({
          catalogos: this.catalogsApi.obtener(),
          empresa: this.api.empresa(),
          vacantes: this.api.propias(1),
        }),
      );
      this.catalogos.set(datos.catalogos);
      this.empresa.set(datos.empresa);
      this.propias.set(datos.vacantes);
      this.perfil = datosEmpresa(datos.empresa);
    } catch (e) {
      this.error.set(errorApi(e));
    } finally {
      this.cargando.set(false);
    }
  }

  nombre(items: ElementoCatalogo[] | undefined, id: number | null) {
    return items?.find((item) => item.id === id)?.nombre ?? 'Sin especificar';
  }

  private async ejecutar(accion: () => Promise<void>) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.aviso.set('');
    try {
      await accion();
    } catch (e) {
      this.error.set(errorApi(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  ir(vista: VistaEmpresa) {
    this.vista.set(vista);
    this.error.set('');
    this.aviso.set('');
    this.estadoEnEdicion.set(null);
    this.candidaturaEnEdicion.set(null);
    this.candidaturaAbierta.set(null);
    if (vista === 'perfil' && this.empresa()) this.perfil = datosEmpresa(this.empresa()!);
  }

  // Sección: perfil de la empresa.
  guardarPerfil() {
    if (!this.perfil || !this.empresa()) return;
    const perfil = { ...this.perfil };
    perfil.nombreComercial = perfil.nombreComercial?.trim() || null;
    perfil.web = perfil.web?.trim() || null;
    perfil.telefono = perfil.telefono?.trim() || null;
    perfil.descripcion = perfil.descripcion?.trim() || null;
    const edicion = cambios(datosEmpresa(this.empresa()!), perfil);
    return this.ejecutar(async () => {
      if (Object.keys(edicion).length) {
        const empresa = await firstValueFrom(this.api.actualizarEmpresa(edicion));
        this.empresa.set(empresa);
        this.perfil = datosEmpresa(empresa);
      }
      this.aviso.set('Perfil guardado.');
    });
  }

  // Sección: publicación, edición y estado de vacantes.
  abrirFormulario(vacante?: Vacante) {
    this.ir('formulario');
    this.seleccionada.set(vacante ?? null);
    this.vacante = vacante ? datosVacante(vacante) : vacanteNueva();
    this.habilidadId = null;
    this.nivelMinId = null;
    this.obligatoria = true;
  }

  agregarRequisito() {
    this.error.set('');
    if (!this.habilidadId || !this.nivelMinId) {
      this.error.set('Selecciona la habilidad y el nivel mínimo.');
      return;
    }
    if (this.vacante.habilidades.some((h) => h.habilidadId === this.habilidadId)) {
      this.error.set('Esta habilidad ya está en la lista.');
      return;
    }
    this.vacante.habilidades = [
      ...this.vacante.habilidades,
      {
        habilidadId: this.habilidadId,
        nivelMinId: this.nivelMinId,
        obligatoria: this.obligatoria,
      },
    ];
    this.habilidadId = null;
    this.nivelMinId = null;
    this.obligatoria = true;
  }

  quitarRequisito(id: number) {
    this.vacante.habilidades = this.vacante.habilidades.filter((h) => h.habilidadId !== id);
  }

  guardarVacante() {
    const original = this.seleccionada();
    const datos: VacanteDatos = {
      ...this.vacante,
      titulo: this.vacante.titulo.trim(),
      descripcion: this.vacante.descripcion.trim(),
      ubicacion: this.vacante.ubicacion?.trim() || null,
    };
    if (
      !datos.titulo ||
      !datos.descripcion ||
      !datos.tipoId ||
      !datos.modalidadId ||
      !datos.fechaCierre
    ) {
      this.error.set('Completa los datos obligatorios de la vacante.');
      return;
    }
    if (this.habilidadId || this.nivelMinId) {
      this.error.set('Añade el requisito pendiente o limpia su selección antes de guardar.');
      return;
    }
    return this.ejecutar(async () => {
      if (original) {
        const edicion = cambios(datosVacante(original), datos);
        if (Object.keys(edicion).length) {
          const nueva = await firstValueFrom(this.api.editar(original.id, edicion));
          this.reemplazarVacante(nueva);
        }
        this.ir('vacantes');
        this.aviso.set('Cambios guardados.');
      } else {
        await firstValueFrom(this.api.crear(datos));
        this.ir('vacantes');
        this.aviso.set('Vacante publicada.');
        this.propias.set(await firstValueFrom(this.api.propias(1)));
      }
    });
  }

  private reemplazarVacante(actualizada: Vacante) {
    this.propias.update(
      (p) =>
        p && {
          ...p,
          items: p.items.map((v) => (v.id === actualizada.id ? actualizada : v)),
        },
    );
    if (this.seleccionada()?.id === actualizada.id) this.seleccionada.set(actualizada);
  }

  paginaVacantes(numero: number) {
    this.estadoEnEdicion.set(null);
    return this.ejecutar(async () => {
      this.propias.set(await firstValueFrom(this.api.propias(numero)));
    });
  }

  abrirEstadoVacante(v: Vacante) {
    this.error.set('');
    this.aviso.set('');
    this.estadoEnEdicion.set(v.id);
    this.estadoId = v.estadoId;
  }

  guardarEstadoVacante(id: number) {
    const estado = this.estadoId;
    if (!estado) return;
    return this.ejecutar(async () => {
      this.reemplazarVacante(await firstValueFrom(this.api.cambiarEstadoVacante(id, estado)));
      this.estadoEnEdicion.set(null);
      this.aviso.set('Estado de vacante actualizado.');
    });
  }

  // Sección: candidatos y evaluación por vacante.
  verPostulantes(v: Vacante, pagina = 1) {
    this.ir('postulantes');
    this.seleccionada.set(v);
    this.candidaturas.set(null);
    return this.ejecutar(async () => {
      const resultado = await firstValueFrom(this.api.postulantes(v.id, pagina));
      this.candidaturas.set({
        ...resultado,
        items: [...resultado.items].sort((a, b) => b.matchPct - a.matchPct),
      });
    });
  }

  abrirEstadoPostulacion(p: Postulante) {
    this.error.set('');
    this.aviso.set('');
    this.candidaturaEnEdicion.set(p.id);
    this.estadoId = p.estadoId;
    this.nota = '';
  }

  guardarEstadoPostulacion(p: Postulante) {
    const estado = this.estadoId;
    if (!estado || p.estado === 'Aceptada') return;
    return this.ejecutar(async () => {
      const actual = await firstValueFrom(
        this.api.cambiarEstadoPostulacion(p.id, estado, this.nota.trim() || null),
      );
      this.candidaturas.update(
        (pagina) =>
          pagina && {
            ...pagina,
            items: pagina.items.map((item) => (item.id === p.id ? { ...item, ...actual } : item)),
          },
      );
      this.candidaturaEnEdicion.set(null);
      this.aviso.set('Estado de postulación actualizado.');
      if (actual.estado === 'Aceptada') {
        const lista = await firstValueFrom(this.api.propias(this.propias()?.pagina ?? 1));
        this.propias.set(lista);
        this.seleccionada.set(lista.items.find((v) => v.id === p.vacanteId) ?? this.seleccionada());
      }
    });
  }
}
