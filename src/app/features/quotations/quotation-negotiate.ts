import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { SrmService } from '../../core/services/srm.service';
import type { NegotiationRound, Quotation, Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quotation-negotiate',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, MatIconModule],
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
          <span>Negotiation Rounds</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          Negotiation Rounds
        </h1>
        @if (rfq(); as item) {
          <p class="text-xs text-[#64748b] m-0 mt-1">
            {{ item.rfqNumber }} — {{ item.title }} · Track buyer target requests, counteroffers, and cost savings.
          </p>
        }
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
        Loading negotiation rounds…
      </section>
    } @else if (rfq(); as item) {
      @if (canOpenRound(item) && quotations().length > 0) {
        <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
          <h2 class="text-sm font-bold text-[#142238] m-0 mb-3">Open New Negotiation Round</h2>
          <form [formGroup]="openNegForm" (ngSubmit)="submitOpenNegotiation(item)" class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Supplier *
              <select formControlName="supplierId" class="h-10 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs">
                <option value="">Select supplier…</option>
                @for (q of quotations(); track q.quotationId) {
                  <option [value]="q.supplierId">{{ q.supplierName }} ({{ q.supplierNumber }})</option>
                }
              </select>
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Target Landed Cost ({{ item.currencyCode }})
              <input type="number" formControlName="targetAmount" class="h-10 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs tabular-nums" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Buyer Negotiation Request *
              <input formControlName="messageText" placeholder="Request revised unit price" class="h-10 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
            </label>
            <button
              type="submit"
              [disabled]="openNegForm.invalid || busy()"
              class="h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">add_comment</mat-icon>
              <span>Open Round</span>
            </button>
          </form>
        </section>
      }

      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-bold text-[#142238] m-0">Active & Historical Rounds</h2>
          <span class="text-xs font-semibold text-[#64748b] tabular-nums">{{ negotiations().length }} round(s)</span>
        </div>

        @if (negotiations().length === 0) {
          <p class="text-xs text-[#64748b] py-6 text-center">No negotiation rounds opened for {{ item.rfqNumber }} yet.</p>
        } @else {
          <div class="grid gap-4">
            @for (round of negotiations(); track round.negotiationRoundId) {
              <div class="border border-[#e3eaf1] rounded-xl p-4">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <span class="font-extrabold text-xs text-[#315c80]">Round {{ round.roundNumber }}</span>
                    <strong class="text-sm text-[#142238] ml-2">{{ round.supplierName }}</strong>
                  </div>
                  <div class="flex flex-wrap items-center gap-3 text-xs">
                    <span class="text-[#64748b] tabular-nums">
                      Baseline: <strong>{{ round.baselineAmount | number:'1.2-2' }}</strong>
                      @if (round.settledAmount !== null) {
                        · Latest: <strong class="text-[#16834e]">{{ round.settledAmount | number:'1.2-2' }}</strong>
                        @if (round.baselineAmount > round.settledAmount) {
                          <span class="text-[#16834e] font-bold">
                            (Saved {{ round.baselineAmount - round.settledAmount | number:'1.2-2' }} · {{ savingsPct(round.baselineAmount, round.settledAmount) | number:'1.1-1' }}%)
                          </span>
                        }
                      }
                    </span>
                    <span
                      class="px-2.5 py-0.5 rounded text-[10px] font-extrabold"
                      [class]="round.status === 'OPEN' ? 'bg-[#eaf8f0] text-[#16834e]' : 'bg-[#f0f4f8] text-[#62758a]'"
                    >
                      {{ round.status }}
                    </span>
                  </div>
                </div>

                <div class="grid gap-2 mb-3">
                  @for (msg of round.messages; track msg.messageId) {
                    <div class="p-2.5 rounded-lg bg-[#f8fafc] border border-[#edf1f5] text-xs">
                      <div class="flex items-center justify-between text-[11px] text-[#64748b] mb-1">
                        <span><strong>{{ msg.senderName }}</strong> ({{ msg.senderRole }})</span>
                        <span>{{ msg.createdAt | date:'short' }}</span>
                      </div>
                      <div class="text-[#142238]">{{ msg.messageText }}</div>
                    </div>
                  }
                </div>

                @if (round.status === 'OPEN' && canRespondNegotiation()) {
                  <form [formGroup]="replyForm" (ngSubmit)="postReply(round.negotiationRoundId, round.roundNumber, false)" class="flex flex-wrap gap-2">
                    <input
                      formControlName="messageText"
                      placeholder="Write a negotiation response or counteroffer…"
                      class="flex-1 min-w-[220px] h-9 px-3 border border-[#cbd5e1] rounded-lg text-xs"
                    />
                    <button type="submit" [disabled]="replyForm.invalid || busy()" class="h-9 px-3.5 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer">
                      Send Message
                    </button>
                    @if (canCommercialEvaluate()) {
                      <button
                        type="button"
                        (click)="postReply(round.negotiationRoundId, round.roundNumber, true)"
                        [disabled]="busy()"
                        class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] cursor-pointer"
                      >
                        Close Round
                      </button>
                    }
                  </form>
                }
              </div>
            }
          </div>
        }
      </section>
    }
  `,
})
export class QuotationNegotiateComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);

  protected readonly rfq = signal<Rfq | null>(null);
  protected readonly quotations = signal<Quotation[]>([]);
  protected readonly negotiations = signal<NegotiationRound[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly openNegForm = new FormGroup({
    supplierId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    targetAmount: new FormControl<number | null>(null),
    messageText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly replyForm = new FormGroup({
    messageText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    const preselectedSupplier = this.route.snapshot.queryParamMap.get('supplierId') ?? '';
    const rfqId = this.route.snapshot.paramMap.get('rfqId');
    if (preselectedSupplier) {
      this.openNegForm.patchValue({ supplierId: preselectedSupplier });
    }
    if (rfqId) {
      this.loadAll(rfqId);
    }
  }

  private loadAll(rfqId: string): void {
    this.loading.set(true);
    this.srm.getRfq(rfqId).subscribe({
      next: (res) => {
        this.rfq.set(res.data);
        this.srm.getNegotiations(rfqId).subscribe({
          next: (nRes) => {
            this.negotiations.set(nRes.data ?? []);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
        if (this.canCommercialEvaluate()) {
          this.srm.getQuotations(rfqId).subscribe({
            next: (qRes) => this.quotations.set(qRes.data ?? []),
            error: () => undefined,
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load negotiation workspace.');
        this.loading.set(false);
      },
    });
  }

  protected canCommercialEvaluate(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SRM_ADMIN');
  }

  protected canOpenRound(rfq: Rfq): boolean {
    return this.canCommercialEvaluate() && !['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status);
  }

  protected canRespondNegotiation(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SUPPLIER_USER', 'SRM_ADMIN');
  }

  protected savingsPct(baseline: number, settled: number): number {
    if (baseline <= 0 || settled >= baseline) return 0;
    return ((baseline - settled) / baseline) * 100;
  }

  protected async submitOpenNegotiation(rfq: Rfq): Promise<void> {
    if (this.openNegForm.invalid || this.busy()) return;
    const { supplierId, targetAmount, messageText } = this.openNegForm.getRawValue();
    const sup = this.quotations().find((q) => q.supplierId === supplierId);
    const ok = await this.confirmDialog.confirm({
      title: 'Open Negotiation Round?',
      message: `Start a new negotiation round with ${sup?.supplierName ?? 'selected supplier'} on ${rfq.rfqNumber}?`,
      confirmLabel: 'Open Round',
      tone: 'primary',
      icon: 'forum',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.openNegotiation(rfq.rfqId, supplierId, targetAmount, messageText).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.openNegForm.patchValue({ targetAmount: null, messageText: '' });
        this.loadAll(rfq.rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to open negotiation round.');
        this.busy.set(false);
      },
    });
  }

  protected async postReply(roundId: string, roundNumber: number, closeRound: boolean): Promise<void> {
    const msg = this.replyForm.controls.messageText.value.trim();
    if (!msg && !closeRound) return;

    const ok = await this.confirmDialog.confirm({
      title: closeRound ? 'Close Negotiation Round?' : 'Send Negotiation Message?',
      message: closeRound
        ? `Close Round ${roundNumber}? Suppliers will no longer be able to reply in this round.`
        : `Post your response to Round ${roundNumber}?`,
      confirmLabel: closeRound ? 'Close Round' : 'Send Message',
      tone: closeRound ? 'warning' : 'primary',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.postNegotiationMessage(roundId, msg || 'Negotiation round concluded by buyer.', null, closeRound).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.replyForm.reset({ messageText: '' });
        const rfq = this.rfq();
        if (rfq) this.loadAll(rfq.rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to post negotiation update.');
        this.busy.set(false);
      },
    });
  }
}
