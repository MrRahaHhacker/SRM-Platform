import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { RoleCode } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { DashboardSummary } from '../../core/services/srm.models';

interface DashboardModule {
  name: string;
  supplierName?: string;
  detail: string;
  supplierDetail?: string;
  route: string;
  queryParams?: Record<string, string>;
  roles: RoleCode[];
}

const ALL_MODULES: DashboardModule[] = [
  {
    name: 'Supplier Onboarding & Qualification',
    supplierName: 'My Supplier Organization & Compliance',
    detail: 'Registration, verification queue, compliance documents & SAP Vendor Code mapping',
    supplierDetail: 'Maintain organization profile, upload GST/PAN/ISO certificates & track qualification',
    route: '/suppliers',
    roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'AUDITOR', 'SUPPLIER_USER'],
  },
  {
    name: 'RFQ Management & Invitations',
    supplierName: 'Invited Sourcing RFQs',
    detail: 'SAP Material Code line references, eligible supplier invitations & deadlines',
    supplierDetail: 'Review invited RFQs, inspect SAP Material Code specs & acknowledge or decline',
    route: '/rfqs',
    roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR', 'SUPPLIER_USER'],
  },
  {
    name: 'Quotations, Comparison & Negotiation',
    supplierName: 'Quotation Submissions & Negotiations',
    detail: 'Versioned landed-cost bids, L1/L2/L3 evaluation & multi-round negotiations',
    supplierDetail: 'Submit versioned quotations, respond to buyer target prices & track bid versions',
    route: '/quotations',
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
  {
    name: 'Approvals, Awards & SAP PIR Sync',
    detail: 'Segregation-of-duties approval tasks, award issuance & idempotent SAP PIR sync',
    route: '/approvals',
    roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR'],
  },
  {
    name: 'Audit Trail & Notifications',
    supplierName: 'Notifications & Alerts',
    detail: 'Append-only compliance search, CSV export & email delivery logs',
    supplierDetail: 'Track RFQ invitations, qualification updates, negotiation messages & award alerts',
    route: '/reports',
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
  {
    name: 'User Management & RBAC Roles',
    supplierName: 'Supplier Organization Colleagues',
    detail: 'Provision internal & supplier portal users, assign roles & control access',
    supplierDetail: 'Add and manage colleague user accounts strictly within your supplier organization',
    route: '/users',
    roles: ['SUPER_ADMIN', 'SRM_ADMIN', 'AUDITOR', 'SUPPLIER_USER'],
  },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[11px] font-extrabold tracking-[0.13em] text-[#64748b] uppercase">
          {{ isSupplierOnly() ? 'SUPPLIER PORTAL OVERVIEW' : 'ENTERPRISE OVERVIEW' }}
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
          {{ isSupplierOnly() ? 'Supplier workspace' : 'Workspace overview' }}
        </h1>
        <p class="text-sm text-[#6f8093] m-0">
          Live SRM workspace strictly scoped to your active role: <strong>{{ currentRolesLabel() }}</strong>.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-3 py-1.5 rounded-full border border-[#dce5ef] bg-white text-[11px] font-bold text-[#52647b]">
          ROLE · {{ primaryRoleLabel() }}
        </span>
      </div>
    </div>

    @if (accessDeniedNotice()) {
      <div class="mb-5 p-3.5 rounded-lg bg-[#fef7e6] border border-[#f5d0a9] text-[#9a6700] text-xs font-medium flex items-center gap-2" role="alert">
        <mat-icon class="!text-base !w-4 !h-4 shrink-0">gpp_maybe</mat-icon>
        <span>Access restricted: the requested screen is not permitted for your active role ({{ currentRolesLabel() }}).</span>
      </div>
    }

    <!-- Hero Banner -->
    <section class="rounded-2xl bg-gradient-to-br from-[#10243f] to-[#173c61] text-white p-7 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-7">
      <div class="max-w-xl">
        <span class="text-[11px] font-extrabold tracking-[0.13em] text-[#9ec8ec] uppercase">
          {{ isSupplierOnly() ? 'SUPPLIER SELF-SERVICE PORTAL' : 'SUPPLIER RELATIONSHIP MANAGEMENT' }}
        </span>
        <h2 class="text-2xl sm:text-3xl font-bold leading-tight mt-2 mb-2.5">
          {{
            isSupplierOnly()
              ? 'Manage qualification, invited RFQs, and quotations.'
              : 'Role-governed SRM workflow complementing SAP.'
          }}
        </h2>
        <p class="text-sm text-[#c4d3e3] leading-relaxed m-0 mb-5">
          {{
            isSupplierOnly()
              ? 'Keep your statutory certificates current, respond to sourcing invitations, submit versioned quotations, and manage colleague accounts.'
              : 'Every module, action button, and approval decision is enforced strictly by your RBAC role and Segregation of Duties policy.'
          }}
        </p>
        <div class="flex flex-wrap gap-2.5">
          @if (canAccessSuppliers()) {
            <a
              routerLink="/suppliers"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[#173c61] text-xs font-bold no-underline hover:bg-[#edf3f8]"
            >
              <mat-icon class="!text-base !w-4 !h-4">business</mat-icon>
              <span>{{ isSupplierOnly() ? 'My Supplier Profile' : 'Suppliers' }}</span>
            </a>
          }
          @if (canAccessRfqs()) {
            <a
              routerLink="/rfqs"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#234f7a] text-white text-xs font-bold no-underline hover:bg-[#2c5d8d]"
            >
              <mat-icon class="!text-base !w-4 !h-4">assignment</mat-icon>
              <span>{{ isSupplierOnly() ? 'Invited RFQs' : 'RFQ Management' }}</span>
            </a>
          }
          @if (canAccessQuotations()) {
            <a
              routerLink="/quotations"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#234f7a] text-white text-xs font-bold no-underline hover:bg-[#2c5d8d]"
            >
              <mat-icon class="!text-base !w-4 !h-4">request_quote</mat-icon>
              <span>{{ isSupplierOnly() ? 'My Quotations' : 'Quotations & Evaluation' }}</span>
            </a>
          }
          @if (canAccessApprovals()) {
            <a
              routerLink="/approvals"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#234f7a] text-white text-xs font-bold no-underline hover:bg-[#2c5d8d]"
            >
              <mat-icon class="!text-base !w-4 !h-4">fact_check</mat-icon>
              <span>Approvals & SAP PIR</span>
            </a>
          }
          @if (canAccessUsers()) {
            <a
              routerLink="/users"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#234f7a] text-white text-xs font-bold no-underline hover:bg-[#2c5d8d]"
            >
              <mat-icon class="!text-base !w-4 !h-4">manage_accounts</mat-icon>
              <span>{{ isSupplierOnly() ? 'Colleague Users' : 'Users & Roles' }}</span>
            </a>
          }
        </div>
      </div>
      <div class="hidden md:grid place-items-center w-32 h-32 rounded-3xl border border-[#45617d] bg-white/5 text-[#b8d4ed] text-2xl font-extrabold rotate-6 shrink-0">
        SRM
      </div>
    </section>

    <!-- Role-Scoped Live KPI Cards -->
    @if (summary(); as data) {
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        @if (canAccessSuppliers()) {
          <a routerLink="/suppliers" class="bg-white border border-[#e3eaf1] rounded-xl p-5 no-underline hover:border-[#6688a9] transition-colors">
            <div class="flex items-center justify-between text-[#64748b] mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider">
                {{ isSupplierOnly() ? 'Organization Status' : 'Suppliers' }}
              </span>
              <mat-icon class="text-[#315c80]">business</mat-icon>
            </div>
            <div class="text-2xl font-extrabold text-[#142238] tabular-nums">{{ data.metrics.totalSuppliers }}</div>
            <div class="text-xs text-[#6f8093] mt-1">
              {{ data.metrics.activeSuppliers }} active · {{ data.metrics.pendingVerification }} in verification
            </div>
          </a>
        }

        @if (canAccessRfqs()) {
          <a routerLink="/rfqs" class="bg-white border border-[#e3eaf1] rounded-xl p-5 no-underline hover:border-[#6688a9] transition-colors">
            <div class="flex items-center justify-between text-[#64748b] mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider">
                {{ isSupplierOnly() ? 'Invited RFQs' : 'RFQs' }}
              </span>
              <mat-icon class="text-[#315c80]">assignment</mat-icon>
            </div>
            <div class="text-2xl font-extrabold text-[#142238] tabular-nums">{{ data.metrics.openRfqs }}</div>
            <div class="text-xs text-[#6f8093] mt-1">
              Open sourcing events ({{ data.metrics.totalRfqs }} total)
            </div>
          </a>
        }

        @if (canAccessQuotations()) {
          <a routerLink="/quotations" class="bg-white border border-[#e3eaf1] rounded-xl p-5 no-underline hover:border-[#6688a9] transition-colors">
            <div class="flex items-center justify-between text-[#64748b] mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider">
                {{ isSupplierOnly() ? 'My Quotations' : 'Quotations' }}
              </span>
              <mat-icon class="text-[#315c80]">request_quote</mat-icon>
            </div>
            <div class="text-2xl font-extrabold text-[#142238] tabular-nums">{{ data.metrics.quotationsCount }}</div>
            <div class="text-xs text-[#6f8093] mt-1">
              Versioned commercial responses
            </div>
          </a>
        }

        @if (canAccessApprovals()) {
          <a routerLink="/approvals" class="bg-white border border-[#e3eaf1] rounded-xl p-5 no-underline hover:border-[#6688a9] transition-colors">
            <div class="flex items-center justify-between text-[#64748b] mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider">Approvals & PIR</span>
              <mat-icon class="text-[#315c80]">fact_check</mat-icon>
            </div>
            <div class="text-2xl font-extrabold text-[#142238] tabular-nums">{{ data.metrics.pendingApprovals }}</div>
            <div class="text-xs text-[#6f8093] mt-1">
              Pending approvals · {{ data.metrics.awardsCount }} awards ({{ data.metrics.sapPirSyncedCount }} SAP PIR)
            </div>
          </a>
        } @else if (isSupplierOnly()) {
          <a routerLink="/reports" [queryParams]="{ tab: 'NOTIFICATIONS' }" class="bg-white border border-[#e3eaf1] rounded-xl p-5 no-underline hover:border-[#6688a9] transition-colors">
            <div class="flex items-center justify-between text-[#64748b] mb-2">
              <span class="text-[11px] font-bold uppercase tracking-wider">My Awards</span>
              <mat-icon class="text-[#315c80]">emoji_events</mat-icon>
            </div>
            <div class="text-2xl font-extrabold text-[#142238] tabular-nums">{{ data.metrics.awardsCount }}</div>
            <div class="text-xs text-[#6f8093] mt-1">
              Awarded contracts & alerts
            </div>
          </a>
        }
      </section>

      <!-- Two-column: Permitted Role Modules & Role Activity/Notifications -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div class="lg:col-span-6 bg-white border border-[#e3eaf1] rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-base font-bold text-[#18283d] m-0">Your Authorized SRM Modules</h2>
              <p class="text-xs text-[#718096] m-0 mt-0.5">Workspaces permitted for {{ currentRolesLabel() }}</p>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-[#eaf8f0] text-[#16834e] text-[10px] font-extrabold">
              {{ visibleModules().length }} ACTIVE
            </span>
          </div>
          <div class="divide-y divide-[#edf1f5]">
            @for (mod of visibleModules(); track mod.route) {
              <div class="py-3 flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-[#eaf8f0] border border-[#b9e3d0] text-[#16834e] grid place-items-center text-xs shrink-0">
                  ✓
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-[#26374b]">{{ mod.name }}</div>
                  <div class="text-[11px] text-[#78889b]">{{ mod.detail }}</div>
                </div>
                <a [routerLink]="mod.route" [queryParams]="mod.queryParams ?? null" class="text-[11px] font-bold text-[#315c80] no-underline hover:underline whitespace-nowrap">
                  Open →
                </a>
              </div>
            }
          </div>
        </div>

        @if (canAccessAudit()) {
          <div class="lg:col-span-6 bg-white border border-[#e3eaf1] rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-base font-bold text-[#18283d] m-0">Recent Audit Activity</h2>
                <p class="text-xs text-[#718096] m-0 mt-0.5">Append-only workflow and security events</p>
              </div>
              <a routerLink="/reports" class="text-xs font-bold text-[#315c80] no-underline hover:underline">
                View full trail
              </a>
            </div>
            @if (data.recentAudit.length === 0) {
              <p class="text-xs text-[#6f8093] py-6 text-center">No recent audit events recorded yet.</p>
            } @else {
              <div class="divide-y divide-[#edf1f5]">
                @for (ev of data.recentAudit; track ev.auditEventId) {
                  <div class="py-2.5 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-[#26374b] truncate">{{ ev.actionCode }}</div>
                      <div class="text-[11px] text-[#6f8093] truncate">
                        {{ ev.actorName }} · {{ ev.entityType }}
                        @if (ev.reason) { — {{ ev.reason }} }
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <span
                        class="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold"
                        [class]="ev.outcome === 'SUCCESS' ? 'bg-[#eaf8f0] text-[#16834e]' : 'bg-[#fff1f0] text-[#a13d36]'"
                      >
                        {{ ev.outcome }}
                      </span>
                      <div class="text-[10px] text-[#8b98a8] mt-0.5">{{ ev.occurredAt | date:'short' }}</div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        } @else {
          <div class="lg:col-span-6 bg-white border border-[#e3eaf1] rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-base font-bold text-[#18283d] m-0">Supplier Portal Actions & Alerts</h2>
                <p class="text-xs text-[#718096] m-0 mt-0.5">Confidential workspace isolated to your supplier organization</p>
              </div>
              <a routerLink="/reports" [queryParams]="{ tab: 'NOTIFICATIONS' }" class="text-xs font-bold text-[#315c80] no-underline hover:underline">
                View notifications
              </a>
            </div>
            <div class="grid gap-3 text-xs text-[#475569]">
              <div class="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                <strong class="block text-[#142238] mb-1">1. Maintain Statutory Compliance</strong>
                Ensure GST, PAN, ISO, and MSME certificates stay verified and unexpired in <em>My Supplier Profile</em>.
              </div>
              <div class="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                <strong class="block text-[#142238] mb-1">2. Acknowledge & Bid on Invited RFQs</strong>
                Review published RFQs in <em>Invited RFQs</em> and submit versioned commercial quotes before deadlines.
              </div>
              <div class="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                <strong class="block text-[#142238] mb-1">3. Strict Organization Isolation</strong>
                Your pricing, negotiations, and colleague accounts are isolated strictly from other suppliers and internal queues.
              </div>
            </div>
          </div>
        }
      </section>
    } @else {
      <div class="bg-white border border-[#e3eaf1] rounded-xl p-8 text-center text-xs text-[#6f8093]">
        Loading workspace summary…
      </div>
    }

    <section class="p-4 border-l-4 border-[#7da9ce] rounded-r-lg bg-[#f0f5fa]">
      <strong class="text-xs font-bold text-[#29435f]">Designed to complement SAP</strong>
      <p class="text-xs text-[#63768b] m-0 mt-1 leading-relaxed">
        SRM owns supplier onboarding, qualification, RFQ sourcing, quotations, evaluation, negotiation, and award approvals. SAP remains the system of record for Vendor Master, Material Master, PR, PO, GRN, Invoice Verification, and MRP.
      </p>
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly accessDeniedNotice = signal(false);

  protected readonly visibleModules = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    const supplierOnly = this.auth.isSupplierOnly();
    return ALL_MODULES.filter((mod) => user.roles.some((r) => mod.roles.includes(r))).map((mod) => ({
      name: supplierOnly && mod.supplierName ? mod.supplierName : mod.name,
      detail: supplierOnly && mod.supplierDetail ? mod.supplierDetail : mod.detail,
      route: mod.route,
      queryParams: supplierOnly && mod.route === '/reports' ? { tab: 'NOTIFICATIONS' } : mod.queryParams,
    }));
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.accessDeniedNotice.set(params.get('denied') === '1');
    });
    this.srm.getDashboardSummary().subscribe({
      next: (res) => this.summary.set(res.data),
      error: () => undefined,
    });
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canAccessSuppliers(): boolean {
    return this.auth.canAccessSuppliers();
  }

  protected canAccessRfqs(): boolean {
    return this.auth.canAccessRfqs();
  }

  protected canAccessQuotations(): boolean {
    return this.auth.canAccessQuotations();
  }

  protected canAccessApprovals(): boolean {
    return this.auth.canAccessApprovals();
  }

  protected canAccessAudit(): boolean {
    return this.auth.canAccessAudit();
  }

  protected canAccessUsers(): boolean {
    return this.auth.canAccessUsers();
  }

  protected currentRolesLabel(): string {
    return (this.auth.getUser()?.roles ?? []).join(', ');
  }

  protected primaryRoleLabel(): string {
    return this.auth.getUser()?.roles[0] ?? 'AUTHENTICATED';
  }
}
