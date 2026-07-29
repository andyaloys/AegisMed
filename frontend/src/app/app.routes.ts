import { Routes } from '@angular/router';
import { MainLayoutComponent } from './shared/layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () => import('./features/overview/overview.component').then(m => m.OverviewComponent)
      },
      {
        path: 'ugd-cases/:indicatorId',
        loadComponent: () => import('./features/ugd-cases/ugd-cases.component').then(m => m.UgdCasesComponent)
      },
      {
        path: 'capa',
        loadComponent: () => import('./features/capa/capa.component').then(m => m.CapaComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
