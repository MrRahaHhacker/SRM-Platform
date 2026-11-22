import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { SrmService } from '../../core/services/srm.service';
import type { Rfq } from '../../core/services/srm.models';
import { SupplierService } from '../suppliers/supplier.service';
import type { Supplier } from '../suppliers/supplier.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rfq-detail',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-[11px] font-bold text-[#64748b] mb-1">
          <a routerLink="/rfqs" class="text-[#315c80] no-underline hover:underline">RFQ Management</a>
          <span>/</span>
          <span>{{ rfq()?.rfqNumber || 'Details' }}</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          {{ rfq()?.title || 'RFQ Workspace' }}
        </h1>
        @if (rfq(); as item) {
          <p class="text-xs text-[#64748b] m-0 mt-1">
            {{ item.rfqNumber }} · {{ item.status }} · Deadline: {{ item.submissionDeadline | date:'medium' }}
          </p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a
          routerLink="/rfqs"
          class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f4f7fa]"
        >
          <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
          <span>Back to RFQs</span>
        </a>
        @if (rfq(); as item) {
          @if (item.status === 'DRAFT' && canCreateRfq()) {
            <a
              [routerLink]="['/rfqs', item.rfqId, 'edit']"
              class="h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-[#315c80] text-xs font-bold inline-flex items-center gap-1.5 no-underline"
            >
              <mat-icon class="!text-base !w-4 !h-4">edit</mat-icon>
              <span>Edit Draft</span>
            </a>
            <button
              type="button"
              (click)="publishRfq(item)"
              [disabled]="busy()"
              class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">publish</mat-icon>
              <span>Publish RFQ</span>
            </button>
          }
          @if (item.status !== 'DRAFT') {
            <a
              [routerLink]="['/quotations/rfq', item.rfqId]"
              class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 no-underline"
            >
              <mat-icon class="!text-base !w-4 !h-4">request_quote</mat-icon>
              <span>{{ isSupplierOnly() ? 'Submit / View Quotation' : 'Open Quotation Matrix' }}</span>
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
        Loading RFQ details…
      </section>
    } @else if (rfq(); as item) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6 mb-6">
        @if (item.description) {
          <p class="text-xs text-[#475569] m-0 mb-4 leading-relaxed">{{ item.description }}</p>
        }

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-xs">
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] font-bold uppercase">Currency / Plant</span>
            <strong class="text-[#142238]">{{ item.currencyCode }} · {{ item.plantCode || 'Standard' }}</strong>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] font-bold uppercase">Payment Terms</span>
            <strong class="text-[#142238]">{{ item.paymentTerms || '—' }}</strong>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] font-bold uppercase">Incoterms</span>
            <strong class="text-[#142238]">{{ item.incoterms || '—' }}</strong>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#64748b] font-bold uppercase">Buyer</span>
            <strong class="text-[#142238]">{{ item.buyerName }}</strong>
          </div>
        </div>

        <h2 class="text-xs font-bold text-[#142238] uppercase tracking-wider mb-2.5">SAP Material Code Lines</h2>
        <div class="overflow-x-auto border border-[#edf1f5] rounded-xl mb-5">
          <table class="w-full border-collapse text-left text-xs">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-3">#</th>
                <th class="py-2.5 px-3">SAP Material Code</th>
                <th class="py-2.5 px-3">Description</th>
                <th class="py-2.5 px-3">Quantity</th>
                <th class="py-2.5 px-3">Target Unit Price</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5]">
              @for (line of item.lines; track line.rfqLineId) {
                <tr>
                  <td class="py-2.5 px-3 text-[#64748b] tabular-nums">{{ line.lineNumber }}</td>
                  <td class="py-2.5 px-3 font-mono font-bold text-[#315c80]">{{ line.sapMaterialCode }}</td>
                  <td class="py-2.5 px-3 text-[#142238]">{{ line.materialDescription }}</td>
                  <td class="py-2.5 px-3 font-semibold tabular-nums">{{ line.quantity | number }} {{ line.uom }}</td>
                  <td class="py-2.5 px-3 tabular-nums">
                    {{ line.targetPrice !== null ? (item.currencyCode + ' ' + (line.targetPrice | number:'1.2-2')) : '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (isSupplierOnly() && item.invitations.length > 0) {
          @let myInv = item.invitations[0];
          <div class="p-4 rounded-xl bg-[#f8fafc] border border-[#e3eaf1]">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-[#142238]">
                  Your Invitation Status: <span class="text-[#315c80]">{{ myInv.invitationStatus }}</span>
                </div>
                @if (myInv.declineReason) {
                  <div class="text-xs text-[#a13d36] mt-0.5">Decline reason: {{ myInv.declineReason }}</div>
                }
              </div>
              @if (myInv.invitationStatus === 'INVITED' && !['AWARDED', 'CLOSED', 'CANCELLED'].includes(item.status)) {
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    (click)="respondInvitation(item, 'ACKNOWLEDGE')"
                    [disabled]="busy()"
                    class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <mat-icon class="!text-base !w-4 !h-4">check_circle</mat-icon>
                    <span>Acknowledge Participation</span>
                  </button>
                  <input
                    [formControl]="declineReasonControl"
                    placeholder="Reason if declining…"
                    class="h-9 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs w-56"
                  />
                  <button
                    type="button"
                    (click)="respondInvitation(item, 'DECLINE')"
                    [disabled]="busy() || !declineReasonControl.value.trim()"
                    class="h-9 px-3 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              }
            </div>
          </div>
        }

        @if (canCreateRfq()) {
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="p-4 rounded-xl border border-[#e3eaf1] bg-[#f8fafc]">
              <h3 class="text-xs font-bold text-[#142238] uppercase tracking-wider m-0 mb-2">
                Invited Suppliers ({{ item.invitations.length }})
              </h3>
              <div class="grid gap-1.5 mb-3">
                @for (inv of item.invitations; track inv.invitationId) {
                  <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-[#edf1f5]">
                    <div>
                      <span class="font-bold text-[#142238]">{{ inv.supplierName }}</span>
                      <span class="text-[#64748b] ml-1.5 font-mono">{{ inv.supplierNumber }}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
                      {{ inv.invitationStatus }}
                    </span>
                  </div>
                }
              </div>

              @if (eligibleUninvitedSuppliers(item).length > 0 && !['AWARDED', 'CLOSED', 'CANCELLED'].includes(item.status)) {
                <div class="flex items-center gap-2 pt-2 border-t border-[#e3eaf1]">
                  <select
                    [formControl]="inviteSupplierControl"
                    class="flex-1 h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs"
                  >
                    <option value="">Select qualified supplier to invite…</option>
                    @for (sup of eligibleUninvitedSuppliers(item); track sup.supplierId) {
                      <option [value]="sup.supplierId">
                        {{ sup.supplierNumber }} — {{ sup.legalName }} ({{ sup.lifecycleStatus }})
                      </option>
                    }
                  </select>
                  <button
                    type="button"
                    (click)="inviteSupplier(item)"
                    [disabled]="!inviteSupplierControl.value || busy()"
                    class="h-9 px-3.5 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Invite
                  </button>
                </div>
              }
            </div>

            <div class="p-4 rounded-xl border border-[#e3eaf1] bg-[#f8fafc]">
              <h3 class="text-xs font-bold text-[#142238] uppercase tracking-wider m-0 mb-2">
                Deadline & Lifecycle Controls
              </h3>
              @if (!['AWARDED', 'CLOSED', 'CANCELLED'].includes(item.status)) {
                <form [formGroup]="deadlineForm" (ngSubmit)="extendDeadline(item)" class="grid gap-2 mb-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="datetime-local" formControlName="submissionDeadline" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
                    <input formControlName="reason" placeholder="Extension reason" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
                  </div>
                  <button
                    type="submit"
                    [disabled]="deadlineForm.invalid || busy()"
                    class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#315c80] cursor-pointer justify-self-start disabled:opacity-50"
                  >
                    Extend Submission Deadline
                  </button>
                </form>

                <div class="flex items-center gap-2 pt-2 border-t border-[#e3eaf1]">
                  <input
                    [formControl]="closeReasonControl"
                    placeholder="Reason to close or cancel RFQ"
                    class="flex-1 h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs"
                  />
                  <button
                    type="button"
                    (click)="closeRfq(item, 'CLOSED')"
                    [disabled]="!closeReasonControl.value.trim() || busy()"
                    class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] cursor-pointer disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    (click)="closeRfq(item, 'CANCELLED')"
                    [disabled]="!closeReasonControl.value.trim() || busy()"
                    class="h-9 px-3 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Cancel RFQ
                  </button>
                </div>
              } @else {
                <p class="text-xs text-[#64748b] m-0">This RFQ is finalized ({{ item.status }}) and no longer accepts deadline edits.</p>
              }
            </div>
          </div>
        }
      </section>
    }
  `,
})
export class RfqDetailComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);

  protected readonly rfq = signal<Rfq | null>(null);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly inviteSupplierControl = new FormControl('', { nonNullable: true });
  protected readonly declineReasonControl = new FormControl('', { nonNullable: true });
  protected readonly closeReasonControl = new FormControl('', { nonNullable: true });

  protected readonly deadlineForm = new FormGroup({
    submissionDeadline: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly qualifiedSuppliers = computed(() =>
    this.suppliers().filter((s) => ['APPROVED', 'ACTIVE'].includes(s.lifecycleStatus)),
  );

  ngOnInit(): void {
    const notice = this.route.snapshot.queryParamMap.get('notice');
    if (notice) this.successMessage.set(notice);

    this.route.paramMap.subscribe((params) => {
      const id = params.get('rfqId');
      if (id) this.loadRfq(id);
    });

    if (this.canCreateRfq()) {
      this.supplierService.getSuppliers().subscribe({
        next: (res) => this.suppliers.set(res.data ?? []),
        error: () => undefined,
      });
    }
  }

  private loadRfq(rfqId: string): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getRfq(rfqId).subscribe({
      next: (res) => {
        this.rfq.set(res.data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQ details.');
        this.loading.set(false);
      },
    });
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canCreateRfq(): boolean {
    return this.auth.hasRole('PROCUREMENT_BUYER', 'SRM_ADMIN');
  }

  protected eligibleUninvitedSuppliers(rfq: Rfq): Supplier[] {
    const invitedIds = new Set(rfq.invitations.map((i) => i.supplierId));
    return this.qualifiedSuppliers().filter((s) => !invitedIds.has(s.supplierId));
  }

  protected async publishRfq(rfq: Rfq): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Publish RFQ?',
      message: `Publish ${rfq.rfqNumber} ("${rfq.title}") and open it for supplier quotations?`,
      confirmLabel: 'Publish RFQ',
      tone: 'success',
      icon: 'publish',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.publishRfq(rfq.rfqId).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.rfq.set(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to publish RFQ.');
        this.busy.set(false);
      },
    });
  }

  protected async inviteSupplier(rfq: Rfq): Promise<void> {
    const sid = this.inviteSupplierControl.value;
    if (!sid || this.busy()) return;
    const sup = this.qualifiedSuppliers().find((s) => s.supplierId === sid);
    const ok = await this.confirmDialog.confirm({
      title: 'Invite Supplier to RFQ?',
      message: `Send RFQ invitation for ${rfq.rfqNumber} to ${sup ? sup.legalName : 'selected supplier'}?`,
      confirmLabel: 'Send Invitation',
      tone: 'primary',
      icon: 'send',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.inviteSuppliers(rfq.rfqId, [sid]).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.inviteSupplierControl.setValue('');
        this.rfq.set(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to invite supplier.');
        this.busy.set(false);
      },
    });
  }

  protected async extendDeadline(rfq: Rfq): Promise<void> {
    if (this.deadlineForm.invalid || this.busy()) return;
    const { submissionDeadline, reason } = this.deadlineForm.getRawValue();
    const ok = await this.confirmDialog.confirm({
      title: 'Extend Submission Deadline?',
      message: `Update deadline for ${rfq.rfqNumber}? Reason: "${reason.trim()}".`,
      confirmLabel: 'Extend Deadline',
      tone: 'warning',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.extendRfqDeadline(rfq.rfqId, submissionDeadline, reason).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.deadlineForm.reset({ submissionDeadline: '', reason: '' });
        this.rfq.set(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to extend deadline.');
        this.busy.set(false);
      },
    });
  }

  protected async closeRfq(rfq: Rfq, status: 'CLOSED' | 'CANCELLED'): Promise<void> {
    const reason = this.closeReasonControl.value.trim();
    if (!reason || this.busy()) return;
    const ok = await this.confirmDialog.confirm({
      title: status === 'CANCELLED' ? 'Cancel RFQ Event?' : 'Close RFQ Event?',
      message: `${status === 'CANCELLED' ? 'Cancel' : 'Close'} ${rfq.rfqNumber}? Reason: "${reason}".`,
      confirmLabel: status === 'CANCELLED' ? 'Cancel RFQ' : 'Close RFQ',
      tone: status === 'CANCELLED' ? 'danger' : 'warning',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.closeRfq(rfq.rfqId, status, reason).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.closeReasonControl.setValue('');
        this.rfq.set(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update RFQ status.');
        this.busy.set(false);
      },
    });
  }

  protected async respondInvitation(rfq: Rfq, action: 'ACKNOWLEDGE' | 'DECLINE'): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: action === 'ACKNOWLEDGE' ? 'Acknowledge RFQ Participation?' : 'Decline RFQ Invitation?',
      message:
        action === 'ACKNOWLEDGE'
          ? `Confirm your intent to participate and submit a quotation for ${rfq.rfqNumber}?`
          : `Decline invitation for ${rfq.rfqNumber}? Reason: "${this.declineReasonControl.value.trim()}".`,
      confirmLabel: action === 'ACKNOWLEDGE' ? 'Acknowledge' : 'Decline Invitation',
      tone: action === 'ACKNOWLEDGE' ? 'success' : 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.respondInvitation(rfq.rfqId, action, this.declineReasonControl.value.trim()).subscribe({
      next: () => {
        this.successMessage.set(`Invitation ${action.toLowerCase()}d successfully.`);
        this.declineReasonControl.setValue('');
        this.busy.set(false);
        this.loadRfq(rfq.rfqId);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to record response.');
        this.busy.set(false);
      },
    });
  }
}
