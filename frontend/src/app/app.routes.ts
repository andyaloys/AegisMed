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
      // Dedicated Dashboard Mutu NSI
      {
        path: 'nsi-dashboard',
        loadComponent: () => import('./features/nsi-dashboard/nsi-dashboard.component').then(m => m.NsiDashboardComponent)
      },
      // NSI Audit Module (Overview)
      {
        path: 'nsi-audit',
        loadComponent: () => import('./features/nsi-audit/nsi-audit.component').then(m => m.NsiAuditComponent)
      },
      // NSI Individual Indicators (Standard Layout & Dedicated Input/Edit Pages)
      {
        path: 'nsi-indicators/:indicatorId/input',
        loadComponent: () => import('./features/nsi-indicators/nsi-audit-input.component').then(m => m.NsiAuditInputComponent)
      },
      {
        path: 'nsi-indicators/:indicatorId/edit/:submissionId',
        loadComponent: () => import('./features/nsi-indicators/nsi-audit-input.component').then(m => m.NsiAuditInputComponent)
      },
      {
        path: 'nsi-indicators/:indicatorId',
        loadComponent: () => import('./features/nsi-indicators/nsi-indicator-detail.component').then(m => m.NsiIndicatorDetailComponent)
      },
      // PDSA Module (Analisis & Tindak Lanjut)
      {
        path: 'pdsa',
        loadComponent: () => import('./features/pdsa/pdsa.component').then(m => m.PdsaComponent)
      },
      // User Management & RBAC Module
      {
        path: 'users',
        loadComponent: () => import('./features/user-management/user-management.component').then(m => m.UserManagementComponent)
      },
      // Project Improvement IGD (Dedicated Dashboard & Cases)
      {
        path: 'project-improvement-igd/dashboard',
        loadComponent: () => import('./features/ugd-dashboard/ugd-dashboard.component').then(m => m.UgdDashboardComponent)
      },
      {
        path: 'ugd-dashboard',
        redirectTo: 'project-improvement-igd/dashboard',
        pathMatch: 'full'
      },
      {
        path: 'project-improvement-igd/:indicatorId/input',
        loadComponent: () => import('./features/ugd-cases/ugd-case-input.component').then(m => m.UgdCaseInputComponent)
      },
      {
        path: 'project-improvement-igd/:indicatorId/edit/:caseId',
        loadComponent: () => import('./features/ugd-cases/ugd-case-input.component').then(m => m.UgdCaseInputComponent)
      },
      {
        path: 'project-improvement-igd/:indicatorId',
        loadComponent: () => import('./features/ugd-cases/ugd-cases.component').then(m => m.UgdCasesComponent)
      },
      // Backward compatibility aliases for ugd-cases
      {
        path: 'ugd-cases/:indicatorId/input',
        loadComponent: () => import('./features/ugd-cases/ugd-case-input.component').then(m => m.UgdCaseInputComponent)
      },
      {
        path: 'ugd-cases/:indicatorId/edit/:caseId',
        loadComponent: () => import('./features/ugd-cases/ugd-case-input.component').then(m => m.UgdCaseInputComponent)
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
