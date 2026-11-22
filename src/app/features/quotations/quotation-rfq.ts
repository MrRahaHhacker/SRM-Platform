import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { SrmService } from '../../core/services/srm.service';
import type { Quotation, Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quotation-rfq',
  imports: [DatePipe, DecimalPipe, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-[11px] font-bold text-[#64748b] mb-1">
          <a routerLink="/quotations" class="text-[#315c80] no-underline hover:underline">Quotations</a>
          <span>/</span>
          <span>{{ rfq()?.rfqNumber || 'RFQ Comparison' }}</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          {{ isSupplierOnly() ? 'Your Submitted Quotation History' : 'Commercial Comparison & Evaluation' }}
        </h1>
        @if (rfq(); as item) {
          <p class="text-xs text-[#64748b] m-0 mt-1">
            {{ item.rfqNumber }} — {{ item.title }} ({{ item.status }})
          </p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a
          routerLink="/quotations"
          class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f4f7fa]"
        >
          <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
          <span>All Quotations</span>
        </a>
        @if (rfq(); as item) {
          @if (canAccessRfqs()) {
            <a
              [routerLink]="['/rfqs', item.rfqId]"
              class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#315c80] no-underline hover:bg-[#f4f7fa]"
            >
              <mat-icon class="!text-base !w-4 !h-4">assignment</mat-icon>
              <span>RFQ Specs</span>
            </a>
          }
          @if (canAccessNegotiations()) {
            <a
              [routerLink]="['/quotations/rfq', item.rfqId, 'negotiate']"
              class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#183b5d] no-underline hover:bg-[#f4f7fa]"
            >
              <mat-icon class="!text-base !w-4 !h-4">forum</mat-icon>
              <span>Negotiation Rounds</span>
            </a>
          }
          @if (canSubmitQuotation(item)) {
            <a
              [routerLink]="['/quotations/rfq', item.rfqId, 'submit']"
              class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold no-underline hover:bg-[#122e49]"
            >
              <mat-icon class="!text-base !w-4 !h-4">send</mat-icon>
              <span>{{ quotations().length > 0 ? 'Submit Revised Quote' : 'Submit Quotation' }}</span>
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
        Loading quotation comparison…
      </section>
    } @else if (rfq(); as item) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">
              {{ isSupplierOnly() ? 'Immutable Bid Versions' : 'L1 / L2 / L3 Landed Cost Matrix' }}
            </h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">
              {{ isSupplierOnly() ? 'Confidential to your supplier organization.' : 'Ranked by Total Landed Cost. Evaluate bids or launch negotiations / award recommendation pages.' }}
            </p>
          </div>
          <span class="text-xs font-semibold text-[#64748b] tabular-nums">{{ quotations().length }} supplier bid(s)</span>
        </div>

        @if (quotations().length === 0) {
          <p class="text-xs text-[#64748b] py-8 text-center">No quotations submitted yet for {{ item.rfqNumber }}.</p>
        } @else {
          @if (!isSupplierOnly()) {
            <div class="overflow-x-auto border border-[#e3eaf1] rounded-xl mb-6">
              <table class="w-full border-collapse text-left text-xs">
                <thead>
                  <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                    <th class="py-2.5 px-3">Rank</th>
                    <th class="py-2.5 px-3">Supplier</th>
                    <th class="py-2.5 px-3">Ver</th>
                    <th class="py-2.5 px-3">Net Material</th>
                    <th class="py-2.5 px-3">Tax & Logistics</th>
                    <th class="py-2.5 px-3">Total Landed Cost</th>
                    <th class="py-2.5 px-3">Vs L1</th>
                    <th class="py-2.5 px-3">Lead Time / Terms</th>
                    <th class="py-2.5 px-3">Technical Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#edf1f5]">
                  @for (row of comparisonRows(); track row.quotationId) {
                    <tr [class]="row.rank === 1 ? 'bg-[#f4fbf7]' : ''">
                      <td class="py-2.5 px-3">
                        @if (row.rank) {
                          <span
                            class="px-2 py-0.5 rounded text-[10px] font-extrabold"
                            [class]="row.rank === 1 ? 'bg-[#eaf8f0] text-[#16834e]' : 'bg-[#edf3f8] text-[#183b5d]'"
                          >
                            L{{ row.rank }}
                          </span>
                        } @else {
                          <span class="text-[#94a3b8]">—</span>
                        }
                      </td>
                      <td class="py-2.5 px-3">
                        <div class="font-bold text-[#142238]">{{ row.supplierName }}</div>
                        <div class="text-[10px] text-[#64748b] font-mono">{{ row.supplierNumber }}</div>
                      </td>
                      <td class="py-2.5 px-3 font-semibold text-[#315c80]">v{{ row.versionNumber }}</td>
                      <td class="py-2.5 px-3 tabular-nums">{{ row.currencyCode }} {{ row.netMaterial | number:'1.2-2' }}</td>
                      <td class="py-2.5 px-3 tabular-nums">{{ row.currencyCode }} {{ row.extrasTotal | number:'1.2-2' }}</td>
                      <td class="py-2.5 px-3 font-extrabold text-[#142238] tabular-nums">
                        {{ row.currencyCode }} {{ row.totalLandedCost | number:'1.2-2' }}
                      </td>
                      <td class="py-2.5 px-3 tabular-nums">
                        @if (row.variancePct === 0) {
                          <span class="text-[#16834e] font-bold">L1 Baseline</span>
                        } @else {
                          <span class="text-[#9a6700] font-semibold">+{{ row.variancePct | number:'1.1-1' }}%</span>
                        }
                      </td>
                      <td class="py-2.5 px-3 text-[#475569]">{{ row.leadTimeDays }}d · {{ row.paymentTerms || 'Std' }}</td>
                      <td class="py-2.5 px-3">
                        <span class="px-2 py-0.5 rounded bg-[#edf4fa] text-[#315b7e] text-[10px] font-bold">
                          {{ row.techStatus }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <div class="grid gap-4">
            @for (q of quotations(); track q.quotationId) {
              @let latest = q.versions[q.versions.length - 1];
              <div class="border border-[#e3eaf1] rounded-xl p-4 bg-[#fcfdfe]">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div class="flex flex-wrap items-center gap-2">
                    @if (q.computedRank) {
                      <span
                        class="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold"
                        [class]="q.computedRank === 1 ? 'bg-[#eaf8f0] text-[#16834e]' : 'bg-[#edf3f8] text-[#183b5d]'"
                      >
                        L{{ q.computedRank }}
                      </span>
                    }
                    <strong class="text-sm text-[#142238]">{{ q.supplierName }}</strong>
                    <span class="text-xs text-[#64748b] font-mono">({{ q.supplierNumber }})</span>
                    <span class="text-[11px] font-semibold text-[#64748b]">· {{ q.versions.length }} version(s)</span>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-extrabold text-[#183b5d] tabular-nums">
                      {{ latest.currencyCode }} {{ latest.totalLandedCost | number:'1.2-2' }}
                    </div>
                    <div class="text-[11px] text-[#64748b]">
                      Lead time: {{ latest.leadTimeDays }}d · {{ latest.incoterms || 'Standard' }} · {{ latest.paymentTerms || 'Standard' }}
                    </div>
                  </div>
                </div>

                <div class="grid gap-2 mb-3">
                  @for (ver of q.versions; track ver.quotationVersionId) {
                    <div class="p-3 rounded-lg bg-white border border-[#edf1f5] text-xs">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span class="font-extrabold text-[#315c80]">v{{ ver.versionNumber }}</span>
                          <span class="ml-2 text-[#142238] font-semibold tabular-nums">
                            {{ ver.currencyCode }} {{ ver.totalLandedCost | number:'1.2-2' }}
                          </span>
                          <span class="ml-2 text-[#64748b]">Submitted {{ ver.submittedAt | date:'short' }} by {{ ver.submittedByName }}</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5">
                          @if (ver.technicalEvaluation) {
                            <span class="px-2 py-0.5 rounded bg-[#eaf8f0] text-[#16834e] text-[10px] font-extrabold">
                              Tech: {{ ver.technicalEvaluation.technicalStatus }}
                            </span>
                          }
                          @if (ver.commercialEvaluation) {
                            <span class="px-2 py-0.5 rounded bg-[#edf3f8] text-[#183b5d] text-[10px] font-extrabold">
                              Comm: L{{ ver.commercialEvaluation.rankNumber }} ({{ ver.commercialEvaluation.score ?? '—' }}/100)
                            </span>
                          }
                          <span class="px-2 py-0.5 rounded bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
                            {{ ver.versionStatus }}
                          </span>
                          @if (canWithdrawVersion(item, ver.versionStatus)) {
                            <button
                              type="button"
                              (click)="withdrawVersion(ver.quotationVersionId, ver.versionNumber)"
                              [disabled]="busy()"
                              class="px-2.5 py-1 rounded border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-[10px] font-bold cursor-pointer"
                            >
                              Withdraw
                            </button>
                          }
                        </div>
                      </div>
                      @if (ver.remarks) {
                        <div class="text-[11px] text-[#64748b] mt-1">Note: {{ ver.remarks }}</div>
                      }
                    </div>
                  }
                </div>

                @if (canTechEvaluate() || canCommercialEvaluate() || canRecommend(item)) {
                  <div class="pt-3 border-t border-[#edf1f5] flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      @if (canTechEvaluate()) {
                        <button
                          type="button"
                          (click)="recordTechEval(latest.quotationVersionId, q.supplierName, latest.versionNumber, 'TECH_ACCEPTED')"
                          [disabled]="busy()"
                          class="h-8 px-3 rounded-lg border border-[#b9e3d0] bg-[#eaf8f0] text-[#16834e] text-[11px] font-bold cursor-pointer"
                        >
                          Tech Accept v{{ latest.versionNumber }}
                        </button>
                        <button
                          type="button"
                          (click)="recordTechEval(latest.quotationVersionId, q.supplierName, latest.versionNumber, 'TECH_REJECTED')"
                          [disabled]="busy()"
                          class="h-8 px-3 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-[11px] font-bold cursor-pointer"
                        >
                          Tech Reject
                        </button>
                      }
                      @if (canCommercialEvaluate()) {
                        <button
                          type="button"
                          (click)="recordCommEval(latest.quotationVersionId, q.supplierName, q.computedRank ?? 1)"
                          [disabled]="busy()"
                          class="h-8 px-3 rounded-lg border border-[#dce4ec] bg-[#f8fafc] text-[#183b5d] text-[11px] font-bold cursor-pointer"
                        >
                          Score Commercial L{{ q.computedRank ?? 1 }}
                        </button>
                        @if (!['AWARDED', 'CLOSED', 'CANCELLED'].includes(item.status)) {
                          <a
                            [routerLink]="['/quotations/rfq', item.rfqId, 'negotiate']"
                            [queryParams]="{ supplierId: q.supplierId }"
                            class="h-8 px-3 rounded-lg border border-[#dce4ec] bg-white text-[#315c80] text-[11px] font-bold inline-flex items-center gap-1 no-underline"
                          >
                            <mat-icon class="!text-sm !w-3.5 !h-3.5">forum</mat-icon>
                            <span>Open Negotiation</span>
                          </a>
                        }
                      }
                    </div>

                    @if (canRecommend(item)) {
                      <a
                        [routerLink]="['/quotations/rfq', item.rfqId, 'recommend', latest.quotationVersionId]"
                        class="h-8 px-3.5 rounded-lg bg-[#183b5d] text-white text-[11px] font-bold inline-flex items-center gap-1 no-underline"
                      >
                        <mat-icon class="!text-sm !w-3.5 !h-3.5">recommend</mat-icon>
                        <span>Recommend for Award</span>
                      </a>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>
    }
  `,
})
export class QuotationRfqComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);

  protected readonly rfq = signal<Rfq | null>(null);
  protected readonly quotations = signal<Quotation[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly comparisonRows = computed(() => {
    const list = this.quotations();
    const activeRows = list
      .map((q) => {
        const active = q.versions.filter((v) => v.versionStatus !== 'WITHDRAWN');
        const ver = active[active.length - 1] ?? q.versions[q.versions.length - 1];
        if (!ver) return null;
        const netMaterial = ver.lines.reduce((s, l) => s + l.netUnitPrice * l.quantity, 0);
        const extrasTotal = ver.lines.reduce(
          (s, l) => s + l.taxAmount + l.freightAmount + l.packingAmount + l.toolingAmount + l.insuranceAmount + l.otherCharges,
          0,
        );
        return {
          quotationId: q.quotationId,
          rank: q.computedRank,
          supplierName: q.supplierName,
          supplierNumber: q.supplierNumber,
          versionNumber: ver.versionNumber,
          currencyCode: ver.currencyCode,
          netMaterial,
          extrasTotal,
          totalLandedCost: ver.totalLandedCost,
          leadTimeDays: ver.leadTimeDays,
          paymentTerms: ver.paymentTerms,
          techStatus: ver.technicalEvaluation?.technicalStatus ?? 'PENDING',
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

    const l1 = activeRows.reduce((m, r) => Math.min(m, r.totalLandedCost), Number.MAX_SAFE_INTEGER);
    return activeRows.map((r) => ({
      ...r,
      variancePct: l1 > 0 && l1 < Number.MAX_SAFE_INTEGER ? ((r.totalLandedCost - l1) / l1) * 100 : 0,
    }));
  });

  ngOnInit(): void {
    const notice = this.route.snapshot.queryParamMap.get('notice');
    if (notice) this.successMessage.set(notice);

    this.route.paramMap.subscribe((params) => {
      const rfqId = params.get('rfqId');
      if (rfqId) {
        this.loadData(rfqId);
      }
    });
  }

  private loadData(rfqId: string): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getRfq(rfqId).subscribe({
      next: (res) => {
        this.rfq.set(res.data);
        this.loadQuotations(rfqId);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQ.');
        this.loading.set(false);
      },
    });
  }

  private loadQuotations(rfqId: string): void {
    this.srm.getQuotations(rfqId).subscribe({
      next: (res) => {
        this.quotations.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load quotations.');
        this.loading.set(false);
      },
    });
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canAccessRfqs(): boolean {
    return this.auth.canAccessRfqs();
  }

  protected canAccessNegotiations(): boolean {
    return this.auth.canAccessNegotiations();
  }

  protected canSubmitQuotation(rfq: Rfq): boolean {
    if (!this.auth.hasRole('SUPPLIER_USER')) return false;
    return ['PUBLISHED', 'INVITATIONS_SENT', 'QUOTATION_OPEN', 'EVALUATION', 'NEGOTIATION'].includes(rfq.status);
  }

  protected canWithdrawVersion(rfq: Rfq, versionStatus: string): boolean {
    if (!this.auth.hasRole('SUPPLIER_USER', 'SRM_ADMIN')) return false;
    if (['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) return false;
    return versionStatus === 'SUBMITTED' || versionStatus === 'REVISED';
  }

  protected canTechEvaluate(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SUPPLIER_VERIFIER', 'SRM_ADMIN');
  }

  protected canCommercialEvaluate(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SRM_ADMIN');
  }

  protected canRecommend(rfq: Rfq): boolean {
    return (
      this.auth.hasRole('PROCUREMENT_BUYER') &&
      ['QUOTATION_OPEN', 'EVALUATION', 'NEGOTIATION'].includes(rfq.status)
    );
  }

  protected async recordTechEval(
    versionId: string,
    supplierName: string,
    versionNumber: number,
    status: string,
  ): Promise<void> {
    const isAccept = status === 'TECH_ACCEPTED';
    const ok = await this.confirmDialog.confirm({
      title: isAccept ? 'Approve Technical Evaluation?' : 'Reject Technical Evaluation?',
      message: `Record "${status}" on ${supplierName} quotation v${versionNumber}?`,
      confirmLabel: isAccept ? 'Tech Accept' : 'Tech Reject',
      tone: isAccept ? 'success' : 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.recordTechnicalEvaluation(versionId, status, `Recorded ${status} during evaluation`).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        const rfq = this.rfq();
        if (rfq) this.loadQuotations(rfq.rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Technical evaluation failed.');
        this.busy.set(false);
      },
    });
  }

  protected async recordCommEval(versionId: string, supplierName: string, rankNumber: number): Promise<void> {
    const score = Math.max(60, 100 - (rankNumber - 1) * 10);
    const ok = await this.confirmDialog.confirm({
      title: 'Record Commercial Score?',
      message: `Assign commercial rank L${rankNumber} (${score}/100) for ${supplierName}?`,
      confirmLabel: 'Save Score',
      tone: 'primary',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm
      .recordCommercialEvaluation(versionId, rankNumber, score, `Verified landed cost rank L${rankNumber}`)
      .subscribe({
        next: (res) => {
          this.successMessage.set(res.message);
          const rfq = this.rfq();
          if (rfq) this.loadQuotations(rfq.rfqId);
          this.busy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Commercial evaluation failed.');
          this.busy.set(false);
        },
      });
  }

  protected async withdrawVersion(versionId: string, versionNumber: number): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Withdraw Quotation Version?',
      message: `Withdraw quotation v${versionNumber}? Once withdrawn, this version cannot be awarded.`,
      confirmLabel: 'Withdraw Bid',
      tone: 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.withdrawQuotation(versionId, 'Withdrawn prior to award decision').subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        const rfq = this.rfq();
        if (rfq) this.loadQuotations(rfq.rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to withdraw quotation version.');
        this.busy.set(false);
      },
    });
  }
}
