import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ApiResponse, RoleCode } from '../auth/auth.models';
import type {
  ApprovalOverview,
  ApprovalRequest,
  AuditEvent,
  Award,
  DashboardSummary,
  ManagedUser,
  NegotiationRound,
  NotificationItem,
  Quotation,
  Rfq,
  SapIntegrationEvent,
} from './srm.models';

const API = '/api/v1';

@Injectable({ providedIn: 'root' })
export class SrmService {
  private readonly http = inject(HttpClient);

  getDashboardSummary(): Observable<ApiResponse<DashboardSummary>> {
    return this.http.get<ApiResponse<DashboardSummary>>(`${API}/dashboard/summary`);
  }

  // RFQs
  getRfqs(): Observable<ApiResponse<Rfq[]>> {
    return this.http.get<ApiResponse<Rfq[]>>(`${API}/rfqs`);
  }

  createRfq(payload: Record<string, unknown>): Observable<ApiResponse<Rfq>> {
    return this.http.post<ApiResponse<Rfq>>(`${API}/rfqs`, payload);
  }

  updateRfqDraft(rfqId: string, payload: Record<string, unknown>): Observable<ApiResponse<Rfq>> {
    return this.http.put<ApiResponse<Rfq>>(`${API}/rfqs/${rfqId}`, payload);
  }

  inviteSuppliers(rfqId: string, supplierIds: string[]): Observable<ApiResponse<Rfq>> {
    return this.http.post<ApiResponse<Rfq>>(`${API}/rfqs/${rfqId}/invite`, { supplierIds });
  }

  publishRfq(rfqId: string): Observable<ApiResponse<Rfq>> {
    return this.http.post<ApiResponse<Rfq>>(`${API}/rfqs/${rfqId}/publish`, {});
  }

  extendRfqDeadline(rfqId: string, submissionDeadline: string, reason: string): Observable<ApiResponse<Rfq>> {
    return this.http.post<ApiResponse<Rfq>>(`${API}/rfqs/${rfqId}/extend-deadline`, {
      submissionDeadline,
      reason,
    });
  }

  closeRfq(rfqId: string, status: 'CLOSED' | 'CANCELLED', reason: string): Observable<ApiResponse<Rfq>> {
    return this.http.post<ApiResponse<Rfq>>(`${API}/rfqs/${rfqId}/close`, { status, reason });
  }

  respondInvitation(rfqId: string, action: 'ACKNOWLEDGE' | 'DECLINE', declineReason = ''): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${API}/rfqs/${rfqId}/invitations/respond`, {
      action,
      declineReason,
    });
  }

  // Quotations & Evaluation
  getQuotations(rfqId: string): Observable<ApiResponse<Quotation[]>> {
    return this.http.get<ApiResponse<Quotation[]>>(`${API}/rfqs/${rfqId}/quotations`);
  }

  submitQuotation(rfqId: string, payload: Record<string, unknown>): Observable<ApiResponse<Quotation>> {
    return this.http.post<ApiResponse<Quotation>>(`${API}/rfqs/${rfqId}/quotations`, payload);
  }

  recordTechnicalEvaluation(
    quotationVersionId: string,
    technicalStatus: string,
    remarks: string,
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${API}/quotations/${quotationVersionId}/technical-evaluation`,
      { technicalStatus, remarks },
    );
  }

  recordCommercialEvaluation(
    quotationVersionId: string,
    rankNumber: number,
    score: number,
    remarks: string,
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${API}/quotations/${quotationVersionId}/commercial-evaluation`,
      { rankNumber, score, remarks },
    );
  }

  withdrawQuotation(quotationVersionId: string, reason: string): Observable<ApiResponse<Quotation>> {
    return this.http.post<ApiResponse<Quotation>>(
      `${API}/quotations/${quotationVersionId}/withdraw`,
      { reason },
    );
  }

  // Negotiations
  getNegotiations(rfqId: string): Observable<ApiResponse<NegotiationRound[]>> {
    return this.http.get<ApiResponse<NegotiationRound[]>>(`${API}/rfqs/${rfqId}/negotiations`);
  }

  openNegotiation(
    rfqId: string,
    supplierId: string,
    targetAmount: number | null,
    messageText: string,
  ): Observable<ApiResponse<NegotiationRound>> {
    return this.http.post<ApiResponse<NegotiationRound>>(`${API}/rfqs/${rfqId}/negotiations`, {
      supplierId,
      targetAmount,
      messageText,
    });
  }

  postNegotiationMessage(
    roundId: string,
    messageText: string,
    proposedTotal: number | null,
    closeRound = false,
  ): Observable<ApiResponse<NegotiationRound>> {
    return this.http.post<ApiResponse<NegotiationRound>>(`${API}/negotiations/${roundId}/messages`, {
      messageText,
      proposedTotal,
      closeRound,
    });
  }

  // Recommendations, Approvals, Awards, SAP PIR
  recommendSupplier(
    rfqId: string,
    quotationVersionId: string,
    justification: string,
  ): Observable<ApiResponse<ApprovalRequest>> {
    return this.http.post<ApiResponse<ApprovalRequest>>(`${API}/rfqs/${rfqId}/recommend`, {
      quotationVersionId,
      justification,
    });
  }

  getApprovalsOverview(): Observable<ApiResponse<ApprovalOverview>> {
    return this.http.get<ApiResponse<ApprovalOverview>>(`${API}/approvals`);
  }

  decideApproval(
    requestId: string,
    taskId: string,
    decision: 'APPROVED' | 'RETURNED' | 'REJECTED',
    remarks: string,
  ): Observable<ApiResponse<ApprovalRequest>> {
    return this.http.post<ApiResponse<ApprovalRequest>>(
      `${API}/approvals/${requestId}/tasks/${taskId}/decide`,
      { decision, remarks },
    );
  }

  recordAward(rfqId: string): Observable<ApiResponse<Award>> {
    return this.http.post<ApiResponse<Award>>(`${API}/rfqs/${rfqId}/award`, {});
  }

  cancelAward(awardId: string, reason: string): Observable<ApiResponse<Award>> {
    return this.http.post<ApiResponse<Award>>(`${API}/awards/${awardId}/cancel`, { reason });
  }

  syncSapPir(awardId: string): Observable<ApiResponse<SapIntegrationEvent>> {
    return this.http.post<ApiResponse<SapIntegrationEvent>>(`${API}/sap-integrations/${awardId}/sync-pir`, {});
  }

  // Audit, Notifications, Admin Users
  getAuditEvents(filters: {
    action?: string;
    outcome?: string;
    entityType?: string;
    q?: string;
  }): Observable<ApiResponse<AuditEvent[]>> {
    let params = new HttpParams();
    if (filters.action) params = params.set('action', filters.action);
    if (filters.outcome) params = params.set('outcome', filters.outcome);
    if (filters.entityType) params = params.set('entityType', filters.entityType);
    if (filters.q) params = params.set('q', filters.q);
    return this.http.get<ApiResponse<AuditEvent[]>>(`${API}/audit-events`, { params });
  }

  logAuditExport(): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${API}/audit-events/export-log`, {});
  }

  getNotifications(): Observable<ApiResponse<NotificationItem[]>> {
    return this.http.get<ApiResponse<NotificationItem[]>>(`${API}/notifications`);
  }

  retryNotification(notificationId: string): Observable<ApiResponse<NotificationItem>> {
    return this.http.post<ApiResponse<NotificationItem>>(`${API}/notifications/${notificationId}/retry`, {});
  }

  getUsers(): Observable<ApiResponse<ManagedUser[]>> {
    return this.http.get<ApiResponse<ManagedUser[]>>(`${API}/admin/users`);
  }

  createUser(payload: {
    email: string;
    fullName: string;
    password: string;
    accountStatus?: 'ACTIVE' | 'PENDING';
    roles: RoleCode[];
    supplierId: string | null;
  }): Observable<ApiResponse<ManagedUser>> {
    return this.http.post<ApiResponse<ManagedUser>>(`${API}/admin/users`, payload);
  }

  updateUser(
    userId: string,
    payload: {
      fullName?: string;
      accountStatus?: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';
      roles?: RoleCode[];
      supplierId?: string | null;
      password?: string;
    },
  ): Observable<ApiResponse<ManagedUser>> {
    return this.http.patch<ApiResponse<ManagedUser>>(`${API}/admin/users/${userId}`, payload);
  }

  updateUserStatus(
    userId: string,
    accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
  ): Observable<ApiResponse<ManagedUser>> {
    return this.updateUser(userId, { accountStatus });
  }
}
