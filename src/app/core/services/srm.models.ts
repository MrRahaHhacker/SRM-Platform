import type { RoleCode } from '../auth/auth.models';

export interface DashboardSummary {
  metrics: {
    totalSuppliers: number;
    activeSuppliers: number;
    pendingVerification: number;
    openRfqs: number;
    totalRfqs: number;
    quotationsCount: number;
    pendingApprovals: number;
    awardsCount: number;
    sapPirSyncedCount: number;
    failedNotifications: number;
  };
  supplierStatusBreakdown: Record<string, number>;
  recentAudit: AuditEvent[];
}

export interface RfqLine {
  rfqLineId: string;
  lineNumber: number;
  sapMaterialCode: string;
  materialDescription: string;
  quantity: number;
  uom: string;
  targetPrice: number | null;
  plantCode: string | null;
  deliveryDate: string | null;
}

export interface RfqInvitation {
  invitationId: string;
  rfqId: string;
  supplierId: string;
  supplierNumber: string;
  supplierName: string;
  invitationStatus: 'INVITED' | 'ACKNOWLEDGED' | 'DECLINED' | 'SUBMITTED';
  declineReason: string | null;
  invitedAt: string;
  acknowledgedAt: string | null;
}

export interface Rfq {
  rfqId: string;
  rfqNumber: string;
  title: string;
  description: string | null;
  buyerUserId: string;
  buyerName: string;
  projectCode: string | null;
  department: string | null;
  plantCode: string | null;
  purchasingGroup: string | null;
  currencyCode: string;
  submissionDeadline: string;
  requiredDeliveryDate: string | null;
  paymentTerms: string | null;
  incoterms: string | null;
  status: string;
  lines: RfqLine[];
  invitations: RfqInvitation[];
  duplicateWarnings?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuotationLine {
  quotationLineId: string;
  rfqLineId: string;
  sapMaterialCode: string;
  materialDescription: string;
  quantity: number;
  uom: string;
  basicUnitPrice: number;
  discountAmount: number;
  netUnitPrice: number;
  taxAmount: number;
  freightAmount: number;
  packingAmount: number;
  toolingAmount: number;
  insuranceAmount: number;
  otherCharges: number;
  landedLineTotal: number;
}

export interface QuotationVersion {
  quotationVersionId: string;
  quotationId: string;
  versionNumber: number;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  currencyCode: string;
  validityDate: string | null;
  paymentTerms: string | null;
  incoterms: string | null;
  leadTimeDays: number;
  minimumOrderQuantity: number | null;
  warrantyTerms: string | null;
  remarks: string | null;
  totalLandedCost: number;
  versionStatus: string;
  lines: QuotationLine[];
  technicalEvaluation: {
    technicalStatus: string;
    evaluatorName: string;
    remarks: string | null;
    evaluatedAt: string;
  } | null;
  commercialEvaluation: {
    comparisonBasis: string;
    rankNumber: number;
    score: number | null;
    evaluatorName: string;
    remarks: string | null;
    evaluatedAt: string;
  } | null;
}

export interface Quotation {
  quotationId: string;
  rfqId: string;
  supplierId: string;
  supplierNumber: string;
  supplierName: string;
  lifecycleStatus: string;
  computedRank: number | null;
  versions: QuotationVersion[];
  createdAt: string;
}

export interface NegotiationMessage {
  messageId: string;
  negotiationRoundId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  messageType: string;
  proposedTotal: number | null;
  messageText: string;
  createdAt: string;
}

export interface NegotiationRound {
  negotiationRoundId: string;
  rfqId: string;
  supplierId: string;
  supplierName: string;
  roundNumber: number;
  status: 'OPEN' | 'CLOSED';
  baselineAmount: number;
  targetAmount: number | null;
  settledAmount: number | null;
  openedAt: string;
  closedAt: string | null;
  messages: NegotiationMessage[];
}

export interface SupplierRecommendation {
  recommendationId: string;
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  supplierId: string;
  supplierName: string;
  quotationVersionId: string;
  versionNumber: number;
  recommendedBy: string;
  recommendedByName: string;
  recommendedAmount: number;
  l1Amount: number;
  savingsAmount: number;
  currencyCode: string;
  isNonL1: boolean;
  justification: string | null;
  createdAt: string;
}

export interface ApprovalTask {
  approvalTaskId: string;
  approvalRequestId: string;
  stageCode: string;
  sequenceNumber: number;
  assignedUserId: string | null;
  assignedGroup: string | null;
  taskStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  decidedBy: string | null;
  decidedByName: string | null;
  remarks: string | null;
  decidedAt: string | null;
  dueAt: string;
}

export interface ApprovalRequest {
  approvalRequestId: string;
  entityType: string;
  entityId: string;
  workflowCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  requestedBy: string;
  requestedByName: string;
  recommendation: SupplierRecommendation;
  tasks: ApprovalTask[];
  createdAt: string;
}

export interface Award {
  awardId: string;
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  supplierId: string;
  supplierNumber: string;
  supplierName: string;
  sapVendorCode: string | null;
  quotationVersionId: string;
  approvalRequestId: string;
  approvedValue: number;
  currencyCode: string;
  awardStatus: string;
  awardedBy: string;
  awardedByName: string;
  awardedAt: string;
}

export interface SapIntegrationEvent {
  integrationEventId: string;
  supplierId: string;
  supplierNumber: string;
  supplierName: string;
  sapVendorCode: string | null;
  awardId: string;
  rfqNumber: string;
  approvedValue: number;
  currencyCode: string;
  operationType: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  externalReference: string | null;
  sanitizedError: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalOverview {
  approvalRequests: ApprovalRequest[];
  awards: Award[];
  sapIntegrations: SapIntegrationEvent[];
}

export interface AuditEvent {
  auditEventId: string;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string;
  actorType: string;
  effectiveRoles: RoleCode[];
  actionCode: string;
  entityType: string;
  entityId: string | null;
  supplierId: string | null;
  rfqId: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  reason: string | null;
  changedFields: Record<string, unknown> | null;
}

export interface NotificationItem {
  notificationId: string;
  recipientUserId: string;
  recipientEmail: string;
  eventType: string;
  title: string;
  message: string;
  channel: 'IN_APP' | 'EMAIL';
  deliveryStatus: 'QUEUED' | 'SENT' | 'FAILED';
  retryCount: number;
  createdAt: string;
  sentAt: string | null;
}

export interface ManagedUser {
  userId: string;
  email: string;
  fullName: string;
  accountStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  roles: RoleCode[];
  supplierId: string | null;
  supplierName?: string | null;
  supplierNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}
