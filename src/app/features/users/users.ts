import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import type { RoleCode } from '../../core/auth/auth.models';
import { SrmService } from '../../core/services/srm.service';
import type { ManagedUser } from '../../core/services/srm.models';
import { SupplierService } from '../suppliers/supplier.service';
import type { Supplier } from '../suppliers/supplier.models';

interface RoleDefinition {
  code: RoleCode;
  label: string;
  scope: string;
  permissions: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-users',
  imports: [ReactiveFormsModule, DatePipe, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#64748b] uppercase">
          SRM WORKSPACE / ADMINISTRATION
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
          {{
            isSupplierOnly()
              ? 'Organization Colleague Users'
              : canCreateUsers()
                ? 'User Management & RBAC Roles'
                : 'User Directory (Read-Only Compliance)'
          }}
        </h1>
        <p class="text-sm text-[#64748b] m-0">
          {{
            isSupplierOnly()
              ? 'Provision and manage portal user accounts strictly within your supplier organization.'
              : canCreateUsers()
                ? 'Create internal and supplier user accounts, assign least-privilege RBAC roles, and control account status.'
                : 'Read-only inspection of SRM user accounts, role assignments, and organization links.'
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        @if (canViewRbacMatrix()) {
          <button
            type="button"
            (click)="toggleMatrix()"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] hover:bg-[#f8fafc] cursor-pointer"
          >
            <mat-icon class="!text-base !w-4 !h-4">verified_user</mat-icon>
            <span>{{ showMatrix() ? 'Hide RBAC Matrix' : 'RBAC Role Matrix' }}</span>
          </button>
        }
        @if (canViewUsers()) {
          <button
            type="button"
            (click)="loadUsers()"
            [disabled]="loading()"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] hover:bg-[#f8fafc] cursor-pointer disabled:opacity-55"
          >
            <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
            <span>Refresh</span>
          </button>
        }
        @if (canCreateUsers()) {
          <button
            type="button"
            (click)="toggleCreatePanel()"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold hover:bg-[#122e49] cursor-pointer"
          >
            <mat-icon class="!text-base !w-4 !h-4">{{ showCreateForm() ? 'close' : 'person_add' }}</mat-icon>
            <span>{{ showCreateForm() ? 'Close Form' : (isSupplierOnly() ? 'Add Colleague' : 'Create New User') }}</span>
          </button>
        }
      </div>
    </div>

    @if (successMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#edf8f1] border border-[#b9e3d0] text-[#267447] text-xs font-medium" role="status">
        {{ successMessage() }}
      </div>
    }
    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    <!-- KPI Summary Cards -->
    @if (canViewUsers()) {
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Total Accounts</span>
          <div class="text-2xl font-extrabold text-[#142238] mt-1 tabular-nums">{{ users().length }}</div>
          <div class="text-[11px] text-[#64748b] mt-0.5">
            {{ isSupplierOnly() ? 'Scoped to your supplier org' : 'Internal + Supplier Portal' }}
          </div>
        </div>
        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Active Users</span>
          <div class="text-2xl font-extrabold text-[#16834e] mt-1 tabular-nums">{{ activeCount() }}</div>
          <div class="text-[11px] text-[#64748b] mt-0.5">Authorized for workspace sign-in</div>
        </div>
        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Supplier Portal</span>
          <div class="text-2xl font-extrabold text-[#183b5d] mt-1 tabular-nums">{{ supplierUserCount() }}</div>
          <div class="text-[11px] text-[#64748b] mt-0.5">Org-isolated external users</div>
        </div>
        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Pending / Suspended</span>
          <div class="text-2xl font-extrabold text-[#9a6700] mt-1 tabular-nums">{{ inactiveCount() }}</div>
          <div class="text-[11px] text-[#64748b] mt-0.5">Disabled, suspended, or pending</div>
        </div>
      </section>
    }

    <!-- Non-Admin Read-Only Notice -->
    @if (!canCreateUsers() && !canViewUsers()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
        <div class="flex items-start gap-3">
          <mat-icon class="text-[#315c80] shrink-0">admin_panel_settings</mat-icon>
          <div>
            <h2 class="text-sm font-bold text-[#142238] m-0">User Provisioning Restricted by RBAC Policy</h2>
            <p class="text-xs text-[#64748b] m-0 mt-1 leading-relaxed">
              Your active role (<strong>{{ currentRolesLabel() }}</strong>) does not include IAM user administration.
              Internal user creation and role assignment are restricted to <strong>SRM_ADMIN</strong> and <strong>SUPER_ADMIN</strong>,
              while <strong>SUPPLIER_USER</strong> accounts can manage colleague accounts within their own supplier organization.
            </p>
          </div>
        </div>
      </section>
    }

    <!-- Create New User Form -->
    @if (canCreateUsers() && showCreateForm()) {
      <section class="bg-white border border-[#d6e0ea] rounded-xl p-6 mb-6 shadow-xs">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#edf1f5]">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">Provision New SRM User</h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">
              {{
                isSupplierOnly()
                  ? 'Add a colleague user linked strictly to your supplier organization.'
                  : 'Create an internal procurement/governance user or link a new supplier portal user.'
              }}
            </p>
          </div>
          <span class="px-2.5 py-1 rounded bg-[#edf3f8] text-[#183b5d] text-[10px] font-extrabold uppercase">
            Least-Privilege RBAC Enforced
          </span>
        </div>

        <form [formGroup]="createForm" (ngSubmit)="createUser()" class="grid gap-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Full Name <span class="text-[#c04b4b]">*</span>
              <input
                formControlName="fullName"
                placeholder="e.g. Rajesh Verma"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
              />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Corporate / Work Email <span class="text-[#c04b4b]">*</span>
              <input
                type="email"
                formControlName="email"
                placeholder="name@company.com"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
              />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Initial Password (8+ chars) <span class="text-[#c04b4b]">*</span>
              <input
                type="password"
                formControlName="password"
                placeholder="Minimum 8 characters"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
              />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Initial Account Status
              <select
                formControlName="accountStatus"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
              >
                <option value="ACTIVE">ACTIVE (Immediate sign-in)</option>
                <option value="PENDING">PENDING (Requires activation)</option>
              </select>
            </label>
          </div>

          <!-- Role Selection -->
          @if (!isSupplierOnly()) {
            <div class="pt-4 border-t border-[#edf1f5]">
              <div class="text-[11px] font-bold text-[#334155] mb-2">
                Assign Role(s) <span class="text-[#c04b4b]">*</span>
                <span class="font-normal text-[#64748b] ml-1">(Multi-role supported; SUPER_ADMIN requires SUPER_ADMIN privileges)</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                @for (role of roleDefinitions; track role.code) {
                  @if (role.code !== 'SUPER_ADMIN' || isSuperAdmin()) {
                    <button
                      type="button"
                      (click)="toggleCreateRole(role.code)"
                      class="p-3 rounded-lg border text-left cursor-pointer transition-colors"
                      [class]="
                        hasCreateRole(role.code)
                          ? 'bg-[#edf3f8] border-[#183b5d] text-[#142238]'
                          : 'bg-[#f8fafc] border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8]'
                      "
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-extrabold font-mono">{{ role.code }}</span>
                        <mat-icon class="!text-base !w-4 !h-4">
                          {{ hasCreateRole(role.code) ? 'check_box' : 'check_box_outline_blank' }}
                        </mat-icon>
                      </div>
                      <div class="text-[10px] text-[#64748b] mt-1 leading-snug">{{ role.label }}</div>
                    </button>
                  }
                }
              </div>
            </div>

            @if (hasCreateRole('SUPPLIER_USER')) {
              <div class="p-4 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                <label class="grid gap-1 text-[11px] font-bold text-[#334155] max-w-lg">
                  Linked Supplier Organization <span class="text-[#c04b4b]">*</span>
                  <select
                    formControlName="supplierId"
                    class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
                  >
                    <option value="">Select supplier organization…</option>
                    @for (sup of suppliers(); track sup.supplierId) {
                      <option [value]="sup.supplierId">
                        {{ sup.supplierNumber }} — {{ sup.legalName }} ({{ sup.lifecycleStatus }})
                      </option>
                    }
                  </select>
                </label>
              </div>
            }
          } @else {
            <div class="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#334155]">
              Role locked to <strong>SUPPLIER_USER</strong> under your supplier organization.
            </div>
          }

          <div class="flex flex-wrap justify-end gap-2 pt-3 border-t border-[#edf1f5]">
            <button
              type="button"
              (click)="resetCreateForm()"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              [disabled]="createForm.invalid || (!isSupplierOnly() && createRoles().length === 0) || busy()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#122e49] cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">person_add</mat-icon>
              <span>{{ busy() ? 'Creating user…' : 'Create User Account' }}</span>
            </button>
          </div>
        </form>
      </section>
    }

    <!-- Edit User Drawer -->
    @if (editingUser(); as editTarget) {
      <section class="bg-white border border-[#7da9ce] rounded-xl p-6 mb-6 shadow-xs">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#edf1f5]">
          <div>
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#315c80]">EDIT USER ACCOUNT</span>
            <h2 class="text-base font-bold text-[#142238] m-0 mt-0.5">{{ editTarget.fullName }} ({{ editTarget.email }})</h2>
          </div>
          <button
            type="button"
            (click)="cancelEdit()"
            class="h-8 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <form [formGroup]="editForm" (ngSubmit)="saveEdit(editTarget.userId)" class="grid gap-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Full Name <span class="text-[#c04b4b]">*</span>
              <input formControlName="fullName" class="h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Account Status
              <select formControlName="accountStatus" class="h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs">
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Reset Password <span class="font-normal text-[#64748b]">(Optional, 8+ chars)</span>
              <input type="password" formControlName="password" placeholder="Leave blank to keep current" class="h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
            </label>
          </div>

          @if (!isSupplierOnly()) {
            <div>
              <div class="text-[11px] font-bold text-[#334155] mb-2">Assigned Roles</div>
              <div class="flex flex-wrap gap-2">
                @for (role of roleDefinitions; track role.code) {
                  @if (role.code !== 'SUPER_ADMIN' || isSuperAdmin()) {
                    <button
                      type="button"
                      (click)="toggleEditRole(role.code)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer"
                      [class]="
                        hasEditRole(role.code)
                          ? 'bg-[#183b5d] text-white border-[#183b5d]'
                          : 'bg-white text-[#334155] border-[#cbd5e1]'
                      "
                    >
                      <span>{{ role.code }}</span>
                    </button>
                  }
                }
              </div>
            </div>
            @if (hasEditRole('SUPPLIER_USER')) {
              <label class="grid gap-1 text-[11px] font-bold text-[#334155] max-w-md">
                Linked Supplier Organization
                <select formControlName="supplierId" class="h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs">
                  <option value="">Select supplier organization…</option>
                  @for (sup of suppliers(); track sup.supplierId) {
                    <option [value]="sup.supplierId">{{ sup.supplierNumber }} — {{ sup.legalName }}</option>
                  }
                </select>
              </label>
            }
          }

          <div class="flex justify-end gap-2 pt-2 border-t border-[#edf1f5]">
            <button
              type="submit"
              [disabled]="editForm.invalid || (!isSupplierOnly() && editRoles().length === 0) || busy()"
              class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">save</mat-icon>
              <span>Save Account Changes</span>
            </button>
          </div>
        </form>
      </section>
    }

    <!-- RBAC Matrix Reference Panel (Admins & Auditor only) -->
    @if (showMatrix() && canViewRbacMatrix()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">SRM RBAC Role & Permission Matrix</h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">Server-side enforced access control across all SRM modules.</p>
          </div>
          <span class="px-2.5 py-0.5 rounded bg-[#f1f5f9] text-[#475569] text-[10px] font-extrabold">7 STANDARD ROLES</span>
        </div>
        <div class="overflow-x-auto border border-[#edf1f5] rounded-lg">
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
                <tr>
                  <td class="py-2.5 px-3 font-mono font-bold text-[#183b5d] whitespace-nowrap">{{ r.code }}</td>
                  <td class="py-2.5 px-3 font-semibold text-[#1e293b]">{{ r.label }}</td>
                  <td class="py-2.5 px-3 text-[#475569]">{{ r.scope }}</td>
                  <td class="py-2.5 px-3 text-[#475569]">{{ r.permissions }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    <!-- User Directory Table -->
    @if (canViewUsers()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">User Directory</h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">
              Search accounts, inspect assigned roles and supplier links, or edit/suspend access.
            </p>
          </div>
          <span class="px-3 py-1 rounded bg-[#f1f5f9] text-[#475569] text-[10px] font-extrabold">
            {{ filteredUsers().length }} account(s)
          </span>
        </div>

        <form [formGroup]="filterForm" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <input
            formControlName="q"
            placeholder="Search by name, email, supplier…"
            class="h-9 px-3 border border-[#cbd5e1] rounded-lg text-xs"
          />
          @if (!isSupplierOnly()) {
            <select formControlName="role" class="h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs">
              <option value="">All Roles</option>
              @for (r of roleDefinitions; track r.code) {
                <option [value]="r.code">{{ r.code }}</option>
              }
            </select>
          }
          <select formControlName="status" class="h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs">
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING">PENDING</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </form>

        @if (loading()) {
          <p class="text-xs text-[#64748b] py-6 text-center">Loading user directory…</p>
        } @else if (filteredUsers().length === 0) {
          <div class="py-8 text-center text-xs text-[#64748b]">No user accounts match the current filters.</div>
        } @else {
          <div class="overflow-x-auto border border-[#edf1f5] rounded-xl">
            <table class="w-full border-collapse text-left text-xs">
              <thead>
                <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                  <th class="py-2.5 px-3">User</th>
                  <th class="py-2.5 px-3">Assigned Roles</th>
                  <th class="py-2.5 px-3">Organization Scope</th>
                  <th class="py-2.5 px-3">Status</th>
                  <th class="py-2.5 px-3">Created</th>
                  <th class="py-2.5 px-3">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#edf1f5]">
                @for (u of filteredUsers(); track u.userId) {
                  <tr class="hover:bg-[#f8fafc]">
                    <td class="py-3 px-3">
                      <div class="font-bold text-[#142238]">{{ u.fullName }}</div>
                      <div class="text-[11px] text-[#64748b]">{{ u.email }}</div>
                    </td>
                    <td class="py-3 px-3">
                      <div class="flex flex-wrap gap-1">
                        @for (r of u.roles; track r) {
                          <span class="px-2 py-0.5 rounded bg-[#edf3f8] text-[#183b5d] font-mono text-[10px] font-bold">
                            {{ r }}
                          </span>
                        }
                      </div>
                    </td>
                    <td class="py-3 px-3">
                      @if (u.supplierId) {
                        <div class="font-semibold text-[#1e293b]">{{ u.supplierName || u.supplierId }}</div>
                        <div class="text-[10px] text-[#64748b]">{{ u.supplierNumber || 'Supplier Portal' }}</div>
                      } @else {
                        <span class="text-[#64748b]">Internal Enterprise</span>
                      }
                    </td>
                    <td class="py-3 px-3">
                      <span
                        class="px-2.5 py-0.5 rounded text-[10px] font-extrabold"
                        [class]="statusBadgeClass(u.accountStatus)"
                      >
                        {{ u.accountStatus }}
                      </span>
                    </td>
                    <td class="py-3 px-3 text-[#64748b] whitespace-nowrap">{{ u.createdAt | date:'mediumDate' }}</td>
                    <td class="py-3 px-3">
                      @if (canManageTarget(u)) {
                        <div class="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            (click)="startEdit(u)"
                            class="inline-flex items-center gap-1 text-[11px] font-bold text-[#183b5d] bg-transparent border-0 cursor-pointer hover:underline"
                          >
                            <mat-icon class="!text-sm !w-3.5 !h-3.5">edit</mat-icon>
                            <span>Edit</span>
                          </button>
                          @if (u.userId !== currentUserId()) {
                            @if (u.accountStatus === 'ACTIVE') {
                              <button
                                type="button"
                                (click)="quickStatus(u.userId, 'SUSPENDED')"
                                [disabled]="busy()"
                                class="text-[11px] font-bold text-[#a13d36] bg-transparent border-0 cursor-pointer hover:underline"
                              >
                                Suspend
                              </button>
                            } @else {
                              <button
                                type="button"
                                (click)="quickStatus(u.userId, 'ACTIVE')"
                                [disabled]="busy()"
                                class="text-[11px] font-bold text-[#16834e] bg-transparent border-0 cursor-pointer hover:underline"
                              >
                                Activate
                              </button>
                            }
                          }
                        </div>
                      } @else {
                        <span class="text-[11px] text-[#94a3b8]">Read-only</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
  `,
})
export class UsersComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);

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

  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly showCreateForm = signal(true);
  protected readonly showMatrix = signal(false);
  protected readonly editingUser = signal<ManagedUser | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly createRoles = signal<RoleCode[]>(['PROCUREMENT_BUYER']);
  protected readonly editRoles = signal<RoleCode[]>([]);

  protected readonly searchQuery = signal('');
  protected readonly roleFilter = signal('');
  protected readonly statusFilter = signal('');

  protected readonly filterForm = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    role: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });

  protected readonly createForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    accountStatus: new FormControl<'ACTIVE' | 'PENDING'>('ACTIVE', { nonNullable: true }),
    supplierId: new FormControl('', { nonNullable: true }),
  });

  protected readonly editForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    accountStatus: new FormControl<'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED'>('ACTIVE', { nonNullable: true }),
    supplierId: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
  });

  protected readonly activeCount = computed(() => this.users().filter((u) => u.accountStatus === 'ACTIVE').length);
  protected readonly supplierUserCount = computed(
    () => this.users().filter((u) => u.roles.includes('SUPPLIER_USER')).length,
  );
  protected readonly inactiveCount = computed(
    () => this.users().filter((u) => u.accountStatus !== 'ACTIVE').length,
  );

  protected readonly filteredUsers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();
    return this.users().filter((u) => {
      if (role && !u.roles.includes(role as RoleCode)) return false;
      if (status && u.accountStatus !== status) return false;
      if (q) {
        const hay = `${u.fullName} ${u.email} ${u.supplierName ?? ''} ${u.supplierNumber ?? ''} ${u.roles.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  constructor() {
    this.filterForm.controls.q.valueChanges.subscribe((v) => this.searchQuery.set(v));
    this.filterForm.controls.role.valueChanges.subscribe((v) => this.roleFilter.set(v));
    this.filterForm.controls.status.valueChanges.subscribe((v) => this.statusFilter.set(v));
  }

  ngOnInit(): void {
    if (this.canViewUsers()) {
      this.loadUsers();
    }
    if (!this.isSupplierOnly() && this.canCreateUsers()) {
      this.supplierService.getSuppliers().subscribe({
        next: (res) => this.suppliers.set(res.data ?? []),
        error: () => undefined,
      });
    }
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected isSuperAdmin(): boolean {
    return this.auth.hasRole('SUPER_ADMIN');
  }

  protected canViewUsers(): boolean {
    return this.auth.canAccessUsers();
  }

  protected canCreateUsers(): boolean {
    return this.auth.canCreateUsers();
  }

  protected canViewRbacMatrix(): boolean {
    return this.auth.canViewRbacMatrix();
  }

  protected currentUserId(): string {
    return this.auth.getUser()?.userId ?? '';
  }

  protected currentRolesLabel(): string {
    return (this.auth.getUser()?.roles ?? []).join(', ');
  }

  protected canManageTarget(user: ManagedUser): boolean {
    if (!this.canCreateUsers()) return false;
    if (user.roles.includes('SUPER_ADMIN') && !this.isSuperAdmin()) return false;
    return true;
  }

  protected toggleCreatePanel(): void {
    this.showCreateForm.update((v) => !v);
  }

  protected toggleMatrix(): void {
    this.showMatrix.update((v) => !v);
  }

  protected hasCreateRole(role: RoleCode): boolean {
    return this.createRoles().includes(role);
  }

  protected toggleCreateRole(role: RoleCode): void {
    this.createRoles.update((curr) =>
      curr.includes(role) ? curr.filter((r) => r !== role) : [...curr, role],
    );
  }

  protected hasEditRole(role: RoleCode): boolean {
    return this.editRoles().includes(role);
  }

  protected toggleEditRole(role: RoleCode): void {
    this.editRoles.update((curr) =>
      curr.includes(role) ? curr.filter((r) => r !== role) : [...curr, role],
    );
  }

  protected loadUsers(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getUsers().subscribe({
      next: (res) => {
        this.users.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load user directory.');
        this.loading.set(false);
      },
    });
  }

  protected createUser(): void {
    if (this.createForm.invalid || this.busy()) return;
    const raw = this.createForm.getRawValue();
    const roles: RoleCode[] = this.isSupplierOnly() ? ['SUPPLIER_USER'] : this.createRoles();
    if (roles.length === 0) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.srm
      .createUser({
        fullName: raw.fullName.trim(),
        email: raw.email.trim(),
        password: raw.password,
        accountStatus: raw.accountStatus,
        roles,
        supplierId: this.isSupplierOnly()
          ? (this.auth.getUser()?.supplierId ?? null)
          : roles.includes('SUPPLIER_USER')
            ? raw.supplierId
            : null,
      })
      .subscribe({
        next: (res) => {
          this.successMessage.set(res.message);
          this.resetCreateForm();
          this.busy.set(false);
          this.loadUsers();
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Unable to create user account.');
          this.busy.set(false);
        },
      });
  }

  protected resetCreateForm(): void {
    this.createForm.reset({
      fullName: '',
      email: '',
      password: '',
      accountStatus: 'ACTIVE',
      supplierId: '',
    });
    this.createRoles.set(this.isSupplierOnly() ? ['SUPPLIER_USER'] : ['PROCUREMENT_BUYER']);
  }

  protected startEdit(user: ManagedUser): void {
    this.editingUser.set(user);
    this.editRoles.set([...user.roles]);
    this.editForm.reset({
      fullName: user.fullName,
      accountStatus: user.accountStatus,
      supplierId: user.supplierId ?? '',
      password: '',
    });
  }

  protected cancelEdit(): void {
    this.editingUser.set(null);
  }

  protected saveEdit(userId: string): void {
    if (this.editForm.invalid || this.busy()) return;
    const raw = this.editForm.getRawValue();
    const roles: RoleCode[] = this.isSupplierOnly() ? ['SUPPLIER_USER'] : this.editRoles();
    if (roles.length === 0) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload: {
      fullName: string;
      accountStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';
      roles?: RoleCode[];
      supplierId?: string | null;
      password?: string;
    } = {
      fullName: raw.fullName.trim(),
      accountStatus: raw.accountStatus,
    };

    if (!this.isSupplierOnly()) {
      payload.roles = roles;
      payload.supplierId = roles.includes('SUPPLIER_USER') ? raw.supplierId : null;
    }
    if (raw.password.trim().length > 0) {
      payload.password = raw.password;
    }

    this.srm.updateUser(userId, payload).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.editingUser.set(null);
        this.busy.set(false);
        this.loadUsers();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update user account.');
        this.busy.set(false);
      },
    });
  }

  protected quickStatus(userId: string, accountStatus: 'ACTIVE' | 'SUSPENDED'): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.updateUserStatus(userId, accountStatus).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.busy.set(false);
        this.loadUsers();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update account status.');
        this.busy.set(false);
      },
    });
  }

  protected statusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-[#eaf8f0] text-[#16834e]';
      case 'PENDING':
        return 'bg-[#fef7e6] text-[#9a6700]';
      default:
        return 'bg-[#fff1f0] text-[#a13d36]';
    }
  }
}
