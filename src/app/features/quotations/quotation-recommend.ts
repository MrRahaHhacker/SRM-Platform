import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { SrmService } from '../../core/services/srm.service';
import type { Quotation, QuotationVersion, Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quotation-recommend',
  imports: [ReactiveFormsModule, DecimalPipe, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-[11px] font-bold text-[#64748b] mb-1">
          <a routerLink="/quotations" class="text-[#315c80] no-underline hover:underline">Quotations</a>
          <span>/</span>
          @if (rfq(); as item) {
            <a [routerLink]="['/quotations/rfq', item.rfqId]" class="text-[#315c80] no-underline hover:underline">{{ item.rfqNumber }}</a>
            <span>/</span>
          }
          <span>Recommend for Award</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          Submit Award Recommendation
        </h1>
        <p class="text-sm text-[#64748b] m-0 mt-1">
          Route the recommended quotation version into Segregation-of-Duties procurement approval.
        </p>
      </div>
      @if (rfq(); as item) {
        <a
          [routerLink]="['/quotations/rfq', item.rfqId]"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f4f7fa]"
        >
          <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
          <span>Back to Comparison</span>
        </a>
      }
    </div>

    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    @if (loading()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center text-xs text-[#64748b]">
        Loading quotation details…
      </section>
    } @else if (target(); as info) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 max-w-3xl">
        <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e3eaf1] mb-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Recommended Bid</span>
              <h2 class="text-lg font-bold text-[#142238] m-0 mt-0.5">
                {{ info.quotation.supplierName }} ({{ info.quotation.supplierNumber }})
              </h2>
              <div class="text-xs text-[#64748b] mt-0.5">
                Version v{{ info.version.versionNumber }} · Lead time {{ info.version.leadTimeDays }} days
              </div>
            </div>
            <div class="text-right">
              <div class="text-xl font-extrabold text-[#183b5d] tabular-nums">
                {{ info.rfq.currencyCode }} {{ info.version.totalLandedCost | number:'1.2-2' }}
              </div>
              <div class="text-[11px] text-[#64748b] tabular-nums">
                L1 Baseline: {{ info.rfq.currencyCode }} {{ info.l1Amount | number:'1.2-2' }}
              </div>
            </div>
          </div>

          @if (info.isNonL1) {
            <div class="mt-3 p-2.5 rounded-lg bg-[#fef7e6] border border-[#f5d0a9] text-[#9a6700] text-xs font-bold">
              NON-L1 EXCEPTION: Commercial justification is mandatory when recommending a higher landed-cost offer.
            </div>
          }
        </div>

        <form [formGroup]="recommendForm" (ngSubmit)="submitRecommendation(info)" class="grid gap-4">
          <label class="grid gap-1.5 text-xs font-bold text-[#334155]">
            Commercial & Technical Justification
            <textarea
              formControlName="justification"
              rows="4"
              placeholder="Explain L1 selection or justify why non-L1 offer provides superior total value/delivery"
              class="p-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
            ></textarea>
          </label>

          <div class="flex justify-end gap-2.5 pt-3 border-t border-[#edf1f5]">
            <a
              [routerLink]="['/quotations/rfq', info.rfq.rfqId]"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline inline-flex items-center"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="busy() || (info.isNonL1 && !recommendForm.controls.justification.value.trim())"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">send</mat-icon>
              <span>{{ busy() ? 'Submitting…' : 'Submit for Approval' }}</span>
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class QuotationRecommendComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly rfq = signal<Rfq | null>(null);
  protected readonly target = signal<{
    rfq: Rfq;
    quotation: Quotation;
    version: QuotationVersion;
    l1Amount: number;
    isNonL1: boolean;
  } | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly recommendForm = new FormGroup({
    justification: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const rfqId = this.route.snapshot.paramMap.get('rfqId');
    const versionId = this.route.snapshot.paramMap.get('versionId');
    if (rfqId && versionId) {
      this.loadTarget(rfqId, versionId);
    }
  }

  private loadTarget(rfqId: string, versionId: string): void {
    this.loading.set(true);
    this.srm.getRfq(rfqId).subscribe({
      next: (rRes) => {
        const rfq = rRes.data;
        this.rfq.set(rfq);
        this.srm.getQuotations(rfqId).subscribe({
          next: (qRes) => {
            const list = qRes.data ?? [];
            const l1Amount = Math.min(
              ...list.map((q) => q.versions[q.versions.length - 1]?.totalLandedCost ?? Number.MAX_SAFE_INTEGER),
            );
            let foundQuote: Quotation | null = null;
            let foundVer: QuotationVersion | null = null;
            for (const q of list) {
              const v = q.versions.find((ver) => ver.quotationVersionId === versionId);
              if (v) {
                foundQuote = q;
                foundVer = v;
                break;
              }
            }
            if (!foundQuote || !foundVer) {
              this.errorMessage.set('Selected quotation version not found.');
              this.loading.set(false);
              return;
            }
            const isNonL1 = foundVer.totalLandedCost > l1Amount;
            this.target.set({ rfq, quotation: foundQuote, version: foundVer, l1Amount, isNonL1 });
            this.recommendForm.reset({
              justification: isNonL1 ? '' : 'L1 landed cost and technical acceptance.',
            });
            this.loading.set(false);
          },
          error: (err: HttpErrorResponse) => {
            this.errorMessage.set(err.error?.message ?? 'Unable to load quotation version.');
            this.loading.set(false);
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQ.');
        this.loading.set(false);
      },
    });
  }

  protected async submitRecommendation(info: {
    rfq: Rfq;
    quotation: Quotation;
    version: QuotationVersion;
    l1Amount: number;
    isNonL1: boolean;
  }): Promise<void> {
    if (this.busy()) return;
    const justification = this.recommendForm.controls.justification.value.trim();
    if (info.isNonL1 && !justification) return;

    const ok = await this.confirmDialog.confirm({
      title: 'Submit Award Recommendation?',
      message: `Recommend ${info.quotation.supplierName} (v${info.version.versionNumber}) for ${info.rfq.rfqNumber} approval?`,
      confirmLabel: 'Submit Recommendation',
      tone: 'primary',
      icon: 'recommend',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm
      .recommendSupplier(info.rfq.rfqId, info.version.quotationVersionId, justification)
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          void this.router.navigate(['/approvals', res.data.approvalRequestId], {
            queryParams: { notice: res.message },
          });
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Failed to submit recommendation.');
          this.busy.set(false);
        },
      });
  }
}
