export type RoleCode =
  | 'SUPER_ADMIN'
  | 'SRM_ADMIN'
  | 'SUPPLIER_USER'
  | 'SUPPLIER_VERIFIER'
  | 'PROCUREMENT_BUYER'
  | 'PROCUREMENT_APPROVER'
  | 'AUDITOR';

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export type SupplierLifecycleStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'ON_HOLD'
  | 'APPROVED'
  | 'PENDING_SAP_MAPPING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'REJECTED';

export type DocumentType =
  | 'GST_CERTIFICATE'
  | 'PAN_CARD'
  | 'ISO_CERTIFICATE'
  | 'BANK_PROOF'
  | 'MSME_CERTIFICATE'
  | 'OTHER';

export type DocumentReviewStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export type RfqStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'INVITATIONS_SENT'
  | 'QUOTATION_OPEN'
  | 'EVALUATION'
  | 'NEGOTIATION'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'AWARDED'
  | 'CLOSED'
  | 'CANCELLED';

export type InvitationStatus = 'INVITED' | 'ACKNOWLEDGED' | 'DECLINED' | 'SUBMITTED';

export type TechnicalStatus =
  | 'PENDING'
  | 'TECH_ACCEPTED'
  | 'TECH_REJECTED'
  | 'CLARIFICATION_REQUIRED'
  | 'CONDITIONALLY_ACCEPTED';

export interface AppUser {
  userId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  accountStatus: AccountStatus;
  roles: RoleCode[];
  supplierId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierAddress {
  addressLine1: string;
  city: string;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string;
}

export interface SapVendorMapping {
  mappingId: string;
  supplierId: string;
  sapSystemCode: string;
  sapVendorCode: string;
  isActive: boolean;
  mappedBy: string;
  mappedByName: string;
  mappedAt: string;
}

export interface SupplierStatusHistoryItem {
  historyId: string;
  supplierId: string;
  oldStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  changedByName: string;
  reason: string | null;
  changedAt: string;
}

export interface SupplierReviewItem {
  reviewId: string;
  supplierId: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewStage: string;
  decision: string;
  remarks: string | null;
  decidedAt: string;
}

export interface SupplierAdditionalContact {
  contactId: string;
  fullName: string;
  email: string;
  phone: string | null;
  designation: string | null;
}

export interface SupplierRecord {
  supplierId: string;
  supplierNumber: string;
  legalName: string;
  tradeName: string | null;
  supplierCategory: string | null;
  msmeNumber: string | null;
  gstin: string | null;
  pan: string | null;
  lifecycleStatus: SupplierLifecycleStatus;
  contactName: string;
  email: string;
  phone: string | null;
  additionalContacts: SupplierAdditionalContact[];
  address: SupplierAddress | null;
  sapVendorCode: string | null;
  sapSystemCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDocumentRecord {
  documentId: string;
  supplierId: string;
  documentType: DocumentType;
  originalFilename: string;
  contentType: string;
  versionNumber: number;
  reviewStatus: DocumentReviewStatus;
  expiryDate: string | null;
  reviewRemarks: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  contentBase64: string;
}

export interface RfqLineRecord {
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

export interface RfqInvitationRecord {
  invitationId: string;
  rfqId: string;
  supplierId: string;
  supplierNumber: string;
  supplierName: string;
  invitationStatus: InvitationStatus;
  declineReason: string | null;
  invitedAt: string;
  acknowledgedAt: string | null;
}

export interface RfqRecord {
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
  status: RfqStatus;
  lines: RfqLineRecord[];
  invitations: RfqInvitationRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface QuotationLineRecord {
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

export interface QuotationVersionRecord {
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
  versionStatus: 'SUBMITTED' | 'REVISED' | 'ACCEPTED' | 'NOT_SELECTED' | 'WITHDRAWN';
  lines: QuotationLineRecord[];
  technicalEvaluation: {
    technicalStatus: TechnicalStatus;
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

export interface QuotationRecord {
  quotationId: string;
  rfqId: string;
  supplierId: string;
  supplierNumber: string;
  supplierName: string;
  lifecycleStatus: 'SUBMITTED' | 'UNDER_EVALUATION' | 'NEGOTIATION_REQUESTED' | 'REVISED' | 'ACCEPTED' | 'NOT_SELECTED';
  versions: QuotationVersionRecord[];
  createdAt: string;
}

export interface NegotiationMessageRecord {
  messageId: string;
  negotiationRoundId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  messageType: 'BUYER_REQUEST' | 'SUPPLIER_RESPONSE' | 'COUNTEROFFER' | 'ROUND_CLOSED';
  proposedTotal: number | null;
  messageText: string;
  createdAt: string;
}

export interface NegotiationRoundRecord {
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
  messages: NegotiationMessageRecord[];
}

export interface SupplierRecommendationRecord {
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

export interface ApprovalTaskRecord {
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

export interface ApprovalRequestRecord {
  approvalRequestId: string;
  entityType: 'RFQ_AWARD';
  entityId: string;
  workflowCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  requestedBy: string;
  requestedByName: string;
  recommendation: SupplierRecommendationRecord;
  tasks: ApprovalTaskRecord[];
  createdAt: string;
}

export interface AwardRecord {
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
  awardStatus: 'APPROVED' | 'AWARDED' | 'CANCELLED';
  awardedBy: string;
  awardedByName: string;
  awardedAt: string;
}

export interface NotificationRecord {
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

export interface AuditEventRecord {
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
  quotationId: string | null;
  approvalRequestId: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  reason: string | null;
  changedFields: Record<string, unknown> | null;
  correlationId: string;
}

export interface SapIntegrationEventRecord {
  integrationEventId: string;
  supplierId: string;
  supplierNumber: string;
  supplierName: string;
  sapVendorCode: string | null;
  awardId: string;
  rfqNumber: string;
  approvedValue: number;
  currencyCode: string;
  operationType: 'PIR_CREATE_OR_UPDATE';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  externalReference: string | null;
  sanitizedError: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}
