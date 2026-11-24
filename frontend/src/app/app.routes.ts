import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { requiereRol } from './guards/rol';

export const routes: Routes = [
  // Sección: portada y tarjeta de acceso sobre la misma fotografía.
  {
    path: '',
    pathMatch: 'full',
    title: 'TalentMatch',
    loadComponent: () => import('./components/banner/banner').then((m) => m.Banner),
  },
  {
    path: 'acceso',
    redirectTo: ({ queryParams }) =>
      inject(Router).createUrlTree(['/'], { queryParams: { ...queryParams, acceso: 1 } }),
  },
  // Sección: vistas internas con el mismo menú lateral.
  {
    path: '',
    loadComponent: () => import('./components/navbar/navbar').then((m) => m.Navbar),
    children: [
      {
        path: 'vacantes',
        title: 'Vacantes · TalentMatch',
        loadComponent: () => import('./components/vacantes/vacantes').then((m) => m.Vacantes),
      },
      {
        path: 'vacantes/:id',
        title: 'Detalle de vacante · TalentMatch',
        loadComponent: () => import('./components/vacantes/vacantes').then((m) => m.Vacantes),
      },
      {
        path: 'perfil-estudiante',
        title: 'Mi perfil · TalentMatch',
        canActivate: [requiereRol('ESTUDIANTE')],
        loadComponent: () =>
          import('./components/perfil-estudiante/perfil-estudiante').then(
            (m) => m.PerfilEstudiante,
          ),
      },
      {
        path: 'proyectos',
        title: 'Mis proyectos · TalentMatch',
        canActivate: [requiereRol('ESTUDIANTE')],
        loadComponent: () => import('./components/proyectos/proyectos').then((m) => m.Proyectos),
      },
      {
        path: 'portafolio/:id',
        title: 'Portafolio · TalentMatch',
        loadComponent: () => import('./components/proyectos/proyectos').then((m) => m.Proyectos),
      },
      {
        path: 'mis-postulaciones',
        title: 'Mis postulaciones · TalentMatch',
        canActivate: [requiereRol('ESTUDIANTE')],
        loadComponent: () =>
          import('./components/mis-postulaciones/mis-postulaciones').then(
            (m) => m.MisPostulaciones,
          ),
      },
      {
        path: 'panel-empresa',
        title: 'Panel de empresa · TalentMatch',
        canActivate: [requiereRol('EMPRESA')],
        loadComponent: () =>
          import('./components/panel-empresa/panel-empresa').then((m) => m.PanelEmpresa),
      },
      {
        path: 'impacto',
        title: 'Impacto social · TalentMatch',
        canActivate: [requiereRol('ADMIN')],
        loadComponent: () => import('./components/impacto/impacto').then((m) => m.Impacto),
      },
    ],
  },
  { path: '**', redirectTo: '/' },
];
