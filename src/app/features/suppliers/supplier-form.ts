import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import type { Supplier } from './supplier.models';
import { SupplierService } from './supplier.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-supplier-form',
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-[11px] font-bold text-[#64748b] mb-1">
          <a routerLink="/suppliers" class="text-[#315c80] no-underline hover:underline">Suppliers</a>
          <span>/</span>
          @if (editSupplier(); as sup) {
            <a [routerLink]="['/suppliers', sup.supplierId]" class="text-[#315c80] no-underline hover:underline">{{ sup.supplierNumber }}</a>
            <span>/</span>
            <span>Edit Profile</span>
          } @else {
            <span>Register New Supplier</span>
          }
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight m-0">
          {{ isEditMode() ? 'Edit Supplier Profile' : 'Register New Supplier' }}
        </h1>
        <p class="text-sm text-[#64748b] m-0 mt-1">
          {{
            isEditMode()
              ? 'Update organization trade details, statutory IDs, and primary contact information.'
              : 'Enter legal entity, tax IDs, primary contact, and registered address to create a new supplier in DRAFT status.'
          }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <a
          [routerLink]="isEditMode() && editSupplierId() ? ['/suppliers', editSupplierId()!] : ['/suppliers']"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline hover:bg-[#f4f7fa]"
        >
          <mat-icon class="!text-base !w-4 !h-4">arrow_back</mat-icon>
          <span>{{ isEditMode() ? 'Back to Profile' : 'Back to Suppliers' }}</span>
        </a>
      </div>
    </div>

    @if (errorMessage()) {
      <div class="mb-4 p-3.5 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
        {{ errorMessage() }}
      </div>
    }

    @if (loading()) {
      <div class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center text-xs text-[#64748b]">
        Loading supplier details…
      </div>
    } @else if (isEditMode() && editSupplier()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="grid gap-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Trade name
              <input formControlName="tradeName" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Supplier Category
              <select formControlName="supplierCategory" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]">
                <option value="">Select category…</option>
                <option value="Precision Machining & CNC">Precision Machining & CNC</option>
                <option value="Automotive & Sheet Metal">Automotive & Sheet Metal</option>
                <option value="Industrial Fasteners & Hardware">Industrial Fasteners & Hardware</option>
                <option value="Valves, Hydraulics & Casting">Valves, Hydraulics & Casting</option>
                <option value="Electrical & Automation">Electrical & Automation</option>
                <option value="Packaging & Consumables">Packaging & Consumables</option>
              </select>
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              MSME / Udyam Number
              <input formControlName="msmeNumber" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs uppercase text-[#0f172a]" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Primary Contact Person <span class="text-[#c04b4b]">*</span>
              <input formControlName="contactName" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Email Address <span class="text-[#c04b4b]">*</span>
              <input formControlName="email" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              Phone Number
              <input formControlName="phone" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              GSTIN
              <input formControlName="gstin" maxlength="15" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs uppercase text-[#0f172a]" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
              PAN
              <input formControlName="pan" maxlength="10" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs uppercase text-[#0f172a]" />
            </label>
          </div>

          <div class="flex justify-end gap-2.5 pt-4 border-t border-[#edf1f5]">
            <a
              [routerLink]="['/suppliers', editSupplierId()!]"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline inline-flex items-center"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="editForm.invalid || saving()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#122e49] disabled:opacity-55 cursor-pointer"
            >
              <mat-icon class="!text-base !w-4 !h-4">save</mat-icon>
              <span>{{ saving() ? 'Saving…' : 'Save Profile Updates' }}</span>
            </button>
          </div>
        </form>
      </section>
    } @else if (!isEditMode()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <form [formGroup]="registrationForm" (ngSubmit)="submitRegistration()" class="grid gap-5">
          <div>
            <h2 class="text-xs font-bold text-[#142238] uppercase tracking-wider mb-3 m-0">Company Information</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label class="sm:col-span-2 grid gap-1 text-[11px] font-bold text-[#334155]">
                Legal company name <span class="text-[#c04b4b]">*</span>
                <input
                  formControlName="legalName"
                  placeholder="e.g. ABC Components Private Limited"
                  class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Trade name
                <input
                  formControlName="tradeName"
                  placeholder="Business / brand name"
                  class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Supplier Category
                <select formControlName="supplierCategory" class="h-10 px-3 border border-[#cbd5e1] rounded-lg bg-white text-xs text-[#0f172a]">
                  <option value="">Select category…</option>
                  <option value="Precision Machining & CNC">Precision Machining & CNC</option>
                  <option value="Automotive & Sheet Metal">Automotive & Sheet Metal</option>
                  <option value="Industrial Fasteners & Hardware">Industrial Fasteners & Hardware</option>
                  <option value="Valves, Hydraulics & Casting">Valves, Hydraulics & Casting</option>
                  <option value="Electrical & Automation">Electrical & Automation</option>
                  <option value="Packaging & Consumables">Packaging & Consumables</option>
                </select>
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                GSTIN
                <input
                  formControlName="gstin"
                  maxlength="15"
                  placeholder="15-character GSTIN"
                  class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a] uppercase"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                PAN
                <input
                  formControlName="pan"
                  maxlength="10"
                  placeholder="10-character PAN"
                  class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a] uppercase"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                MSME / Udyam Number
                <input
                  formControlName="msmeNumber"
                  placeholder="UDYAM-XX-00-0000000"
                  class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a] uppercase"
                />
              </label>
            </div>
          </div>

          <div class="pt-4 border-t border-[#edf1f5]">
            <h2 class="text-xs font-bold text-[#142238] uppercase tracking-wider mb-3 m-0">Primary Contact</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Contact person <span class="text-[#c04b4b]">*</span>
                <input formControlName="contactName" placeholder="Full name" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Email address <span class="text-[#c04b4b]">*</span>
                <input type="email" formControlName="email" placeholder="name@company.com" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Phone number
                <input formControlName="phone" placeholder="+91" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]" />
              </label>
            </div>

            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold text-[#334155]">Additional Contacts (Optional)</span>
                <button
                  type="button"
                  (click)="addRegContact()"
                  class="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-[#dce4ec] bg-white text-[11px] font-bold text-[#315c80] cursor-pointer"
                >
                  <mat-icon class="!text-sm !w-3.5 !h-3.5">add</mat-icon>
                  <span>Add contact</span>
                </button>
              </div>
              <div formArrayName="additionalContacts" class="grid gap-2">
                @for (c of regContactsArray.controls; track $index) {
                  <div [formGroupName]="$index" class="grid grid-cols-1 sm:grid-cols-9 gap-2 items-center p-2.5 rounded-lg bg-[#f8fafc] border border-[#e3eaf1]">
                    <input formControlName="fullName" placeholder="Full name *" class="sm:col-span-2 h-8 px-2 border border-[#cbd5e1] rounded bg-white text-xs" />
                    <input formControlName="email" placeholder="Email *" class="sm:col-span-3 h-8 px-2 border border-[#cbd5e1] rounded bg-white text-xs" />
                    <input formControlName="phone" placeholder="Phone" class="sm:col-span-2 h-8 px-2 border border-[#cbd5e1] rounded bg-white text-xs" />
                    <input formControlName="designation" placeholder="Role / Title" class="sm:col-span-1 h-8 px-2 border border-[#cbd5e1] rounded bg-white text-xs" />
                    <button
                      type="button"
                      (click)="removeRegContact($index)"
                      class="h-8 px-2 rounded border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <mat-icon class="!text-sm !w-3.5 !h-3.5">delete</mat-icon>
                      <span>Remove</span>
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-[#edf1f5]">
            <h2 class="text-xs font-bold text-[#142238] uppercase tracking-wider mb-3 m-0">
              Registered Address <small class="text-[#64748b] font-normal ml-1 lowercase">Optional</small>
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label class="sm:col-span-2 grid gap-1 text-[11px] font-bold text-[#334155]">
                Address line
                <input formControlName="addressLine1" placeholder="Building, street and industrial area" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                City
                <input formControlName="city" placeholder="City" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                State
                <input formControlName="stateRegion" placeholder="State" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Postal code
                <input formControlName="postalCode" placeholder="PIN code" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a]" />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#334155]">
                Country code
                <input formControlName="countryCode" maxlength="2" placeholder="IN" class="h-10 px-3 border border-[#cbd5e1] rounded-lg text-xs text-[#0f172a] uppercase" />
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-2.5 pt-4 border-t border-[#edf1f5]">
            <a
              routerLink="/suppliers"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#334155] no-underline inline-flex items-center"
            >
              Cancel
            </a>
            <button
              type="submit"
              [disabled]="registrationForm.invalid || saving()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#122e49] disabled:opacity-55 cursor-pointer"
            >
              <mat-icon class="!text-base !w-4 !h-4">save</mat-icon>
              <span>{{ saving() ? 'Saving supplier…' : 'Register Supplier' }}</span>
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class SupplierFormComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly editSupplierId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly editSupplier = signal<Supplier | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly registrationForm = new FormGroup({
    legalName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    tradeName: new FormControl('', { nonNullable: true }),
    supplierCategory: new FormControl('', { nonNullable: true }),
    msmeNumber: new FormControl('', { nonNullable: true }),
    gstin: new FormControl('', { nonNullable: true }),
    pan: new FormControl('', { nonNullable: true }),
    contactName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true }),
    additionalContacts: new FormArray<FormGroup>([]),
    addressLine1: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    stateRegion: new FormControl('', { nonNullable: true }),
    postalCode: new FormControl('', { nonNullable: true }),
    countryCode: new FormControl('IN', { nonNullable: true }),
  });

  protected readonly editForm = new FormGroup({
    tradeName: new FormControl('', { nonNullable: true }),
    supplierCategory: new FormControl('', { nonNullable: true }),
    msmeNumber: new FormControl('', { nonNullable: true }),
    contactName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true }),
    gstin: new FormControl('', { nonNullable: true }),
    pan: new FormControl('', { nonNullable: true }),
  });

  get regContactsArray(): FormArray<FormGroup> {
    return this.registrationForm.controls.additionalContacts;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('supplierId');
    if (id) {
      this.editSupplierId.set(id);
      this.isEditMode.set(true);
      this.loadSupplierForEdit(id);
    } else if (!this.auth.canRegisterSupplier()) {
      void this.router.navigate(['/suppliers']);
    }
  }

  private loadSupplierForEdit(supplierId: string): void {
    this.loading.set(true);
    this.supplierService.getSupplier(supplierId).subscribe({
      next: (res) => {
        const s = res.data;
        if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(s.lifecycleStatus)) {
          this.errorMessage.set(`Supplier ${s.supplierNumber} is in ${s.lifecycleStatus} state and cannot be edited.`);
          this.loading.set(false);
          return;
        }
        this.editSupplier.set(s);
        this.editForm.patchValue({
          tradeName: s.tradeName ?? '',
          supplierCategory: s.supplierCategory ?? '',
          msmeNumber: s.msmeNumber ?? '',
          contactName: s.contactName,
          email: s.email,
          phone: s.phone ?? '',
          gstin: s.gstin ?? '',
          pan: s.pan ?? '',
        });
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load supplier for editing.');
        this.loading.set(false);
      },
    });
  }

  protected addRegContact(): void {
    this.regContactsArray.push(
      new FormGroup({
        fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
        phone: new FormControl('', { nonNullable: true }),
        designation: new FormControl('', { nonNullable: true }),
      }),
    );
  }

  protected async removeRegContact(index: number): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Remove Contact?',
      message: 'Are you sure you want to remove this additional contact row?',
      confirmLabel: 'Remove',
      tone: 'danger',
      icon: 'delete',
    });
    if (ok) {
      this.regContactsArray.removeAt(index);
    }
  }

  protected async submitRegistration(): Promise<void> {
    if (this.registrationForm.invalid || this.saving()) return;
    const raw = this.registrationForm.getRawValue();
    const ok = await this.confirmDialog.confirm({
      title: 'Register New Supplier?',
      message: `Create supplier record for "${raw.legalName.trim()}" in initial DRAFT status?`,
      confirmLabel: 'Create Supplier',
      tone: 'primary',
      icon: 'add_business',
    });
    if (!ok) return;

    this.saving.set(true);
    this.errorMessage.set('');
    this.supplierService
      .registerSupplier({
        ...raw,
        tradeName: raw.tradeName.trim(),
        supplierCategory: raw.supplierCategory.trim(),
        msmeNumber: raw.msmeNumber.trim().toUpperCase(),
        gstin: raw.gstin.trim().toUpperCase(),
        pan: raw.pan.trim().toUpperCase(),
        additionalContacts: raw.additionalContacts.map((c) => ({
          fullName: String(c['fullName'] ?? '').trim(),
          email: String(c['email'] ?? '').trim(),
          phone: String(c['phone'] ?? '').trim() || null,
          designation: String(c['designation'] ?? '').trim() || null,
        })),
        countryCode: raw.countryCode.trim().toUpperCase() || 'IN',
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          void this.router.navigate(['/suppliers', res.data.supplierId], {
            queryParams: { notice: `${res.data.supplierNumber} registered successfully.` },
          });
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Supplier registration failed.');
          this.saving.set(false);
        },
      });
  }

  protected async saveEdit(): Promise<void> {
    const supplierId = this.editSupplierId();
    const sup = this.editSupplier();
    if (!supplierId || !sup || this.editForm.invalid || this.saving()) return;

    const ok = await this.confirmDialog.confirm({
      title: 'Save Profile Changes?',
      message: `Save updated organization and contact details for ${sup.supplierNumber}?`,
      confirmLabel: 'Save Changes',
      tone: 'primary',
      icon: 'save',
    });
    if (!ok) return;

    this.saving.set(true);
    this.errorMessage.set('');
    const raw = this.editForm.getRawValue();
    this.supplierService.updateSupplier(supplierId, raw).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/suppliers', supplierId], {
          queryParams: { notice: 'Supplier profile updates saved.' },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update supplier profile.');
        this.saving.set(false);
      },
    });
  }
}
