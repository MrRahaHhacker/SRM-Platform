import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import type { ApiResponse, Supplier, SupplierLifecycleResult } from './supplier.models';
import { SupplierService } from './supplier.service';
import { SupplierDocumentsComponent } from './supplier-documents';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-suppliers',
  imports: [ReactiveFormsModule, DatePipe, MatIconModule, SupplierDocumentsComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#8795a5] uppercase">
          SRM WORKSPACE / SUPPLIERS
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#17263b] tracking-tight mt-1 mb-1">
          Supplier management & qualification
        </h1>
        <p class="text-sm text-[#78889b] m-0">
          Onboard suppliers, verify compliance documents, map existing SAP Vendor Codes, and manage lifecycle status.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          (click)="loadSuppliers()"
          [disabled]="loading()"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] hover:bg-[#f4f7fa] cursor-pointer disabled:opacity-55"
        >
          <mat-icon class="!text-base !w-4 !h-4">refresh</mat-icon>
          <span>Refresh</span>
        </button>
        @if (canRegisterSupplier()) {
          <button
            type="button"
            (click)="toggleRegistrationForm()"
            class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold hover:bg-[#122e49] cursor-pointer"
          >
            <mat-icon class="!text-base !w-4 !h-4">{{ showForm() ? 'close' : 'add_business' }}</mat-icon>
            <span>{{ showForm() ? 'Close form' : 'Register supplier' }}</span>
          </button>
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

    <!-- New Supplier Registration Form -->
    @if (showForm() && canRegisterSupplier()) {
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6">
        <div class="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 class="text-base font-bold text-[#18283d] m-0">New supplier registration</h2>
            <p class="text-xs text-[#78889b] m-0 mt-0.5">Enter legal entity, tax IDs, primary contact, and registered address.</p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">
            Initial status: DRAFT
          </span>
        </div>

        <form [formGroup]="registrationForm" (ngSubmit)="submitRegistration()" class="grid gap-5">
          <div class="pt-4 border-t border-[#edf1f5]">
            <h3 class="text-xs font-bold text-[#18283d] mb-3 m-0">Company information</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label class="sm:col-span-2 grid gap-1 text-[11px] font-bold text-[#53657a]">
                Legal company name <span class="text-[#c04b4b]">*</span>
                <input
                  formControlName="legalName"
                  placeholder="e.g. ABC Components Private Limited"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Trade name
                <input
                  formControlName="tradeName"
                  placeholder="Business / brand name"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Supplier Category
                <select formControlName="supplierCategory" class="h-10 px-3 border border-[#dfe6ed] rounded-lg bg-white text-xs text-[#24364b]">
                  <option value="">Select category…</option>
                  <option value="Precision Machining & CNC">Precision Machining & CNC</option>
                  <option value="Automotive & Sheet Metal">Automotive & Sheet Metal</option>
                  <option value="Industrial Fasteners & Hardware">Industrial Fasteners & Hardware</option>
                  <option value="Valves, Hydraulics & Casting">Valves, Hydraulics & Casting</option>
                  <option value="Electrical & Automation">Electrical & Automation</option>
                  <option value="Packaging & Consumables">Packaging & Consumables</option>
                </select>
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                GSTIN
                <input
                  formControlName="gstin"
                  maxlength="15"
                  placeholder="15-character GSTIN"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b] uppercase"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                PAN
                <input
                  formControlName="pan"
                  maxlength="10"
                  placeholder="10-character PAN"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b] uppercase"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                MSME / Udyam Number
                <input
                  formControlName="msmeNumber"
                  placeholder="UDYAM-XX-00-0000000"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b] uppercase"
                />
              </label>
            </div>
          </div>

          <div class="pt-4 border-t border-[#edf1f5]">
            <h3 class="text-xs font-bold text-[#18283d] mb-3 m-0">Primary contact</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Contact person <span class="text-[#c04b4b]">*</span>
                <input
                  formControlName="contactName"
                  placeholder="Full name"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Email address <span class="text-[#c04b4b]">*</span>
                <input
                  type="email"
                  formControlName="email"
                  placeholder="name@company.com"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Phone number
                <input
                  formControlName="phone"
                  placeholder="+91"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
            </div>

            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold text-[#53657a]">Additional Contacts (Optional)</span>
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
                  <div [formGroupName]="$index" class="grid grid-cols-1 sm:grid-cols-9 gap-2 items-center p-2.5 rounded-lg bg-[#f9fbfc] border border-[#e6ebf1]">
                    <input formControlName="fullName" placeholder="Full name *" class="sm:col-span-2 h-8 px-2 border border-[#dfe6ed] rounded bg-white text-xs" />
                    <input formControlName="email" placeholder="Email *" class="sm:col-span-3 h-8 px-2 border border-[#dfe6ed] rounded bg-white text-xs" />
                    <input formControlName="phone" placeholder="Phone" class="sm:col-span-2 h-8 px-2 border border-[#dfe6ed] rounded bg-white text-xs" />
                    <input formControlName="designation" placeholder="Role / Title" class="sm:col-span-1 h-8 px-2 border border-[#dfe6ed] rounded bg-white text-xs" />
                    <button type="button" (click)="removeRegContact($index)" class="h-8 px-2 rounded border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer">
                      Remove
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-[#edf1f5]">
            <h3 class="text-xs font-bold text-[#18283d] mb-3 m-0">
              Registered address <small class="text-[#8996a5] font-normal ml-1">Optional</small>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label class="sm:col-span-2 grid gap-1 text-[11px] font-bold text-[#53657a]">
                Address line
                <input
                  formControlName="addressLine1"
                  placeholder="Building, street and industrial area"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                City
                <input
                  formControlName="city"
                  placeholder="City"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                State
                <input
                  formControlName="stateRegion"
                  placeholder="State"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Postal code
                <input
                  formControlName="postalCode"
                  placeholder="PIN code"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b]"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Country code
                <input
                  formControlName="countryCode"
                  maxlength="2"
                  placeholder="IN"
                  class="h-10 px-3 border border-[#dfe6ed] rounded-lg text-xs text-[#24364b] uppercase"
                />
              </label>
            </div>
            <p class="text-[11px] text-[#8996a5] mt-2 m-0">If you enter an address line, City and 2-letter Country code are required.</p>
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-[#edf1f5]">
            <button
              type="button"
              (click)="resetRegistrationForm()"
              class="h-10 px-4 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              [disabled]="registrationForm.invalid || saving()"
              class="h-10 px-5 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#122e49] disabled:opacity-55 cursor-pointer"
            >
              <mat-icon class="!text-base !w-4 !h-4">save</mat-icon>
              <span>{{ saving() ? 'Saving supplier…' : 'Save supplier' }}</span>
            </button>
          </div>
        </form>
      </section>
    }

    <!-- Selected Supplier Profile & Lifecycle Panel -->
    @if (detailsLoading()) {
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6 text-xs text-[#6f8093]">
        Loading supplier profile…
      </section>
    } @else if (selectedSupplier(); as supplier) {
      <section class="bg-white border border-[#e6ebf1] rounded-xl p-6 mb-6">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-md bg-[#edf3f8] text-[#183b5d] text-[11px] font-extrabold">
                {{ supplier.supplierNumber }}
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold" [class]="statusBadgeClass(supplier.lifecycleStatus)">
                {{ supplier.lifecycleStatus }}
              </span>
              @if (supplier.sapVendorCode) {
                <span class="px-2.5 py-0.5 rounded-md bg-[#eaf8f0] text-[#16834e] text-[10px] font-extrabold">
                  SAP Vendor: {{ supplier.sapVendorCode }}
                </span>
              }
            </div>
            <h2 class="text-xl font-bold text-[#18283d] m-0 mt-2">{{ supplier.legalName }}</h2>
            <p class="text-xs text-[#78889b] m-0 mt-0.5">
              Registered {{ supplier.createdAt | date:'medium' }}
              @if (supplier.tradeName) { · Trade name: {{ supplier.tradeName }} }
            </p>
          </div>
          <div class="flex items-center gap-2">
            @if (canEditProfile(supplier)) {
              <button
                type="button"
                (click)="toggleEditProfile(supplier)"
                class="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#315c80] cursor-pointer"
              >
                <mat-icon class="!text-base !w-4 !h-4">edit</mat-icon>
                <span>{{ editingProfile() ? 'Cancel edit' : 'Edit profile' }}</span>
              </button>
            }
            <button
              type="button"
              (click)="closeDetails()"
              class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#40566d] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        @if (editingProfile()) {
          <form [formGroup]="editForm" (ngSubmit)="saveProfileEdit(supplier.supplierId)" class="p-4 rounded-xl bg-[#f9fbfc] border border-[#e6ebf1] mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Trade name
              <input formControlName="tradeName" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Category
              <input formControlName="supplierCategory" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              MSME Number
              <input formControlName="msmeNumber" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs uppercase" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Contact person
              <input formControlName="contactName" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Email
              <input formControlName="email" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              Phone
              <input formControlName="phone" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              GSTIN
              <input formControlName="gstin" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs uppercase" />
            </label>
            <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
              PAN
              <input formControlName="pan" class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs uppercase" />
            </label>
            <div class="sm:col-span-3 flex justify-end gap-2 mt-1">
              <button
                type="submit"
                [disabled]="lifecycleBusy()"
                class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer"
              >
                Save profile updates
              </button>
            </div>
          </form>
        }

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] uppercase font-bold">Primary Contact</span>
            <strong class="text-xs text-[#30465e]">{{ supplier.contactName || '—' }}</strong>
            <div class="text-[11px] text-[#6f8093] truncate">{{ supplier.email || '—' }}</div>
            <div class="text-[11px] text-[#6f8093]">{{ supplier.phone || '—' }}</div>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] uppercase font-bold">Category & MSME</span>
            <strong class="text-xs text-[#30465e]">{{ supplier.supplierCategory || 'General Supply' }}</strong>
            <div class="text-[11px] text-[#6f8093]">MSME: {{ supplier.msmeNumber || '—' }}</div>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] uppercase font-bold">GSTIN / PAN</span>
            <strong class="text-xs text-[#30465e]">{{ supplier.gstin || '—' }}</strong>
            <div class="text-[11px] text-[#6f8093]">PAN: {{ supplier.pan || '—' }}</div>
          </div>
          <div class="p-3 rounded-lg border border-[#edf1f5]">
            <span class="block text-[10px] text-[#8795a5] uppercase font-bold">Registered Address</span>
            <strong class="text-xs text-[#30465e]">
              {{ supplier.address ? (supplier.address.city + ', ' + supplier.address.countryCode) : '—' }}
            </strong>
            <div class="text-[11px] text-[#6f8093] truncate">{{ supplier.address?.addressLine1 || '' }}</div>
          </div>
        </div>

        @if ((supplier.additionalContacts?.length ?? 0) > 0) {
          <div class="mb-5 p-3.5 rounded-lg border border-[#edf1f5] bg-[#fcfdfe]">
            <span class="block text-[10px] font-extrabold uppercase tracking-wider text-[#8795a5] mb-2">
              Additional Organization Contacts
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              @for (c of supplier.additionalContacts!; track $index) {
                <div class="p-2.5 rounded-lg bg-white border border-[#edf1f5]">
                  <div class="font-bold text-[#273b51]">{{ c.fullName }}</div>
                  <div class="text-[11px] text-[#6f8093]">{{ c.designation || 'Contact' }} · {{ c.email }}</div>
                  @if (c.phone) {
                    <div class="text-[11px] text-[#8795a5]">{{ c.phone }}</div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Lifecycle & Verification Actions -->
        <div class="p-4 rounded-xl border border-[#e6ebf1] bg-[#f9fbfc] mb-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-bold text-[#18283d] m-0">Qualification & lifecycle workflow</h3>
              <p class="text-xs text-[#78889b] m-0 mt-0.5">
                Current state: <strong>{{ supplier.lifecycleStatus }}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              @if ((supplier.lifecycleStatus === 'DRAFT' || supplier.lifecycleStatus === 'CORRECTION_REQUIRED') && canSubmitSupplier()) {
                <button
                  type="button"
                  (click)="submitForReview()"
                  [disabled]="lifecycleBusy()"
                  class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  <mat-icon class="!text-base !w-4 !h-4">send</mat-icon>
                  <span>{{ supplier.lifecycleStatus === 'CORRECTION_REQUIRED' ? 'Resubmit for review' : 'Submit for verification' }}</span>
                </button>
              }
              @if ((supplier.lifecycleStatus === 'SUBMITTED' || supplier.lifecycleStatus === 'ON_HOLD') && canVerifySupplier()) {
                <button
                  type="button"
                  (click)="startSupplierReview()"
                  [disabled]="lifecycleBusy()"
                  class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  <mat-icon class="!text-base !w-4 !h-4">rate_review</mat-icon>
                  <span>Start review</span>
                </button>
              }
            </div>
          </div>

          @if (supplier.lifecycleStatus === 'UNDER_REVIEW' && canVerifySupplier()) {
            <div class="mt-4 pt-4 border-t border-[#e6ebf1]">
              <label class="grid gap-1 max-w-xl text-[11px] font-bold text-[#53657a]">
                Reviewer remarks <span class="font-normal text-[#8795a5]">(Required to return for correction, hold, or reject)</span>
                <textarea
                  [formControl]="lifecycleRemarksControl"
                  rows="2"
                  maxlength="2000"
                  placeholder="Record the verification decision reason"
                  class="p-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs text-[#24364b]"
                ></textarea>
              </label>
              <div class="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  (click)="decideSupplier('APPROVE')"
                  [disabled]="lifecycleBusy()"
                  class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold cursor-pointer disabled:opacity-55"
                >
                  Approve qualification
                </button>
                <button
                  type="button"
                  (click)="decideSupplier('RETURN')"
                  [disabled]="lifecycleBusy() || !lifecycleRemarksControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#dce4ec] bg-white text-[#40566d] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Return for correction
                </button>
                <button
                  type="button"
                  (click)="decideSupplier('HOLD')"
                  [disabled]="lifecycleBusy() || !lifecycleRemarksControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#f5d0a9] bg-[#fef7e6] text-[#9a6700] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Put on hold
                </button>
                <button
                  type="button"
                  (click)="decideSupplier('REJECT')"
                  [disabled]="lifecycleBusy() || !lifecycleRemarksControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Reject supplier
                </button>
              </div>
            </div>
          }

          <!-- Controlled SAP Vendor Code Mapping (APPROVED / ACTIVE) -->
          @if ((supplier.lifecycleStatus === 'APPROVED' || supplier.lifecycleStatus === 'ACTIVE') && canMapSapVendor()) {
            <form
              [formGroup]="sapMappingForm"
              (ngSubmit)="mapSapVendorCode(supplier.supplierId)"
              class="mt-4 pt-4 border-t border-[#e6ebf1] flex flex-wrap items-end gap-3"
            >
              <div class="flex-1 min-w-[200px]">
                <div class="text-xs font-bold text-[#18283d]">Map Existing SAP Vendor Code</div>
                <p class="text-[11px] text-[#78889b] m-0">
                  SAP owns Vendor Master creation. Map an existing SAP Vendor Code to activate this supplier.
                </p>
              </div>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                SAP System
                <input
                  formControlName="sapSystemCode"
                  class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs w-36"
                />
              </label>
              <label class="grid gap-1 text-[11px] font-bold text-[#53657a]">
                Existing SAP Vendor Code
                <input
                  formControlName="sapVendorCode"
                  placeholder="SAP-VND-40025"
                  class="h-9 px-2.5 border border-[#dfe6ed] rounded-lg bg-white text-xs w-40 uppercase"
                />
              </label>
              <button
                type="submit"
                [disabled]="sapMappingForm.invalid || lifecycleBusy()"
                class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
              >
                <mat-icon class="!text-base !w-4 !h-4">link</mat-icon>
                <span>{{ supplier.sapVendorCode ? 'Update SAP Mapping' : 'Map & Activate' }}</span>
              </button>
            </form>
          }

          <!-- Admin Suspend / Reactivate -->
          @if ((supplier.lifecycleStatus === 'ACTIVE' || supplier.lifecycleStatus === 'SUSPENDED') && canAdminSuspend()) {
            <div class="mt-4 pt-4 border-t border-[#e6ebf1] flex flex-wrap items-center gap-3">
              <input
                [formControl]="statusReasonControl"
                placeholder="Reason for suspension or reactivation"
                class="flex-1 min-w-[220px] h-9 px-3 border border-[#dfe6ed] rounded-lg bg-white text-xs"
              />
              @if (supplier.lifecycleStatus === 'ACTIVE') {
                <button
                  type="button"
                  (click)="toggleSuspend(supplier, 'SUSPENDED')"
                  [disabled]="lifecycleBusy() || !statusReasonControl.value.trim()"
                  class="h-9 px-4 rounded-lg border border-[#f0d4d1] bg-[#fff7f6] text-[#a13d36] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Suspend supplier
                </button>
              } @else {
                <button
                  type="button"
                  (click)="toggleSuspend(supplier, 'ACTIVE')"
                  [disabled]="lifecycleBusy() || !statusReasonControl.value.trim()"
                  class="h-9 px-4 rounded-lg bg-[#16834e] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Reactivate supplier
                </button>
              }
            </div>
          }
        </div>

        <!-- Status & Review History Timeline -->
        @if ((supplier.statusHistory?.length ?? 0) > 0) {
          <div class="mb-5">
            <h3 class="text-xs font-bold text-[#18283d] uppercase tracking-wider mb-2.5">
              Status & Qualification History
            </h3>
            <div class="grid gap-2">
              @for (item of supplier.statusHistory!; track item.historyId) {
                <div class="p-2.5 rounded-lg border border-[#edf1f5] bg-[#fcfdfe] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span class="font-bold text-[#315c80]">{{ item.oldStatus || 'NEW' }} → {{ item.newStatus }}</span>
                    <span class="text-[#6f8093] ml-2">by {{ item.changedByName }}</span>
                    @if (item.reason) {
                      <span class="text-[#30465e] ml-2">— {{ item.reason }}</span>
                    }
                  </div>
                  <span class="text-[11px] text-[#8b98a8]">{{ item.changedAt | date:'short' }}</span>
                </div>
              }
            </div>
          </div>
        }

        <app-supplier-documents [supplierId]="supplier.supplierId" />
      </section>
    }

    <!-- Supplier Queue / Directory -->
    <section class="bg-white border border-[#e6ebf1] rounded-xl p-6">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 class="text-base font-bold text-[#18283d] m-0">
            {{ isSupplierOnly() ? 'Your supplier organization' : 'Registered suppliers' }}
          </h2>
          <p class="text-xs text-[#78889b] m-0 mt-0.5">
            Filter by qualification stage or search by name, supplier ID, GSTIN, or SAP Vendor Code.
          </p>
        </div>
        <span class="px-3 py-1 rounded-full bg-[#f0f4f8] text-[#62758a] text-[10px] font-extrabold">
          {{ filteredSuppliers().length }} records
        </span>
      </div>

      @if (!isSupplierOnly()) {
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex flex-wrap gap-1.5">
            @for (status of statusFilters; track status) {
              <button
                type="button"
                (click)="activeStatusFilter.set(status)"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors"
                [class]="
                  activeStatusFilter() === status
                    ? 'bg-[#183b5d] text-white border-[#183b5d]'
                    : 'bg-white text-[#52657a] border-[#dce4ec] hover:bg-[#f4f7fa]'
                "
              >
                {{ status }}
              </button>
            }
          </div>
          <input
            [formControl]="searchControl"
            placeholder="Search supplier, ID, GSTIN, SAP code…"
            class="h-9 px-3 border border-[#dfe6ed] rounded-lg text-xs w-64"
          />
        </div>
      }

      @if (loading()) {
        <p class="text-xs text-[#6f8093] py-6 text-center">Loading supplier records…</p>
      } @else if (filteredSuppliers().length === 0) {
        <div class="py-10 text-center text-xs text-[#6f8093]">
          <strong class="block text-sm text-[#30465e] mb-1">No matching suppliers found</strong>
          Adjust your status filter or register a new supplier organization.
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#8795a5]">
                <th class="py-2.5 px-3">Supplier</th>
                <th class="py-2.5 px-3">Supplier ID</th>
                <th class="py-2.5 px-3">Primary contact</th>
                <th class="py-2.5 px-3">GSTIN / SAP Vendor</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#edf1f5] text-xs">
              @for (supplier of filteredSuppliers(); track supplier.supplierId) {
                <tr class="hover:bg-[#f9fbfc]">
                  <td class="py-3.5 px-3">
                    <div class="font-bold text-[#273b51]">{{ supplier.legalName }}</div>
                    <div class="text-[11px] text-[#8b98a7]">{{ supplier.tradeName || '—' }}</div>
                  </td>
                  <td class="py-3.5 px-3 font-extrabold text-[#315c80]">{{ supplier.supplierNumber }}</td>
                  <td class="py-3.5 px-3">
                    <div class="text-[#273b51]">{{ supplier.contactName || '—' }}</div>
                    <div class="text-[11px] text-[#8b98a7]">{{ supplier.email || '—' }}</div>
                  </td>
                  <td class="py-3.5 px-3">
                    <div class="text-[#52657a]">{{ supplier.gstin || '—' }}</div>
                    @if (supplier.sapVendorCode) {
                      <div class="text-[11px] font-bold text-[#16834e]">{{ supplier.sapVendorCode }}</div>
                    }
                  </td>
                  <td class="py-3.5 px-3">
                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold" [class]="statusBadgeClass(supplier.lifecycleStatus)">
                      {{ supplier.lifecycleStatus }}
                    </span>
                  </td>
                  <td class="py-3.5 px-3">
                    <button
                      type="button"
                      (click)="viewDetails(supplier)"
                      class="text-xs font-extrabold text-[#315c80] bg-transparent border-0 cursor-pointer hover:underline"
                    >
                      Open profile
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
export class SuppliersComponent implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);

  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly selectedSupplier = signal<Supplier | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly detailsLoading = signal(false);
  protected readonly lifecycleBusy = signal(false);
  protected readonly showForm = signal(false);
  protected readonly editingProfile = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly activeStatusFilter = signal('ALL');
  protected readonly searchQuery = signal('');

  protected readonly statusFilters = [
    'ALL',
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CORRECTION_REQUIRED',
    'APPROVED',
    'ACTIVE',
    'REJECTED',
  ];

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly lifecycleRemarksControl = new FormControl('', { nonNullable: true });
  protected readonly statusReasonControl = new FormControl('', { nonNullable: true });

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

  protected readonly sapMappingForm = new FormGroup({
    sapSystemCode: new FormControl('SAP_S4_PROD', { nonNullable: true, validators: [Validators.required] }),
    sapVendorCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  get regContactsArray(): FormArray<FormGroup> {
    return this.registrationForm.controls.additionalContacts;
  }

  protected readonly filteredSuppliers = computed(() => {
    const status = this.activeStatusFilter();
    const q = this.searchQuery().trim().toLowerCase();
    return this.suppliers().filter((s) => {
      if (status !== 'ALL' && s.lifecycleStatus !== status) return false;
      if (q) {
        const hay = `${s.legalName} ${s.tradeName ?? ''} ${s.supplierNumber} ${s.gstin ?? ''} ${s.sapVendorCode ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  constructor() {
    this.searchControl.valueChanges.subscribe((val) => this.searchQuery.set(val));
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canRegisterSupplier(): boolean {
    return this.auth.canRegisterSupplier();
  }

  protected canSubmitSupplier(): boolean {
    return this.auth.hasRole('SRM_ADMIN', 'SUPPLIER_USER');
  }

  protected canVerifySupplier(): boolean {
    return this.auth.hasRole('SUPPLIER_VERIFIER', 'SRM_ADMIN');
  }

  protected canMapSapVendor(): boolean {
    return this.auth.hasRole('SRM_ADMIN', 'PROCUREMENT_BUYER');
  }

  protected canAdminSuspend(): boolean {
    return this.auth.hasRole('SRM_ADMIN', 'SUPER_ADMIN');
  }

  protected canEditProfile(supplier: Supplier): boolean {
    return (
      ['DRAFT', 'CORRECTION_REQUIRED'].includes(supplier.lifecycleStatus) &&
      this.auth.hasRole('SRM_ADMIN', 'SUPPLIER_USER')
    );
  }

  protected toggleRegistrationForm(): void {
    this.showForm.update((v) => !v);
  }

  protected loadSuppliers(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.supplierService.getSuppliers().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        this.suppliers.set(list);
        this.loading.set(false);
        // Auto-open supplier profile for SUPPLIER_USER
        if (this.isSupplierOnly() && list.length === 1 && !this.selectedSupplier()) {
          this.viewDetails(list[0]!);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load supplier records.');
        this.loading.set(false);
      },
    });
  }

  protected viewDetails(supplier: Supplier): void {
    this.detailsLoading.set(true);
    this.editingProfile.set(false);
    this.supplierService.getSupplier(supplier.supplierId).subscribe({
      next: (res) => {
        this.selectedSupplier.set(res.data);
        this.sapMappingForm.patchValue({
          sapSystemCode: res.data.sapSystemCode || 'SAP_S4_PROD',
          sapVendorCode: res.data.sapVendorCode || '',
        });
        this.lifecycleRemarksControl.setValue('');
        this.statusReasonControl.setValue('');
        this.detailsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load supplier profile.');
        this.detailsLoading.set(false);
      },
    });
  }

  protected closeDetails(): void {
    this.selectedSupplier.set(null);
    this.editingProfile.set(false);
  }

  protected toggleEditProfile(supplier: Supplier): void {
    if (!this.editingProfile()) {
      this.editForm.patchValue({
        tradeName: supplier.tradeName ?? '',
        supplierCategory: supplier.supplierCategory ?? '',
        msmeNumber: supplier.msmeNumber ?? '',
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone ?? '',
        gstin: supplier.gstin ?? '',
        pan: supplier.pan ?? '',
      });
    }
    this.editingProfile.update((v) => !v);
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

  protected removeRegContact(index: number): void {
    this.regContactsArray.removeAt(index);
  }

  protected saveProfileEdit(supplierId: string): void {
    if (this.editForm.invalid || this.lifecycleBusy()) return;
    this.lifecycleBusy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const raw = this.editForm.getRawValue();
    this.supplierService.updateSupplier(supplierId, raw).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.editingProfile.set(false);
        this.lifecycleBusy.set(false);
        this.loadSuppliers();
        this.viewDetails(res.data);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update supplier profile.');
        this.lifecycleBusy.set(false);
      },
    });
  }

  protected submitForReview(): void {
    const sup = this.selectedSupplier();
    if (!sup) return;
    this.runLifecycleAction(this.supplierService.submitSupplier(sup.supplierId));
  }

  protected startSupplierReview(): void {
    const sup = this.selectedSupplier();
    if (!sup) return;
    this.runLifecycleAction(this.supplierService.startSupplierReview(sup.supplierId));
  }

  protected decideSupplier(decision: 'APPROVE' | 'RETURN' | 'HOLD' | 'REJECT'): void {
    const sup = this.selectedSupplier();
    if (!sup) return;
    const remarks = this.lifecycleRemarksControl.value.trim();
    if (decision !== 'APPROVE' && !remarks) {
      this.errorMessage.set('Add remarks before returning, holding, or rejecting this supplier.');
      return;
    }
    this.runLifecycleAction(this.supplierService.decideSupplier(sup.supplierId, decision, remarks));
  }

  protected mapSapVendorCode(supplierId: string): void {
    if (this.sapMappingForm.invalid || this.lifecycleBusy()) return;
    this.lifecycleBusy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const { sapSystemCode, sapVendorCode } = this.sapMappingForm.getRawValue();
    this.supplierService.mapSapVendorCode(supplierId, sapSystemCode, sapVendorCode).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.lifecycleBusy.set(false);
        this.loadSuppliers();
        this.viewDetails(res.data.supplier);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Failed to map SAP Vendor Code.');
        this.lifecycleBusy.set(false);
      },
    });
  }

  protected toggleSuspend(supplier: Supplier, status: 'ACTIVE' | 'SUSPENDED'): void {
    const reason = this.statusReasonControl.value.trim();
    if (!reason) return;
    this.runLifecycleAction(this.supplierService.changeSupplierStatus(supplier.supplierId, status, reason));
  }

  private runLifecycleAction(req$: Observable<ApiResponse<SupplierLifecycleResult>>): void {
    const current = this.selectedSupplier();
    if (!current || this.lifecycleBusy()) return;
    this.lifecycleBusy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    req$.subscribe({
      next: (res) => {
        this.successMessage.set(res.message || `Supplier status changed to ${res.data.currentStatus}.`);
        this.lifecycleRemarksControl.setValue('');
        this.statusReasonControl.setValue('');
        this.lifecycleBusy.set(false);
        this.loadSuppliers();
        this.viewDetails(current);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update supplier status.');
        this.lifecycleBusy.set(false);
      },
    });
  }

  protected submitRegistration(): void {
    if (this.registrationForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const raw = this.registrationForm.getRawValue();
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
          this.successMessage.set(`${res.data.supplierNumber} registered successfully.`);
          this.suppliers.update((list) => [res.data, ...list]);
          this.resetRegistrationForm();
          this.showForm.set(false);
          this.saving.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Supplier registration failed.');
          this.saving.set(false);
        },
      });
  }

  protected resetRegistrationForm(): void {
    this.regContactsArray.clear();
    this.registrationForm.reset({
      legalName: '',
      tradeName: '',
      supplierCategory: '',
      msmeNumber: '',
      gstin: '',
      pan: '',
      contactName: '',
      email: '',
      phone: '',
      addressLine1: '',
      city: '',
      stateRegion: '',
      postalCode: '',
      countryCode: 'IN',
    });
  }

  protected statusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
      case 'APPROVED':
        return 'bg-[#eaf8f0] text-[#16834e]';
      case 'REJECTED':
      case 'SUSPENDED':
        return 'bg-[#fff1f0] text-[#a13d36]';
      case 'CORRECTION_REQUIRED':
      case 'ON_HOLD':
        return 'bg-[#fef7e6] text-[#9a6700]';
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return 'bg-[#edf4fa] text-[#315b7e]';
      default:
        return 'bg-[#f0f4f8] text-[#62758a]';
    }
  }
}
