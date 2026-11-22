import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';
import { LoginComponent } from './features/auth/login';
import { DashboardComponent } from './features/dashboard/dashboard';
import { SuppliersComponent } from './features/suppliers/suppliers';
import { SupplierFormComponent } from './features/suppliers/supplier-form';
import { SupplierDetailComponent } from './features/suppliers/supplier-detail';
import { RfqsComponent } from './features/rfqs/rfqs';
import { RfqFormComponent } from './features/rfqs/rfq-form';
import { RfqDetailComponent } from './features/rfqs/rfq-detail';
import { QuotationsComponent } from './features/quotations/quotations';
import { QuotationRfqComponent } from './features/quotations/quotation-rfq';
import { QuotationSubmitComponent } from './features/quotations/quotation-submit';
import { QuotationNegotiateComponent } from './features/quotations/quotation-negotiate';
import { QuotationRecommendComponent } from './features/quotations/quotation-recommend';
import { ApprovalsComponent } from './features/approvals/approvals';
import { ApprovalDetailComponent } from './features/approvals/approval-detail';
import { ReportsComponent } from './features/reports/reports';
import { UsersComponent } from './features/users/users';
import { UserFormComponent } from './features/users/user-form';
import { RolesMatrixComponent } from './features/users/roles-matrix';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },

  // Suppliers Module (static routes before :supplierId)
  {
    path: 'suppliers',
    component: SuppliersComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'suppliers/new',
    component: SupplierFormComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER'],
    },
  },
  {
    path: 'suppliers/:supplierId/edit',
    component: SupplierFormComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'suppliers/:supplierId',
    component: SupplierDetailComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },

  // RFQs Module (static routes before :rfqId)
  {
    path: 'rfqs',
    component: RfqsComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'rfqs/new',
    component: RfqFormComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER'],
    },
  },
  {
    path: 'rfqs/:rfqId/edit',
    component: RfqFormComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER'],
    },
  },
  {
    path: 'rfqs/:rfqId',
    component: RfqDetailComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },

  // Quotations, Evaluation & Negotiations Module
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
    path: 'quotations/rfq/:rfqId/submit',
    component: QuotationSubmitComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPPLIER_USER', 'SUPER_ADMIN', 'SRM_ADMIN'],
    },
  },
  {
    path: 'quotations/rfq/:rfqId/negotiate',
    component: QuotationNegotiateComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'quotations/rfq/:rfqId/recommend/:versionId',
    component: QuotationRecommendComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['PROCUREMENT_BUYER', 'SUPER_ADMIN', 'SRM_ADMIN'],
    },
  },
  {
    path: 'quotations/rfq/:rfqId',
    component: QuotationRfqComponent,
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

  // Approvals & SAP PIR Module
  {
    path: 'approvals',
    component: ApprovalsComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR'],
    },
  },
  {
    path: 'approvals/:requestId',
    component: ApprovalDetailComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR'],
    },
  },

  // Audit & Notifications
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

  // Users & RBAC Module (static routes before :userId)
  {
    path: 'users',
    component: UsersComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'AUDITOR', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'users/new',
    component: UserFormComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_USER'],
    },
  },
  {
    path: 'users/roles-matrix',
    component: RolesMatrixComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'AUDITOR'],
    },
  },
  {
    path: 'users/:userId/edit',
    component: UserFormComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_USER'],
    },
  },

  { path: '**', redirectTo: 'dashboard' },
];
