export type RoleCode =
  | 'SUPER_ADMIN'
  | 'SRM_ADMIN'
  | 'SUPPLIER_USER'
  | 'SUPPLIER_VERIFIER'
  | 'PROCUREMENT_BUYER'
  | 'PROCUREMENT_APPROVER'
  | 'AUDITOR';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
  supplierId: string | null;
}

export interface LoginResponse extends AuthUser {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface DemoAccountInfo {
  email: string;
  fullName: string;
  roles: RoleCode[];
  supplierNumber?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}
