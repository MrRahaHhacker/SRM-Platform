import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quotations',
  imports: [DatePipe, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#64748b] uppercase">
          SRM WORKSPACE / QUOTATIONS & NEGOTIATION
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
          {{ isSupplierOnly() ? 'My Quotations & Negotiations' : 'Quotations, Evaluation & Negotiation' }}
        </h1>
        <p class="text-sm text-[#64748b] m-0">
          {{
            isSupplierOnly()
              ? 'Select an invited RFQ to submit or revise your quotation version or join active negotiation rounds.'
              : 'Select an RFQ event to open its dedicated L1/L2/L3 landed cost comparison matrix, evaluations, and negotiation workspace.'
          }}
        </p>
      </div>
      <button
        type="button"
        (click)="loadRfqs()"
        [disabled]="loading()"
        class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] hover:bg-[#f4f7fa] cursor-pointer disabled:opacity-55"
      >
        <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
        <span>Refresh</span>
      </button>
    </div>

    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-bold text-[#142238] m-0">Sourcing Events Ready for Quotations</h2>
          <p class="text-xs text-[#64748b] m-0 mt-0.5">Each event opens on a dedicated comparison, submission, or negotiation page.</p>
        </div>
        <span class="text-xs font-semibold text-[#64748b] tabular-nums">{{ rfqs().length }} events</span>
      </div>

      @if (loading()) {
        <p class="text-xs text-[#64748b] py-8 text-center">Loading sourcing events…</p>
      } @else if (rfqs().length === 0) {
        <p class="text-xs text-[#64748b] py-8 text-center">No RFQs available for quotation review.</p>
      } @else {
        <div class="overflow-x-auto border border-[#edf1f5] rounded-xl">
          <table class="w-full border-collapse text-left text-xs">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-3">RFQ Number</th>
                <th class="py-2.5 px-3">Title & Currency</th>
                <th class="py-2.5 px-3">Lines</th>
                <th class="py-2.5 px-3">Deadline</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Dedicated Pages</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5]">
              @for (rfq of rfqs(); track rfq.rfqId) {
                <tr class="hover:bg-[#f8fafc]">
                  <td class="py-3.5 px-3 font-mono font-bold text-[#315c80]">{{ rfq.rfqNumber }}</td>
                  <td class="py-3.5 px-3">
                    <div class="font-bold text-[#142238]">{{ rfq.title }}</div>
                    <div class="text-[11px] text-[#64748b]">{{ rfq.currencyCode }} · Buyer: {{ rfq.buyerName }}</div>
                  </td>
                  <td class="py-3.5 px-3 tabular-nums">{{ rfq.lines.length }}</td>
                  <td class="py-3.5 px-3 text-[#475569] whitespace-nowrap">{{ rfq.submissionDeadline | date:'mediumDate' }}</td>
                  <td class="py-3.5 px-3">
                    <span class="px-2.5 py-0.5 rounded-md bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
                      {{ rfq.status }}
                    </span>
                  </td>
                  <td class="py-3.5 px-3">
                    <div class="flex flex-wrap items-center gap-3 whitespace-nowrap">
                      <a
                        [routerLink]="['/quotations/rfq', rfq.rfqId]"
                        class="inline-flex items-center gap-1 text-xs font-bold text-[#183b5d] no-underline hover:underline"
                      >
                        <mat-icon class="!text-sm !w-3.5 !h-3.5">request_quote</mat-icon>
                        <span>{{ isSupplierOnly() ? 'View Bids' : 'Comparison Matrix' }}</span>
                      </a>
                      @if (canSubmitQuotation(rfq)) {
                        <a
                          [routerLink]="['/quotations/rfq', rfq.rfqId, 'submit']"
                          class="inline-flex items-center gap-1 text-xs font-bold text-[#16834e] no-underline hover:underline"
                        >
                          <mat-icon class="!text-sm !w-3.5 !h-3.5">send</mat-icon>
                          <span>Submit / Revise Quote</span>
                        </a>
                      }
                      @if (canAccessNegotiations()) {
                        <a
                          [routerLink]="['/quotations/rfq', rfq.rfqId, 'negotiate']"
                          class="inline-flex items-center gap-1 text-xs font-bold text-[#315c80] no-underline hover:underline"
                        >
                          <mat-icon class="!text-sm !w-3.5 !h-3.5">forum</mat-icon>
                          <span>Negotiations</span>
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
export class QuotationsComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly rfqs = signal<Rfq[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    const initialRfqId = this.route.snapshot.queryParamMap.get('rfqId');
    if (initialRfqId) {
      void this.router.navigate(['/quotations/rfq', initialRfqId], { replaceUrl: true });
      return;
    }
    this.loadRfqs();
  }

  protected loadRfqs(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getRfqs().subscribe({
      next: (res) => {
        this.rfqs.set((res.data ?? []).filter((r) => r.status !== 'DRAFT'));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQs.');
        this.loading.set(false);
      },
    });
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canAccessNegotiations(): boolean {
    return this.auth.canAccessNegotiations();
  }

  protected canSubmitQuotation(rfq: Rfq): boolean {
    if (!this.auth.hasRole('SUPPLIER_USER')) return false;
    return ['PUBLISHED', 'INVITATIONS_SENT', 'QUOTATION_OPEN', 'EVALUATION', 'NEGOTIATION'].includes(rfq.status);
  }
}
