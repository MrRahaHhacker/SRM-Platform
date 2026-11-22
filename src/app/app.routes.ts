import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';
import { LoginComponent } from './features/auth/login';
import { DashboardComponent } from './features/dashboard/dashboard';
import { SuppliersComponent } from './features/suppliers/suppliers';
import { RfqsComponent } from './features/rfqs/rfqs';
import { QuotationsComponent } from './features/quotations/quotations';
import { ApprovalsComponent } from './features/approvals/approvals';
import { ReportsComponent } from './features/reports/reports';
import { UsersComponent } from './features/users/users';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  {
    path: 'suppliers',
    component: SuppliersComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'rfqs',
    component: RfqsComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'quotations',
    component: QuotationsComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: [
        'SUPER_ADMIN',
        'SRM_ADMIN',
        'SUPPLIER_VERIFIER',
        'PROCUREMENT_BUYER',
        'PROCUREMENT_APPROVER',
        'AUDITOR',
        'SUPPLIER_USER',
      ],
    },
  },
  {
    path: 'approvals',
    component: ApprovalsComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR'],
    },
  },
  {
    path: 'reports',
    component: ReportsComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: [
        'SUPER_ADMIN',
        'SRM_ADMIN',
        'SUPPLIER_VERIFIER',
        'PROCUREMENT_BUYER',
        'PROCUREMENT_APPROVER',
        'AUDITOR',
        'SUPPLIER_USER',
      ],
    },
  },
  {
    path: 'users',
    component: UsersComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },
  { path: '**', redirectTo: 'dashboard' },
];
