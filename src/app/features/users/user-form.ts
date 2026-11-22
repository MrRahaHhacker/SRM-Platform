import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import type { RoleCode } from '../../core/auth/auth.models';
import { SrmService } from '../../core/services/srm.service';
import type { ManagedUser } from '../../core/services/srm.models';
import { SupplierService } from '../suppliers/supplier.service';
import type { Supplier } from '../suppliers/supplier.models';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';

interface RoleOption {
  code: RoleCode;
  label: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { code: 'SUPER_ADMIN', label: 'Platform Super Admin' },
  { code: 'SRM_ADMIN', label: 'SRM Administrator' },
  { code: 'SUPPLIER_USER', label: 'Supplier Portal User' },
  { code: 'SUPPLIER_VERIFIER', label: 'Supplier Onboarding Verifier' },
  { code: 'PROCUREMENT_BUYER', label: 'Procurement Buyer' },
  { code: 'PROCUREMENT_APPROVER', label: 'Procurement Approver' },
  { code: 'AUDITOR', label: 'Compliance Auditor' },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
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
        SRM WORKSPACE / USER ADMINISTRATION / {{ isEditMode() ? 'EDIT USER' : 'CREATE USER' }}
      </span>
      <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
        {{
          isEditMode()
            ? 'Edit User Account'
            : isSupplierOnly()
              ? 'Add Supplier Colleague User'
              : 'Provision New SRM User'
        }}
      </h1>
      <p class="text-sm text-[#64748b] m-0">
        {{
          isEditMode()
            ? 'Update user profile, RBAC role assignments, supplier link, or account status.'
            : isSupplierOnly()
              ? 'Create a colleague account scoped strictly to your supplier organization.'
              : 'Create an internal SRM user or link a supplier portal account with least-privilege RBAC enforcement.'
        }}
      </p>
    </div>

    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    @if (loadingTarget()) {
      <div class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center text-xs text-[#64748b]">
        Loading user account details…
      </div>
    } @else {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 max-w-4xl">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#edf1f5]">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">
              {{ isEditMode() ? editTargetEmail() : 'New User Credentials & Scope' }}
            </h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">
              All creations and privilege modifications are logged in the append-only audit trail.
            </p>
          </div>
          <span class="px-2.5 py-1 rounded bg-[#edf3f8] text-[#183b5d] text-[10px] font-extrabold uppercase">
            Least-Privilege RBAC
          </span>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Full Name <span class="text-[#c04b4b]">*</span>
              <input
                formControlName="fullName"
                placeholder="e.g. Rajesh Verma"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
              />
            </label>

            @if (!isEditMode()) {
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Corporate / Work Email <span class="text-[#c04b4b]">*</span>
                <input
                  type="email"
                  formControlName="email"
                  placeholder="name@company.com"
                  class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
                />
              </label>
            } @else {
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Account Email (Immutable)
                <input
                  [value]="editTargetEmail()"
                  disabled
                  class="h-10 px-3 border border-[#e2e8f0] rounded-lg bg-[#f8fafc] text-xs text-[#64748b]"
                />
              </label>
            }

            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              {{ isEditMode() ? 'Reset Password (Optional, 8+ chars)' : 'Initial Password (8+ chars) *' }}
              <input
                type="password"
                formControlName="password"
                [placeholder]="isEditMode() ? 'Leave blank to keep current password' : 'Minimum 8 characters'"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
              />
            </label>

            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Account Status
              <select
                formControlName="accountStatus"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
              >
                <option value="ACTIVE">ACTIVE (Sign-in allowed)</option>
                <option value="PENDING">PENDING (Requires activation)</option>
                @if (isEditMode()) {
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DISABLED">DISABLED</option>
                }
              </select>
            </label>
          </div>

          @if (!isSupplierOnly()) {
            <div class="pt-4 border-t border-[#edf1f5]">
              <div class="text-[11px] font-bold text-[#334155] mb-2">
                Assign Role(s) <span class="text-[#c04b4b]">*</span>
                <span class="font-normal text-[#64748b] ml-1">(SUPER_ADMIN assignment requires SUPER_ADMIN privileges)</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                @for (role of roleOptions; track role.code) {
                  @if (role.code !== 'SUPER_ADMIN' || isSuperAdmin()) {
                    <button
                      type="button"
                      (click)="toggleRole(role.code)"
                      class="p-3 rounded-lg border text-left cursor-pointer transition-colors"
                      [class]="
                        hasRole(role.code)
                          ? 'bg-[#edf3f8] border-[#183b5d] text-[#142238]'
                          : 'bg-[#f8fafc] border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8]'
                      "
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-extrabold font-mono">{{ role.code }}</span>
                        <mat-icon class="!text-base !w-4 !h-4">
                          {{ hasRole(role.code) ? 'check_box' : 'check_box_outline_blank' }}
                        </mat-icon>
                      </div>
                      <div class="text-[10px] text-[#64748b] mt-1 leading-snug">{{ role.label }}</div>
                    </button>
                  }
                }
              </div>
            </div>

            @if (hasRole('SUPPLIER_USER')) {
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
              Role locked to <strong>SUPPLIER_USER</strong> strictly within your supplier organization.
            </div>
          }

          <div class="flex flex-wrap justify-end gap-2.5 pt-4 border-t border-[#edf1f5]">
            <a
              routerLink="/users"
              class="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f8fafc]"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="form.invalid || (!isSupplierOnly() && selectedRoles().length === 0) || busy()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#122e49] cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">{{ isEditMode() ? 'save' : 'person_add' }}</mat-icon>
              <span>{{ busy() ? 'Saving…' : (isEditMode() ? 'Save User Changes' : 'Create User Account') }}</span>
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class UserFormComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly userId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly editTargetEmail = signal('');
  protected readonly loadingTarget = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly selectedRoles = signal<RoleCode[]>(['PROCUREMENT_BUYER']);

  protected readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    accountStatus: new FormControl<'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED'>('ACTIVE', { nonNullable: true }),
    supplierId: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    if (!this.isSupplierOnly()) {
      this.supplierService.getSuppliers().subscribe({
        next: (res) => this.suppliers.set(res.data ?? []),
        error: () => undefined,
      });
    } else {
      this.selectedRoles.set(['SUPPLIER_USER']);
    }

    this.route.paramMap.subscribe((params) => {
      const id = params.get('userId');
      if (id) {
        this.userId.set(id);
        this.isEditMode.set(true);
        this.form.controls.email.clearValidators();
        this.form.controls.email.updateValueAndValidity();
        this.form.controls.password.clearValidators();
        this.form.controls.password.setValidators([Validators.minLength(8)]);
        this.form.controls.password.updateValueAndValidity();
        this.loadExistingUser(id);
      } else {
        this.userId.set(null);
        this.isEditMode.set(false);
      }
    });
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected isSuperAdmin(): boolean {
    return this.auth.hasRole('SUPER_ADMIN');
  }

  protected hasRole(role: RoleCode): boolean {
    return this.selectedRoles().includes(role);
  }

  protected toggleRole(role: RoleCode): void {
    this.selectedRoles.update((curr) =>
      curr.includes(role) ? curr.filter((r) => r !== role) : [...curr, role],
    );
  }

  private loadExistingUser(id: string): void {
    this.loadingTarget.set(true);
    this.srm.getUsers().subscribe({
      next: (res) => {
        const user: ManagedUser | undefined = (res.data ?? []).find((u) => u.userId === id);
        if (!user) {
          this.errorMessage.set('User account not found or outside your organization scope.');
          this.loadingTarget.set(false);
          return;
        }
        this.editTargetEmail.set(user.email);
        this.selectedRoles.set([...user.roles]);
        this.form.reset({
          fullName: user.fullName,
          email: user.email,
          password: '',
          accountStatus: user.accountStatus,
          supplierId: user.supplierId ?? '',
        });
        this.loadingTarget.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load user details.');
        this.loadingTarget.set(false);
      },
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    const raw = this.form.getRawValue();
    const roles: RoleCode[] = this.isSupplierOnly() ? ['SUPPLIER_USER'] : this.selectedRoles();
    if (roles.length === 0) return;

    if (!this.isSupplierOnly() && roles.includes('SUPPLIER_USER') && !raw.supplierId) {
      this.errorMessage.set('Please select a linked supplier organization for SUPPLIER_USER.');
      return;
    }

    const editingId = this.userId();
    const ok = await this.confirmDialog.confirm(
      editingId
        ? {
            title: 'Save User Account Changes',
            message: `Save updates to ${raw.fullName.trim()} (${roles.join(', ')})?`,
            confirmLabel: 'Save Changes',
            cancelLabel: 'Cancel',
            tone: 'primary',
            icon: 'save',
          }
        : {
            title: 'Create New User Account',
            message: `Provision user ${raw.fullName.trim()} (${raw.email.trim()}) with role(s): ${roles.join(', ')}?`,
            confirmLabel: 'Create User',
            cancelLabel: 'Cancel',
            tone: 'primary',
            icon: 'person_add',
          },
    );
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');

    if (editingId) {
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

      this.srm.updateUser(editingId, payload).subscribe({
        next: () => {
          this.busy.set(false);
          void this.router.navigate(['/users']);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Unable to update user account.');
          this.busy.set(false);
        },
      });
    } else {
      this.srm
        .createUser({
          fullName: raw.fullName.trim(),
          email: raw.email.trim(),
          password: raw.password,
          accountStatus: raw.accountStatus === 'PENDING' ? 'PENDING' : 'ACTIVE',
          roles,
          supplierId: this.isSupplierOnly()
            ? (this.auth.getUser()?.supplierId ?? null)
            : roles.includes('SUPPLIER_USER')
              ? raw.supplierId
              : null,
        })
        .subscribe({
          next: () => {
            this.busy.set(false);
            void this.router.navigate(['/users']);
          },
          error: (err: HttpErrorResponse) => {
            this.errorMessage.set(err.error?.message ?? 'Unable to create user account.');
            this.busy.set(false);
          },
        });
    }
  }
}
