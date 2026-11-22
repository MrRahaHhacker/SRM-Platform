import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { RoleCode } from './core/auth/auth.models';
import { AuthService } from './core/auth/auth.service';
import { ConfirmDialogComponent } from './core/ui/confirm-dialog';
import { ConfirmDialogService } from './core/ui/confirm-dialog.service';

interface NavItem {
  label: string;
  supplierLabel?: string;
  path: string;
  icon: string;
  queryParams?: Record<string, string>;
  roles: RoleCode[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL_NAV_SECTIONS: NavSection[] = [
  {
    title: 'CORE',
    items: [
      {
        label: 'Workspace Overview',
        supplierLabel: 'Supplier Portal Home',
        path: '/dashboard',
        icon: 'dashboard',
        roles: [
          'SUPER_ADMIN',
          'SRM_ADMIN',
          'SUPPLIER_USER',
          'SUPPLIER_VERIFIER',
          'PROCUREMENT_BUYER',
          'PROCUREMENT_APPROVER',
          'AUDITOR',
        ],
      },
    ],
  },
  {
    title: 'SUPPLIER LIFECYCLE',
    items: [
      {
        label: 'Suppliers & Onboarding',
        supplierLabel: 'My Supplier Profile',
        path: '/suppliers',
        icon: 'business',
        roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'AUDITOR', 'SUPPLIER_USER'],
      },
    ],
  },
  {
    title: 'SOURCING & BIDDING',
    items: [
      {
        label: 'RFQ Management',
        supplierLabel: 'Invited RFQs',
        path: '/rfqs',
        icon: 'assignment',
        roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER'],
      },
      {
        label: 'Quotations & Bids',
        supplierLabel: 'My Quotations & Rounds',
        path: '/quotations',
        icon: 'request_quote',
        roles: [
          'SUPER_ADMIN',
          'SRM_ADMIN',
          'SUPPLIER_VERIFIER',
          'PROCUREMENT_BUYER',
          'PROCUREMENT_APPROVER',
          'AUDITOR',
          'SUPPLIER_USER',
        ],
      },
    ],
  },
  {
    title: 'GOVERNANCE & SAP',
    items: [
      {
        label: 'Approvals & SAP PIR',
        path: '/approvals',
        icon: 'fact_check',
        roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR'],
      },
      {
        label: 'Audit & Notifications',
        supplierLabel: 'Notifications',
        path: '/reports',
        icon: 'analytics',
        roles: [
          'SUPER_ADMIN',
          'SRM_ADMIN',
          'SUPPLIER_VERIFIER',
          'PROCUREMENT_BUYER',
          'PROCUREMENT_APPROVER',
          'AUDITOR',
          'SUPPLIER_USER',
        ],
      },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      {
        label: 'Users & Roles',
        supplierLabel: 'Colleague Users',
        path: '/users',
        icon: 'manage_accounts',
        roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'AUDITOR', 'SUPPLIER_USER'],
      },
    ],
  },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly currentUser = this.auth.currentUser;

  protected readonly navSections = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    const supplierOnly = this.auth.isSupplierOnly();
    return ALL_NAV_SECTIONS.map((section) => ({
      title: section.title,
      items: section.items
        .filter((item) => user.roles.some((r) => item.roles.includes(r)))
        .map((item) => ({
          ...item,
          label: supplierOnly && item.supplierLabel ? item.supplierLabel : item.label,
          queryParams: supplierOnly && item.path === '/reports' ? { tab: 'NOTIFICATIONS' } : item.queryParams,
        })),
    })).filter((section) => section.items.length > 0);
  });

  protected readonly canAccessUsers = computed(() => {
    this.currentUser();
    return this.auth.canAccessUsers();
  });

  protected readonly isSupplierOnly = computed(() => {
    this.currentUser();
    return this.auth.isSupplierOnly();
  });

  protected readonly userInitial = computed(() => {
    const name = this.currentUser()?.fullName?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  protected async logout(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Confirm Sign Out',
      message: 'Are you sure you want to sign out of the SRM workspace?',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Stay Signed In',
      tone: 'warning',
      icon: 'logout',
    });
    if (!ok) return;

    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
