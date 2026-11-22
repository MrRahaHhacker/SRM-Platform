import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { SrmService } from '../../core/services/srm.service';
import type { Rfq } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rfq-form',
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-[11px] font-bold text-[#64748b] mb-1">
          <a routerLink="/rfqs" class="text-[#315c80] no-underline hover:underline">RFQ Management</a>
          <span>/</span>
          @if (editingRfq(); as rfq) {
            <a [routerLink]="['/rfqs', rfq.rfqId]" class="text-[#315c80] no-underline hover:underline">{{ rfq.rfqNumber }}</a>
            <span>/</span>
            <span>Edit Draft</span>
          } @else {
            <span>Create Draft RFQ</span>
          }
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          {{ isEditMode() ? 'Edit Draft Request for Quotation' : 'New Request for Quotation (RFQ)' }}
        </h1>
        <p class="text-sm text-[#64748b] m-0 mt-1">
          Reference existing SAP Material Codes (SRM does not create Material Master records).
        </p>
      </div>
      <a
        [routerLink]="isEditMode() && editRfqId() ? ['/rfqs', editRfqId()!] : ['/rfqs']"
        class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f4f7fa]"
      >
        <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
        <span>{{ isEditMode() ? 'Back to RFQ' : 'Back to RFQs' }}</span>
      </a>
    </div>

    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    @if (loading()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center text-xs text-[#64748b]">
        Loading draft RFQ…
      </section>
    } @else {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <form [formGroup]="rfqForm" (ngSubmit)="saveRfq()" class="grid gap-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <label class="sm:col-span-2 grid gap-1 text-[11px] font-bold text-[#334155]">
              RFQ Title <span class="text-[#c04b4b]">*</span>
              <input
                formControlName="title"
                placeholder="e.g. Precision Machined Brackets — Q2 Requirement"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]"
              />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Currency
              <select formControlName="currencyCode" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Submission Deadline <span class="text-[#c04b4b]">*</span>
              <input
                type="datetime-local"
                formControlName="submissionDeadline"
                class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]"
              />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Plant Code
              <input formControlName="plantCode" placeholder="PLT-1100" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs uppercase" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Purchasing Group
              <input formControlName="purchasingGroup" placeholder="PG-CNC" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs uppercase" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Payment Terms
              <input formControlName="paymentTerms" placeholder="Net 45 days" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Incoterms
              <input formControlName="incoterms" placeholder="DAP Pune Plant" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Project Code
              <input formControlName="projectCode" placeholder="PRJ-EV26" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs" />
            </label>
            <label class="sm:col-span-2 lg:col-span-3 grid gap-1 text-[11px] font-bold text-[#334155]">
              Technical & Commercial Scope Notes
              <textarea formControlName="description" rows="2" class="p-2.5 border border-[#cbd5e1] rounded-lg text-xs"></textarea>
            </label>
          </div>

          <div class="pt-4 border-t border-[#edf1f5]">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xs font-bold text-[#142238] uppercase tracking-wider m-0">
                RFQ Lines (SAP Material Code References)
              </h2>
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
                <div [formGroupName]="$index" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-lg bg-[#f8fafc] border border-[#e3eaf1] items-end">
                  <label class="sm:col-span-3 grid gap-1 text-[10px] font-bold text-[#334155]">
                    SAP Material Code *
                    <input formControlName="sapMaterialCode" placeholder="MAT-CNC-8801" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs uppercase" />
                  </label>
                  <label class="sm:col-span-4 grid gap-1 text-[10px] font-bold text-[#334155]">
                    Material Description *
                    <input formControlName="materialDescription" placeholder="Part specification" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
                  </label>
                  <label class="sm:col-span-2 grid gap-1 text-[10px] font-bold text-[#334155]">
                    Qty *
                    <input type="number" formControlName="quantity" min="1" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
                  </label>
                  <label class="sm:col-span-1 grid gap-1 text-[10px] font-bold text-[#334155]">
                    UOM
                    <input formControlName="uom" placeholder="NOS" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs uppercase" />
                  </label>
                  <label class="sm:col-span-1 grid gap-1 text-[10px] font-bold text-[#334155]">
                    Target
                    <input type="number" formControlName="targetPrice" min="0" class="h-9 px-2 border border-[#cbd5e1] rounded-lg bg-white text-xs" />
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

          <div class="flex justify-end gap-2.5 pt-4 border-t border-[#edf1f5]">
            <a
              [routerLink]="isEditMode() && editRfqId() ? ['/rfqs', editRfqId()!] : ['/rfqs']"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline inline-flex items-center"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="rfqForm.invalid || busy()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
            >
              <mat-icon class="!text-base !w-4 !h-4">save</mat-icon>
              <span>{{ busy() ? 'Saving…' : (isEditMode() ? 'Save Draft Updates' : 'Create Draft RFQ') }}</span>
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class RfqFormComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isEditMode = signal(false);
  protected readonly editRfqId = signal<string | null>(null);
  protected readonly editingRfq = signal<Rfq | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal('');

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

  get linesArray(): FormArray {
    return this.rfqForm.controls.lines;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('rfqId');
    if (id) {
      this.isEditMode.set(true);
      this.editRfqId.set(id);
      this.loadDraftRfq(id);
    }
  }

  private loadDraftRfq(rfqId: string): void {
    this.loading.set(true);
    this.srm.getRfq(rfqId).subscribe({
      next: (res) => {
        const rfq = res.data;
        if (rfq.status !== 'DRAFT') {
          this.errorMessage.set(`${rfq.rfqNumber} is already ${rfq.status} and draft lines cannot be modified.`);
          this.loading.set(false);
          return;
        }
        this.editingRfq.set(rfq);
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
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load RFQ draft.');
        this.loading.set(false);
      },
    });
  }

  protected addLine(): void {
    this.linesArray.push(this.buildLineGroup());
  }

  protected async removeLine(index: number): Promise<void> {
    if (this.linesArray.length <= 1) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Remove RFQ Line?',
      message: `Remove line #${index + 1} from this RFQ?`,
      confirmLabel: 'Remove Line',
      tone: 'danger',
      icon: 'delete',
    });
    if (ok) {
      this.linesArray.removeAt(index);
    }
  }

  protected async saveRfq(): Promise<void> {
    if (this.rfqForm.invalid || this.busy()) return;
    const raw = this.rfqForm.getRawValue();
    const editId = this.editRfqId();

    const ok = await this.confirmDialog.confirm({
      title: editId ? 'Save Draft RFQ Updates?' : 'Create New Draft RFQ?',
      message: editId
        ? `Save changes to draft RFQ "${raw.title}" with ${raw.lines.length} line item(s)?`
        : `Create new draft RFQ "${raw.title}" with ${raw.lines.length} material line(s)?`,
      confirmLabel: editId ? 'Save Updates' : 'Create Draft RFQ',
      tone: 'primary',
      icon: 'save',
    });
    if (!ok) return;

    this.busy.set(true);
    this.errorMessage.set('');

    if (editId) {
      this.srm.updateRfqDraft(editId, raw).subscribe({
        next: (res) => {
          this.busy.set(false);
          void this.router.navigate(['/rfqs', res.data.rfqId], {
            queryParams: { notice: res.message },
          });
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
        this.busy.set(false);
        void this.router.navigate(['/rfqs', res.data.rfqId], {
          queryParams: { notice: res.message },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to create RFQ.');
        this.busy.set(false);
      },
    });
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
