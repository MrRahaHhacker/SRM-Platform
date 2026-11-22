import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import type { ApiResponse, Supplier, SupplierLifecycleResult } from './supplier.models';
import { SupplierService } from './supplier.service';
import { SupplierDocumentsComponent } from './supplier-documents';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-supplier-detail',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, MatIconModule, SupplierDocumentsComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-[11px] font-bold text-[#64748b] mb-1">
          <a routerLink="/suppliers" class="text-[#315c80] no-underline hover:underline">Suppliers</a>
          <span>/</span>
          <span>{{ supplier()?.supplierNumber || 'Profile' }}</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          {{ supplier()?.legalName || 'Supplier Profile' }}
        </h1>
        @if (supplier(); as sup) {
          <p class="text-xs text-[#64748b] m-0 mt-1">
            Registered {{ sup.createdAt | date:'medium' }}
            @if (sup.tradeName) { · Trade name: {{ sup.tradeName }} }
          </p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a
          routerLink="/suppliers"
          class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f4f7fa]"
        >
          <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
          <span>Back to Suppliers</span>
        </a>
        @if (supplier(); as sup) {
          @if (canEditProfile(sup)) {
            <a
              [routerLink]="['/suppliers', sup.supplierId, 'edit']"
              class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#183b5d] text-white text-xs font-bold no-underline hover:bg-[#122e49]"
            >
              <mat-icon class="!text-base !w-4 !h-4">edit</mat-icon>
              <span>Edit Profile</span>
            </a>
          }
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

    @if (loading()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center text-xs text-[#64748b]">
        Loading supplier profile…
      </section>
    } @else if (supplier(); as sup) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
        <div class="flex flex-wrap items-center gap-2 mb-5">
          <span class="px-2.5 py-0.5 rounded-md bg-[#edf3f8] text-[#183b5d] font-mono text-[11px] font-extrabold">
            {{ sup.supplierNumber }}
          </span>
          <span class="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold" [class]="statusBadgeClass(sup.lifecycleStatus)">
            {{ sup.lifecycleStatus }}
          </span>
          @if (sup.sapVendorCode) {
            <span class="px-2.5 py-0.5 rounded-md bg-[#eaf8f0] text-[#16834e] font-mono text-[10px] font-extrabold">
              SAP Vendor: {{ sup.sapVendorCode }}
            </span>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div class="p-3.5 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] uppercase font-bold">Primary Contact</span>
            <strong class="text-xs text-[#142238]">{{ sup.contactName || '—' }}</strong>
            <div class="text-[11px] text-[#64748b] truncate">{{ sup.email || '—' }}</div>
            <div class="text-[11px] text-[#64748b]">{{ sup.phone || '—' }}</div>
          </div>
          <div class="p-3.5 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] uppercase font-bold">Category & MSME</span>
            <strong class="text-xs text-[#142238]">{{ sup.supplierCategory || 'General Supply' }}</strong>
            <div class="text-[11px] text-[#64748b]">MSME: {{ sup.msmeNumber || '—' }}</div>
          </div>
          <div class="p-3.5 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] uppercase font-bold">GSTIN / PAN</span>
            <strong class="text-xs text-[#142238] font-mono">{{ sup.gstin || '—' }}</strong>
            <div class="text-[11px] text-[#64748b] font-mono">PAN: {{ sup.pan || '—' }}</div>
          </div>
          <div class="p-3.5 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] uppercase font-bold">Registered Address</span>
            <strong class="text-xs text-[#142238]">
              {{ sup.address ? (sup.address.city + ', ' + sup.address.countryCode) : '—' }}
            </strong>
            <div class="text-[11px] text-[#64748b] truncate">{{ sup.address?.addressLine1 || '' }}</div>
          </div>
        </div>

        @if ((sup.additionalContacts?.length ?? 0) > 0) {
          <div class="mb-5 p-4 rounded-lg border border-[#edf1f5] bg-[#fcfdfe]">
            <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b] mb-2">
              Additional Organization Contacts
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              @for (c of sup.additionalContacts!; track $index) {
                <div class="p-2.5 rounded-lg bg-white border border-[#edf1f5]">
                  <div class="font-bold text-[#142238]">{{ c.fullName }}</div>
                  <div class="text-[11px] text-[#64748b]">{{ c.designation || 'Contact' }} · {{ c.email }}</div>
                  @if (c.phone) {
                    <div class="text-[11px] text-[#64748b]">{{ c.phone }}</div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Qualification & Lifecycle Workflow -->
        <div class="p-4 rounded-xl border border-[#e3eaf1] bg-[#f8fafc] mb-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-[#142238] m-0">Qualification & Lifecycle Workflow</h2>
              <p class="text-xs text-[#64748b] m-0 mt-0.5">
                Current state: <strong>{{ sup.lifecycleStatus }}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              @if ((sup.lifecycleStatus === 'DRAFT' || sup.lifecycleStatus === 'CORRECTION_REQUIRED') && canSubmitSupplier()) {
                <button
                  type="button"
                  (click)="submitForReview()"
                  [disabled]="lifecycleBusy()"
                  class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  <mat-icon class="!text-base !w-4 !h-4">send</mat-icon>
                  <span>{{ sup.lifecycleStatus === 'CORRECTION_REQUIRED' ? 'Resubmit for review' : 'Submit for verification' }}</span>
                </button>
              }
              @if ((sup.lifecycleStatus === 'SUBMITTED' || sup.lifecycleStatus === 'ON_HOLD') && canVerifySupplier()) {
                <button
                  type="button"
                  (click)="startSupplierReview()"
                  [disabled]="lifecycleBusy()"
                  class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  <mat-icon class="!text-base !w-4 !h-4">rate_review</mat-icon>
                  <span>Start review</span>
                </button>
              }
            </div>
          </div>

          @if (sup.lifecycleStatus === 'UNDER_REVIEW' && canVerifySupplier()) {
            <div class="mt-4 pt-4 border-t border-[#e3eaf1]">
              <label class="grid gap-1 max-w-xl text-[11px] font-bold text-[#334155]">
                Reviewer remarks <span class="font-normal text-[#64748b]">(Required to return for correction, hold, or reject)</span>
                <textarea
                  [formControl]="lifecycleRemarksControl"
                  rows="2"
                  maxlength="2000"
                  placeholder="Record the verification decision reason"
                  class="p-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
                ></textarea>
              </label>
              <div class="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  (click)="decideSupplier('APPROVE')"
                  [disabled]="lifecycleBusy()"
                  class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  <mat-icon class="!text-base !w-4 !h-4">check_circle</mat-icon>
                  <span>Approve qualification</span>
                </button>
                <button
                  type="button"
                  (click)="decideSupplier('RETURN')"
                  [disabled]="lifecycleBusy() || !lifecycleRemarksControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#dce4ec] bg-white text-[#334155] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Return for correction
                </button>
                <button
                  type="button"
                  (click)="decideSupplier('HOLD')"
                  [disabled]="lifecycleBusy() || !lifecycleRemarksControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#f5d0a9] bg-[#fef7e6] text-[#9a6700] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Put on hold
                </button>
                <button
                  type="button"
                  (click)="decideSupplier('REJECT')"
                  [disabled]="lifecycleBusy() || !lifecycleRemarksControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Reject supplier
                </button>
              </div>
            </div>
          }

          @if ((sup.lifecycleStatus === 'APPROVED' || sup.lifecycleStatus === 'ACTIVE') && canMapSapVendor()) {
            <form
              [formGroup]="sapMappingForm"
              (ngSubmit)="mapSapVendorCode(sup.supplierId)"
              class="mt-4 pt-4 border-t border-[#e3eaf1] flex flex-wrap items-end gap-3"
            >
              <div class="flex-1 min-w-[200px]">
                <div class="text-xs font-bold text-[#142238]">Map Existing SAP Vendor Code</div>
                <p class="text-[11px] text-[#64748b] m-0">
                  SAP owns Vendor Master creation. Map an existing SAP Vendor Code to activate this supplier.
                </p>
              </div>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                SAP System
                <input formControlName="sapSystemCode" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs w-36" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Existing SAP Vendor Code
                <input formControlName="sapVendorCode" placeholder="SAP-VND-40025" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs w-40 uppercase" />
              </label>
              <button
                type="submit"
                [disabled]="sapMappingForm.invalid || lifecycleBusy()"
                class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
              >
                <mat-icon class="!text-base !w-4 !h-4">link</mat-icon>
                <span>{{ sup.sapVendorCode ? 'Update SAP Mapping' : 'Map & Activate' }}</span>
              </button>
            </form>
          }

          @if ((sup.lifecycleStatus === 'ACTIVE' || sup.lifecycleStatus === 'SUSPENDED') && canAdminSuspend()) {
            <div class="mt-4 pt-4 border-t border-[#e3eaf1] flex flex-wrap items-center gap-3">
              <input
                [formControl]="statusReasonControl"
                placeholder="Reason for suspension or reactivation"
                class="flex-1 min-w-[220px] h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs"
              />
              @if (sup.lifecycleStatus === 'ACTIVE') {
                <button
                  type="button"
                  (click)="toggleSuspend(sup, 'SUSPENDED')"
                  [disabled]="lifecycleBusy() || !statusReasonControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Suspend supplier
                </button>
              } @else {
                <button
                  type="button"
                  (click)="toggleSuspend(sup, 'ACTIVE')"
                  [disabled]="lifecycleBusy() || !statusReasonControl.value.trim()"
                  class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Reactivate supplier
                </button>
              }
            </div>
          }
        </div>

        @if ((sup.statusHistory?.length ?? 0) > 0) {
          <div class="mb-5">
            <h3 class="text-xs font-bold text-[#142238] uppercase tracking-wider mb-2.5">
              Status & Qualification History
            </h3>
            <div class="grid gap-2">
              @for (item of sup.statusHistory!; track item.historyId) {
                <div class="p-2.5 rounded-lg border border-[#edf1f5] bg-[#fcfdfe] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span class="font-bold text-[#315c80]">{{ item.oldStatus || 'NEW' }} → {{ item.newStatus }}</span>
                    <span class="text-[#64748b] ml-2">by {{ item.changedByName }}</span>
                    @if (item.reason) {
                      <span class="text-[#1e293b] ml-2">— {{ item.reason }}</span>
                    }
                  </div>
                  <span class="text-[11px] text-[#64748b] tabular-nums">{{ item.changedAt | date:'short' }}</span>
                </div>
              }
            </div>
          </div>
        }

        <app-supplier-documents [supplierId]="sup.supplierId" />
      </section>
    }
  `,
})
export class SupplierDetailComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);

  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly loading = signal(false);
  protected readonly lifecycleBusy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly lifecycleRemarksControl = new FormControl('', { nonNullable: true });
  protected readonly statusReasonControl = new FormControl('', { nonNullable: true });

  protected readonly sapMappingForm = new FormGroup({
    sapSystemCode: new FormControl('SAP_S4_PROD', { nonNullable: true, validators: [Validators.required] }),
    sapVendorCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    const notice = this.route.snapshot.queryParamMap.get('notice');
    if (notice) this.successMessage.set(notice);

    this.route.paramMap.subscribe((params) => {
      const id = params.get('supplierId');
      if (id) {
        this.loadSupplier(id);
      }
    });
  }

  private loadSupplier(supplierId: string): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.supplierService.getSupplier(supplierId).subscribe({
      next: (res) => {
        this.supplier.set(res.data);
        this.sapMappingForm.patchValue({
          sapSystemCode: res.data.sapSystemCode || 'SAP_S4_PROD',
          sapVendorCode: res.data.sapVendorCode || '',
        });
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load supplier profile.');
        this.loading.set(false);
      },
    });
  }

  protected canEditProfile(supplier: Supplier): boolean {
    return (
      ['DRAFT', 'CORRECTION_REQUIRED'].includes(supplier.lifecycleStatus) &&
      this.auth.hasRole('SRM_ADMIN', 'SUPPLIER_USER')
    );
  }

  protected canSubmitSupplier(): boolean {
    return this.auth.hasRole('SRM_ADMIN', 'SUPPLIER_USER');
  }

  protected canVerifySupplier(): boolean {
    return this.auth.hasRole('SUPPLIER_VERIFIER', 'SRM_ADMIN');
  }

  protected canMapSapVendor(): boolean {
    return this.auth.hasRole('SRM_ADMIN', 'PROCUREMENT_BUYER');
  }

  protected canAdminSuspend(): boolean {
    return this.auth.hasRole('SRM_ADMIN', 'SUPER_ADMIN');
  }

  protected async submitForReview(): Promise<void> {
    const sup = this.supplier();
    if (!sup) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Submit Supplier for Verification?',
      message: `Submit ${sup.legalName} (${sup.supplierNumber}) to internal supplier verifiers for review?`,
      confirmLabel: 'Submit for Review',
      tone: 'primary',
      icon: 'send',
    });
    if (ok) {
      this.runLifecycleAction(this.supplierService.submitSupplier(sup.supplierId));
    }
  }

  protected async startSupplierReview(): Promise<void> {
    const sup = this.supplier();
    if (!sup) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Start Qualification Review?',
      message: `Move ${sup.legalName} into UNDER_REVIEW status and begin compliance verification?`,
      confirmLabel: 'Start Review',
      tone: 'primary',
      icon: 'rate_review',
    });
    if (ok) {
      this.runLifecycleAction(this.supplierService.startSupplierReview(sup.supplierId));
    }
  }

  protected async decideSupplier(decision: 'APPROVE' | 'RETURN' | 'HOLD' | 'REJECT'): Promise<void> {
    const sup = this.supplier();
    if (!sup) return;
    const remarks = this.lifecycleRemarksControl.value.trim();
    if (decision !== 'APPROVE' && !remarks) {
      this.errorMessage.set('Add remarks before returning, holding, or rejecting this supplier.');
      return;
    }

    const labelMap: Record<'APPROVE' | 'RETURN' | 'HOLD' | 'REJECT', { title: string; confirm: string; tone: 'success' | 'warning' | 'danger' }> = {
      APPROVE: { title: 'Approve Supplier Qualification?', confirm: 'Approve Supplier', tone: 'success' },
      RETURN: { title: 'Return for Correction?', confirm: 'Return Supplier', tone: 'warning' },
      HOLD: { title: 'Put Supplier on Hold?', confirm: 'Put on Hold', tone: 'warning' },
      REJECT: { title: 'Reject Supplier?', confirm: 'Reject Supplier', tone: 'danger' },
    };
    const cfg = labelMap[decision];
    const ok = await this.confirmDialog.confirm({
      title: cfg.title,
      message: `Confirm "${decision}" decision for ${sup.legalName} (${sup.supplierNumber})?`,
      confirmLabel: cfg.confirm,
      tone: cfg.tone,
    });
    if (ok) {
      this.runLifecycleAction(this.supplierService.decideSupplier(sup.supplierId, decision, remarks));
    }
  }

  protected async mapSapVendorCode(supplierId: string): Promise<void> {
    if (this.sapMappingForm.invalid || this.lifecycleBusy()) return;
    const { sapSystemCode, sapVendorCode } = this.sapMappingForm.getRawValue();
    const ok = await this.confirmDialog.confirm({
      title: 'Map Existing SAP Vendor Code?',
      message: `Link SAP Vendor Code "${sapVendorCode.trim().toUpperCase()}" (${sapSystemCode}) and activate supplier?`,
      confirmLabel: 'Map & Activate',
      tone: 'primary',
      icon: 'link',
    });
    if (!ok) return;

    this.lifecycleBusy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.supplierService.mapSapVendorCode(supplierId, sapSystemCode, sapVendorCode).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.lifecycleBusy.set(false);
        this.loadSupplier(supplierId);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to map SAP Vendor Code.');
        this.lifecycleBusy.set(false);
      },
    });
  }

  protected async toggleSuspend(supplier: Supplier, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    const reason = this.statusReasonControl.value.trim();
    if (!reason) return;
    const ok = await this.confirmDialog.confirm({
      title: status === 'SUSPENDED' ? 'Suspend Supplier?' : 'Reactivate Supplier?',
      message:
        status === 'SUSPENDED'
          ? `Suspend ${supplier.legalName}? Reason: "${reason}".`
          : `Reactivate ${supplier.legalName}? Reason: "${reason}".`,
      confirmLabel: status === 'SUSPENDED' ? 'Suspend Supplier' : 'Reactivate Supplier',
      tone: status === 'SUSPENDED' ? 'danger' : 'success',
    });
    if (ok) {
      this.runLifecycleAction(this.supplierService.changeSupplierStatus(supplier.supplierId, status, reason));
    }
  }

  private runLifecycleAction(req$: Observable<ApiResponse<SupplierLifecycleResult>>): void {
    const current = this.supplier();
    if (!current || this.lifecycleBusy()) return;
    this.lifecycleBusy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    req$.subscribe({
      next: (res) => {
        this.successMessage.set(res.message || `Supplier status changed to ${res.data.currentStatus}.`);
        this.lifecycleRemarksControl.setValue('');
        this.statusReasonControl.setValue('');
        this.lifecycleBusy.set(false);
        this.loadSupplier(current.supplierId);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update supplier status.');
        this.lifecycleBusy.set(false);
      },
    });
  }

  protected statusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
      case 'APPROVED':
        return 'bg-[#eaf8f0] text-[#16834e]';
      case 'REJECTED':
      case 'SUSPENDED':
        return 'bg-[#fff1f0] text-[#a13d36]';
      case 'CORRECTION_REQUIRED':
      case 'ON_HOLD':
        return 'bg-[#fef7e6] text-[#9a6700]';
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return 'bg-[#edf4fa] text-[#315b7e]';
      default:
        return 'bg-[#f0f4f8] text-[#62758a]';
    }
  }
}
