import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { SrmService } from '../../core/services/srm.service';
import type { Quotation, Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quotation-submit',
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
          <span>{{ existingQuotes().length > 0 ? 'Revise Quotation' : 'Submit Quotation' }}</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          {{ existingQuotes().length > 0 ? 'Submit Revised Quotation Version' : 'Submit Commercial Quotation' }}
        </h1>
        @if (rfq(); as item) {
          <p class="text-xs text-[#64748b] m-0 mt-1">
            {{ item.rfqNumber }} — {{ item.title }} · Next version: v{{ (existingQuotes()[0]?.versions?.length ?? 0) + 1 }}
          </p>
        }
      </div>
      @if (rfq(); as item) {
        <a
          [routerLink]="['/quotations/rfq', item.rfqId]"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f4f7fa]"
        >
          <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
          <span>Back to Bid History</span>
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
        Loading RFQ pricing sheet…
      </section>
    } @else if (rfq(); as item) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-[#edf1f5]">
          <div class="text-xs text-[#475569]">
            Every submission creates an immutable version. Prior versions remain locked for auditability.
          </div>
          <span class="px-3 py-1.5 rounded-md bg-[#edf4fa] text-[#183b5d] text-xs font-extrabold tabular-nums">
            Computed Landed Total: {{ item.currencyCode }} {{ computedFormTotal() | number:'1.2-2' }}
          </span>
        </div>

        <form [formGroup]="quoteForm" (ngSubmit)="submitQuotation(item)" class="grid gap-5">
          <div formArrayName="lines" class="grid gap-3">
            @for (lineCtrl of quoteLinesArray.controls; track $index) {
              @let rfqLine = item.lines[$index];
              <div [formGroupName]="$index" class="p-4 rounded-xl bg-[#f8fafc] border border-[#e3eaf1]">
                <div class="text-xs font-bold text-[#142238] mb-3">
                  {{ rfqLine.sapMaterialCode }} — {{ rfqLine.materialDescription }} ({{ rfqLine.quantity }} {{ rfqLine.uom }})
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  <label class="grid gap-1 text-[10px] font-bold text-[#334155]">
                    Basic Unit Price *
                    <input type="number" formControlName="basicUnitPrice" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
                  </label>
                  <label class="grid gap-1 text-[10px] font-bold text-[#334155]">
                    Discount (Total)
                    <input type="number" formControlName="discountAmount" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
                  </label>
                  <label class="grid gap-1 text-[10px] font-bold text-[#334155]">
                    Tax (Total)
                    <input type="number" formControlName="taxAmount" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
                  </label>
                  <label class="grid gap-1 text-[10px] font-bold text-[#334155]">
                    Freight
                    <input type="number" formControlName="freightAmount" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
                  </label>
                  <label class="grid gap-1 text-[10px] font-bold text-[#334155]">
                    Packing
                    <input type="number" formControlName="packingAmount" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
                  </label>
                  <label class="grid gap-1 text-[10px] font-bold text-[#334155]">
                    Tooling
                    <input type="number" formControlName="toolingAmount" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
                  </label>
                  <label class="grid gap-1 text-[10px] font-bold text-[#334155]">
                    Insurance/Other
                    <input type="number" formControlName="insuranceAmount" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
                  </label>
                </div>
              </div>
            }
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Lead Time (Days) *
              <input type="number" formControlName="leadTimeDays" min="0" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Payment Terms
              <input formControlName="paymentTerms" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Incoterms
              <input formControlName="incoterms" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Validity Date
              <input type="date" formControlName="validityDate" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
            <label class="sm:col-span-4 grid gap-1 text-[11px] font-bold text-[#334155]">
              Commercial / Technical Remarks
              <input formControlName="remarks" placeholder="Note delivery commitments, tooling amortization, or warranty" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
          </div>

          <div class="flex justify-end gap-2.5 pt-4 border-t border-[#edf1f5]">
            <a
              [routerLink]="['/quotations/rfq', item.rfqId]"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline inline-flex items-center"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="quoteForm.invalid || busy()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">send</mat-icon>
              <span>{{ busy() ? 'Submitting…' : 'Submit Quotation Version' }}</span>
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class QuotationSubmitComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly rfq = signal<Rfq | null>(null);
  protected readonly existingQuotes = signal<Quotation[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly quoteForm = new FormGroup({
    leadTimeDays: new FormControl(14, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    paymentTerms: new FormControl('Net 45 days', { nonNullable: true }),
    incoterms: new FormControl('DAP Pune Plant', { nonNullable: true }),
    validityDate: new FormControl('', { nonNullable: true }),
    remarks: new FormControl('', { nonNullable: true }),
    lines: new FormArray<FormGroup>([]),
  });

  protected readonly computedFormTotal = computed(() => {
    const item = this.rfq();
    if (!item) return 0;
    const raw = this.quoteForm.getRawValue();
    return raw.lines.reduce((acc, line, idx) => {
      const qty = item.lines[idx]?.quantity ?? 1;
      const basic = Number(line['basicUnitPrice'] ?? 0) * qty;
      const disc = Number(line['discountAmount'] ?? 0);
      const extras =
        Number(line['taxAmount'] ?? 0) +
        Number(line['freightAmount'] ?? 0) +
        Number(line['packingAmount'] ?? 0) +
        Number(line['toolingAmount'] ?? 0) +
        Number(line['insuranceAmount'] ?? 0);
      return acc + Math.max(0, basic - disc) + extras;
    }, 0);
  });

  get quoteLinesArray(): FormArray<FormGroup> {
    return this.quoteForm.controls.lines;
  }

  ngOnInit(): void {
    const rfqId = this.route.snapshot.paramMap.get('rfqId');
    if (rfqId) {
      this.loadRfq(rfqId);
    }
  }

  private loadRfq(rfqId: string): void {
    this.loading.set(true);
    this.srm.getRfq(rfqId).subscribe({
      next: (res) => {
        const rfq = res.data;
        this.rfq.set(rfq);
        this.quoteLinesArray.clear();
        for (const line of rfq.lines) {
          this.quoteLinesArray.push(
            new FormGroup({
              rfqLineId: new FormControl(line.rfqLineId, { nonNullable: true }),
              basicUnitPrice: new FormControl(line.targetPrice ?? 1000, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
              discountAmount: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
              taxAmount: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
              freightAmount: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
              packingAmount: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
              toolingAmount: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
              insuranceAmount: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
            }),
          );
        }
        this.srm.getQuotations(rfqId).subscribe({
          next: (qRes) => this.existingQuotes.set(qRes.data ?? []),
          error: () => undefined,
        });
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQ pricing form.');
        this.loading.set(false);
      },
    });
  }

  protected async submitQuotation(rfq: Rfq): Promise<void> {
    if (this.quoteForm.invalid || this.busy()) return;
    const nextVer = (this.existingQuotes()[0]?.versions?.length ?? 0) + 1;
    const total = this.computedFormTotal().toFixed(2);
    const ok = await this.confirmDialog.confirm({
      title: 'Submit Quotation Version?',
      message: `Submit immutable quotation v${nextVer} for ${rfq.rfqNumber} (Total: ${rfq.currencyCode} ${total})?`,
      confirmLabel: 'Submit Quotation',
      tone: 'primary',
      icon: 'send',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.submitQuotation(rfq.rfqId, this.quoteForm.getRawValue()).subscribe({
      next: (res) => {
        this.busy.set(false);
        void this.router.navigate(['/quotations/rfq', rfq.rfqId], {
          queryParams: { notice: res.message },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Quotation submission failed.');
        this.busy.set(false);
      },
    });
  }
}
