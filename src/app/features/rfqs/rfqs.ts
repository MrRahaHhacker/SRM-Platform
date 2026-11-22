import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rfqs',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#64748b] uppercase">
          SRM WORKSPACE / SOURCING
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
          {{ isSupplierOnly() ? 'Invited Sourcing RFQs' : 'RFQ Management & Invitations' }}
        </h1>
        <p class="text-sm text-[#64748b] m-0">
          {{
            isSupplierOnly()
              ? 'Open any invited RFQ on a dedicated page to inspect SAP material lines, acknowledge, or submit a quotation.'
              : 'Create sourcing events, manage SAP Material Code lines, and open dedicated RFQ workspaces.'
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          (click)="loadData()"
          [disabled]="loading()"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] hover:bg-[#f4f7fa] cursor-pointer disabled:opacity-55 whitespace-nowrap"
        >
          <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
          <span>Refresh</span>
        </button>
        @if (canCreateRfq()) {
          <a
            routerLink="/rfqs/new"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold no-underline hover:bg-[#122e49] whitespace-nowrap"
          >
            <mat-icon class="!text-base !w-4 !h-4">post_add</mat-icon>
            <span>Create RFQ</span>
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
            {{ isSupplierOnly() ? 'Invited RFQs' : 'All Sourcing RFQs' }}
          </h2>
          <p class="text-xs text-[#64748b] m-0 mt-0.5">Select an RFQ to open its dedicated detail workspace or quotation comparison page.</p>
        </div>
        <span class="text-xs font-semibold text-[#64748b] tabular-nums">{{ filteredRfqs().length }} RFQs</span>
      </div>

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
          placeholder="Search RFQ number, title, plant…"
          class="h-9 px-3 border border-[#cbd5e1] rounded-lg text-xs w-64"
        />
      </div>

      @if (loading()) {
        <p class="text-xs text-[#64748b] py-8 text-center">Loading RFQs…</p>
      } @else if (filteredRfqs().length === 0) {
        <div class="py-10 text-center text-xs text-[#64748b]">No RFQs match the current filters.</div>
      } @else {
        <div class="overflow-x-auto border border-[#edf1f5] rounded-xl">
          <table class="w-full border-collapse text-left text-xs">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-3">RFQ Number</th>
                <th class="py-2.5 px-3">Title</th>
                <th class="py-2.5 px-3">Lines</th>
                <th class="py-2.5 px-3">Invited</th>
                <th class="py-2.5 px-3">Deadline</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5]">
              @for (rfq of filteredRfqs(); track rfq.rfqId) {
                <tr class="hover:bg-[#f8fafc]">
                  <td class="py-3.5 px-3 font-mono font-bold text-[#315c80]">{{ rfq.rfqNumber }}</td>
                  <td class="py-3.5 px-3">
                    <div class="font-bold text-[#142238]">{{ rfq.title }}</div>
                    <div class="text-[11px] text-[#64748b]">{{ rfq.plantCode || 'Standard' }} · {{ rfq.currencyCode }}</div>
                  </td>
                  <td class="py-3.5 px-3 tabular-nums">{{ rfq.lines.length }}</td>
                  <td class="py-3.5 px-3 tabular-nums">{{ rfq.invitations.length }}</td>
                  <td class="py-3.5 px-3 text-[#475569] whitespace-nowrap">{{ rfq.submissionDeadline | date:'mediumDate' }}</td>
                  <td class="py-3.5 px-3">
                    <span class="px-2.5 py-0.5 rounded-md bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
                      {{ rfq.status }}
                    </span>
                  </td>
                  <td class="py-3.5 px-3">
                    <div class="flex items-center gap-3 whitespace-nowrap">
                      <a
                        [routerLink]="['/rfqs', rfq.rfqId]"
                        class="inline-flex items-center gap-1 text-xs font-bold text-[#183b5d] no-underline hover:underline"
                      >
                        <mat-icon class="!text-sm !w-3.5 !h-3.5">open_in_new</mat-icon>
                        <span>Open</span>
                      </a>
                      @if (rfq.status === 'DRAFT' && canCreateRfq()) {
                        <a
                          [routerLink]="['/rfqs', rfq.rfqId, 'edit']"
                          class="inline-flex items-center gap-1 text-xs font-bold text-[#315c80] no-underline hover:underline"
                        >
                          <mat-icon class="!text-sm !w-3.5 !h-3.5">edit</mat-icon>
                          <span>Edit Draft</span>
                        </a>
                      }
                      @if (rfq.status !== 'DRAFT') {
                        <a
                          [routerLink]="['/quotations/rfq', rfq.rfqId]"
                          class="inline-flex items-center gap-1 text-xs font-bold text-[#16834e] no-underline hover:underline"
                        >
                          <mat-icon class="!text-sm !w-3.5 !h-3.5">request_quote</mat-icon>
                          <span>Quotations</span>
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
export class RfqsComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);

  protected readonly rfqs = signal<Rfq[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly activeStatusFilter = signal('ALL');
  protected readonly searchQuery = signal('');

  protected readonly statusFilters = ['ALL', 'DRAFT', 'QUOTATION_OPEN', 'EVALUATION', 'NEGOTIATION', 'APPROVAL_PENDING', 'AWARDED'];
  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly filteredRfqs = computed(() => {
    const status = this.activeStatusFilter();
    const q = this.searchQuery().trim().toLowerCase();
    return this.rfqs().filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false;
      if (q) {
        const hay = `${r.rfqNumber} ${r.title} ${r.plantCode ?? ''} ${r.currencyCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  constructor() {
    this.searchControl.valueChanges.subscribe((v) => this.searchQuery.set(v));
  }

  ngOnInit(): void {
    this.loadData();
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canCreateRfq(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SRM_ADMIN');
  }

  protected loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getRfqs().subscribe({
      next: (res) => {
        this.rfqs.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQs.');
        this.loading.set(false);
      },
    });
  }
}
