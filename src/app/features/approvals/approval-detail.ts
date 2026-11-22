import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { ApprovalOverview, ApprovalRequest, Award, SapIntegrationEvent } from '../../core/services/srm.models';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-approval-detail',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, MatIconModule],
  template: `
    <div class="mb-6">
      <a
        routerLink="/approvals"
        class="inline-flex items-center gap-1.5 text-xs font-bold text-[#315c80] no-underline hover:underline mb-2"
      >
        <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
        <span>Back to Approvals & SAP PIR Queue</span>
      </a>
      <span class="block text-[10px] font-extrabold tracking-[0.14em] text-[#64748b] uppercase">
        SRM WORKSPACE / APPROVAL REQUEST / {{ request()?.recommendation?.rfqNumber || requestId() }}
      </span>
      <div class="flex flex-wrap items-end justify-between gap-4 mt-1">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
            {{ request()?.recommendation?.rfqTitle || 'Approval Request Workspace' }}
          </h1>
          <p class="text-sm text-[#64748b] m-0 mt-1">
            Review buyer recommendation, execute Segregation-of-Duties decision, record formal award, and manage SAP PIR sync.
          </p>
        </div>
        <button
          type="button"
          (click)="loadOverview()"
          [disabled]="loading()"
          class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] hover:bg-[#f8fafc] cursor-pointer disabled:opacity-55"
        >
          <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
          <span>Refresh</span>
        </button>
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

    @if (loading() && !request()) {
      <div class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center text-xs text-[#64748b]">
        Loading approval request details…
      </div>
    } @else if (!request()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center">
        <mat-icon class="text-[#94a3b8] !text-3xl !w-8 !h-8 mb-2">search_off</mat-icon>
        <h2 class="text-base font-bold text-[#142238] m-0">Approval request not found</h2>
        <p class="text-xs text-[#64748b] mt-1 mb-4">The requested approval record is unavailable or outside your workspace scope.</p>
        <a
          routerLink="/approvals"
          class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold no-underline"
        >
          Return to Queue
        </a>
      </section>
    } @else {
      @let req = request()!;
      @let task = req.tasks[0];

      <!-- Summary KPI Strip -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Approval Status</span>
          <div class="mt-1.5 flex items-center gap-2">
            <span
              class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold"
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
              <span class="px-2 py-0.5 rounded-full bg-[#fef7e6] text-[#9a6700] text-[10px] font-extrabold">
                NON-L1
              </span>
            }
          </div>
          <div class="text-[11px] text-[#64748b] mt-1.5">{{ req.createdAt | date:'medium' }}</div>
        </div>

        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Recommended Supplier</span>
          <div class="text-sm font-bold text-[#142238] mt-1 truncate">{{ req.recommendation.supplierName }}</div>
          <div class="text-[11px] text-[#64748b] mt-0.5">
            Quotation v{{ req.recommendation.versionNumber }} · By {{ req.recommendation.recommendedByName }}
          </div>
        </div>

        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Recommended Value</span>
          <div class="text-lg font-extrabold text-[#183b5d] mt-1 tabular-nums">
            {{ req.recommendation.currencyCode }} {{ req.recommendation.recommendedAmount | number:'1.2-2' }}
          </div>
          <div class="text-[11px] text-[#64748b] mt-0.5 tabular-nums">
            L1 Baseline: {{ req.recommendation.l1Amount | number:'1.2-2' }}
          </div>
        </div>

        <div class="bg-white border border-[#e3eaf1] rounded-xl p-4">
          <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Variance / Savings</span>
          @if (req.recommendation.savingsAmount > 0) {
            <div class="text-lg font-extrabold text-[#16834e] mt-1 tabular-nums">
              +{{ req.recommendation.currencyCode }} {{ req.recommendation.savingsAmount | number:'1.2-2' }}
            </div>
            <div class="text-[11px] text-[#16834e] mt-0.5">Favorable savings captured</div>
          } @else {
            <div class="text-lg font-extrabold text-[#142238] mt-1 tabular-nums">
              {{ req.recommendation.isNonL1 ? 'Non-L1 Exception' : 'L1 Matched' }}
            </div>
            <div class="text-[11px] text-[#64748b] mt-0.5">
              {{ req.recommendation.isNonL1 ? 'Technical / lead-time justified' : 'Lowest evaluated bidder' }}
            </div>
          }
        </div>
      </section>

      <!-- Recommendation Justification & Navigation Links -->
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">Commercial Recommendation Brief</h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">
              Submitted for RFQ {{ req.recommendation.rfqNumber }} by {{ req.recommendation.recommendedByName }}.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a
              [routerLink]="['/rfqs', req.recommendation.rfqId]"
              class="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#dce4ec] bg-white text-[11px] font-bold text-[#315c80] no-underline hover:bg-[#f4f7fa]"
            >
              <mat-icon class="!text-sm !w-4 !h-4">assignment</mat-icon>
              <span>Inspect RFQ</span>
            </a>
            <a
              [routerLink]="['/quotations/rfq', req.recommendation.rfqId]"
              class="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#dce4ec] bg-white text-[11px] font-bold text-[#315c80] no-underline hover:bg-[#f4f7fa]"
            >
              <mat-icon class="!text-sm !w-4 !h-4">compare_arrows</mat-icon>
              <span>Comparison Matrix</span>
            </a>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#30465e] leading-relaxed">
          <strong class="block text-[#142238] mb-1">Buyer Commercial Justification</strong>
          {{ req.recommendation.justification || 'No commercial remarks recorded.' }}
        </div>
      </section>

      <!-- Section 1: Approval Governance Decision -->
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#edf1f5]">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">Approval Task & Segregation of Duties</h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">
              Only authorized PROCUREMENT_APPROVER accounts distinct from the recommender may decide this task.
            </p>
          </div>
          @if (task) {
            <span class="px-2.5 py-1 rounded bg-[#f1f5f9] text-[#334155] text-[10px] font-extrabold">
              TASK: {{ task.taskStatus }}
            </span>
          }
        </div>

        @if (task && task.taskStatus === 'PENDING') {
          @if (!canApprove()) {
            <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#475569]">
              Pending decision by an authorized <strong>PROCUREMENT_APPROVER</strong>. Your active role does not include approval decision rights.
            </div>
          } @else if (isRecommenderSelf(req)) {
            <div class="p-4 rounded-xl bg-[#fef7e6] border border-[#f5d0a9] text-xs text-[#9a6700] font-medium flex items-center gap-2">
              <mat-icon class="!text-base !w-4 !h-4 shrink-0">gpp_maybe</mat-icon>
              <span>Segregation of duties enforced: you submitted this recommendation and cannot approve, return, or reject it.</span>
            </div>
          } @else {
            <div class="grid gap-4">
              <label class="grid gap-1.5 text-xs font-bold text-[#334155]">
                Approval Decision Remarks
                <span class="font-normal text-[#64748b]">Optional for Approval · Mandatory when returning or rejecting</span>
                <textarea
                  [formControl]="remarksControl"
                  rows="3"
                  placeholder="Enter governance remarks, audit notes, or revision instructions…"
                  class="p-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]"
                ></textarea>
              </label>

              <div class="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  (click)="decide(req, task.approvalTaskId, 'APPROVED')"
                  [disabled]="busy()"
                  class="h-10 px-5 rounded-lg bg-[#16834e] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#126a3f] cursor-pointer disabled:opacity-50"
                >
                  <mat-icon class="!text-base !w-4 !h-4">check_circle</mat-icon>
                  <span>Approve Recommendation</span>
                </button>
                <button
                  type="button"
                  (click)="decide(req, task.approvalTaskId, 'RETURNED')"
                  [disabled]="busy() || !remarksControl.value.trim()"
                  class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] inline-flex items-center gap-1.5 hover:bg-[#f8fafc] cursor-pointer disabled:opacity-50"
                >
                  <mat-icon class="!text-base !w-4 !h-4">undo</mat-icon>
                  <span>Return to Buyer</span>
                </button>
                <button
                  type="button"
                  (click)="decide(req, task.approvalTaskId, 'REJECTED')"
                  [disabled]="busy() || !remarksControl.value.trim()"
                  class="h-10 px-4 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-xs font-bold text-[#a13d36] inline-flex items-center gap-1.5 hover:bg-[#feeceb] cursor-pointer disabled:opacity-50"
                >
                  <mat-icon class="!text-base !w-4 !h-4">cancel</mat-icon>
                  <span>Reject Recommendation</span>
                </button>
              </div>
            </div>
          }
        } @else if (task) {
          <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#334155]">
            <div>
              Decision recorded: <strong>{{ task.taskStatus }}</strong> by <strong>{{ task.decidedByName }}</strong>
              @if (task.decidedAt) { · {{ task.decidedAt | date:'medium' }} }
            </div>
            @if (task.remarks) {
              <div class="mt-1.5 text-[#475569]">Remarks: "{{ task.remarks }}"</div>
            }
          </div>
        }
      </section>

      <!-- Section 2: Formal Award Issuance & Controlled SAP PIR Integration -->
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#edf1f5]">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">Formal Award & SAP PIR Integration</h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">
              Issue the formal SRM award after approval and synchronize the Purchase Info Record (PIR) with SAP.
            </p>
          </div>
          @if (activeAward(); as award) {
            <span
              class="px-2.5 py-1 rounded-full text-[10px] font-extrabold"
              [class]="award.awardStatus === 'CANCELLED' ? 'bg-[#fff1f0] text-[#a13d36]' : 'bg-[#eaf8f0] text-[#16834e]'"
            >
              AWARD: {{ award.awardStatus }}
            </span>
          }
        </div>

        @if (!activeAward()) {
          @if (req.status === 'APPROVED' && canIssueAward()) {
            <div class="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#f0f5fa] border border-[#dce4ec]">
              <div class="text-xs text-[#30465e]">
                <strong class="block text-[#142238]">Ready for Formal Award Issuance</strong>
                Approval has passed. Record the formal award to unlock idempotent SAP PIR synchronization.
              </div>
              <button
                type="button"
                (click)="recordAward(req)"
                [disabled]="busy()"
                class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#122e49] cursor-pointer disabled:opacity-50"
              >
                <mat-icon class="!text-base !w-4 !h-4">emoji_events</mat-icon>
                <span>Record Formal Award</span>
              </button>
            </div>
          } @else {
            <p class="text-xs text-[#64748b] m-0">
              {{
                req.status === 'APPROVED'
                  ? 'Awaiting formal award issuance by an authorized Procurement Buyer.'
                  : 'Formal award issuance becomes available once the approval request is APPROVED.'
              }}
            </p>
          }
        } @else {
          @let award = activeAward()!;
          @let sapEv = sapEvent();
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Awarded Value</span>
              <div class="text-base font-extrabold text-[#142238] mt-1 tabular-nums">
                {{ award.currencyCode }} {{ award.approvedValue | number:'1.2-2' }}
              </div>
              <div class="text-[11px] text-[#64748b] mt-0.5">Award ID: {{ award.awardId }}</div>
            </div>

            <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">SAP Vendor Code</span>
              <div class="text-base font-mono font-bold text-[#142238] mt-1">
                {{ sapEv?.sapVendorCode || 'NOT MAPPED' }}
              </div>
              <div class="text-[11px] text-[#64748b] mt-0.5">Required before SAP PIR sync</div>
            </div>

            <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">SAP PIR Status & Ref</span>
              <div class="mt-1 flex items-center gap-2">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                  [class]="
                    sapEv?.status === 'SUCCESS'
                      ? 'bg-[#eaf8f0] text-[#16834e]'
                      : sapEv?.status === 'FAILED'
                        ? 'bg-[#fff1f0] text-[#a13d36]'
                        : 'bg-[#fef7e6] text-[#9a6700]'
                  "
                >
                  {{ sapEv?.status || 'PENDING' }}
                </span>
                <span class="font-mono text-xs text-[#142238]">{{ sapEv?.externalReference || '—' }}</span>
              </div>
              @if (sapEv?.sanitizedError) {
                <div class="text-[11px] text-[#a13d36] mt-1">{{ sapEv?.sanitizedError }}</div>
              }
            </div>
          </div>

          @if (award.awardStatus !== 'CANCELLED') {
            <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#edf1f5]">
              @if (canSyncSap() && sapEv?.status !== 'SUCCESS') {
                <button
                  type="button"
                  (click)="syncPir(award.awardId, req.recommendation.rfqNumber)"
                  [disabled]="busy()"
                  class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#122e49] cursor-pointer disabled:opacity-50"
                >
                  <mat-icon class="!text-base !w-4 !h-4">sync</mat-icon>
                  <span>{{ sapEv?.status === 'FAILED' ? 'Retry SAP PIR Sync' : 'Sync SAP PIR' }}</span>
                </button>
              } @else if (sapEv?.status === 'SUCCESS') {
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#16834e]">
                  <mat-icon class="!text-base !w-4 !h-4">verified</mat-icon>
                  <span>SAP Purchase Info Record synchronized ({{ sapEv?.externalReference }})</span>
                </span>
              }
            </div>

            @if (canSyncSap()) {
              <div class="mt-5 p-4 rounded-xl bg-[#fff7f6] border border-[#f0d4d1]">
                <div class="text-xs font-bold text-[#a13d36] mb-2">Cancel Formal Award (Exception Action)</div>
                <div class="flex flex-wrap items-center gap-2.5">
                  <input
                    [formControl]="cancelReasonControl"
                    placeholder="Mandatory audit reason to cancel this award…"
                    class="flex-1 min-w-[260px] h-9 px-3 border border-[#f0d4d1] rounded-lg bg-white text-xs"
                  />
                  <button
                    type="button"
                    (click)="cancelAward(award.awardId, req.recommendation.rfqNumber)"
                    [disabled]="busy() || !cancelReasonControl.value.trim()"
                    class="h-9 px-4 rounded-lg bg-[#a13d36] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <mat-icon class="!text-sm !w-4 !h-4">block</mat-icon>
                    <span>Cancel Formal Award</span>
                  </button>
                </div>
              </div>
            }
          } @else {
            <div class="p-4 rounded-xl bg-[#fff1f0] border border-[#f5d0cd] text-xs text-[#a13d36] font-medium">
              This formal award has been cancelled. All cancellation history is preserved in the audit log.
            </div>
          }
        }
      </section>
    }
  `,
})
export class ApprovalDetailComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly requestId = signal('');
  protected readonly overview = signal<ApprovalOverview | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly remarksControl = new FormControl('', { nonNullable: true });
  protected readonly cancelReasonControl = new FormControl('', { nonNullable: true });

  protected readonly request = computed<ApprovalRequest | null>(() => {
    const id = this.requestId();
    return this.overview()?.approvalRequests.find((r) => r.approvalRequestId === id) ?? null;
  });

  protected readonly activeAward = computed<Award | null>(() => {
    const req = this.request();
    const awards = this.overview()?.awards ?? [];
    if (!req) return null;
    return (
      awards.find((a) => a.rfqId === req.recommendation.rfqId && a.awardStatus !== 'CANCELLED') ??
      awards.find((a) => a.rfqId === req.recommendation.rfqId) ??
      null
    );
  });

  protected readonly sapEvent = computed<SapIntegrationEvent | null>(() => {
    const award = this.activeAward();
    if (!award) return null;
    return this.overview()?.sapIntegrations.find((ev) => ev.awardId === award.awardId) ?? null;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('requestId') ?? '';
      this.requestId.set(id);
      this.loadOverview();
    });
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

  protected loadOverview(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getApprovalsOverview().subscribe({
      next: (res) => {
        this.overview.set(res.data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load approval request details.');
        this.loading.set(false);
      },
    });
  }

  protected async decide(
    req: ApprovalRequest,
    taskId: string,
    decision: 'APPROVED' | 'RETURNED' | 'REJECTED',
  ): Promise<void> {
    const remarks = this.remarksControl.value.trim();
    if ((decision === 'RETURNED' || decision === 'REJECTED') && !remarks) {
      this.errorMessage.set('Please enter remarks before returning or rejecting.');
      return;
    }

    const actionConfig =
      decision === 'APPROVED'
        ? {
            title: 'Approve Award Recommendation',
            message: `Approve ${req.recommendation.supplierName} for ${req.recommendation.rfqNumber} (${req.recommendation.currencyCode} ${req.recommendation.recommendedAmount.toFixed(2)})?`,
            confirmLabel: 'Approve',
            tone: 'success' as const,
            icon: 'check_circle',
          }
        : decision === 'RETURNED'
          ? {
              title: 'Return Recommendation to Buyer',
              message: `Return ${req.recommendation.rfqNumber} recommendation to the buyer for revision?`,
              confirmLabel: 'Return',
              tone: 'warning' as const,
              icon: 'undo',
            }
          : {
              title: 'Reject Award Recommendation',
              message: `Permanently reject the award recommendation for ${req.recommendation.rfqNumber}?`,
              confirmLabel: 'Reject',
              tone: 'danger' as const,
              icon: 'cancel',
            };

    const ok = await this.confirmDialog.confirm({
      ...actionConfig,
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.decideApproval(req.approvalRequestId, taskId, decision, remarks).subscribe({
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

  protected async recordAward(req: ApprovalRequest): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Record Formal Award',
      message: `Issue the formal SRM award to ${req.recommendation.supplierName} for ${req.recommendation.rfqNumber}?`,
      confirmLabel: 'Record Award',
      cancelLabel: 'Cancel',
      tone: 'primary',
      icon: 'emoji_events',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.recordAward(req.recommendation.rfqId).subscribe({
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

  protected async syncPir(awardId: string, rfqNumber: string): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Synchronize SAP Purchase Info Record',
      message: `Trigger idempotent SAP PIR creation/update for ${rfqNumber}?`,
      confirmLabel: 'Sync SAP PIR',
      cancelLabel: 'Cancel',
      tone: 'primary',
      icon: 'sync',
    });
    if (!ok) return;

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

  protected async cancelAward(awardId: string, rfqNumber: string): Promise<void> {
    const reason = this.cancelReasonControl.value.trim();
    if (!reason || this.busy()) return;

    const ok = await this.confirmDialog.confirm({
      title: 'Cancel Formal Award',
      message: `Cancel the formal award for ${rfqNumber}? This action is permanently logged in the audit trail.`,
      confirmLabel: 'Cancel Award',
      cancelLabel: 'Keep Award',
      tone: 'danger',
      icon: 'block',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.srm.cancelAward(awardId, reason).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
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
