import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ApiResponse, AuthUser, DemoAccountInfo, LoginRequest, LoginResponse, RoleCode } from './auth.models';

const TOKEN_KEY = 'srm_access_token';
const USER_KEY = 'srm_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly userState = signal<AuthUser | null>(this.readStoredUser());

  readonly currentUser = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userState() && !!this.getToken());

  login(payload: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>('/api/v1/auth/login', payload).pipe(
      tap((response) => {
        const user: AuthUser = {
          userId: response.data.userId,
          email: response.data.email,
          fullName: response.data.fullName,
          roles: response.data.roles,
          supplierId: response.data.supplierId ?? null,
        };
        if (this.isBrowser) {
          sessionStorage.setItem(TOKEN_KEY, response.data.accessToken);
          sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        }
        this.userState.set(user);
      }),
    );
  }

  getDemoAccounts(): Observable<ApiResponse<DemoAccountInfo[]>> {
    return this.http.get<ApiResponse<DemoAccountInfo[]>>('/api/v1/auth/demo-accounts');
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return sessionStorage.getItem(TOKEN_KEY);
  }

  getUser(): AuthUser | null {
    return this.userState();
  }

  hasRole(...roles: RoleCode[]): boolean {
    const user = this.userState();
    if (!user) return false;
    return user.roles.some((r) => roles.includes(r));
  }

  isSupplierOnly(): boolean {
    const user = this.userState();
    if (!user) return false;
    return (
      user.roles.includes('SUPPLIER_USER') &&
      !this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR')
    );
  }

  isAuditorOnly(): boolean {
    const user = this.userState();
    if (!user) return false;
    return (
      user.roles.includes('AUDITOR') &&
      !this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'SUPPLIER_USER')
    );
  }

  canAccessSuppliers(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'AUDITOR', 'SUPPLIER_USER');
  }

  canRegisterSupplier(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER');
  }

  canAccessRfqs(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER');
  }

  canAccessQuotations(): boolean {
    return this.hasRole(
      'SUPER_ADMIN',
      'SRM_ADMIN',
      'SUPPLIER_VERIFIER',
      'PROCUREMENT_BUYER',
      'PROCUREMENT_APPROVER',
      'AUDITOR',
      'SUPPLIER_USER',
    );
  }

  canAccessNegotiations(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER');
  }

  canAccessApprovals(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR');
  }

  canAccessAudit(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR');
  }

  canAccessUsers(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'AUDITOR', 'SUPPLIER_USER');
  }

  canCreateUsers(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_USER');
  }

  canViewRbacMatrix(): boolean {
    return this.hasRole('SUPER_ADMIN', 'SRM_ADMIN', 'AUDITOR');
  }

  canExportAudit(): boolean {
    return this.hasRole('AUDITOR', 'SUPER_ADMIN', 'SRM_ADMIN');
  }

  canRetryNotifications(): boolean {
    return this.hasRole('SRM_ADMIN', 'SUPER_ADMIN');
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post('/api/v1/auth/logout', {}).subscribe({ error: () => undefined });
    }
    if (this.isBrowser) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
    this.userState.set(null);
  }

  private readStoredUser(): AuthUser | null {
    if (!this.isBrowser) return null;
    const raw = sessionStorage.getItem(USER_KEY);
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!raw || !token) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
