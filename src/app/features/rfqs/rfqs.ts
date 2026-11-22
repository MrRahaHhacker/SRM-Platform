import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { Rfq } from '../../core/services/srm.models';
import { SupplierService } from '../suppliers/supplier.service';
import type { Supplier } from '../suppliers/supplier.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rfqs',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#8795a5] uppercase">
          SRM WORKSPACE / SOURCING
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#17263b] tracking-tight mt-1 mb-1">
          RFQ management & invitations
        </h1>
        <p class="text-sm text-[#78889b] m-0">
          Create sourcing events using SAP Material Code references, invite qualified suppliers, and track participation.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          (click)="loadData()"
          [disabled]="loading()"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer disabled:opacity-55"
        >
          <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
          <span>Refresh</span>
        </button>
        @if (canCreateRfq()) {
          <button
            type="button"
            (click)="toggleCreateForm()"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer"
          >
            <mat-icon class="!text-base !w-4 !h-4">{{ showCreateForm() ? 'close' : 'post_add' }}</mat-icon>
            <span>{{ showCreateForm() ? 'Close form' : 'Create RFQ' }}</span>
          </button>
        }
      </div>
    </div>

    @if (successMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#edf8f1] border border-[#b9e3d0] text-[#267447] text-xs font-medium" role="status">
        {{ successMessage() }}
      </div>
    }
    @if (duplicateWarnings().length > 0) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fef7e6] border border-[#f5d0a9] text-[#9a6700] text-xs font-medium" role="status">
        <div class="font-bold mb-1">Duplicate Active Material Notice (Non-blocking):</div>
        @for (w of duplicateWarnings(); track w) {
          <div>• {{ w }}</div>
        }
      </div>
    }
    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    <!-- Create / Edit Draft RFQ Form -->
    @if (showCreateForm() && canCreateRfq()) {
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-bold text-[#18283d] m-0">
              {{ editingDraftId() ? 'Edit Draft Request for Quotation' : 'New Request for Quotation (RFQ)' }}
            </h2>
            <p class="text-xs text-[#78889b] m-0 mt-0.5">
              Reference existing SAP Material Codes (SRM does not create Material Master records).
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">Status: DRAFT</span>
        </div>

        <form [formGroup]="rfqForm" (ngSubmit)="createRfq()" class="grid gap-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <label class="sm:col-span-2 grid gap-1 text-[11px] font-bold text-[#53657a]">
              RFQ Title <span class="text-[#c04b4b]">*</span>
              <input
                formControlName="title"
                placeholder="e.g. Precision Machined Brackets — Q2 Requirement"
                class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
              />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Currency
              <select formControlName="currencyCode" class="h-10 px-3 border border-[#dfe6ed] rounded-lg bg-white text-xs text-[#24364b]">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Submission Deadline <span class="text-[#c04b4b]">*</span>
              <input
                type="datetime-local"
                formControlName="submissionDeadline"
                class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
              />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Plant Code
              <input formControlName="plantCode" placeholder="PLT-1100" class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs uppercase" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Purchasing Group
              <input formControlName="purchasingGroup" placeholder="PG-CNC" class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs uppercase" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Payment Terms
              <input formControlName="paymentTerms" placeholder="Net 45 days" class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Incoterms
              <input formControlName="incoterms" placeholder="DAP Pune Plant" class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Project Code
              <input formControlName="projectCode" placeholder="PRJ-EV26" class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs" />
            </label>
            <label class="sm:col-span-2 lg:col-span-3 grid gap-1 text-[11px] font-bold text-[#53657a]">
              Technical & Commercial Scope Notes
              <textarea formControlName="description" rows="2" class="p-2.5 border border-[#dfe6ed] rounded-lg text-xs"></textarea>
            </label>
          </div>

          <!-- RFQ Lines -->
          <div class="pt-4 border-t border-[#edf1f5]">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-bold text-[#18283d] m-0">RFQ Lines (SAP Material Code References)</h3>
              <button
                type="button"
                (click)="addLine()"
                class="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#dce4ec] bg-white text-[11px] font-bold text-[#315c80] cursor-pointer"
              >
                <mat-icon class="!text-sm !w-3.5 !h-3.5">add</mat-icon>
                <span>Add line</span>
              </button>
            </div>
            <div formArrayName="lines" class="grid gap-2.5">
              @for (line of linesArray.controls; track $index) {
                <div [formGroupName]="$index" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-lg bg-[#f9fbfc] border border-[#e6ebf1] items-end">
                  <label class="sm:col-span-3 grid gap-1 text-[10px] font-bold text-[#53657a]">
                    SAP Material Code *
                    <input formControlName="sapMaterialCode" placeholder="MAT-CNC-8801" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs uppercase" />
                  </label>
                  <label class="sm:col-span-4 grid gap-1 text-[10px] font-bold text-[#53657a]">
                    Material Description *
                    <input formControlName="materialDescription" placeholder="Part specification" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                  </label>
                  <label class="sm:col-span-2 grid gap-1 text-[10px] font-bold text-[#53657a]">
                    Qty *
                    <input type="number" formControlName="quantity" min="1" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                  </label>
                  <label class="sm:col-span-1 grid gap-1 text-[10px] font-bold text-[#53657a]">
                    UOM
                    <input formControlName="uom" placeholder="NOS" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs uppercase" />
                  </label>
                  <label class="sm:col-span-1 grid gap-1 text-[10px] font-bold text-[#53657a]">
                    Target
                    <input type="number" formControlName="targetPrice" min="0" class="h-9 px-2 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
                  </label>
                  <div class="sm:col-span-1 flex justify-end">
                    @if (linesArray.length > 1) {
                      <button
                        type="button"
                        (click)="removeLine($index)"
                        class="h-9 w-9 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] grid place-items-center cursor-pointer"
                        aria-label="Remove line"
                      >
                        <mat-icon class="!text-base !w-4 !h-4">delete</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-[#edf1f5]">
            <button
              type="button"
              (click)="toggleCreateForm()"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="rfqForm.invalid || busy()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">save</mat-icon>
              <span>{{ busy() ? 'Saving…' : (editingDraftId() ? 'Save Draft Updates' : 'Create Draft RFQ') }}</span>
            </button>
          </div>
        </form>
      </section>
    }

    <!-- Selected RFQ Workspace -->
    @if (selectedRfq(); as rfq) {
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-md bg-[#edf3f8] text-[#183b5d] text-[11px] font-extrabold">
                {{ rfq.rfqNumber }}
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#edf4fa] text-[#315b7e]">
                {{ rfq.status }}
              </span>
              <span class="text-[11px] text-[#6f8093]">
                Deadline: <strong>{{ rfq.submissionDeadline | date:'medium' }}</strong>
              </span>
            </div>
            <h2 class="text-xl font-bold text-[#18283d] m-0 mt-2">{{ rfq.title }}</h2>
            @if (rfq.description) {
              <p class="text-xs text-[#6f8093] m-0 mt-1">{{ rfq.description }}</p>
            }
          </div>
          <div class="flex flex-wrap gap-2">
            @if (rfq.status === 'DRAFT' && canCreateRfq()) {
              <button
                type="button"
                (click)="startEditDraft(rfq)"
                [disabled]="busy()"
                class="h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-[#315c80] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <mat-icon class="!text-base !w-4 !h-4">edit</mat-icon>
                <span>Edit Draft</span>
              </button>
              <button
                type="button"
                (click)="publishRfq(rfq.rfqId)"
                [disabled]="busy()"
                class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <mat-icon class="!text-base !w-4 !h-4">publish</mat-icon>
                <span>Publish RFQ</span>
              </button>
            }
            <a
              [routerLink]="['/quotations']"
              [queryParams]="{ rfqId: rfq.rfqId }"
              class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 no-underline"
            >
              <mat-icon class="!text-base !w-4 !h-4">request_quote</mat-icon>
              <span>{{ isSupplierOnly() ? 'Submit / View Quotation' : 'Compare Quotations' }}</span>
            </a>
            <button
              type="button"
              (click)="selectedRfq.set(null)"
              class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <!-- RFQ Metadata -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-xs">
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] font-bold uppercase">Currency / Plant</span>
            <strong class="text-[#273b51]">{{ rfq.currencyCode }} · {{ rfq.plantCode || 'Standard' }}</strong>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] font-bold uppercase">Payment Terms</span>
            <strong class="text-[#273b51]">{{ rfq.paymentTerms || '—' }}</strong>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] font-bold uppercase">Incoterms</span>
            <strong class="text-[#273b51]">{{ rfq.incoterms || '—' }}</strong>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] font-bold uppercase">Buyer</span>
            <strong class="text-[#273b51]">{{ rfq.buyerName }}</strong>
          </div>
        </div>

        <!-- Line Items -->
        <h3 class="text-xs font-bold text-[#18283d] uppercase tracking-wider mb-2">SAP Material Code Lines</h3>
        <div class="overflow-x-auto border border-[#edf1f5] rounded-xl mb-5">
          <table class="w-full border-collapse text-left text-xs">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#8795a5]">
                <th class="py-2.5 px-3">#</th>
                <th class="py-2.5 px-3">SAP Material Code</th>
                <th class="py-2.5 px-3">Description</th>
                <th class="py-2.5 px-3">Quantity</th>
                <th class="py-2.5 px-3">Target Unit Price</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5]">
              @for (line of rfq.lines; track line.rfqLineId) {
                <tr>
                  <td class="py-2.5 px-3 text-[#6f8093]">{{ line.lineNumber }}</td>
                  <td class="py-2.5 px-3 font-bold text-[#315c80]">{{ line.sapMaterialCode }}</td>
                  <td class="py-2.5 px-3 text-[#273b51]">{{ line.materialDescription }}</td>
                  <td class="py-2.5 px-3 font-semibold">{{ line.quantity | number }} {{ line.uom }}</td>
                  <td class="py-2.5 px-3">{{ line.targetPrice !== null ? (rfq.currencyCode + ' ' + (line.targetPrice | number:'1.2-2')) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Supplier Invitation Response (SUPPLIER_USER) -->
        @if (isSupplierOnly() && rfq.invitations.length > 0) {
          @let myInv = rfq.invitations[0];
          <div class="p-4 rounded-xl bg-[#f9fbfc] border border-[#e6ebf1]">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-[#18283d]">
                  Your Invitation Status: <span class="text-[#315c80]">{{ myInv.invitationStatus }}</span>
                </div>
                @if (myInv.declineReason) {
                  <div class="text-xs text-[#a13d36] mt-0.5">Decline reason: {{ myInv.declineReason }}</div>
                }
              </div>
              @if (myInv.invitationStatus === 'INVITED' && !['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    (click)="respondInvitation(rfq.rfqId, 'ACKNOWLEDGE')"
                    [disabled]="busy()"
                    class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold cursor-pointer"
                  >
                    Acknowledge Participation
                  </button>
                  <input
                    [formControl]="declineReasonControl"
                    placeholder="Reason if declining…"
                    class="h-9 px-3 border border-[#dfe6ed] rounded-lg bg-white text-xs w-56"
                  />
                  <button
                    type="button"
                    (click)="respondInvitation(rfq.rfqId, 'DECLINE')"
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

        <!-- Buyer Invitations & Deadline Controls -->
        @if (canCreateRfq()) {
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="p-4 rounded-xl border border-[#e6ebf1] bg-[#f9fbfc]">
              <h3 class="text-xs font-bold text-[#18283d] uppercase tracking-wider m-0 mb-2">
                Invited Suppliers ({{ rfq.invitations.length }})
              </h3>
              <div class="grid gap-1.5 mb-3">
                @for (inv of rfq.invitations; track inv.invitationId) {
                  <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-[#edf1f5]">
                    <div>
                      <span class="font-bold text-[#273b51]">{{ inv.supplierName }}</span>
                      <span class="text-[#8795a5] ml-1.5">{{ inv.supplierNumber }}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
                      {{ inv.invitationStatus }}
                    </span>
                  </div>
                }
              </div>

              @if (eligibleUninvitedSuppliers(rfq).length > 0 && !['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
                <div class="flex items-center gap-2 pt-2 border-t border-[#e6ebf1]">
                  <select
                    [formControl]="inviteSupplierControl"
                    class="flex-1 h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs"
                  >
                    <option value="">Select qualified supplier to invite…</option>
                    @for (sup of eligibleUninvitedSuppliers(rfq); track sup.supplierId) {
                      <option [value]="sup.supplierId">
                        {{ sup.supplierNumber }} — {{ sup.legalName }} ({{ sup.lifecycleStatus }})
                      </option>
                    }
                  </select>
                  <button
                    type="button"
                    (click)="inviteSupplier(rfq.rfqId)"
                    [disabled]="!inviteSupplierControl.value || busy()"
                    class="h-9 px-3.5 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Invite
                  </button>
                </div>
              }
            </div>

            <div class="p-4 rounded-xl border border-[#e6ebf1] bg-[#f9fbfc]">
              <h3 class="text-xs font-bold text-[#18283d] uppercase tracking-wider m-0 mb-2">
                Deadline & Lifecycle Controls
              </h3>
              @if (!['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
                <form [formGroup]="deadlineForm" (ngSubmit)="extendDeadline(rfq.rfqId)" class="grid gap-2 mb-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="datetime-local"
                      formControlName="submissionDeadline"
                      class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs"
                    />
                    <input
                      formControlName="reason"
                      placeholder="Extension reason"
                      class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    [disabled]="deadlineForm.invalid || busy()"
                    class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#315c80] cursor-pointer justify-self-start disabled:opacity-50"
                  >
                    Extend Submission Deadline
                  </button>
                </form>

                <div class="flex items-center gap-2 pt-2 border-t border-[#e6ebf1]">
                  <input
                    [formControl]="closeReasonControl"
                    placeholder="Reason to close or cancel RFQ"
                    class="flex-1 h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs"
                  />
                  <button
                    type="button"
                    (click)="closeRfq(rfq.rfqId, 'CLOSED')"
                    [disabled]="!closeReasonControl.value.trim() || busy()"
                    class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    (click)="closeRfq(rfq.rfqId, 'CANCELLED')"
                    [disabled]="!closeReasonControl.value.trim() || busy()"
                    class="h-9 px-3 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              } @else {
                <p class="text-xs text-[#6f8093] m-0">This RFQ is finalized ({{ rfq.status }}) and no longer accepts deadline edits.</p>
              }
            </div>
          </div>
        }
      </section>
    }

    <!-- RFQs Directory Table -->
    <section class="bg-white border border-[#e6ebf1] rounded-xl p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-bold text-[#18283d] m-0">
            {{ isSupplierOnly() ? 'Invited RFQs' : 'All Sourcing RFQs' }}
          </h2>
          <p class="text-xs text-[#78889b] m-0 mt-0.5">Select an RFQ to inspect material lines, invitations, and commercial quotations.</p>
        </div>
        <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">{{ rfqs().length }} RFQs</span>
      </div>

      @if (loading()) {
        <p class="text-xs text-[#6f8093] py-6 text-center">Loading RFQs…</p>
      } @else if (rfqs().length === 0) {
        <div class="py-10 text-center text-xs text-[#6f8093]">No RFQs available for your account.</div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-xs">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#8795a5]">
                <th class="py-2.5 px-3">RFQ Number</th>
                <th class="py-2.5 px-3">Title</th>
                <th class="py-2.5 px-3">Lines</th>
                <th class="py-2.5 px-3">Invited</th>
                <th class="py-2.5 px-3">Deadline</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5]">
              @for (rfq of rfqs(); track rfq.rfqId) {
                <tr class="hover:bg-[#f9fbfc]">
                  <td class="py-3.5 px-3 font-extrabold text-[#315c80]">{{ rfq.rfqNumber }}</td>
                  <td class="py-3.5 px-3">
                    <div class="font-bold text-[#273b51]">{{ rfq.title }}</div>
                    <div class="text-[11px] text-[#8b98a7]">{{ rfq.plantCode || 'Standard' }} · {{ rfq.currencyCode }}</div>
                  </td>
                  <td class="py-3.5 px-3">{{ rfq.lines.length }}</td>
                  <td class="py-3.5 px-3">{{ rfq.invitations.length }}</td>
                  <td class="py-3.5 px-3 text-[#52657a]">{{ rfq.submissionDeadline | date:'mediumDate' }}</td>
                  <td class="py-3.5 px-3">
                    <span class="px-2.5 py-0.5 rounded-full bg-[#edf4fa] text-[#315b7e] text-[10px] font-extrabold">
                      {{ rfq.status }}
                    </span>
                  </td>
                  <td class="py-3.5 px-3">
                    <button
                      type="button"
                      (click)="selectedRfq.set(rfq)"
                      class="text-xs font-extrabold text-[#315c80] bg-transparent border-0 cursor-pointer hover:underline"
                    >
                      Open
                    </button>
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
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);

  protected readonly rfqs = signal<Rfq[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly selectedRfq = signal<Rfq | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly showCreateForm = signal(false);
  protected readonly editingDraftId = signal<string | null>(null);
  protected readonly duplicateWarnings = signal<string[]>([]);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly inviteSupplierControl = new FormControl('', { nonNullable: true });
  protected readonly declineReasonControl = new FormControl('', { nonNullable: true });
  protected readonly closeReasonControl = new FormControl('', { nonNullable: true });

  protected readonly deadlineForm = new FormGroup({
    submissionDeadline: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly rfqForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    currencyCode: new FormControl('INR', { nonNullable: true, validators: [Validators.required] }),
    submissionDeadline: new FormControl(this.defaultFutureDatetime(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    plantCode: new FormControl('PLT-1100', { nonNullable: true }),
    purchasingGroup: new FormControl('PG-CNC', { nonNullable: true }),
    paymentTerms: new FormControl('Net 45 days', { nonNullable: true }),
    incoterms: new FormControl('DAP Pune Plant', { nonNullable: true }),
    projectCode: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    lines: new FormArray([this.buildLineGroup()]),
  });

  protected readonly qualifiedSuppliers = computed(() =>
    this.suppliers().filter((s) => ['APPROVED', 'ACTIVE'].includes(s.lifecycleStatus)),
  );

  get linesArray(): FormArray {
    return this.rfqForm.controls.lines;
  }

  ngOnInit(): void {
    this.loadData();
  }

  protected toggleCreateForm(): void {
    if (this.showCreateForm()) {
      this.showCreateForm.set(false);
      this.editingDraftId.set(null);
    } else {
      this.editingDraftId.set(null);
      this.resetRfqForm();
      this.showCreateForm.set(true);
    }
  }

  protected startEditDraft(rfq: Rfq): void {
    this.editingDraftId.set(rfq.rfqId);
    this.linesArray.clear();
    for (const line of rfq.lines) {
      this.linesArray.push(
        new FormGroup({
          sapMaterialCode: new FormControl(line.sapMaterialCode, { nonNullable: true, validators: [Validators.required] }),
          materialDescription: new FormControl(line.materialDescription, { nonNullable: true, validators: [Validators.required] }),
          quantity: new FormControl(line.quantity, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
          uom: new FormControl(line.uom, { nonNullable: true, validators: [Validators.required] }),
          targetPrice: new FormControl<number | null>(line.targetPrice),
        }),
      );
    }
    this.rfqForm.patchValue({
      title: rfq.title,
      currencyCode: rfq.currencyCode,
      submissionDeadline: rfq.submissionDeadline.slice(0, 16),
      plantCode: rfq.plantCode ?? '',
      purchasingGroup: rfq.purchasingGroup ?? '',
      paymentTerms: rfq.paymentTerms ?? '',
      incoterms: rfq.incoterms ?? '',
      projectCode: rfq.projectCode ?? '',
      description: rfq.description ?? '',
    });
    this.showCreateForm.set(true);
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

  protected addLine(): void {
    this.linesArray.push(this.buildLineGroup());
  }

  protected removeLine(index: number): void {
    if (this.linesArray.length > 1) {
      this.linesArray.removeAt(index);
    }
  }

  protected loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.srm.getRfqs().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        this.rfqs.set(list);
        const currentSelected = this.selectedRfq();
        if (currentSelected) {
          this.selectedRfq.set(list.find((r) => r.rfqId === currentSelected.rfqId) ?? null);
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQs.');
        this.loading.set(false);
      },
    });

    if (this.canCreateRfq()) {
      this.supplierService.getSuppliers().subscribe({
        next: (res) => this.suppliers.set(res.data ?? []),
        error: () => undefined,
      });
    }
  }

  protected createRfq(): void {
    if (this.rfqForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.duplicateWarnings.set([]);
    const raw = this.rfqForm.getRawValue();
    const editId = this.editingDraftId();

    if (editId) {
      this.srm.updateRfqDraft(editId, raw).subscribe({
        next: (res) => {
          this.successMessage.set(res.message);
          this.updateRfqInList(res.data);
          this.editingDraftId.set(null);
          this.showCreateForm.set(false);
          this.busy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Failed to update draft RFQ.');
          this.busy.set(false);
        },
      });
      return;
    }

    this.srm.createRfq(raw).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.duplicateWarnings.set(res.data.duplicateWarnings ?? []);
        this.rfqs.update((list) => [res.data, ...list]);
        this.selectedRfq.set(res.data);
        this.showCreateForm.set(false);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to create RFQ.');
        this.busy.set(false);
      },
    });
  }

  private resetRfqForm(): void {
    this.linesArray.clear();
    this.linesArray.push(this.buildLineGroup());
    this.rfqForm.reset({
      title: '',
      currencyCode: 'INR',
      submissionDeadline: this.defaultFutureDatetime(),
      plantCode: 'PLT-1100',
      purchasingGroup: 'PG-CNC',
      paymentTerms: 'Net 45 days',
      incoterms: 'DAP Pune Plant',
      projectCode: '',
      description: '',
    });
  }

  protected inviteSupplier(rfqId: string): void {
    const sid = this.inviteSupplierControl.value;
    if (!sid || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.inviteSuppliers(rfqId, [sid]).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.inviteSupplierControl.setValue('');
        this.updateRfqInList(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to invite supplier.');
        this.busy.set(false);
      },
    });
  }

  protected publishRfq(rfqId: string): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.publishRfq(rfqId).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.updateRfqInList(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to publish RFQ.');
        this.busy.set(false);
      },
    });
  }

  protected extendDeadline(rfqId: string): void {
    if (this.deadlineForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    const { submissionDeadline, reason } = this.deadlineForm.getRawValue();
    this.srm.extendRfqDeadline(rfqId, submissionDeadline, reason).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.deadlineForm.reset({ submissionDeadline: '', reason: '' });
        this.updateRfqInList(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to extend deadline.');
        this.busy.set(false);
      },
    });
  }

  protected closeRfq(rfqId: string, status: 'CLOSED' | 'CANCELLED'): void {
    const reason = this.closeReasonControl.value.trim();
    if (!reason || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.closeRfq(rfqId, status, reason).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.closeReasonControl.setValue('');
        this.updateRfqInList(res.data);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update RFQ status.');
        this.busy.set(false);
      },
    });
  }

  protected respondInvitation(rfqId: string, action: 'ACKNOWLEDGE' | 'DECLINE'): void {
    this.busy.set(true);
    this.errorMessage.set('');
    this.srm.respondInvitation(rfqId, action, this.declineReasonControl.value.trim()).subscribe({
      next: () => {
        this.successMessage.set(`Invitation ${action.toLowerCase()}d successfully.`);
        this.declineReasonControl.setValue('');
        this.loadData();
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to record response.');
        this.busy.set(false);
      },
    });
  }

  private updateRfqInList(updated: Rfq): void {
    this.rfqs.update((list) => list.map((r) => (r.rfqId === updated.rfqId ? updated : r)));
    this.selectedRfq.set(updated);
  }

  private buildLineGroup(): FormGroup {
    return new FormGroup({
      sapMaterialCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      materialDescription: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      quantity: new FormControl(100, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
      uom: new FormControl('NOS', { nonNullable: true, validators: [Validators.required] }),
      targetPrice: new FormControl<number | null>(null),
    });
  }

  private defaultFutureDatetime(): string {
    const d = new Date(Date.now() + 7 * 86400_000);
    return d.toISOString().slice(0, 16);
  }
}
