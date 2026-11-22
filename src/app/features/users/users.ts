import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import type { RoleCode } from '../../core/auth/auth.models';
import { SrmService } from '../../core/services/srm.service';
import type { ManagedUser } from '../../core/services/srm.models';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';

const ALL_ROLE_CODES: RoleCode[] = [
  'SUPER_ADMIN',
  'SRM_ADMIN',
  'SUPPLIER_USER',
  'SUPPLIER_VERIFIER',
  'PROCUREMENT_BUYER',
  'PROCUREMENT_APPROVER',
  'AUDITOR',
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-users',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, MatIconModule],
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
                ? 'Browse user accounts, open dedicated creation/editing screens, or toggle account access.'
                : 'Read-only inspection of SRM user accounts, role assignments, and organization links.'
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        @if (canViewRbacMatrix()) {
          <a
            routerLink="/users/roles-matrix"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f8fafc]"
          >
            <mat-icon class="!text-base !w-4 !h-4">verified_user</mat-icon>
            <span>RBAC Role Matrix</span>
          </a>
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
          <a
            routerLink="/users/new"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold no-underline hover:bg-[#122e49]"
          >
            <mat-icon class="!text-base !w-4 !h-4">person_add</mat-icon>
            <span>{{ isSupplierOnly() ? 'Add Colleague' : 'Create New User' }}</span>
          </a>
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
            </p>
          </div>
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
              Search accounts, inspect assigned roles and supplier links, or open the edit page.
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
              @for (r of roleCodes; track r) {
                <option [value]="r">{{ r }}</option>
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
                        <div class="flex flex-wrap items-center gap-2.5">
                          <a
                            [routerLink]="['/users', u.userId, 'edit']"
                            class="inline-flex items-center gap-1 text-[11px] font-bold text-[#183b5d] no-underline hover:underline"
                          >
                            <mat-icon class="!text-sm !w-3.5 !h-3.5">edit</mat-icon>
                            <span>Edit</span>
                          </a>
                          @if (u.userId !== currentUserId()) {
                            @if (u.accountStatus === 'ACTIVE') {
                              <button
                                type="button"
                                (click)="quickStatus(u, 'SUSPENDED')"
                                [disabled]="busy()"
                                class="text-[11px] font-bold text-[#a13d36] bg-transparent border-0 cursor-pointer hover:underline"
                              >
                                Suspend
                              </button>
                            } @else {
                              <button
                                type="button"
                                (click)="quickStatus(u, 'ACTIVE')"
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
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly roleCodes = ALL_ROLE_CODES;
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly searchQuery = signal('');
  protected readonly roleFilter = signal('');
  protected readonly statusFilter = signal('');

  protected readonly filterForm = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    role: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
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

  protected async quickStatus(user: ManagedUser, accountStatus: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      accountStatus === 'SUSPENDED'
        ? {
            title: 'Suspend User Account',
            message: `Suspend ${user.fullName} (${user.email})? They will immediately lose workspace sign-in access.`,
            confirmLabel: 'Suspend',
            cancelLabel: 'Cancel',
            tone: 'danger',
            icon: 'person_off',
          }
        : {
            title: 'Activate User Account',
            message: `Activate ${user.fullName} (${user.email}) so they can sign in?`,
            confirmLabel: 'Activate',
            cancelLabel: 'Cancel',
            tone: 'success',
            icon: 'how_to_reg',
          },
    );
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.updateUserStatus(user.userId, accountStatus).subscribe({
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
