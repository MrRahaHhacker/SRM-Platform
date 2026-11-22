import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { RoleCode } from '../../core/auth/auth.models';

interface RoleDefinition {
  code: RoleCode;
  label: string;
  scope: string;
  permissions: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-roles-matrix',
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="mb-6">
      <a
        routerLink="/users"
        class="inline-flex items-center gap-1.5 text-xs font-bold text-[#315c80] no-underline hover:underline mb-2"
      >
        <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
        <span>Back to User Directory</span>
      </a>
      <span class="block text-[10px] font-extrabold tracking-[0.14em] text-[#64748b] uppercase">
        SRM WORKSPACE / GOVERNANCE / RBAC MATRIX
      </span>
      <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
        RBAC Role & Permission Matrix
      </h1>
      <p class="text-sm text-[#64748b] m-0">
        Server-side enforced Role-Based Access Control across all 7 SRM platform roles and organization scopes.
      </p>
    </div>

    <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-bold text-[#142238] m-0">Role Definitions & Data Scoping</h2>
          <p class="text-xs text-[#64748b] m-0 mt-0.5">Every route and API endpoint validates active JWT roles and entity ownership.</p>
        </div>
        <span class="px-2.5 py-1 rounded bg-[#f1f5f9] text-[#475569] text-[10px] font-extrabold">7 STANDARD ROLES</span>
      </div>

      <div class="overflow-x-auto border border-[#edf1f5] rounded-xl">
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
              <th class="py-2.5 px-3">Role Code</th>
              <th class="py-2.5 px-3">Title</th>
              <th class="py-2.5 px-3">Data Scope</th>
              <th class="py-2.5 px-3">Core Permissions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#edf1f5]">
            @for (r of roleDefinitions; track r.code) {
              <tr class="hover:bg-[#f8fafc]">
                <td class="py-3 px-3 font-mono font-bold text-[#183b5d] whitespace-nowrap">{{ r.code }}</td>
                <td class="py-3 px-3 font-semibold text-[#1e293b] whitespace-nowrap">{{ r.label }}</td>
                <td class="py-3 px-3 text-[#475569]">{{ r.scope }}</td>
                <td class="py-3 px-3 text-[#475569] leading-relaxed">{{ r.permissions }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white border border-[#e3eaf1] rounded-xl p-5">
        <div class="text-xs font-bold text-[#142238] mb-1">Segregation of Duties (SoD)</div>
        <p class="text-xs text-[#64748b] m-0 leading-relaxed">
          Buyers who submit an award recommendation are blocked from approving, returning, or rejecting that approval task.
        </p>
      </div>
      <div class="bg-white border border-[#e3eaf1] rounded-xl p-5">
        <div class="text-xs font-bold text-[#142238] mb-1">Supplier Tenant Isolation</div>
        <p class="text-xs text-[#64748b] m-0 leading-relaxed">
          SUPPLIER_USER accounts only see their own supplier profile, invited RFQs, own bid versions, and same-org colleagues.
        </p>
      </div>
      <div class="bg-white border border-[#e3eaf1] rounded-xl p-5">
        <div class="text-xs font-bold text-[#142238] mb-1">Privilege Escalation Guard</div>
        <p class="text-xs text-[#64748b] m-0 leading-relaxed">
          Only SUPER_ADMIN may assign or modify SUPER_ADMIN privileges. Auditors maintain strictly read-only audit access.
        </p>
      </div>
    </section>
  `,
})
export class RolesMatrixComponent {
  protected readonly roleDefinitions: RoleDefinition[] = [
    {
      code: 'SUPER_ADMIN',
      label: 'Platform Super Admin',
      scope: 'Full platform & security administration',
      permissions: 'Manage all roles including SRM_ADMIN, system settings, and full audit governance.',
    },
    {
      code: 'SRM_ADMIN',
      label: 'SRM Administrator',
      scope: 'Enterprise SRM administration',
      permissions: 'Create/manage users, roles, supplier lifecycle overrides, notification retries, and SAP integration review.',
    },
    {
      code: 'SUPPLIER_USER',
      label: 'Supplier Portal User',
      scope: 'Strictly own supplier organization',
      permissions: 'Manage supplier profile, upload compliance docs, respond to invited RFQs, submit quotations, and manage org colleagues.',
    },
    {
      code: 'SUPPLIER_VERIFIER',
      label: 'Supplier Onboarding Verifier',
      scope: 'All supplier organizations',
      permissions: 'Review onboarding applications, verify/reject compliance certificates, approve or return suppliers.',
    },
    {
      code: 'PROCUREMENT_BUYER',
      label: 'Procurement Buyer',
      scope: 'Sourcing & supplier engagement',
      permissions: 'Map existing SAP Vendor Codes, create/publish RFQs, evaluate bids, negotiate, recommend awards, and sync SAP PIR.',
    },
    {
      code: 'PROCUREMENT_APPROVER',
      label: 'Procurement Approver',
      scope: 'Award governance queue',
      permissions: 'Review award recommendations and approve/return/reject with Segregation of Duties enforcement.',
    },
    {
      code: 'AUDITOR',
      label: 'Compliance Auditor',
      scope: 'Read-only platform governance',
      permissions: 'Inspect supplier histories, approvals, SAP integration logs, IAM directory, and export audit trails.',
    },
  ];
}
