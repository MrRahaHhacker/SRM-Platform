import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import type { Supplier } from './supplier.models';
import { SupplierService } from './supplier.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-suppliers',
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#64748b] uppercase">
          SRM WORKSPACE / SUPPLIERS
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
          {{ isSupplierOnly() ? 'My Supplier Organization' : 'Supplier Management & Qualification' }}
        </h1>
        <p class="text-sm text-[#64748b] m-0">
          {{
            isSupplierOnly()
              ? 'Open your organization profile to edit draft details, upload compliance certificates, or submit for review.'
              : 'Select any supplier record to open its full qualification profile, verification workflow, and SAP Vendor mapping.'
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          (click)="loadSuppliers()"
          [disabled]="loading()"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] hover:bg-[#f4f7fa] cursor-pointer disabled:opacity-55 whitespace-nowrap"
        >
          <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
          <span>Refresh</span>
        </button>
        @if (canRegisterSupplier()) {
          <a
            routerLink="/suppliers/new"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold no-underline hover:bg-[#122e49] whitespace-nowrap"
          >
            <mat-icon class="!text-base !w-4 !h-4">add_business</mat-icon>
            <span>Register supplier</span>
          </a>
        }
      </div>
    </div>

    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 class="text-base font-bold text-[#142238] m-0">
            {{ isSupplierOnly() ? 'Your supplier organization' : 'Registered suppliers' }}
          </h2>
          <p class="text-xs text-[#64748b] m-0 mt-0.5">
            Filter by qualification stage or open a dedicated supplier profile page.
          </p>
        </div>
        <span class="text-xs font-semibold text-[#64748b] tabular-nums">
          {{ filteredSuppliers().length }} records
        </span>
      </div>

      @if (!isSupplierOnly()) {
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex flex-wrap gap-1.5">
            @for (status of statusFilters; track status) {
              <button
                type="button"
                (click)="activeStatusFilter.set(status)"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors whitespace-nowrap"
                [class]="
                  activeStatusFilter() === status
                    ? 'bg-[#183b5d] text-white border-[#183b5d]'
                    : 'bg-white text-[#475569] border-[#dce4ec] hover:bg-[#f4f7fa]'
                "
              >
                {{ status }}
              </button>
            }
          </div>
          <input
            [formControl]="searchControl"
            placeholder="Search supplier, ID, GSTIN, SAP code…"
            class="h-9 px-3 border border-[#cbd5e1] rounded-lg text-xs w-64"
          />
        </div>
      }

      @if (loading()) {
        <p class="text-xs text-[#64748b] py-8 text-center">Loading supplier records…</p>
      } @else if (filteredSuppliers().length === 0) {
        <div class="py-10 text-center text-xs text-[#64748b]">
          <strong class="block text-sm text-[#1e293b] mb-1">No matching suppliers found</strong>
          Adjust your status filter or register a new supplier organization.
        </div>
      } @else {
        <div class="overflow-x-auto border border-[#edf1f5] rounded-xl">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-3">Supplier</th>
                <th class="py-2.5 px-3">Supplier ID</th>
                <th class="py-2.5 px-3">Primary contact</th>
                <th class="py-2.5 px-3">GSTIN / SAP Vendor</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5] text-xs">
              @for (supplier of filteredSuppliers(); track supplier.supplierId) {
                <tr class="hover:bg-[#f8fafc]">
                  <td class="py-3.5 px-3">
                    <div class="font-bold text-[#142238]">{{ supplier.legalName }}</div>
                    <div class="text-[11px] text-[#64748b]">{{ supplier.tradeName || '—' }}</div>
                  </td>
                  <td class="py-3.5 px-3 font-mono font-bold text-[#315c80]">{{ supplier.supplierNumber }}</td>
                  <td class="py-3.5 px-3">
                    <div class="text-[#1e293b]">{{ supplier.contactName || '—' }}</div>
                    <div class="text-[11px] text-[#64748b]">{{ supplier.email || '—' }}</div>
                  </td>
                  <td class="py-3.5 px-3">
                    <div class="text-[#475569] font-mono text-[11px]">{{ supplier.gstin || '—' }}</div>
                    @if (supplier.sapVendorCode) {
                      <div class="text-[11px] font-bold text-[#16834e] font-mono">{{ supplier.sapVendorCode }}</div>
                    }
                  </td>
                  <td class="py-3.5 px-3">
                    <span class="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold" [class]="statusBadgeClass(supplier.lifecycleStatus)">
                      {{ supplier.lifecycleStatus }}
                    </span>
                  </td>
                  <td class="py-3.5 px-3">
                    <div class="flex items-center gap-3 whitespace-nowrap">
                      <a
                        [routerLink]="['/suppliers', supplier.supplierId]"
                        class="inline-flex items-center gap-1 text-xs font-bold text-[#183b5d] no-underline hover:underline"
                      >
                        <mat-icon class="!text-sm !w-3.5 !h-3.5">open_in_new</mat-icon>
                        <span>Open profile</span>
                      </a>
                      @if (canEditProfile(supplier)) {
                        <a
                          [routerLink]="['/suppliers', supplier.supplierId, 'edit']"
                          class="inline-flex items-center gap-1 text-xs font-bold text-[#315c80] no-underline hover:underline"
                        >
                          <mat-icon class="!text-sm !w-3.5 !h-3.5">edit</mat-icon>
                          <span>Edit</span>
                        </a>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class SuppliersComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);

  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly activeStatusFilter = signal('ALL');
  protected readonly searchQuery = signal('');

  protected readonly statusFilters = [
    'ALL',
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CORRECTION_REQUIRED',
    'APPROVED',
    'ACTIVE',
    'REJECTED',
  ];

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly filteredSuppliers = computed(() => {
    const status = this.activeStatusFilter();
    const q = this.searchQuery().trim().toLowerCase();
    return this.suppliers().filter((s) => {
      if (status !== 'ALL' && s.lifecycleStatus !== status) return false;
      if (q) {
        const hay = `${s.legalName} ${s.tradeName ?? ''} ${s.supplierNumber} ${s.gstin ?? ''} ${s.sapVendorCode ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  constructor() {
    this.searchControl.valueChanges.subscribe((val) => this.searchQuery.set(val));
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canRegisterSupplier(): boolean {
    return this.auth.canRegisterSupplier();
  }

  protected canEditProfile(supplier: Supplier): boolean {
    return (
      ['DRAFT', 'CORRECTION_REQUIRED'].includes(supplier.lifecycleStatus) &&
      this.auth.hasRole('SRM_ADMIN', 'SUPPLIER_USER')
    );
  }

  protected loadSuppliers(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.supplierService.getSuppliers().subscribe({
      next: (res) => {
        this.suppliers.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load supplier records.');
        this.loading.set(false);
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
