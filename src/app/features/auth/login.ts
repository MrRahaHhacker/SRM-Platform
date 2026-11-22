import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import type { DemoAccountInfo } from '../../core/auth/auth.models';
import { SupplierService } from '../suppliers/supplier.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-6">
      <div class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left: Sign-in or Self-Registration Card -->
        <div class="lg:col-span-7 bg-white border border-[#e4eaf0] rounded-2xl p-8 shadow-sm">
          <div class="flex items-center justify-between gap-4 mb-6">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-[#183b5d] text-white grid place-items-center text-xl font-extrabold">
                S
              </div>
              <div>
                <div class="text-[10px] font-extrabold tracking-[0.14em] text-[#8392a2] uppercase">
                  SRM WORKSPACE ACCESS
                </div>
                <h1 class="text-2xl font-bold text-[#18283d] tracking-tight m-0">
                  {{ registerMode() ? 'Supplier Self-Registration' : 'Sign in to SRM Platform' }}
                </h1>
              </div>
            </div>
            <button
              type="button"
              (click)="toggleMode()"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#315c80] hover:bg-[#f4f7fa] cursor-pointer"
            >
              <mat-icon>{{ registerMode() ? 'login' : 'domain_add' }}</mat-icon>
              <span>{{ registerMode() ? 'Back to Sign In' : 'Register Supplier' }}</span>
            </button>
          </div>

          @if (errorMessage()) {
            <div class="mb-4 p-3 rounded-lg bg-[#fff1f0] border border-[#f5d0cd] text-[#a13d36] text-xs font-medium" role="alert">
              {{ errorMessage() }}
            </div>
          }
          @if (successMessage()) {
            <div class="mb-4 p-3 rounded-lg bg-[#edf8f1] border border-[#b9e3d0] text-[#267447] text-xs font-medium" role="status">
              {{ successMessage() }}
            </div>
          }

          @if (!registerMode()) {
            <form [formGroup]="loginForm" (ngSubmit)="submitLogin()" class="grid gap-4">
              <p class="text-xs text-[#6f8093] m-0">
                Authenticate with your SRM workspace account to access onboarding, RFQ sourcing, quotations, approvals, or compliance audit tools.
              </p>

              <label class="grid gap-1.5 text-xs font-bold text-[#4d6075]">
                Email address
                <input
                  type="email"
                  formControlName="email"
                  autocomplete="username"
                  placeholder="name@company.com"
                  class="w-full h-11 px-3 border border-[#dce4ec] rounded-lg text-sm text-[#1d2d42] outline-none focus:border-[#183b5d]"
                />
              </label>

              <label class="grid gap-1.5 text-xs font-bold text-[#4d6075]">
                Password
                <input
                  type="password"
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="Enter your password"
                  class="w-full h-11 px-3 border border-[#dce4ec] rounded-lg text-sm text-[#1d2d42] outline-none focus:border-[#183b5d]"
                />
              </label>

              <button
                type="submit"
                [disabled]="loginForm.invalid || loading()"
                class="h-11 rounded-lg bg-[#183b5d] text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[#122e49] disabled:opacity-55 cursor-pointer"
              >
                <mat-icon>lock_open</mat-icon>
                <span>{{ loading() ? 'Signing in…' : 'Sign in' }}</span>
              </button>
            </form>
          } @else {
            <form [formGroup]="registerForm" (ngSubmit)="submitRegistration()" class="grid gap-3.5">
              <p class="text-xs text-[#6f8093] m-0">
                New supplier organizations start in <strong>DRAFT</strong> status for internal verification before RFQ eligibility.
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="sm:col-span-2 grid gap-1 text-xs font-bold text-[#4d6075]">
                  Legal company name *
                  <input
                    formControlName="legalName"
                    placeholder="e.g. Precision Gears India Pvt Ltd"
                    class="h-10 px-3 border border-[#dce4ec] rounded-lg text-xs text-[#1d2d42]"
                  />
                </label>
                <label class="grid gap-1 text-xs font-bold text-[#4d6075]">
                  GSTIN (optional)
                  <input
                    formControlName="gstin"
                    placeholder="27AABCA1234F1Z5"
                    class="h-10 px-3 border border-[#dce4ec] rounded-lg text-xs text-[#1d2d42] uppercase"
                  />
                </label>
                <label class="grid gap-1 text-xs font-bold text-[#4d6075]">
                  PAN (optional)
                  <input
                    formControlName="pan"
                    placeholder="AABCA1234F"
                    class="h-10 px-3 border border-[#dce4ec] rounded-lg text-xs text-[#1d2d42] uppercase"
                  />
                </label>
                <label class="grid gap-1 text-xs font-bold text-[#4d6075]">
                  Primary contact name *
                  <input
                    formControlName="contactName"
                    placeholder="Full name"
                    class="h-10 px-3 border border-[#dce4ec] rounded-lg text-xs text-[#1d2d42]"
                  />
                </label>
                <label class="grid gap-1 text-xs font-bold text-[#4d6075]">
                  Contact email *
                  <input
                    type="email"
                    formControlName="email"
                    placeholder="contact@supplier.com"
                    class="h-10 px-3 border border-[#dce4ec] rounded-lg text-xs text-[#1d2d42]"
                  />
                </label>
                <label class="grid gap-1 text-xs font-bold text-[#4d6075]">
                  City
                  <input
                    formControlName="city"
                    placeholder="Pune"
                    class="h-10 px-3 border border-[#dce4ec] rounded-lg text-xs text-[#1d2d42]"
                  />
                </label>
                <label class="grid gap-1 text-xs font-bold text-[#4d6075]">
                  Country code
                  <input
                    formControlName="countryCode"
                    maxlength="2"
                    placeholder="IN"
                    class="h-10 px-3 border border-[#dce4ec] rounded-lg text-xs text-[#1d2d42] uppercase"
                  />
                </label>
              </div>
              <button
                type="submit"
                [disabled]="registerForm.invalid || loading()"
                class="h-11 rounded-lg bg-[#183b5d] text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[#122e49] disabled:opacity-55 cursor-pointer"
              >
                <mat-icon>how_to_reg</mat-icon>
                <span>{{ loading() ? 'Submitting registration…' : 'Submit Supplier Registration' }}</span>
              </button>
            </form>
          }
        </div>

        <!-- Right: Development Role Quick-Fill Panel -->
        <aside class="lg:col-span-5 bg-white border border-[#e4eaf0] rounded-2xl p-6 shadow-sm">
          <div class="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.13em] text-[#64748b] uppercase mb-2">
            <mat-icon class="!text-base !w-4 !h-4 text-[#183b5d]">verified_user</mat-icon>
            <span>RBAC DEVELOPMENT PROFILES</span>
          </div>
          <h2 class="text-base font-bold text-[#18283d] m-0 mb-1">Test all 7 SRM roles</h2>
          <p class="text-xs text-[#6f8093] m-0 mb-4 leading-relaxed">
            Select any seeded workspace role below to populate credentials (dev password:
            <code class="px-1.5 py-0.5 rounded bg-[#f0f4f8] text-[#183b5d] font-mono">SrmDev@2026</code>).
          </p>

          <div class="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
            @for (account of demoAccounts(); track account.email) {
              <button
                type="button"
                (click)="fillDemoAccount(account)"
                class="text-left p-3 rounded-xl border border-[#e6ebf1] hover:border-[#6688a9] hover:bg-[#f8fafc] transition-colors cursor-pointer flex items-center justify-between gap-2"
              >
                <div class="min-w-0">
                  <div class="text-xs font-bold text-[#1d2d42] truncate">
                    {{ account.fullName }}
                    @if (account.supplierNumber) {
                      <span class="text-[#315c80]">({{ account.supplierNumber }})</span>
                    }
                  </div>
                  <div class="text-[11px] text-[#6f8093] truncate">{{ account.email }}</div>
                </div>
                <span class="px-2 py-1 rounded-md bg-[#edf3f8] text-[#183b5d] text-[10px] font-extrabold whitespace-nowrap">
                  {{ account.roles[0] }}
                </span>
              </button>
            }
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly supplierService = inject(SupplierService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly registerMode = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly demoAccounts = signal<DemoAccountInfo[]>([]);

  protected readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly registerForm = new FormGroup({
    legalName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    gstin: new FormControl('', { nonNullable: true }),
    pan: new FormControl('', { nonNullable: true }),
    contactName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    city: new FormControl('', { nonNullable: true }),
    countryCode: new FormControl('IN', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.auth.getDemoAccounts().subscribe({
      next: (res) => this.demoAccounts.set(res.data ?? []),
      error: () => undefined,
    });
  }

  protected toggleMode(): void {
    this.registerMode.update((v) => !v);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected fillDemoAccount(account: DemoAccountInfo): void {
    this.registerMode.set(false);
    this.errorMessage.set('');
    this.loginForm.patchValue({
      email: account.email,
      password: 'SrmDev@2026',
    });
  }

  protected submitLogin(): void {
    if (this.loginForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    const { email, password } = this.loginForm.getRawValue();
    this.auth.login({ email: email.trim(), password }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        void this.router.navigateByUrl(returnUrl.startsWith('/') ? returnUrl : '/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(
          error.status === 401
            ? 'Invalid email or password, or account is not active.'
            : error.error?.message || 'Authentication service is temporarily unavailable.',
        );
        this.loading.set(false);
      },
    });
  }

  protected async submitRegistration(): Promise<void> {
    if (this.registerForm.invalid || this.loading()) return;
    const raw = this.registerForm.getRawValue();
    const ok = await this.confirmDialog.confirm({
      title: 'Submit Supplier Registration',
      message: `Register "${raw.legalName.trim()}" as a new supplier organization in DRAFT onboarding status?`,
      confirmLabel: 'Submit Registration',
      cancelLabel: 'Cancel',
      tone: 'primary',
      icon: 'how_to_reg',
    });
    if (!ok) return;

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.supplierService
      .registerSupplier({
        legalName: raw.legalName.trim(),
        tradeName: '',
        gstin: raw.gstin.trim().toUpperCase(),
        pan: raw.pan.trim().toUpperCase(),
        contactName: raw.contactName.trim(),
        email: raw.email.trim(),
        phone: '',
        addressLine1: raw.city.trim() ? `${raw.city.trim()} Industrial Area` : '',
        city: raw.city.trim(),
        stateRegion: '',
        postalCode: '',
        countryCode: raw.countryCode.trim().toUpperCase() || 'IN',
      })
      .subscribe({
        next: (res) => {
          this.successMessage.set(
            `Supplier ${res.data.supplierNumber} registered in DRAFT status. Internal verifiers can now review your profile.`,
          );
          this.registerForm.reset({
            legalName: '',
            gstin: '',
            pan: '',
            contactName: '',
            email: '',
            city: '',
            countryCode: 'IN',
          });
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message || 'Supplier registration failed.');
          this.loading.set(false);
        },
      });
  }
}
