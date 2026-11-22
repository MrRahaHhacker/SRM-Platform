import { ChangeDetectionStrategy, Component, PLATFORM_ID, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import type { SupplierDocument } from './supplier.models';
import { SupplierService } from './supplier.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-supplier-documents',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, MatIconModule],
  template: `
    <section class="mt-6 pt-5 border-t border-[#edf1f5]" aria-label="Supplier documents">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <span class="text-[10px] font-extrabold tracking-[0.13em] text-[#8795a5] uppercase">
            SUPPLIER COMPLIANCE
          </span>
          <h3 class="text-base font-bold text-[#18283d] m-0 mt-1">Documents & Certificates</h3>
          <p class="text-xs text-[#78889b] m-0 mt-0.5">
            Upload and verify statutory certificates. Each replacement is retained as a new version.
          </p>
        </div>
        <button
          type="button"
          (click)="loadDocuments()"
          [disabled]="loading()"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] hover:bg-[#f4f7fa] cursor-pointer disabled:opacity-55"
        >
          <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
          <span>{{ loading() ? 'Refreshing…' : 'Refresh' }}</span>
        </button>
      </div>

      @if (successMessage()) {
        <div class="mb-3 p-3 rounded-lg bg-[#edf8f1] text-[#267447] text-xs font-medium" role="status">
          {{ successMessage() }}
        </div>
      }
      @if (errorMessage()) {
        <div class="mb-3 p-3 rounded-lg bg-[#fff1f0] text-[#a13d36] text-xs font-medium" role="alert">
          {{ errorMessage() }}
        </div>
      }

      @if (canUpload()) {
        <form
          [formGroup]="uploadForm"
          (ngSubmit)="upload()"
          class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-4 rounded-xl bg-[#f9fbfc] border border-[#e6ebf1] mb-4"
        >
          <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
            Document type
            <select
              formControlName="documentType"
              class="h-10 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs text-[#24364b]"
            >
              @for (t of documentTypes; track t.value) {
                <option [value]="t.value">{{ t.label }}</option>
              }
            </select>
          </label>

          <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
            File <span class="font-normal text-[#8996a5]">(PDF, PNG, JPEG · max 10 MB)</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              (change)="selectFile($event)"
              class="h-10 px-2 py-1.5 border border-[#dfe6ed] rounded-lg bg-white text-xs text-[#24364b]"
            />
          </label>

          <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
            Expiry date <span class="font-normal text-[#8996a5]">(Optional)</span>
            <input
              type="date"
              formControlName="expiryDate"
              class="h-10 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs text-[#24364b]"
            />
          </label>

          <button
            type="submit"
            [disabled]="!selectedFile() || uploading()"
            class="h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#122e49] disabled:opacity-55 cursor-pointer"
          >
            <mat-icon class="!text-base !w-4 !h-4">upload_file</mat-icon>
            <span>{{ uploading() ? 'Uploading…' : 'Upload document' }}</span>
          </button>
        </form>
      }

      @if (selectedFile(); as file) {
        <p class="text-[11px] text-[#53657a] mb-3">
          Selected: <strong>{{ file.name }}</strong> ({{ file.size / 1024 / 1024 | number:'1.2-2' }} MB)
        </p>
      }

      @if (loading() && documents().length === 0) {
        <p class="text-xs text-[#6f8093] py-4">Loading supplier documents…</p>
      } @else if (documents().length === 0) {
        <div class="p-6 rounded-xl border border-dashed border-[#dce4ec] text-center text-xs text-[#6f8093]">
          No documents uploaded for this supplier yet.
        </div>
      } @else {
        <div class="overflow-x-auto border border-[#edf1f5] rounded-xl">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#8795a5]">
                <th class="py-2.5 px-3">Document</th>
                <th class="py-2.5 px-3">Version</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Expiry</th>
                <th class="py-2.5 px-3">Uploaded</th>
                <th class="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5] text-xs">
              @for (item of documents(); track item.documentId) {
                <tr>
                  <td class="py-3 px-3">
                    <div class="font-bold text-[#273b51]">{{ labelFor(item.documentType) }}</div>
                    <div class="text-[11px] text-[#78889b]">{{ item.originalFilename }}</div>
                    @if (item.reviewRemarks) {
                      <div class="text-[11px] text-[#52657a] mt-0.5">Review: {{ item.reviewRemarks }}</div>
                    }
                  </td>
                  <td class="py-3 px-3 font-semibold text-[#315c80]">v{{ item.versionNumber }}</td>
                  <td class="py-3 px-3">
                    <span
                      class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold"
                      [class]="
                        item.reviewStatus === 'VERIFIED'
                          ? 'bg-[#eaf8f0] text-[#16834e]'
                          : item.reviewStatus === 'REJECTED' || item.reviewStatus === 'EXPIRED'
                            ? 'bg-[#fff1f0] text-[#a13d36]'
                            : 'bg-[#fef7e6] text-[#9a6700]'
                      "
                    >
                      {{ item.reviewStatus }}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-[#52657a]">
                    {{ item.expiryDate || '—' }}
                    @if (item.isExpired || item.reviewStatus === 'EXPIRED') {
                      <span class="ml-1 text-[10px] font-bold text-[#a13d36]">(Expired)</span>
                    }
                  </td>
                  <td class="py-3 px-3 text-[#52657a]">{{ item.uploadedAt | date:'mediumDate' }}</td>
                  <td class="py-3 px-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        (click)="download(item)"
                        [disabled]="downloadingId() === item.documentId"
                        class="text-[11px] font-bold text-[#315c80] bg-transparent border-0 cursor-pointer hover:underline"
                      >
                        {{ downloadingId() === item.documentId ? 'Preparing…' : 'Download' }}
                      </button>
                      @if (item.reviewStatus === 'PENDING' && canReview()) {
                        <button
                          type="button"
                          (click)="review(item, 'VERIFY')"
                          [disabled]="reviewingId() === item.documentId"
                          class="text-[11px] font-bold text-[#267447] bg-transparent border-0 cursor-pointer hover:underline"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          (click)="review(item, 'REJECT')"
                          [disabled]="reviewingId() === item.documentId || !reviewRemarksControl.value.trim()"
                          class="text-[11px] font-bold text-[#a13d36] bg-transparent border-0 cursor-pointer hover:underline disabled:opacity-45"
                        >
                          Reject
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (hasPendingReviews() && canReview()) {
          <label class="grid gap-1 mt-3 max-w-lg text-[11px] font-bold text-[#53657a]">
            Reviewer remarks <span class="font-normal text-[#8996a5]">(Required to reject a document)</span>
            <textarea
              [formControl]="reviewRemarksControl"
              rows="2"
              maxlength="2000"
              placeholder="Add a reason before rejecting, or an optional note before verification"
              class="p-2.5 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
            ></textarea>
          </label>
        }
      }
    </section>
  `,
})
export class SupplierDocumentsComponent {
  readonly supplierId = input.required<string>();

  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly documentTypes = [
    { value: 'GST_CERTIFICATE', label: 'GST certificate' },
    { value: 'PAN_CARD', label: 'PAN card' },
    { value: 'ISO_CERTIFICATE', label: 'ISO certificate' },
    { value: 'BANK_PROOF', label: 'Bank proof' },
    { value: 'MSME_CERTIFICATE', label: 'MSME certificate' },
    { value: 'OTHER', label: 'Other' },
  ];

  protected readonly documents = signal<SupplierDocument[]>([]);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly downloadingId = signal('');
  protected readonly reviewingId = signal('');
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  protected readonly uploadForm = new FormGroup({
    documentType: new FormControl('GST_CERTIFICATE', { nonNullable: true, validators: [Validators.required] }),
    expiryDate: new FormControl('', { nonNullable: true }),
  });

  protected readonly reviewRemarksControl = new FormControl('', { nonNullable: true });

  private fileInputEl: HTMLInputElement | null = null;

  constructor() {
    effect(() => {
      const id = this.supplierId();
      if (id) {
        this.loadDocuments();
      }
    });
  }

  protected canUpload(): boolean {
    return this.auth.hasRole('SRM_ADMIN', 'SUPER_ADMIN', 'SUPPLIER_USER');
  }

  protected canReview(): boolean {
    return this.auth.hasRole('SUPPLIER_VERIFIER', 'SRM_ADMIN');
  }

  protected hasPendingReviews(): boolean {
    return this.documents().some((item) => item.reviewStatus === 'PENDING');
  }

  protected selectFile(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.fileInputEl = inputEl;
    this.selectedFile.set(inputEl.files?.[0] ?? null);
  }

  protected loadDocuments(): void {
    const id = this.supplierId();
    if (!id) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.supplierService.getDocuments(id).subscribe({
      next: (res) => {
        this.documents.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load supplier documents.');
        this.loading.set(false);
      },
    });
  }

  protected async upload(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.uploading()) return;

    const { documentType, expiryDate } = this.uploadForm.getRawValue();
    const ok = await this.confirmDialog.confirm({
      title: 'Upload Compliance Document?',
      message: `Upload "${file.name}" as ${this.labelFor(documentType)} for verification?`,
      confirmLabel: 'Upload',
      tone: 'primary',
      icon: 'upload_file',
    });
    if (!ok) return;

    this.uploading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.supplierService.uploadDocument(this.supplierId(), documentType, file, expiryDate).subscribe({
      next: (res) => {
        this.successMessage.set(res.message || 'Document uploaded for verification.');
        this.selectedFile.set(null);
        this.uploadForm.patchValue({ expiryDate: '' });
        if (this.fileInputEl) {
          this.fileInputEl.value = '';
        }
        this.uploading.set(false);
        this.loadDocuments();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Document upload failed.');
        this.uploading.set(false);
      },
    });
  }

  protected download(fileRecord: SupplierDocument): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.downloadingId.set(fileRecord.documentId);
    this.errorMessage.set('');
    this.supplierService.downloadDocument(this.supplierId(), fileRecord.documentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = globalThis.document.createElement('a');
        link.href = url;
        link.download = fileRecord.originalFilename;
        link.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set('');
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to download this document.');
        this.downloadingId.set('');
      },
    });
  }

  protected async review(fileRecord: SupplierDocument, decision: 'VERIFY' | 'REJECT'): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: decision === 'VERIFY' ? 'Verify Document?' : 'Reject Document?',
      message: `Mark "${fileRecord.originalFilename}" (${this.labelFor(fileRecord.documentType)}) as ${decision === 'VERIFY' ? 'VERIFIED' : 'REJECTED'}?`,
      confirmLabel: decision === 'VERIFY' ? 'Verify' : 'Reject',
      tone: decision === 'VERIFY' ? 'success' : 'danger',
    });
    if (!ok) return;

    this.reviewingId.set(fileRecord.documentId);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.supplierService
      .reviewDocument(this.supplierId(), fileRecord.documentId, decision, this.reviewRemarksControl.value.trim())
      .subscribe({
        next: (res) => {
          this.successMessage.set(res.message || 'Document review recorded.');
          this.reviewRemarksControl.setValue('');
          this.reviewingId.set('');
          this.loadDocuments();
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Unable to save document review.');
          this.reviewingId.set('');
        },
      });
  }

  protected labelFor(type: string): string {
    return this.documentTypes.find((item) => item.value === type)?.label ?? type;
  }
}
