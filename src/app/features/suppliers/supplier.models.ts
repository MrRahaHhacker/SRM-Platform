export type { ApiResponse } from '../../core/auth/auth.models';

export interface SupplierAddress {
  addressLine1: string;
  city: string;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string;
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

export interface SupplierAdditionalContact {
  contactId?: string;
  fullName: string;
  email: string;
  phone: string | null;
  designation: string | null;
}

export interface Supplier {
  supplierId: string;
  supplierNumber: string;
  legalName: string;
  tradeName: string | null;
  supplierCategory?: string | null;
  msmeNumber?: string | null;
  gstin: string | null;
  pan: string | null;
  lifecycleStatus: string;
  contactName: string;
  email: string;
  phone: string | null;
  additionalContacts?: SupplierAdditionalContact[];
  address: SupplierAddress | null;
  sapVendorCode: string | null;
  sapSystemCode: string | null;
  createdAt: string;
  updatedAt?: string;
  statusHistory?: SupplierStatusHistoryItem[];
  reviews?: SupplierReviewItem[];
  sapMappings?: SapVendorMapping[];
}

export interface SupplierRegistration {
  legalName: string;
  tradeName: string;
  supplierCategory?: string;
  msmeNumber?: string;
  gstin: string;
  pan: string;
  contactName: string;
  email: string;
  phone: string;
  additionalContacts?: SupplierAdditionalContact[];
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
}

export interface SupplierLifecycleResult {
  supplierId: string;
  previousStatus: string;
  currentStatus: string;
  action: string;
}

export interface SupplierDocument {
  documentId: string;
  supplierId: string;
  documentType: string;
  originalFilename: string;
  contentType: string;
  versionNumber: number;
  reviewStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  expiryDate: string | null;
  isExpired?: boolean;
  reviewRemarks: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
}
