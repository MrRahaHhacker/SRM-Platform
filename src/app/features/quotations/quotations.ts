import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { NegotiationRound, Quotation, Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quotations',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#8795a5] uppercase">
          SRM WORKSPACE / QUOTATIONS & NEGOTIATION
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#17263b] tracking-tight mt-1 mb-1">
          Quotations, evaluation & negotiation
        </h1>
        <p class="text-sm text-[#78889b] m-0">
          Version-controlled supplier bids, L1/L2/L3 landed cost comparison, technical clearance, negotiation rounds, and award recommendation.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select
          [formControl]="selectedRfqControl"
          (change)="onRfqChange()"
          class="h-10 px-3 border border-[#dce4ec] rounded-lg bg-white text-xs font-bold text-[#18283d] min-w-[260px]"
        >
          @for (rfq of rfqs(); track rfq.rfqId) {
            <option [value]="rfq.rfqId">{{ rfq.rfqNumber }} — {{ rfq.title }} ({{ rfq.status }})</option>
          }
        </select>
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

    @if (activeRfq(); as rfq) {
      <!-- Supplier Quotation Submission Form (SUPPLIER_USER or SRM_ADMIN) -->
      @if (canSubmitQuotation(rfq)) {
        <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 class="text-base font-bold text-[#18283d] m-0">
                {{ quotations().length > 0 ? 'Submit Revised Quotation Version' : 'Submit Quotation' }}
              </h2>
              <p class="text-xs text-[#78889b] m-0 mt-0.5">
                Every submission creates an immutable version (v{{ (quotations()[0]?.versions?.length ?? 0) + 1 }}). Prior versions remain preserved.
              </p>
            </div>
            <span class="px-3 py-1 rounded-full bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
              Computed Landed Total: {{ rfq.currencyCode }} {{ computedFormTotal() | number:'1.2-2' }}
            </span>
          </div>

          <form [formGroup]="quoteForm" (ngSubmit)="submitQuotation(rfq.rfqId)" class="grid gap-4">
            <div formArrayName="lines" class="grid gap-3">
              @for (lineCtrl of quoteLinesArray.controls; track $index) {
                @let rfqLine = rfq.lines[$index];
                <div [formGroupName]="$index" class="p-3.5 rounded-xl bg-[#f9fbfc] border border-[#e6ebf1]">
                  <div class="text-xs font-bold text-[#18283d] mb-2">
                    {{ rfqLine.sapMaterialCode }} — {{ rfqLine.materialDescription }} ({{ rfqLine.quantity }} {{ rfqLine.uom }})
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                      Basic Unit Price *
                      <input type="number" formControlName="basicUnitPrice" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                    </label>
                    <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                      Discount (Total)
                      <input type="number" formControlName="discountAmount" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                    </label>
                    <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                      Tax (Total)
                      <input type="number" formControlName="taxAmount" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                    </label>
                    <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                      Freight
                      <input type="number" formControlName="freightAmount" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                    </label>
                    <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                      Packing
                      <input type="number" formControlName="packingAmount" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                    </label>
                    <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                      Tooling
                      <input type="number" formControlName="toolingAmount" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                    </label>
                    <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                      Insurance/Other
                      <input type="number" formControlName="insuranceAmount" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                    </label>
                  </div>
                </div>
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Lead Time (Days) *
                <input type="number" formControlName="leadTimeDays" min="0" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg text-xs" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Payment Terms
                <input formControlName="paymentTerms" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg text-xs" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Incoterms
                <input formControlName="incoterms" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg text-xs" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Validity Date
                <input type="date" formControlName="validityDate" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg text-xs" />
              </label>
              <label class="sm:col-span-4 grid gap-1 text-[11px] font-bold text-[#53657a]">
                Commercial / Technical Remarks
                <input formControlName="remarks" placeholder="Note delivery commitments, tooling amortization, or warranty" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg text-xs" />
              </label>
            </div>

            <div class="flex justify-end">
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

      <!-- Commercial Comparison Matrix & Version History -->
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-base font-bold text-[#18283d] m-0">
              {{ isSupplierOnly() ? 'Your Submitted Quotation History' : 'Commercial Comparison & Evaluation Matrix' }}
            </h2>
            <p class="text-xs text-[#78889b] m-0 mt-0.5">
              {{ isSupplierOnly() ? 'Confidential to your organization. Competitor bids are strictly isolated.' : 'Ranked by Total Landed Cost (L1 = lowest landed cost).' }}
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">
            {{ quotations().length }} supplier bid(s)
          </span>
        </div>

        @if (quotations().length === 0) {
          <p class="text-xs text-[#6f8093] py-6 text-center">No quotations submitted yet for {{ rfq.rfqNumber }}.</p>
        } @else {
          @if (!isSupplierOnly()) {
            <!-- Side-by-Side Commercial Comparison Matrix Table -->
            <div class="overflow-x-auto border border-[#e3eaf1] rounded-xl mb-5">
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
                        <div class="text-[10px] text-[#64748b]">{{ row.supplierNumber }}</div>
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
                      <td class="py-2.5 px-3 text-[#475569]">
                        {{ row.leadTimeDays }}d · {{ row.paymentTerms || 'Std' }}
                      </td>
                      <td class="py-2.5 px-3">
                        <span class="px-2 py-0.5 rounded-full bg-[#edf4fa] text-[#315b7e] text-[10px] font-bold">
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
              <div class="border border-[#e6ebf1] rounded-xl p-4 bg-[#fcfdfe]">
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
                    <strong class="text-sm text-[#18283d]">{{ q.supplierName }}</strong>
                    <span class="text-xs text-[#6f8093]">({{ q.supplierNumber }})</span>
                    <span class="px-2 py-0.5 rounded-full bg-[#f0f4f8] text-[#52657a] text-[10px] font-bold">
                      {{ q.versions.length }} version(s)
                    </span>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-extrabold text-[#183b5d] tabular-nums">
                      {{ latest.currencyCode }} {{ latest.totalLandedCost | number:'1.2-2' }}
                    </div>
                    <div class="text-[11px] text-[#6f8093]">
                      Lead time: {{ latest.leadTimeDays }}d · {{ latest.incoterms || 'Standard' }} · {{ latest.paymentTerms || 'Standard' }}
                    </div>
                  </div>
                </div>

                <!-- Version Timeline -->
                <div class="grid gap-2 mb-3">
                  @for (ver of q.versions; track ver.quotationVersionId) {
                    <div class="p-3 rounded-lg bg-white border border-[#edf1f5] text-xs">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span class="font-extrabold text-[#315c80]">v{{ ver.versionNumber }}</span>
                          <span class="ml-2 text-[#273b51] font-semibold">
                            {{ ver.currencyCode }} {{ ver.totalLandedCost | number:'1.2-2' }}
                          </span>
                          <span class="ml-2 text-[#8795a5]">Submitted {{ ver.submittedAt | date:'short' }} by {{ ver.submittedByName }}</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5">
                          @if (ver.technicalEvaluation) {
                            <span class="px-2 py-0.5 rounded-full bg-[#eaf8f0] text-[#16834e] text-[10px] font-extrabold">
                              Tech: {{ ver.technicalEvaluation.technicalStatus }}
                            </span>
                          }
                          @if (ver.commercialEvaluation) {
                            <span class="px-2 py-0.5 rounded-full bg-[#edf3f8] text-[#183b5d] text-[10px] font-extrabold">
                              Comm: L{{ ver.commercialEvaluation.rankNumber }} ({{ ver.commercialEvaluation.score ?? '—' }}/100)
                            </span>
                          }
                          <span class="px-2 py-0.5 rounded-full bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
                            {{ ver.versionStatus }}
                          </span>
                          @if (canWithdrawVersion(rfq, ver.versionStatus)) {
                            <button
                              type="button"
                              (click)="withdrawVersion(ver.quotationVersionId)"
                              [disabled]="busy()"
                              class="px-2 py-0.5 rounded border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-[10px] font-bold cursor-pointer"
                            >
                              Withdraw
                            </button>
                          }
                        </div>
                      </div>
                      @if (ver.remarks) {
                        <div class="text-[11px] text-[#6f8093] mt-1">Note: {{ ver.remarks }}</div>
                      }
                    </div>
                  }
                </div>

                <!-- Internal Evaluation & Recommendation Actions (Strictly Role-Gated) -->
                @if (canTechEvaluate() || canCommercialEvaluate() || canRecommend(rfq)) {
                  <div class="pt-3 border-t border-[#edf1f5] flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      @if (canTechEvaluate()) {
                        <button
                          type="button"
                          (click)="recordTechEval(latest.quotationVersionId, 'TECH_ACCEPTED')"
                          [disabled]="busy()"
                          class="h-8 px-3 rounded-lg border border-[#b9e3d0] bg-[#eaf8f0] text-[#16834e] text-[11px] font-bold cursor-pointer"
                        >
                          Tech Accept v{{ latest.versionNumber }}
                        </button>
                        <button
                          type="button"
                          (click)="recordTechEval(latest.quotationVersionId, 'TECH_REJECTED')"
                          [disabled]="busy()"
                          class="h-8 px-3 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-[11px] font-bold cursor-pointer"
                        >
                          Tech Reject
                        </button>
                      }
                      @if (canCommercialEvaluate()) {
                        <button
                          type="button"
                          (click)="recordCommEval(latest.quotationVersionId, q.computedRank ?? 1)"
                          [disabled]="busy()"
                          class="h-8 px-3 rounded-lg border border-[#dce4ec] bg-[#f8fafc] text-[#183b5d] text-[11px] font-bold cursor-pointer"
                        >
                          Score Commercial L{{ q.computedRank ?? 1 }}
                        </button>
                        @if (!['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
                          <button
                            type="button"
                            (click)="openNegotiationFor(q.supplierId, latest.totalLandedCost)"
                            class="h-8 px-3 rounded-lg border border-[#dce4ec] bg-white text-[#315c80] text-[11px] font-bold cursor-pointer"
                          >
                            Open Negotiation
                          </button>
                        }
                      }
                    </div>

                    @if (canRecommend(rfq)) {
                      <button
                        type="button"
                        (click)="startRecommend(q, latest.quotationVersionId, latest.versionNumber, latest.totalLandedCost)"
                        class="h-8 px-3.5 rounded-lg bg-[#183b5d] text-white text-[11px] font-bold cursor-pointer"
                      >
                        Recommend for Award
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Recommendation Justification Drawer -->
        @if (recommendingTarget(); as recTarget) {
          <form [formGroup]="recommendForm" (ngSubmit)="submitRecommendation(rfq.rfqId)" class="mt-5 p-4 rounded-xl bg-[#f0f5fa] border border-[#7da9ce]">
            <div class="text-xs font-bold text-[#18283d] mb-1">
              Recommend {{ recTarget.supplierName }} (v{{ recTarget.versionNumber }} · {{ rfq.currencyCode }} {{ recTarget.amount | number:'1.2-2' }})
              @if (recTarget.isNonL1) {
                <span class="ml-2 px-2 py-0.5 rounded-full bg-[#fef7e6] text-[#9a6700] text-[10px] font-extrabold">
                  NON-L1 EXCEPTION (Justification Mandatory)
                </span>
              }
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <input
                formControlName="justification"
                placeholder="Commercial justification (mandatory if non-L1)"
                class="flex-1 min-w-[260px] h-9 px-3 border border-[#dfe6ed] rounded-lg bg-white text-xs"
              />
              <button
                type="submit"
                [disabled]="busy() || (recTarget.isNonL1 && !recommendForm.controls.justification.value.trim())"
                class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Submit for Approval
              </button>
              <button
                type="button"
                (click)="recommendingTarget.set(null)"
                class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        }
      </section>

      <!-- Negotiation Rounds (Strictly hidden for roles without negotiation access) -->
      @if (canAccessNegotiations()) {
        <section class="bg-white border border-[#e6ebf1] rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-base font-bold text-[#18283d] m-0">Negotiation Rounds</h2>
              <p class="text-xs text-[#78889b] m-0 mt-0.5">
                Track buyer target requests, supplier counteroffers, and savings achieved against initial offers.
              </p>
            </div>
            <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">
              {{ negotiations().length }} round(s)
            </span>
          </div>

          @if (negotiatingSupplierId(); as negSupId) {
            <form [formGroup]="openNegForm" (ngSubmit)="submitOpenNegotiation(rfq.rfqId, negSupId)" class="p-4 rounded-xl bg-[#f9fbfc] border border-[#e6ebf1] mb-4 grid gap-3">
              <div class="text-xs font-bold text-[#18283d]">Open New Negotiation Round</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label class="grid gap-1 text-[10px] font-bold text-[#53657a]">
                  Target Landed Cost ({{ rfq.currencyCode }})
                  <input type="number" formControlName="targetAmount" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                </label>
                <label class="sm:col-span-2 grid gap-1 text-[10px] font-bold text-[#53657a]">
                  Buyer Negotiation Request *
                  <input formControlName="messageText" placeholder="Request revised unit price or tooling waiver" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                </label>
              </div>
              <div class="flex gap-2 justify-end">
                <button type="button" (click)="negotiatingSupplierId.set(null)" class="h-8 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" [disabled]="openNegForm.invalid || busy()" class="h-8 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer">
                  Open Round
                </button>
              </div>
            </form>
          }

          @if (negotiations().length === 0) {
            <p class="text-xs text-[#6f8093] py-4 text-center">No negotiation rounds opened for this RFQ.</p>
          } @else {
            <div class="grid gap-4">
              @for (round of negotiations(); track round.negotiationRoundId) {
                <div class="border border-[#e6ebf1] rounded-xl p-4">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <span class="font-extrabold text-xs text-[#315c80]">Round {{ round.roundNumber }}</span>
                      <strong class="text-sm text-[#18283d] ml-2">{{ round.supplierName }}</strong>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs">
                      <span class="text-[#6f8093]">
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
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold"
                        [class]="round.status === 'OPEN' ? 'bg-[#eaf8f0] text-[#16834e]' : 'bg-[#f0f4f8] text-[#62758a]'"
                      >
                        {{ round.status }}
                      </span>
                    </div>
                  </div>

                  <div class="grid gap-2 mb-3">
                    @for (msg of round.messages; track msg.messageId) {
                      <div class="p-2.5 rounded-lg bg-[#f9fbfc] border border-[#edf1f5] text-xs">
                        <div class="flex items-center justify-between text-[11px] text-[#6f8093] mb-1">
                          <span><strong>{{ msg.senderName }}</strong> ({{ msg.senderRole }})</span>
                          <span>{{ msg.createdAt | date:'short' }}</span>
                        </div>
                        <div class="text-[#273b51]">{{ msg.messageText }}</div>
                      </div>
                    }
                  </div>

                  @if (round.status === 'OPEN' && canRespondNegotiation()) {
                    <form [formGroup]="replyForm" (ngSubmit)="postReply(round.negotiationRoundId, false)" class="flex flex-wrap gap-2">
                      <input
                        formControlName="messageText"
                        placeholder="Write a negotiation response or counteroffer…"
                        class="flex-1 min-w-[220px] h-9 px-3 border border-[#dfe6ed] rounded-lg text-xs"
                      />
                      <button type="submit" [disabled]="replyForm.invalid || busy()" class="h-9 px-3.5 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer">
                        Send Message
                      </button>
                      @if (canCommercialEvaluate()) {
                        <button
                          type="button"
                          (click)="postReply(round.negotiationRoundId, true)"
                          [disabled]="busy()"
                          class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
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
    }
  `,
})
export class QuotationsComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly rfqs = signal<Rfq[]>([]);
  protected readonly activeRfq = signal<Rfq | null>(null);
  protected readonly quotations = signal<Quotation[]>([]);
  protected readonly negotiations = signal<NegotiationRound[]>([]);
  protected readonly busy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly negotiatingSupplierId = signal<string | null>(null);
  protected readonly recommendingTarget = signal<{
    supplierName: string;
    quotationVersionId: string;
    versionNumber: number;
    amount: number;
    isNonL1: boolean;
  } | null>(null);

  protected readonly selectedRfqControl = new FormControl('', { nonNullable: true });

  protected readonly quoteForm = new FormGroup({
    leadTimeDays: new FormControl(14, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    paymentTerms: new FormControl('Net 45 days', { nonNullable: true }),
    incoterms: new FormControl('DAP Pune Plant', { nonNullable: true }),
    validityDate: new FormControl('', { nonNullable: true }),
    remarks: new FormControl('', { nonNullable: true }),
    lines: new FormArray<FormGroup>([]),
  });

  protected readonly openNegForm = new FormGroup({
    targetAmount: new FormControl<number | null>(null),
    messageText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly replyForm = new FormGroup({
    messageText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly recommendForm = new FormGroup({
    justification: new FormControl('', { nonNullable: true }),
  });

  protected readonly computedFormTotal = computed(() => {
    const rfq = this.activeRfq();
    if (!rfq) return 0;
    const raw = this.quoteForm.getRawValue();
    return raw.lines.reduce((acc, line, idx) => {
      const qty = rfq.lines[idx]?.quantity ?? 1;
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
    const initialRfqId = this.route.snapshot.queryParamMap.get('rfqId');
    this.srm.getRfqs().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        this.rfqs.set(list);
        const picked = list.find((r) => r.rfqId === initialRfqId) ?? list[0] ?? null;
        if (picked) {
          this.selectedRfqControl.setValue(picked.rfqId);
          this.selectRfq(picked);
        }
      },
      error: (err: HttpErrorResponse) => this.errorMessage.set(err.error?.message ?? 'Unable to load RFQs.'),
    });
  }

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

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
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

  protected canAccessNegotiations(): boolean {
    return this.auth.canAccessNegotiations();
  }

  protected canRecommend(rfq: Rfq): boolean {
    return (
      this.auth.hasRole('PROCUREMENT_BUYER') &&
      ['QUOTATION_OPEN', 'EVALUATION', 'NEGOTIATION'].includes(rfq.status)
    );
  }

  protected canRespondNegotiation(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SUPPLIER_USER', 'SRM_ADMIN');
  }

  protected savingsPct(baseline: number, settled: number): number {
    if (baseline <= 0 || settled >= baseline) return 0;
    return ((baseline - settled) / baseline) * 100;
  }

  protected onRfqChange(): void {
    const rfq = this.rfqs().find((r) => r.rfqId === this.selectedRfqControl.value) ?? null;
    if (rfq) this.selectRfq(rfq);
  }

  private selectRfq(rfq: Rfq): void {
    this.activeRfq.set(rfq);
    this.recommendingTarget.set(null);
    this.negotiatingSupplierId.set(null);

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

    this.loadRfqDetails(rfq.rfqId);
  }

  private loadRfqDetails(rfqId: string): void {
    this.srm.getQuotations(rfqId).subscribe({
      next: (res) => this.quotations.set(res.data ?? []),
      error: (err: HttpErrorResponse) => this.errorMessage.set(err.error?.message ?? 'Unable to load quotations.'),
    });
    if (this.canAccessNegotiations()) {
      this.srm.getNegotiations(rfqId).subscribe({
        next: (res) => this.negotiations.set(res.data ?? []),
        error: () => undefined,
      });
    } else {
      this.negotiations.set([]);
    }
  }

  protected submitQuotation(rfqId: string): void {
    if (this.quoteForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const raw = this.quoteForm.getRawValue();
    this.srm.submitQuotation(rfqId, raw).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.loadRfqDetails(rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Quotation submission failed.');
        this.busy.set(false);
      },
    });
  }

  protected recordTechEval(versionId: string, status: string): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.recordTechnicalEvaluation(versionId, status, `Recorded ${status} during evaluation`).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        const rfq = this.activeRfq();
        if (rfq) this.loadRfqDetails(rfq.rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Technical evaluation failed.');
        this.busy.set(false);
      },
    });
  }

  protected recordCommEval(versionId: string, rankNumber: number): void {
    this.busy.set(true);
    this.errorMessage.set('');
    const score = Math.max(60, 100 - (rankNumber - 1) * 10);
    this.srm
      .recordCommercialEvaluation(versionId, rankNumber, score, `Verified landed cost rank L${rankNumber}`)
      .subscribe({
        next: (res) => {
          this.successMessage.set(res.message);
          const rfq = this.activeRfq();
          if (rfq) this.loadRfqDetails(rfq.rfqId);
          this.busy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Commercial evaluation failed.');
          this.busy.set(false);
        },
      });
  }

  protected withdrawVersion(versionId: string): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.withdrawQuotation(versionId, 'Withdrawn prior to award decision').subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        const rfq = this.activeRfq();
        if (rfq) this.loadRfqDetails(rfq.rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to withdraw quotation version.');
        this.busy.set(false);
      },
    });
  }

  protected openNegotiationFor(supplierId: string, currentTotal: number): void {
    this.negotiatingSupplierId.set(supplierId);
    this.openNegForm.patchValue({
      targetAmount: Math.round(currentTotal * 0.94),
      messageText: '',
    });
  }

  protected submitOpenNegotiation(rfqId: string, supplierId: string): void {
    if (this.openNegForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    const { targetAmount, messageText } = this.openNegForm.getRawValue();
    this.srm.openNegotiation(rfqId, supplierId, targetAmount, messageText).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.negotiatingSupplierId.set(null);
        this.loadRfqDetails(rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to open negotiation round.');
        this.busy.set(false);
      },
    });
  }

  protected postReply(roundId: string, closeRound: boolean): void {
    const msg = this.replyForm.controls.messageText.value.trim();
    if (!msg && !closeRound) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.postNegotiationMessage(roundId, msg || 'Negotiation round concluded by buyer.', null, closeRound).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.replyForm.reset({ messageText: '' });
        const rfq = this.activeRfq();
        if (rfq) this.loadRfqDetails(rfq.rfqId);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to post negotiation update.');
        this.busy.set(false);
      },
    });
  }

  protected startRecommend(q: Quotation, versionId: string, versionNumber: number, amount: number): void {
    const minAmount = Math.min(
      ...this.quotations().map((item) => item.versions[item.versions.length - 1]?.totalLandedCost ?? Number.MAX_SAFE_INTEGER),
    );
    this.recommendingTarget.set({
      supplierName: q.supplierName,
      quotationVersionId: versionId,
      versionNumber,
      amount,
      isNonL1: amount > minAmount,
    });
    this.recommendForm.reset({ justification: amount > minAmount ? '' : 'L1 landed cost and technical acceptance.' });
  }

  protected submitRecommendation(rfqId: string): void {
    const target = this.recommendingTarget();
    if (!target || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.srm
      .recommendSupplier(rfqId, target.quotationVersionId, this.recommendForm.controls.justification.value.trim())
      .subscribe({
        next: (res) => {
          this.successMessage.set(res.message);
          this.recommendingTarget.set(null);
          this.busy.set(false);
          void this.router.navigate(['/approvals']);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Failed to submit recommendation.');
          this.busy.set(false);
        },
      });
  }
}
