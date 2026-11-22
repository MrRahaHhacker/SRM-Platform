import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  SapVendorMapping,
  Supplier,
  SupplierDocument,
  SupplierLifecycleResult,
  SupplierRegistration,
} from './supplier.models';

const API_BASE_URL = '/api/v1';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);

  getSuppliers(): Observable<ApiResponse<Supplier[]>> {
    return this.http.get<ApiResponse<Supplier[]>>(`${API_BASE_URL}/suppliers`);
  }

  getSupplier(supplierId: string): Observable<ApiResponse<Supplier>> {
    return this.http.get<ApiResponse<Supplier>>(`${API_BASE_URL}/suppliers/${supplierId}`);
  }

  registerSupplier(payload: SupplierRegistration): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(`${API_BASE_URL}/suppliers`, payload);
  }

  updateSupplier(supplierId: string, payload: Partial<SupplierRegistration>): Observable<ApiResponse<Supplier>> {
    return this.http.patch<ApiResponse<Supplier>>(`${API_BASE_URL}/suppliers/${supplierId}`, payload);
  }

  submitSupplier(supplierId: string): Observable<ApiResponse<SupplierLifecycleResult>> {
    return this.http.post<ApiResponse<SupplierLifecycleResult>>(
      `${API_BASE_URL}/suppliers/${supplierId}/submit`,
      {},
    );
  }

  startSupplierReview(supplierId: string): Observable<ApiResponse<SupplierLifecycleResult>> {
    return this.http.post<ApiResponse<SupplierLifecycleResult>>(
      `${API_BASE_URL}/suppliers/${supplierId}/start-review`,
      {},
    );
  }

  decideSupplier(
    supplierId: string,
    decision: 'APPROVE' | 'RETURN' | 'HOLD' | 'REJECT',
    remarks: string,
  ): Observable<ApiResponse<SupplierLifecycleResult>> {
    return this.http.post<ApiResponse<SupplierLifecycleResult>>(
      `${API_BASE_URL}/suppliers/${supplierId}/decision`,
      { decision, remarks },
    );
  }

  mapSapVendorCode(
    supplierId: string,
    sapSystemCode: string,
    sapVendorCode: string,
  ): Observable<ApiResponse<{ supplier: Supplier; mapping: SapVendorMapping }>> {
    return this.http.post<ApiResponse<{ supplier: Supplier; mapping: SapVendorMapping }>>(
      `${API_BASE_URL}/suppliers/${supplierId}/sap-mapping`,
      { sapSystemCode, sapVendorCode },
    );
  }

  changeSupplierStatus(
    supplierId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason: string,
  ): Observable<ApiResponse<SupplierLifecycleResult>> {
    return this.http.post<ApiResponse<SupplierLifecycleResult>>(
      `${API_BASE_URL}/suppliers/${supplierId}/status`,
      { status, reason },
    );
  }

  getDocuments(supplierId: string): Observable<ApiResponse<SupplierDocument[]>> {
    return this.http.get<ApiResponse<SupplierDocument[]>>(
      `${API_BASE_URL}/suppliers/${supplierId}/documents`,
    );
  }

  uploadDocument(
    supplierId: string,
    documentType: string,
    file: File,
    expiryDate: string,
  ): Observable<ApiResponse<SupplierDocument>> {
    const body = new FormData();
    body.append('documentType', documentType);
    body.append('file', file, file.name);
    if (expiryDate) body.append('expiryDate', expiryDate);
    return this.http.post<ApiResponse<SupplierDocument>>(
      `${API_BASE_URL}/suppliers/${supplierId}/documents`,
      body,
    );
  }

  downloadDocument(supplierId: string, documentId: string): Observable<Blob> {
    return this.http.get(
      `${API_BASE_URL}/suppliers/${supplierId}/documents/${documentId}/content`,
      { responseType: 'blob' },
    );
  }

  reviewDocument(
    supplierId: string,
    documentId: string,
    decision: 'VERIFY' | 'REJECT',
    remarks: string,
  ): Observable<ApiResponse<SupplierDocument>> {
    return this.http.post<ApiResponse<SupplierDocument>>(
      `${API_BASE_URL}/suppliers/${supplierId}/documents/${documentId}/review`,
      { decision, remarks },
    );
  }
}
