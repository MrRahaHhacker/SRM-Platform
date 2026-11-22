import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { SrmService } from '../../core/services/srm.service';
import type { AuditEvent, NotificationItem } from '../../core/services/srm.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reports',
  imports: [ReactiveFormsModule, DatePipe, JsonPipe, RouterLink, MatIconModule],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <span class="text-[10px] font-extrabold tracking-[0.14em] text-[#64748b] uppercase">
          SRM WORKSPACE / GOVERNANCE & AUDIT
        </span>
        <h1 class="text-2xl sm:text-3xl font-bold text-[#142238] tracking-tight mt-1 mb-1">
          Audit Trail & Notifications
        </h1>
        <p class="text-sm text-[#64748b] m-0">
          Append-only compliance audit log explorer and email/in-app notification delivery tracking.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        @if (canAccessAudit()) {
          <button
            type="button"
            (click)="activeTab.set('AUDIT')"
            class="h-9 px-3.5 rounded-lg text-xs font-bold border cursor-pointer"
            [class]="activeTab() === 'AUDIT' ? 'bg-[#183b5d] text-white border-[#183b5d]' : 'bg-white text-[#334155] border-[#dce4ec]'"
          >
            Audit Trail
          </button>
        }
        <button
          type="button"
          (click)="activeTab.set('NOTIFICATIONS')"
          class="h-9 px-3.5 rounded-lg text-xs font-bold border cursor-pointer"
          [class]="activeTab() === 'NOTIFICATIONS' ? 'bg-[#183b5d] text-white border-[#183b5d]' : 'bg-white text-[#334155] border-[#dce4ec]'"
        >
          Notifications ({{ notifications().length }})
        </button>
        @if (canAccessUsers()) {
          <a
            routerLink="/users"
            class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#183b5d] no-underline hover:bg-[#f4f7fa]"
          >
            <mat-icon class="!text-base !w-4 !h-4">manage_accounts</mat-icon>
            <span>{{ isSupplierOnly() ? 'Colleague Users' : 'Users & Roles' }}</span>
          </a>
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

    <!-- TAB 1: AUDIT TRAIL -->
    @if (activeTab() === 'AUDIT' && canAccessAudit()) {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 class="text-base font-bold text-[#142238] m-0">Append-Only Audit Trail</h2>
              <p class="text-xs text-[#64748b] m-0 mt-0.5">Read-only history of security, user IAM, onboarding, sourcing, approval, and SAP events.</p>
            </div>
            @if (canExportAudit()) {
              <button
                type="button"
                (click)="exportCsv()"
                class="h-9 px-3.5 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold text-[#315c80] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <mat-icon class="!text-base !w-4 !h-4">download</mat-icon>
                <span>Export CSV (Audited)</span>
              </button>
            }
          </div>

          <form [formGroup]="auditFilterForm" (ngSubmit)="loadAuditEvents()" class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-4">
            <input
              formControlName="q"
              placeholder="Search actor, action, reason…"
              class="h-9 px-3 border border-[#cbd5e1] rounded-lg text-xs"
            />
            <select formControlName="entityType" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs">
              <option value="">All Entity Types</option>
              <option value="USER">USER</option>
              <option value="SUPPLIER">SUPPLIER</option>
              <option value="SUPPLIER_DOCUMENT">SUPPLIER_DOCUMENT</option>
              <option value="RFQ">RFQ</option>
              <option value="QUOTATION_VERSION">QUOTATION_VERSION</option>
              <option value="APPROVAL_REQUEST">APPROVAL_REQUEST</option>
              <option value="AWARD">AWARD</option>
              <option value="SAP_INTEGRATION">SAP_INTEGRATION</option>
            </select>
            <select formControlName="outcome" class="h-9 px-2.5 border border-[#cbd5e1] rounded-lg bg-white text-xs">
              <option value="">All Outcomes</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="DENIED">DENIED</option>
              <option value="FAILURE">FAILURE</option>
            </select>
            <button type="submit" class="h-9 px-4 rounded-lg bg-[#183b5d] text-white text-xs font-bold cursor-pointer">
              Filter Audit Log
            </button>
          </form>

          <div class="overflow-x-auto border border-[#edf1f5] rounded-xl">
            <table class="w-full border-collapse text-left text-xs">
              <thead>
                <tr class="bg-[#f7f9fb] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                  <th class="py-2.5 px-3">Timestamp (UTC)</th>
                  <th class="py-2.5 px-3">Actor & Role</th>
                  <th class="py-2.5 px-3">Action</th>
                  <th class="py-2.5 px-3">Entity</th>
                  <th class="py-2.5 px-3">Outcome</th>
                  <th class="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#edf1f5]">
                @for (ev of auditEvents(); track ev.auditEventId) {
                  <tr>
                    <td class="py-3 px-3 whitespace-nowrap text-[#475569]">{{ ev.occurredAt | date:'short' }}</td>
                    <td class="py-3 px-3">
                      <div class="font-bold text-[#142238]">{{ ev.actorName }}</div>
                      <div class="text-[10px] text-[#64748b]">{{ ev.actorType }}</div>
                    </td>
                    <td class="py-3 px-3 font-mono text-[11px] font-bold text-[#315c80]">{{ ev.actionCode }}</td>
                    <td class="py-3 px-3 text-[#475569]">{{ ev.entityType }}</td>
                    <td class="py-3 px-3">
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                        [class]="
                          ev.outcome === 'SUCCESS'
                            ? 'bg-[#eaf8f0] text-[#16834e]'
                            : 'bg-[#fff1f0] text-[#a13d36]'
                        "
                      >
                        {{ ev.outcome }}
                      </span>
                    </td>
                    <td class="py-3 px-3 max-w-md">
                      @if (ev.reason) {
                        <div class="text-[#1e293b]">{{ ev.reason }}</div>
                      }
                      @if (ev.changedFields) {
                        <div class="text-[10px] font-mono text-[#64748b] truncate">{{ ev.changedFields | json }}</div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
      </section>
    }

    <!-- TAB 2: NOTIFICATIONS -->
    @if (activeTab() === 'NOTIFICATIONS') {
      <section class="bg-white border border-[#e3eaf1] rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-bold text-[#142238] m-0">Notifications & Delivery Logs</h2>
            <p class="text-xs text-[#64748b] m-0 mt-0.5">In-app and email dispatch status with controlled retry for failed deliveries.</p>
          </div>
          <button type="button" (click)="loadNotifications()" class="h-9 px-3 rounded-lg border border-[#dce4ec] bg-white text-xs font-bold cursor-pointer">
            Refresh
          </button>
        </div>

        @if (notifications().length === 0) {
          <p class="text-xs text-[#64748b] py-6 text-center">No notifications recorded.</p>
        } @else {
          <div class="divide-y divide-[#edf1f5]">
            @for (n of notifications(); track n.notificationId) {
              <div class="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-[#142238]">{{ n.title }}</span>
                    <span class="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569] text-[10px] font-bold">{{ n.channel }}</span>
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                      [class]="n.deliveryStatus === 'SENT' ? 'bg-[#eaf8f0] text-[#16834e]' : 'bg-[#fff1f0] text-[#a13d36]'"
                    >
                      {{ n.deliveryStatus }}
                    </span>
                  </div>
                  <div class="text-[#475569] mt-0.5">{{ n.message }}</div>
                  <div class="text-[10px] text-[#64748b] mt-0.5">
                    To: {{ n.recipientEmail }} · {{ n.createdAt | date:'short' }} · Retries: {{ n.retryCount }}
                  </div>
                </div>
                @if (n.deliveryStatus === 'FAILED' && canRetryNotifications()) {
                  <button
                    type="button"
                    (click)="retryNotification(n.notificationId)"
                    class="h-8 px-3 rounded-lg bg-[#183b5d] text-white text-[11px] font-bold cursor-pointer"
                  >
                    Retry Delivery
                  </button>
                }
              </div>
            }
          </div>
        }
      </section>
    }
  `,
})
export class ReportsComponent implements OnInit {
  private readonly srm = inject(SrmService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly activeTab = signal<'AUDIT' | 'NOTIFICATIONS'>('AUDIT');
  protected readonly auditEvents = signal<AuditEvent[]>([]);
  protected readonly notifications = signal<NotificationItem[]>([]);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly auditFilterForm = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    entityType: new FormControl('', { nonNullable: true }),
    outcome: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (requestedTab === 'NOTIFICATIONS' || !this.canAccessAudit()) {
      this.activeTab.set('NOTIFICATIONS');
    }
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('tab') === 'NOTIFICATIONS' || !this.canAccessAudit()) {
        this.activeTab.set('NOTIFICATIONS');
      } else if (params.get('tab') === 'AUDIT' && this.canAccessAudit()) {
        this.activeTab.set('AUDIT');
      }
    });

    if (this.canAccessAudit()) {
      this.loadAuditEvents();
    }
    this.loadNotifications();
  }

  protected isSupplierOnly(): boolean {
    return this.auth.isSupplierOnly();
  }

  protected canAccessAudit(): boolean {
    return this.auth.canAccessAudit();
  }

  protected canAccessUsers(): boolean {
    return this.auth.canAccessUsers();
  }

  protected canExportAudit(): boolean {
    return this.auth.canExportAudit();
  }

  protected canRetryNotifications(): boolean {
    return this.auth.canRetryNotifications();
  }

  protected loadAuditEvents(): void {
    const raw = this.auditFilterForm.getRawValue();
    this.srm.getAuditEvents(raw).subscribe({
      next: (res) => this.auditEvents.set(res.data ?? []),
      error: (err: HttpErrorResponse) => this.errorMessage.set(err.error?.message ?? 'Unable to load audit trail.'),
    });
  }

  protected exportCsv(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.srm.logAuditExport().subscribe({ error: () => undefined });
    const rows = [
      ['Timestamp', 'Actor', 'ActorType', 'Action', 'EntityType', 'Outcome', 'Reason'],
      ...this.auditEvents().map((e) => [
        e.occurredAt,
        e.actorName,
        e.actorType,
        e.actionCode,
        e.entityType,
        e.outcome,
        (e.reason ?? '').replace(/"/g, '""'),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement('a');
    link.href = url;
    link.download = `srm-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.successMessage.set('Audit trail exported to CSV (export event recorded).');
  }

  protected loadNotifications(): void {
    this.srm.getNotifications().subscribe({
      next: (res) => this.notifications.set(res.data ?? []),
      error: () => undefined,
    });
  }

  protected retryNotification(id: string): void {
    this.srm.retryNotification(id).subscribe({
      next: (res) => {
        this.successMessage.set(res.message);
        this.loadNotifications();
      },
      error: (err: HttpErrorResponse) => this.errorMessage.set(err.error?.message ?? 'Retry failed.'),
    });
  }
}
