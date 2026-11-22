import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { ApprovalOverview, ApprovalRequest } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-approvals',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#8795a5] uppercase">
          SRM WORKSPACE / APPROVALS & SAP PIR
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#17263b] tracking-tight mt-1 mb-1">
          Approvals, awards & SAP PIR sync
        </h1>
        <p class="text-sm text-[#78889b] m-0">
          Review buyer recommendations with segregation-of-duties enforcement, issue awards, and sync SAP Purchase Info Records.
        </p>
      </div>
      <button
        type="button"
        (click)="loadOverview()"
        [disabled]="loading()"
        class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer disabled:opacity-55"
      >
        <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
        <span>Refresh</span>
      </button>
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

    @if (isSupplierOnly()) {
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-8 text-center">
        <mat-icon class="text-[#315c80] !text-3xl !w-8 !h-8 mb-2">lock</mat-icon>
        <h2 class="text-base font-bold text-[#18283d] m-0">Internal Approval Governance</h2>
        <p class="text-xs text-[#6f8093] max-w-md mx-auto mt-1">
          Approval tasks, internal recommendations, and SAP PIR integration events are restricted to authorized procurement approvers, buyers, and auditors.
        </p>
      </section>
    } @else if (overview(); as data) {
      <!-- Approval Requests Queue -->
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-bold text-[#18283d] m-0">Procurement Approval Queue</h2>
            <p class="text-xs text-[#78889b] m-0 mt-0.5">
              Segregation of duties: the buyer who recommended an award cannot approve it.
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">
            {{ data.approvalRequests.length }} request(s)
          </span>
        </div>

        @if (data.approvalRequests.length === 0) {
          <p class="text-xs text-[#6f8093] py-6 text-center">No approval requests queued.</p>
        } @else {
          <div class="grid gap-4">
            @for (req of data.approvalRequests; track req.approvalRequestId) {
              @let task = req.tasks[0];
              <div class="p-4 rounded-xl border border-[#e6ebf1] bg-[#fcfdfe]">
                <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="px-2.5 py-0.5 rounded-md bg-[#edf3f8] text-[#183b5d] text-[11px] font-extrabold">
                        {{ req.recommendation.rfqNumber }}
                      </span>
                      <span
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold"
                        [class]="
                          req.status === 'APPROVED'
                            ? 'bg-[#eaf8f0] text-[#16834e]'
                            : req.status === 'REJECTED'
                              ? 'bg-[#fff1f0] text-[#a13d36]'
                              : 'bg-[#fef7e6] text-[#9a6700]'
                        "
                      >
                        {{ req.status }}
                      </span>
                      @if (req.recommendation.isNonL1) {
                        <span class="px-2.5 py-0.5 rounded-full bg-[#fef7e6] text-[#9a6700] text-[10px] font-extrabold">
                          NON-L1 EXCEPTION
                        </span>
                      }
                    </div>
                    <h3 class="text-sm font-bold text-[#18283d] m-0 mt-1.5">
                      {{ req.recommendation.rfqTitle }} — {{ req.recommendation.supplierName }}
                    </h3>
                    <p class="text-xs text-[#6f8093] m-0 mt-0.5">
                      Recommended by <strong>{{ req.recommendation.recommendedByName }}</strong> ·
                      Quotation v{{ req.recommendation.versionNumber }} ·
                      {{ req.createdAt | date:'medium' }}
                    </p>
                  </div>

                  <div class="text-right">
                    <div class="text-base font-extrabold text-[#183b5d] tabular-nums">
                      {{ req.recommendation.currencyCode }} {{ req.recommendation.recommendedAmount | number:'1.2-2' }}
                    </div>
                    <div class="text-[11px] text-[#6f8093]">
                      L1 baseline: {{ req.recommendation.l1Amount | number:'1.2-2' }}
                      @if (req.recommendation.savingsAmount > 0) {
                        · <span class="text-[#16834e] font-bold">Saved {{ req.recommendation.savingsAmount | number:'1.2-2' }}</span>
                      }
                    </div>
                  </div>
                </div>

                @if (req.recommendation.justification) {
                  <div class="p-3 rounded-lg bg-white border border-[#edf1f5] text-xs text-[#30465e] mb-3">
                    <strong>Commercial Justification:</strong> {{ req.recommendation.justification }}
                  </div>
                }

                @if (task && task.taskStatus === 'PENDING' && canApprove()) {
                  @if (isRecommenderSelf(req)) {
                    <div class="p-3 rounded-lg bg-[#fef7e6] text-[#9a6700] text-xs font-medium">
                      Segregation of duties: you submitted this recommendation and cannot approve it.
                    </div>
                  } @else {
                    <div class="pt-3 border-t border-[#edf1f5] flex flex-wrap items-center gap-2">
                      <input
                        [formControl]="remarksControl"
                        placeholder="Approval remarks (required for return or rejection)"
                        class="flex-1 min-w-[220px] h-9 px-3 border border-[#dfe6ed] rounded-lg bg-white text-xs"
                      />
                      <button
                        type="button"
                        (click)="decide(req.approvalRequestId, task.approvalTaskId, 'APPROVED')"
                        [disabled]="busy()"
                        class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        (click)="decide(req.approvalRequestId, task.approvalTaskId, 'RETURNED')"
                        [disabled]="busy() || !remarksControl.value.trim()"
                        class="h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer disabled:opacity-50"
                      >
                        Return
                      </button>
                      <button
                        type="button"
                        (click)="decide(req.approvalRequestId, task.approvalTaskId, 'REJECTED')"
                        [disabled]="busy() || !remarksControl.value.trim()"
                        class="h-9 px-3.5 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-xs font-bold text-[#a13d36] cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  }
                } @else if (task && task.taskStatus !== 'PENDING') {
                  <div class="text-xs text-[#52657a] pt-2 border-t border-[#edf1f5] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Decision: <strong>{{ task.taskStatus }}</strong> by {{ task.decidedByName }}
                      @if (task.remarks) { — "{{ task.remarks }}" }
                    </span>
                    @if (req.status === 'APPROVED' && canIssueAward() && !hasAwardForRfq(req.recommendation.rfqId)) {
                      <button
                        type="button"
                        (click)="recordAward(req.recommendation.rfqId)"
                        [disabled]="busy()"
                        class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <mat-icon class="!text-base !w-4 !h-4">emoji_events</mat-icon>
                        <span>Record Formal Award</span>
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>

      <!-- Formal Awards & Controlled SAP PIR Integration -->
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-bold text-[#18283d] m-0">Awards & Controlled SAP PIR Integration</h2>
            <p class="text-xs text-[#78889b] m-0 mt-0.5">
              Final initial-SRM integration milestone: idempotent SAP Purchase Info Record (PIR) creation/update after approval and award.
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">
            {{ data.sapIntegrations.length }} integration record(s)
          </span>
        </div>

        @if (data.sapIntegrations.length === 0) {
          <p class="text-xs text-[#6f8093] py-6 text-center">No awards recorded yet.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left text-xs">
              <thead>
                <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#8795a5]">
                  <th class="py-2.5 px-3">RFQ</th>
                  <th class="py-2.5 px-3">Awarded Supplier</th>
                  <th class="py-2.5 px-3">SAP Vendor Code</th>
                  <th class="py-2.5 px-3">Approved Value</th>
                  <th class="py-2.5 px-3">SAP PIR Status</th>
                  <th class="py-2.5 px-3">SAP PIR Reference</th>
                  <th class="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#edf1f5]">
                @for (ev of data.sapIntegrations; track ev.integrationEventId) {
                  <tr>
                    <td class="py-3 px-3 font-bold text-[#315c80]">{{ ev.rfqNumber }}</td>
                    <td class="py-3 px-3">
                      <div class="font-bold text-[#273b51]">{{ ev.supplierName }}</div>
                      <div class="text-[11px] text-[#8b98a7]">{{ ev.supplierNumber }}</div>
                    </td>
                    <td class="py-3 px-3 font-mono text-[11px]">{{ ev.sapVendorCode || 'NOT MAPPED' }}</td>
                    <td class="py-3 px-3 font-bold tabular-nums">{{ ev.currencyCode }} {{ ev.approvedValue | number:'1.2-2' }}</td>
                    <td class="py-3 px-3">
                      <span
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold"
                        [class]="
                          ev.status === 'SUCCESS'
                            ? 'bg-[#eaf8f0] text-[#16834e]'
                            : ev.status === 'FAILED'
                              ? 'bg-[#fff1f0] text-[#a13d36]'
                              : 'bg-[#fef7e6] text-[#9a6700]'
                        "
                      >
                        {{ ev.status }}
                      </span>
                      @if (ev.sanitizedError) {
                        <div class="text-[11px] text-[#a13d36] mt-1 max-w-xs">{{ ev.sanitizedError }}</div>
                      }
                    </td>
                    <td class="py-3 px-3 font-mono text-[11px] text-[#273b51]">{{ ev.externalReference || '—' }}</td>
                    <td class="py-3 px-3">
                      <div class="flex flex-wrap items-center gap-2">
                        @if (isAwardCancelled(ev.awardId)) {
                          <span class="px-2 py-0.5 rounded bg-[#fff1f0] text-[#a13d36] text-[10px] font-extrabold">
                            AWARD CANCELLED
                          </span>
                        } @else {
                          @if (ev.status !== 'SUCCESS' && canSyncSap()) {
                            <button
                              type="button"
                              (click)="syncPir(ev.awardId)"
                              [disabled]="busy()"
                              class="h-8 px-3 rounded-lg bg-[#183b5d] text-white text-[11px] font-bold cursor-pointer"
                            >
                              {{ ev.status === 'FAILED' ? 'Retry SAP PIR' : 'Sync SAP PIR' }}
                            </button>
                          } @else if (ev.status === 'SUCCESS') {
                            <span class="text-[11px] text-[#16834e] font-bold">Synced</span>
                          }
                          @if (canSyncSap()) {
                            <button
                              type="button"
                              (click)="startCancelAward(ev.awardId)"
                              [disabled]="busy()"
                              class="h-8 px-2.5 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-[11px] font-bold cursor-pointer"
                            >
                              Cancel Award
                            </button>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (cancellingAwardId(); as cancelId) {
            <div class="mt-4 p-4 rounded-xl bg-[#fff7f6] border border-[#f0d4d1] flex flex-wrap items-center gap-2">
              <input
                [formControl]="cancelReasonControl"
                placeholder="Mandatory reason to cancel formal award…"
                class="flex-1 min-w-[260px] h-9 px-3 border border-[#f0d4d1] rounded-lg bg-white text-xs"
              />
              <button
                type="button"
                (click)="confirmCancelAward(cancelId)"
                [disabled]="busy() || !cancelReasonControl.value.trim()"
                class="h-9 px-4 rounded-lg bg-[#a13d36] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
              <button
                type="button"
                (click)="cancellingAwardId.set(null)"
                class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        }
      </section>
    }
  `,
})
export class ApprovalsComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);

  protected readonly overview = signal<ApprovalOverview | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly cancellingAwardId = signal<string | null>(null);

  protected readonly remarksControl = new FormControl('', { nonNullable: true });
  protected readonly cancelReasonControl = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    if (!this.isSupplierOnly()) {
      this.loadOverview();
    }
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canApprove(): boolean {
    return this.auth.hasRole('PROCUREMENT_APPROVER');
  }

  protected canIssueAward(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER');
  }

  protected canSyncSap(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SRM_ADMIN');
  }

  protected isRecommenderSelf(req: ApprovalRequest): boolean {
    return req.recommendation.recommendedBy === this.auth.getUser()?.userId;
  }

  protected hasAwardForRfq(rfqId: string): boolean {
    return this.overview()?.awards.some((a) => a.rfqId === rfqId && a.awardStatus !== 'CANCELLED') ?? false;
  }

  protected isAwardCancelled(awardId: string): boolean {
    return this.overview()?.awards.some((a) => a.awardId === awardId && a.awardStatus === 'CANCELLED') ?? false;
  }

  protected loadOverview(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getApprovalsOverview().subscribe({
      next: (res) => {
        this.overview.set(res.data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load approvals.');
        this.loading.set(false);
      },
    });
  }

  protected decide(requestId: string, taskId: string, decision: 'APPROVED' | 'RETURNED' | 'REJECTED'): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.decideApproval(requestId, taskId, decision, this.remarksControl.value.trim()).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.remarksControl.setValue('');
        this.busy.set(false);
        this.loadOverview();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to record approval decision.');
        this.busy.set(false);
      },
    });
  }

  protected recordAward(rfqId: string): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.recordAward(rfqId).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.busy.set(false);
        this.loadOverview();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to record award.');
        this.busy.set(false);
      },
    });
  }

  protected syncPir(awardId: string): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.syncSapPir(awardId).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.busy.set(false);
        this.loadOverview();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'SAP PIR sync failed.');
        this.busy.set(false);
        this.loadOverview();
      },
    });
  }

  protected startCancelAward(awardId: string): void {
    this.cancellingAwardId.set(awardId);
    this.cancelReasonControl.setValue('');
  }

  protected confirmCancelAward(awardId: string): void {
    const reason = this.cancelReasonControl.value.trim();
    if (!reason || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.cancelAward(awardId, reason).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.cancellingAwardId.set(null);
        this.cancelReasonControl.setValue('');
        this.busy.set(false);
        this.loadOverview();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to cancel award.');
        this.busy.set(false);
      },
    });
  }
}
