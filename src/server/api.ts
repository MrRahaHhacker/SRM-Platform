import express, { type Router } from 'express';
import {
  apiSuccess,
  authenticate,
  hasAnyRole,
  hashPassword,
  newId,
  optionalAuthenticate,
  requireRoles,
  sendError,
  signJwt,
  verifyPassword,
  type AuthClaims,
  type AuthenticatedRequest,
} from './auth';
import { parseMultipartForm } from './multipart';
import type {
  ApprovalRequestRecord,
  AuditEventRecord,
  DocumentType,
  NegotiationRoundRecord,
  QuotationLineRecord,
  QuotationRecord,
  QuotationVersionRecord,
  RfqLineRecord,
  RfqRecord,
  RoleCode,
  SupplierDocumentRecord,
  SupplierLifecycleStatus,
  SupplierRecord,
  TechnicalStatus,
} from './models';
import { DEMO_USERS_SEED_INFO, getStore } from './store';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DOC_TYPES: DocumentType[] = [
  'GST_CERTIFICATE',
  'PAN_CARD',
  'ISO_CERTIFICATE',
  'BANK_PROOF',
  'MSME_CERTIFICATE',
  'OTHER',
];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const ALL_ROLES: RoleCode[] = [
  'SUPER_ADMIN',
  'SRM_ADMIN',
  'SUPPLIER_USER',
  'SUPPLIER_VERIFIER',
  'PROCUREMENT_BUYER',
  'PROCUREMENT_APPROVER',
  'AUDITOR',
];

function recordAudit(params: {
  auth?: AuthClaims;
  actorType?: string;
  actionCode: string;
  entityType: string;
  entityId?: string | null;
  supplierId?: string | null;
  rfqId?: string | null;
  quotationId?: string | null;
  approvalRequestId?: string | null;
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  reason?: string | null;
  changedFields?: Record<string, unknown> | null;
}) {
  const store = getStore();
  const event: AuditEventRecord = {
    auditEventId: newId(),
    occurredAt: new Date().toISOString(),
    actorUserId: params.auth?.sub ?? null,
    actorName: params.auth?.fullName ?? 'Anonymous / Public',
    actorType: params.actorType ?? params.auth?.roles[0] ?? 'PUBLIC',
    effectiveRoles: params.auth?.roles ?? [],
    actionCode: params.actionCode,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    supplierId: params.supplierId ?? null,
    rfqId: params.rfqId ?? null,
    quotationId: params.quotationId ?? null,
    approvalRequestId: params.approvalRequestId ?? null,
    outcome: params.outcome ?? 'SUCCESS',
    reason: params.reason ?? null,
    changedFields: params.changedFields ?? null,
    correlationId: newId(),
  };
  store.auditEvents.unshift(event);
}

function queueNotification(params: {
  recipientUserId: string;
  recipientEmail: string;
  eventType: string;
  title: string;
  message: string;
  channel?: 'IN_APP' | 'EMAIL';
}) {
  const store = getStore();
  const now = new Date().toISOString();
  store.notifications.unshift({
    notificationId: newId(),
    recipientUserId: params.recipientUserId,
    recipientEmail: params.recipientEmail,
    eventType: params.eventType,
    title: params.title,
    message: params.message,
    channel: params.channel ?? 'IN_APP',
    deliveryStatus: 'SENT',
    retryCount: 0,
    createdAt: now,
    sentAt: now,
  });
}

function notifySupplierUsers(supplierId: string, eventType: string, title: string, message: string) {
  const store = getStore();
  const users = store.users.filter((u) => u.supplierId === supplierId && u.accountStatus === 'ACTIVE');
  for (const user of users) {
    queueNotification({
      recipientUserId: user.userId,
      recipientEmail: user.email,
      eventType,
      title,
      message,
      channel: 'EMAIL',
    });
  }
}

function isSupplierScopedOnly(auth: AuthClaims): boolean {
  return (
    auth.roles.includes('SUPPLIER_USER') &&
    !hasAnyRole(auth, ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR'])
  );
}

function sanitizeDoc(doc: SupplierDocumentRecord) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const isExpired = Boolean(doc.expiryDate && doc.expiryDate < todayIso);
  return {
    documentId: doc.documentId,
    supplierId: doc.supplierId,
    documentType: doc.documentType,
    originalFilename: doc.originalFilename,
    contentType: doc.contentType,
    versionNumber: doc.versionNumber,
    reviewStatus: isExpired && doc.reviewStatus !== 'REJECTED' ? ('EXPIRED' as const) : doc.reviewStatus,
    expiryDate: doc.expiryDate,
    isExpired,
    reviewRemarks: doc.reviewRemarks,
    uploadedAt: doc.uploadedAt,
    reviewedAt: doc.reviewedAt,
  };
}

function parseAdditionalContacts(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const contacts = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const fullName = typeof rec['fullName'] === 'string' ? rec['fullName'].trim() : '';
    const email = typeof rec['email'] === 'string' ? rec['email'].trim() : '';
    const phone = typeof rec['phone'] === 'string' && rec['phone'].trim() ? rec['phone'].trim() : null;
    const designation = typeof rec['designation'] === 'string' && rec['designation'].trim() ? rec['designation'].trim() : null;
    if (!fullName || !email || !EMAIL_REGEX.test(email)) continue;
    contacts.push({
      contactId: typeof rec['contactId'] === 'string' && rec['contactId'].trim() ? rec['contactId'].trim() : newId(),
      fullName,
      email,
      phone,
      designation,
    });
  }
  return contacts;
}

function formatSupplierResponse(s: SupplierRecord) {
  return {
    supplierId: s.supplierId,
    supplierNumber: s.supplierNumber,
    legalName: s.legalName,
    tradeName: s.tradeName,
    supplierCategory: s.supplierCategory,
    msmeNumber: s.msmeNumber,
    gstin: s.gstin,
    pan: s.pan,
    lifecycleStatus: s.lifecycleStatus,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    additionalContacts: s.additionalContacts ?? [],
    address: s.address,
    sapVendorCode: s.sapVendorCode,
    sapSystemCode: s.sapSystemCode,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function createApiRouter(): Router {
  const router = express.Router();
  const jsonParser = express.json({ limit: '2mb' });

  // Health
  router.get('/health', (_req, res) => {
    res.json({
      application: 'SRM ERP API',
      status: 'UP',
      timestamp: new Date().toISOString(),
    });
  });

  // Dev demo accounts metadata (never exposes passwords)
  router.get('/auth/demo-accounts', (_req, res) => {
    res.json(apiSuccess('Development accounts retrieved', DEMO_USERS_SEED_INFO));
  });

  // Login
  router.post('/auth/login', jsonParser, (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      sendError(res, 400, 'Email and password are required', req.originalUrl);
      return;
    }

    const store = getStore();
    const user = store.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.accountStatus !== 'ACTIVE' || !verifyPassword(password, user.passwordHash)) {
      recordAudit({
        actorType: 'ANONYMOUS',
        actionCode: 'AUTH_LOGIN_FAILED',
        entityType: 'USER',
        entityId: user?.userId ?? null,
        outcome: 'FAILURE',
        reason: `Failed login attempt for ${email}`,
      });
      sendError(res, 401, 'Invalid email or password, or account is not active', req.originalUrl);
      return;
    }

    if (user.roles.length === 0) {
      sendError(res, 401, 'No active role assigned to this account', req.originalUrl);
      return;
    }

    const { token, expiresIn } = signJwt({
      sub: user.userId,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      supplierId: user.supplierId,
    });

    recordAudit({
      auth: {
        sub: user.userId,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
        supplierId: user.supplierId,
        iat: 0,
        exp: 0,
      },
      actionCode: 'AUTH_LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.userId,
      supplierId: user.supplierId,
      outcome: 'SUCCESS',
    });

    res.json(
      apiSuccess('Login successful', {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn,
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
        supplierId: user.supplierId,
      }),
    );
  });

  // Logout (audit logged)
  router.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res) => {
    recordAudit({
      auth: req.auth,
      actionCode: 'AUTH_LOGOUT',
      entityType: 'USER',
      entityId: req.auth?.sub ?? null,
      supplierId: req.auth?.supplierId ?? null,
      outcome: 'SUCCESS',
    });
    res.json(apiSuccess('Logged out', null));
  });

  // Dashboard Summary (strictly role-scoped)
  router.get('/dashboard/summary', authenticate, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const store = getStore();
    const supplierOnly = isSupplierScopedOnly(auth);

    const canSeeSuppliers =
      supplierOnly ||
      hasAnyRole(auth, ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'AUDITOR']);
    const canSeeRfqs =
      supplierOnly ||
      hasAnyRole(auth, ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR']);
    const canSeeQuotations =
      supplierOnly ||
      hasAnyRole(auth, ['SUPER_ADMIN', 'SRM_ADMIN', 'SUPPLIER_VERIFIER', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR']);
    const canSeeApprovals = hasAnyRole(auth, [
      'SUPER_ADMIN',
      'SRM_ADMIN',
      'PROCUREMENT_BUYER',
      'PROCUREMENT_APPROVER',
      'AUDITOR',
    ]);
    const canSeeAudit = hasAnyRole(auth, [
      'SUPER_ADMIN',
      'SRM_ADMIN',
      'SUPPLIER_VERIFIER',
      'PROCUREMENT_BUYER',
      'PROCUREMENT_APPROVER',
      'AUDITOR',
    ]);

    const visibleSuppliers = !canSeeSuppliers
      ? []
      : supplierOnly
        ? store.suppliers.filter((s) => s.supplierId === auth.supplierId)
        : store.suppliers;

    const visibleRfqs = !canSeeRfqs
      ? []
      : supplierOnly
        ? store.rfqs.filter(
            (r) => r.status !== 'DRAFT' && r.invitations.some((inv) => inv.supplierId === auth.supplierId),
          )
        : store.rfqs;

    const visibleQuotations = !canSeeQuotations
      ? []
      : supplierOnly
        ? store.quotations.filter((q) => q.supplierId === auth.supplierId)
        : store.quotations;

    const visibleApprovals = canSeeApprovals ? store.approvalRequests : [];

    const statusCounts: Record<string, number> = {};
    for (const s of visibleSuppliers) {
      statusCounts[s.lifecycleStatus] = (statusCounts[s.lifecycleStatus] ?? 0) + 1;
    }

    const recentAudit = canSeeAudit ? store.auditEvents.slice(0, 8) : [];

    const pendingNotifications = store.notifications.filter(
      (n) => (n.recipientUserId === auth.sub || hasAnyRole(auth, ['SRM_ADMIN', 'SUPER_ADMIN'])) && n.deliveryStatus === 'FAILED',
    ).length;

    res.json(
      apiSuccess('Dashboard summary retrieved', {
        metrics: {
          totalSuppliers: visibleSuppliers.length,
          activeSuppliers: visibleSuppliers.filter((s) => s.lifecycleStatus === 'ACTIVE').length,
          pendingVerification: visibleSuppliers.filter((s) =>
            ['SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED'].includes(s.lifecycleStatus),
          ).length,
          openRfqs: visibleRfqs.filter((r) =>
            ['PUBLISHED', 'INVITATIONS_SENT', 'QUOTATION_OPEN', 'EVALUATION', 'NEGOTIATION'].includes(r.status),
          ).length,
          totalRfqs: visibleRfqs.length,
          quotationsCount: visibleQuotations.length,
          pendingApprovals: visibleApprovals.filter((a) => a.status === 'PENDING').length,
          awardsCount: supplierOnly
            ? store.awards.filter((a) => a.supplierId === auth.supplierId && a.awardStatus !== 'CANCELLED').length
            : canSeeApprovals
              ? store.awards.length
              : 0,
          sapPirSyncedCount: canSeeApprovals
            ? store.sapIntegrations.filter((i) => i.status === 'SUCCESS').length
            : 0,
          failedNotifications: pendingNotifications,
        },
        supplierStatusBreakdown: statusCounts,
        recentAudit,
      }),
    );
  });

  // ==================== SUPPLIERS ====================

  // List suppliers (internal onboarding/sourcing/audit roles see all; SUPPLIER_USER sees only own supplier org)
  router.get(
    '/suppliers',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SUPPLIER_VERIFIER', 'SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'SUPPLIER_USER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const store = getStore();
      const list = isSupplierScopedOnly(auth)
        ? store.suppliers.filter((s) => s.supplierId === auth.supplierId)
        : store.suppliers;
      res.json(apiSuccess('Suppliers retrieved successfully', list.map(formatSupplierResponse)));
    },
  );

  // Public supplier self-registration OR authorized internal registration
  router.post('/suppliers', optionalAuthenticate, jsonParser, (req: AuthenticatedRequest, res) => {
    if (req.auth && !hasAnyRole(req.auth, ['PROCUREMENT_BUYER', 'SRM_ADMIN', 'SUPER_ADMIN'])) {
      recordAudit({
        auth: req.auth,
        actionCode: 'SUPPLIER_REGISTER_DENIED',
        entityType: 'SUPPLIER',
        outcome: 'DENIED',
        reason: 'Role is not permitted to register supplier organizations',
      });
      sendError(res, 403, 'Your role is not authorized to register a supplier organization', req.originalUrl);
      return;
    }
    const body = req.body ?? {};
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
    const tradeName = typeof body.tradeName === 'string' && body.tradeName.trim() ? body.tradeName.trim() : null;
    const supplierCategory = typeof body.supplierCategory === 'string' && body.supplierCategory.trim() ? body.supplierCategory.trim() : null;
    const msmeNumber = typeof body.msmeNumber === 'string' && body.msmeNumber.trim() ? body.msmeNumber.trim().toUpperCase() : null;
    const gstin = typeof body.gstin === 'string' && body.gstin.trim() ? body.gstin.trim().toUpperCase() : null;
    const pan = typeof body.pan === 'string' && body.pan.trim() ? body.pan.trim().toUpperCase() : null;
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    const additionalContacts = parseAdditionalContacts(body.additionalContacts);
    const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const stateRegion = typeof body.stateRegion === 'string' && body.stateRegion.trim() ? body.stateRegion.trim() : null;
    const postalCode = typeof body.postalCode === 'string' && body.postalCode.trim() ? body.postalCode.trim() : null;
    const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';

    if (!legalName || legalName.length > 200) {
      sendError(res, 400, 'Legal company name is required (max 200 characters)', req.originalUrl);
      return;
    }
    if (gstin && !GSTIN_REGEX.test(gstin)) {
      sendError(res, 400, 'Enter a valid 15-character GSTIN', req.originalUrl);
      return;
    }
    if (pan && !PAN_REGEX.test(pan)) {
      sendError(res, 400, 'Enter a valid 10-character PAN', req.originalUrl);
      return;
    }
    if (!contactName || contactName.length > 160) {
      sendError(res, 400, 'Primary contact name is required', req.originalUrl);
      return;
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      sendError(res, 400, 'A valid contact email address is required', req.originalUrl);
      return;
    }
    if (addressLine1 && (!city || countryCode.length !== 2)) {
      sendError(res, 400, 'City and 2-letter country code are required when an address is provided', req.originalUrl);
      return;
    }

    const store = getStore();
    const supplierId = newId();
    const supplierNumber = `SUP-${store.supplierSeq++}`;
    const now = new Date().toISOString();

    const record: SupplierRecord = {
      supplierId,
      supplierNumber,
      legalName,
      tradeName,
      supplierCategory,
      msmeNumber,
      gstin,
      pan,
      lifecycleStatus: 'DRAFT',
      contactName,
      email,
      phone,
      additionalContacts,
      address: addressLine1
        ? {
            addressLine1,
            city,
            stateRegion,
            postalCode,
            countryCode,
          }
        : null,
      sapVendorCode: null,
      sapSystemCode: null,
      createdAt: now,
      updatedAt: now,
    };

    store.suppliers.unshift(record);
    store.supplierHistory.unshift({
      historyId: newId(),
      supplierId,
      oldStatus: null,
      newStatus: 'DRAFT',
      changedBy: req.auth?.sub ?? null,
      changedByName: req.auth?.fullName ?? contactName,
      reason: 'Supplier organization registered',
      changedAt: now,
    });

    recordAudit({
      auth: req.auth,
      actorType: req.auth ? req.auth.roles[0] : 'SUPPLIER_SELF_REGISTRATION',
      actionCode: 'SUPPLIER_REGISTERED',
      entityType: 'SUPPLIER',
      entityId: supplierId,
      supplierId,
      outcome: 'SUCCESS',
      changedFields: { supplierNumber, legalName, lifecycleStatus: 'DRAFT' },
    });

    res.status(201).json(apiSuccess('Supplier registered successfully', formatSupplierResponse(record)));
  });

  // Get single supplier + SAP mapping + history + reviews
  router.get(
    '/suppliers/:supplierId',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SUPPLIER_VERIFIER', 'SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'SUPPLIER_USER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      if (isSupplierScopedOnly(auth) && auth.supplierId !== supplierId) {
        recordAudit({
          auth,
          actionCode: 'SUPPLIER_ACCESS_DENIED',
          entityType: 'SUPPLIER',
          entityId: supplierId,
          supplierId,
          outcome: 'DENIED',
          reason: 'Cross-supplier profile access attempted',
        });
        sendError(res, 403, 'You can only access your own supplier organization profile', req.originalUrl);
        return;
      }

      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }

      const statusHistory = store.supplierHistory.filter((h) => h.supplierId === supplierId);
      const reviews = store.supplierReviews.filter((r) => r.supplierId === supplierId);
      const sapMappings = store.supplierMappings.filter((m) => m.supplierId === supplierId);

      res.json(
        apiSuccess('Supplier retrieved successfully', {
          ...formatSupplierResponse(supplier),
          statusHistory,
          reviews,
          sapMappings,
        }),
      );
    },
  );

  // Update supplier profile (permitted only in DRAFT or CORRECTION_REQUIRED for owning supplier or SRM_ADMIN)
  router.patch(
    '/suppliers/:supplierId',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPPLIER_USER'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      if (isSupplierScopedOnly(auth) && auth.supplierId !== supplierId) {
        sendError(res, 403, 'You can only edit your own supplier organization profile', req.originalUrl);
        return;
      }

      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }
      if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(supplier.lifecycleStatus)) {
        sendError(res, 409, 'Profile edits are allowed only in DRAFT or CORRECTION_REQUIRED status', req.originalUrl);
        return;
      }

      const body = req.body ?? {};
      if (typeof body.tradeName === 'string') supplier.tradeName = body.tradeName.trim() || null;
      if (typeof body.supplierCategory === 'string') supplier.supplierCategory = body.supplierCategory.trim() || null;
      if (typeof body.msmeNumber === 'string') supplier.msmeNumber = body.msmeNumber.trim().toUpperCase() || null;
      if (typeof body.contactName === 'string' && body.contactName.trim()) supplier.contactName = body.contactName.trim();
      if (typeof body.email === 'string' && EMAIL_REGEX.test(body.email.trim())) supplier.email = body.email.trim();
      if (typeof body.phone === 'string') supplier.phone = body.phone.trim() || null;
      if (Array.isArray(body.additionalContacts)) {
        supplier.additionalContacts = parseAdditionalContacts(body.additionalContacts);
      }
      if (typeof body.gstin === 'string') {
        const g = body.gstin.trim().toUpperCase();
        if (g && !GSTIN_REGEX.test(g)) {
          sendError(res, 400, 'Enter a valid 15-character GSTIN', req.originalUrl);
          return;
        }
        supplier.gstin = g || null;
      }
      if (typeof body.pan === 'string') {
        const p = body.pan.trim().toUpperCase();
        if (p && !PAN_REGEX.test(p)) {
          sendError(res, 400, 'Enter a valid 10-character PAN', req.originalUrl);
          return;
        }
        supplier.pan = p || null;
      }
      if (typeof body.addressLine1 === 'string' && body.addressLine1.trim()) {
        const city = typeof body.city === 'string' ? body.city.trim() : supplier.address?.city ?? '';
        const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : supplier.address?.countryCode ?? 'IN';
        if (!city || countryCode.length !== 2) {
          sendError(res, 400, 'City and 2-letter country code are required', req.originalUrl);
          return;
        }
        supplier.address = {
          addressLine1: body.addressLine1.trim(),
          city,
          stateRegion: typeof body.stateRegion === 'string' ? body.stateRegion.trim() || null : null,
          postalCode: typeof body.postalCode === 'string' ? body.postalCode.trim() || null : null,
          countryCode,
        };
      }
      supplier.updatedAt = new Date().toISOString();

      recordAudit({
        auth,
        actionCode: 'SUPPLIER_PROFILE_UPDATED',
        entityType: 'SUPPLIER',
        entityId: supplierId,
        supplierId,
        outcome: 'SUCCESS',
      });

      res.json(apiSuccess('Supplier profile updated successfully', formatSupplierResponse(supplier)));
    },
  );

  // Submit supplier for verification
  router.post(
    '/suppliers/:supplierId/submit',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPPLIER_USER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      if (isSupplierScopedOnly(auth) && auth.supplierId !== supplierId) {
        sendError(res, 403, 'You can only submit your own supplier organization', req.originalUrl);
        return;
      }
      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }
      if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(supplier.lifecycleStatus)) {
        sendError(res, 409, 'Only draft or correction-required suppliers can be submitted', req.originalUrl);
        return;
      }

      const oldStatus = supplier.lifecycleStatus;
      supplier.lifecycleStatus = 'SUBMITTED';
      supplier.updatedAt = new Date().toISOString();

      store.supplierHistory.unshift({
        historyId: newId(),
        supplierId,
        oldStatus,
        newStatus: 'SUBMITTED',
        changedBy: auth.sub,
        changedByName: auth.fullName,
        reason: oldStatus === 'CORRECTION_REQUIRED' ? 'Resubmitted after corrections' : 'Submitted for qualification review',
        changedAt: supplier.updatedAt,
      });

      recordAudit({
        auth,
        actionCode: 'SUPPLIER_SUBMITTED',
        entityType: 'SUPPLIER',
        entityId: supplierId,
        supplierId,
        outcome: 'SUCCESS',
        changedFields: { lifecycleStatus: { old: oldStatus, new: 'SUBMITTED' } },
      });

      // Notify verifier
      const verifier = store.users.find((u) => u.roles.includes('SUPPLIER_VERIFIER'));
      if (verifier) {
        queueNotification({
          recipientUserId: verifier.userId,
          recipientEmail: verifier.email,
          eventType: 'SUPPLIER_SUBMITTED',
          title: `Supplier verification pending: ${supplier.supplierNumber}`,
          message: `${supplier.legalName} has been submitted for onboarding qualification review.`,
        });
      }

      res.json(
        apiSuccess('Supplier submitted for verification', {
          supplierId,
          previousStatus: oldStatus,
          currentStatus: 'SUBMITTED',
          action: 'SUPPLIER_SUBMITTED',
        }),
      );
    },
  );

  // Start review
  router.post(
    '/suppliers/:supplierId/start-review',
    authenticate,
    requireRoles('SUPPLIER_VERIFIER', 'SRM_ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }
      if (supplier.lifecycleStatus !== 'SUBMITTED' && supplier.lifecycleStatus !== 'ON_HOLD') {
        sendError(res, 409, 'Only submitted or on-hold suppliers can enter review', req.originalUrl);
        return;
      }

      const oldStatus = supplier.lifecycleStatus;
      supplier.lifecycleStatus = 'UNDER_REVIEW';
      supplier.updatedAt = new Date().toISOString();

      store.supplierHistory.unshift({
        historyId: newId(),
        supplierId,
        oldStatus,
        newStatus: 'UNDER_REVIEW',
        changedBy: auth.sub,
        changedByName: auth.fullName,
        reason: 'Qualification review started',
        changedAt: supplier.updatedAt,
      });

      recordAudit({
        auth,
        actionCode: 'REVIEW_STARTED',
        entityType: 'SUPPLIER',
        entityId: supplierId,
        supplierId,
        outcome: 'SUCCESS',
        changedFields: { lifecycleStatus: { old: oldStatus, new: 'UNDER_REVIEW' } },
      });

      res.json(
        apiSuccess('Supplier review started', {
          supplierId,
          previousStatus: oldStatus,
          currentStatus: 'UNDER_REVIEW',
          action: 'REVIEW_STARTED',
        }),
      );
    },
  );

  // Supplier qualification decision (APPROVE, RETURN, REJECT, HOLD)
  router.post(
    '/suppliers/:supplierId/decision',
    authenticate,
    requireRoles('SUPPLIER_VERIFIER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      if (auth.supplierId && auth.supplierId === supplierId) {
        recordAudit({
          auth,
          actionCode: 'SUPPLIER_DECISION_SOD_DENIED',
          entityType: 'SUPPLIER',
          entityId: supplierId,
          supplierId,
          outcome: 'DENIED',
          reason: 'Segregation of duties: user cannot verify their own linked supplier organization',
        });
        sendError(res, 403, 'Segregation of duties: you cannot approve or reject your own supplier organization', req.originalUrl);
        return;
      }
      const decision = typeof req.body?.decision === 'string' ? req.body.decision.trim().toUpperCase() : '';
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';

      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }
      if (supplier.lifecycleStatus !== 'UNDER_REVIEW') {
        sendError(res, 409, 'Supplier must be under review before a decision', req.originalUrl);
        return;
      }

      let nextStatus: SupplierLifecycleStatus;
      if (decision === 'APPROVE') nextStatus = 'APPROVED';
      else if (decision === 'RETURN') nextStatus = 'CORRECTION_REQUIRED';
      else if (decision === 'REJECT') nextStatus = 'REJECTED';
      else if (decision === 'HOLD') nextStatus = 'ON_HOLD';
      else {
        sendError(res, 400, 'Decision must be APPROVE, RETURN, HOLD, or REJECT', req.originalUrl);
        return;
      }

      if (decision !== 'APPROVE' && !remarks) {
        sendError(res, 400, 'Remarks are required for return, hold, or rejection', req.originalUrl);
        return;
      }

      const oldStatus = supplier.lifecycleStatus;
      const now = new Date().toISOString();
      supplier.lifecycleStatus = nextStatus;
      supplier.updatedAt = now;

      store.supplierReviews.unshift({
        reviewId: newId(),
        supplierId,
        reviewerUserId: auth.sub,
        reviewerName: auth.fullName,
        reviewStage: 'QUALIFICATION',
        decision,
        remarks: remarks || null,
        decidedAt: now,
      });

      store.supplierHistory.unshift({
        historyId: newId(),
        supplierId,
        oldStatus,
        newStatus: nextStatus,
        changedBy: auth.sub,
        changedByName: auth.fullName,
        reason: remarks || `Qualification ${decision.toLowerCase()}`,
        changedAt: now,
      });

      recordAudit({
        auth,
        actionCode: `SUPPLIER_${nextStatus}`,
        entityType: 'SUPPLIER',
        entityId: supplierId,
        supplierId,
        outcome: 'SUCCESS',
        reason: remarks || null,
        changedFields: { lifecycleStatus: { old: oldStatus, new: nextStatus } },
      });

      notifySupplierUsers(
        supplierId,
        `SUPPLIER_${nextStatus}`,
        `Supplier Qualification Update: ${nextStatus}`,
        remarks
          ? `Your supplier profile (${supplier.supplierNumber}) moved to ${nextStatus}. Remarks: ${remarks}`
          : `Your supplier profile (${supplier.supplierNumber}) has been ${nextStatus}.`,
      );

      res.json(
        apiSuccess('Supplier review decision recorded', {
          supplierId,
          previousStatus: oldStatus,
          currentStatus: nextStatus,
          action: `SUPPLIER_${nextStatus}`,
        }),
      );
    },
  );

  // Map existing SAP Vendor Code (never creates SAP Vendor Master)
  router.post(
    '/suppliers/:supplierId/sap-mapping',
    authenticate,
    requireRoles('SRM_ADMIN', 'PROCUREMENT_BUYER'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      const sapSystemCode = typeof req.body?.sapSystemCode === 'string' && req.body.sapSystemCode.trim()
        ? req.body.sapSystemCode.trim().toUpperCase()
        : 'SAP_S4_PROD';
      const sapVendorCode = typeof req.body?.sapVendorCode === 'string'
        ? req.body.sapVendorCode.trim().toUpperCase()
        : '';

      if (!sapVendorCode) {
        sendError(res, 400, 'Existing SAP Vendor Code is required', req.originalUrl);
        return;
      }

      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }
      if (!['APPROVED', 'PENDING_SAP_MAPPING', 'ACTIVE'].includes(supplier.lifecycleStatus)) {
        sendError(res, 409, 'Supplier must be APPROVED before mapping an existing SAP Vendor Code', req.originalUrl);
        return;
      }

      const duplicate = store.supplierMappings.find(
        (m) => m.sapSystemCode === sapSystemCode && m.sapVendorCode === sapVendorCode && m.supplierId !== supplierId,
      );
      if (duplicate) {
        sendError(res, 409, `SAP Vendor Code ${sapVendorCode} is already mapped to another supplier`, req.originalUrl);
        return;
      }

      const oldStatus = supplier.lifecycleStatus;
      const oldCode = supplier.sapVendorCode;
      const now = new Date().toISOString();

      for (const m of store.supplierMappings) {
        if (m.supplierId === supplierId) m.isActive = false;
      }

      const mapping = {
        mappingId: newId(),
        supplierId,
        sapSystemCode,
        sapVendorCode,
        isActive: true,
        mappedBy: auth.sub,
        mappedByName: auth.fullName,
        mappedAt: now,
      };
      store.supplierMappings.unshift(mapping);

      supplier.sapVendorCode = sapVendorCode;
      supplier.sapSystemCode = sapSystemCode;
      supplier.lifecycleStatus = 'ACTIVE';
      supplier.updatedAt = now;

      store.supplierHistory.unshift({
        historyId: newId(),
        supplierId,
        oldStatus,
        newStatus: 'ACTIVE',
        changedBy: auth.sub,
        changedByName: auth.fullName,
        reason: `Mapped existing SAP Vendor Code ${sapVendorCode} (${sapSystemCode})`,
        changedAt: now,
      });

      recordAudit({
        auth,
        actionCode: 'SAP_VENDOR_MAPPED',
        entityType: 'SUPPLIER',
        entityId: supplierId,
        supplierId,
        outcome: 'SUCCESS',
        reason: `Mapped existing SAP Vendor Code ${sapVendorCode}`,
        changedFields: {
          sapVendorCode: { old: oldCode, new: sapVendorCode },
          lifecycleStatus: { old: oldStatus, new: 'ACTIVE' },
        },
      });

      res.json(
        apiSuccess(`SAP Vendor Code ${sapVendorCode} mapped and supplier activated`, {
          supplier: formatSupplierResponse(supplier),
          mapping,
        }),
      );
    },
  );

  // Suspend or reactivate supplier
  router.post(
    '/suppliers/:supplierId/status',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPER_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      const targetStatus = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      if (!['SUSPENDED', 'ACTIVE'].includes(targetStatus)) {
        sendError(res, 400, 'Status must be SUSPENDED or ACTIVE', req.originalUrl);
        return;
      }
      if (!reason) {
        sendError(res, 400, 'Reason is required for supplier status change', req.originalUrl);
        return;
      }

      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }

      const oldStatus = supplier.lifecycleStatus;
      const now = new Date().toISOString();
      supplier.lifecycleStatus = targetStatus as SupplierLifecycleStatus;
      supplier.updatedAt = now;

      store.supplierHistory.unshift({
        historyId: newId(),
        supplierId,
        oldStatus,
        newStatus: targetStatus,
        changedBy: auth.sub,
        changedByName: auth.fullName,
        reason,
        changedAt: now,
      });

      recordAudit({
        auth,
        actionCode: `SUPPLIER_${targetStatus}`,
        entityType: 'SUPPLIER',
        entityId: supplierId,
        supplierId,
        outcome: 'SUCCESS',
        reason,
        changedFields: { lifecycleStatus: { old: oldStatus, new: targetStatus } },
      });

      res.json(
        apiSuccess(`Supplier status changed to ${targetStatus}`, {
          supplierId,
          previousStatus: oldStatus,
          currentStatus: targetStatus,
          action: `SUPPLIER_${targetStatus}`,
        }),
      );
    },
  );

  // ==================== SUPPLIER DOCUMENTS ====================

  router.get(
    '/suppliers/:supplierId/documents',
    authenticate,
    requireRoles('SUPPLIER_VERIFIER', 'SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'SUPPLIER_USER', 'PROCUREMENT_BUYER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      if (isSupplierScopedOnly(auth) && auth.supplierId !== supplierId) {
        sendError(res, 403, 'You can only view documents for your own supplier organization', req.originalUrl);
        return;
      }
      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }

      const docs = store.documents
        .filter((d) => d.supplierId === supplierId)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .map(sanitizeDoc);

      res.json(apiSuccess('Supplier documents retrieved successfully', docs));
    },
  );

  router.post(
    '/suppliers/:supplierId/documents',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPER_ADMIN', 'SUPPLIER_USER'),
    async (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      if (isSupplierScopedOnly(auth) && auth.supplierId !== supplierId) {
        sendError(res, 403, 'You can only upload documents for your own supplier organization', req.originalUrl);
        return;
      }

      const store = getStore();
      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found', req.originalUrl);
        return;
      }

      try {
        const parsed = await parseMultipartForm(req);
        const docType = (parsed.fields['documentType'] || '').trim().toUpperCase() as DocumentType;
        const expiryDate = (parsed.fields['expiryDate'] || '').trim() || null;
        const file = parsed.files['file'];

        if (!ALLOWED_DOC_TYPES.includes(docType)) {
          sendError(res, 400, 'Unsupported document type', req.originalUrl);
          return;
        }
        if (!file || file.buffer.length === 0) {
          sendError(res, 400, 'Document file is required', req.originalUrl);
          return;
        }
        if (file.buffer.length > 10 * 1024 * 1024) {
          sendError(res, 400, 'Document exceeds maximum size of 10 MB', req.originalUrl);
          return;
        }
        if (!ALLOWED_MIME_TYPES.includes(file.contentType)) {
          const ext = file.originalFilename.toLowerCase();
          if (!ext.endsWith('.pdf') && !ext.endsWith('.png') && !ext.endsWith('.jpg') && !ext.endsWith('.jpeg')) {
            sendError(res, 400, 'Only PDF, PNG, and JPEG files are supported', req.originalUrl);
            return;
          }
        }

        const existingVersions = store.documents.filter(
          (d) => d.supplierId === supplierId && d.documentType === docType,
        );
        const nextVersion = existingVersions.reduce((max, d) => Math.max(max, d.versionNumber), 0) + 1;

        const cleanName = file.originalFilename.replace(/[^A-Za-z0-9._ -]/g, '_').slice(-255) || 'supplier-document';
        const doc: SupplierDocumentRecord = {
          documentId: newId(),
          supplierId,
          documentType: docType,
          originalFilename: cleanName,
          contentType: file.contentType,
          versionNumber: nextVersion,
          reviewStatus: 'PENDING',
          expiryDate,
          reviewRemarks: null,
          uploadedBy: auth.sub,
          uploadedAt: new Date().toISOString(),
          reviewedBy: null,
          reviewedAt: null,
          contentBase64: file.buffer.toString('base64'),
        };

        store.documents.unshift(doc);

        recordAudit({
          auth,
          actionCode: 'SUPPLIER_DOCUMENT_UPLOADED',
          entityType: 'SUPPLIER_DOCUMENT',
          entityId: doc.documentId,
          supplierId,
          outcome: 'SUCCESS',
          changedFields: { documentType: docType, versionNumber: nextVersion },
        });

        res.status(201).json(apiSuccess('Supplier document uploaded for verification', sanitizeDoc(doc)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to process uploaded file';
        sendError(res, 400, msg, req.originalUrl);
      }
    },
  );

  router.get(
    '/suppliers/:supplierId/documents/:documentId/content',
    authenticate,
    requireRoles('SUPPLIER_VERIFIER', 'SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'SUPPLIER_USER', 'PROCUREMENT_BUYER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      const documentId = String(req.params['documentId']);
      if (isSupplierScopedOnly(auth) && auth.supplierId !== supplierId) {
        sendError(res, 403, 'Access denied', req.originalUrl);
        return;
      }

      const store = getStore();
      const doc = store.documents.find((d) => d.supplierId === supplierId && d.documentId === documentId);
      if (!doc) {
        sendError(res, 404, 'Supplier document not found', req.originalUrl);
        return;
      }

      const buffer = Buffer.from(doc.contentBase64, 'base64');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename.replace(/"/g, '')}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(buffer);
    },
  );

  router.post(
    '/suppliers/:supplierId/documents/:documentId/review',
    authenticate,
    requireRoles('SUPPLIER_VERIFIER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierId = String(req.params['supplierId']);
      const documentId = String(req.params['documentId']);
      const decision = typeof req.body?.decision === 'string' ? req.body.decision.trim().toUpperCase() : '';
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';

      if (!['VERIFY', 'REJECT'].includes(decision)) {
        sendError(res, 400, 'Decision must be VERIFY or REJECT', req.originalUrl);
        return;
      }
      if (decision === 'REJECT' && !remarks) {
        sendError(res, 400, 'Remarks are required when rejecting a document', req.originalUrl);
        return;
      }

      const store = getStore();
      const doc = store.documents.find(
        (d) => d.supplierId === supplierId && d.documentId === documentId && d.reviewStatus === 'PENDING',
      );
      if (!doc) {
        sendError(res, 404, 'Pending supplier document not found', req.originalUrl);
        return;
      }

      const nextStatus = decision === 'VERIFY' ? 'VERIFIED' : 'REJECTED';
      doc.reviewStatus = nextStatus;
      doc.reviewedBy = auth.sub;
      doc.reviewedAt = new Date().toISOString();
      doc.reviewRemarks = remarks || null;

      recordAudit({
        auth,
        actionCode: `SUPPLIER_DOCUMENT_${nextStatus}`,
        entityType: 'SUPPLIER_DOCUMENT',
        entityId: documentId,
        supplierId,
        outcome: 'SUCCESS',
        reason: remarks || null,
        changedFields: { reviewStatus: nextStatus },
      });

      res.json(apiSuccess('Supplier document review recorded', sanitizeDoc(doc)));
    },
  );

  // ==================== RFQS & INVITATIONS ====================

  router.get(
    '/rfqs',
    authenticate,
    requireRoles(
      'PROCUREMENT_BUYER',
      'PROCUREMENT_APPROVER',
      'SUPPLIER_VERIFIER',
      'SRM_ADMIN',
      'SUPER_ADMIN',
      'AUDITOR',
      'SUPPLIER_USER',
    ),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const store = getStore();
      const supplierOnly = isSupplierScopedOnly(auth);
      const verifierOnly =
        auth.roles.includes('SUPPLIER_VERIFIER') &&
        !hasAnyRole(auth, ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR']);

      let list = store.rfqs;
      if (supplierOnly) {
        list = store.rfqs
          .filter((r) => r.status !== 'DRAFT' && r.invitations.some((inv) => inv.supplierId === auth.supplierId))
          .map((r) => ({
            ...r,
            // Supplier isolation: only expose own invitation, hide competitor identities!
            invitations: r.invitations.filter((inv) => inv.supplierId === auth.supplierId),
          }));
      } else if (verifierOnly) {
        list = store.rfqs
          .filter((r) => r.status !== 'DRAFT')
          .map((r) => ({
            ...r,
            invitations: [],
          }));
      }
      res.json(apiSuccess('RFQs retrieved successfully', list));
    },
  );

  router.get(
    '/rfqs/:rfqId',
    authenticate,
    requireRoles(
      'PROCUREMENT_BUYER',
      'PROCUREMENT_APPROVER',
      'SUPPLIER_VERIFIER',
      'SRM_ADMIN',
      'SUPER_ADMIN',
      'AUDITOR',
      'SUPPLIER_USER',
    ),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (isSupplierScopedOnly(auth)) {
        const ownInv = rfq.invitations.filter((inv) => inv.supplierId === auth.supplierId);
        if (rfq.status === 'DRAFT' || ownInv.length === 0) {
          recordAudit({
            auth,
            actionCode: 'RFQ_ACCESS_DENIED',
            entityType: 'RFQ',
            entityId: rfqId,
            rfqId,
            outcome: 'DENIED',
            reason: rfq.status === 'DRAFT' ? 'Supplier attempted to access unpublished draft RFQ' : 'Supplier attempted to access an uninvited RFQ',
          });
          sendError(res, 403, 'You are not invited to this RFQ', req.originalUrl);
          return;
        }
        res.json(apiSuccess('RFQ retrieved successfully', { ...rfq, invitations: ownInv }));
        return;
      }
      const verifierOnly =
        auth.roles.includes('SUPPLIER_VERIFIER') &&
        !hasAnyRole(auth, ['SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'AUDITOR']);
      if (verifierOnly && rfq.status === 'DRAFT') {
        sendError(res, 403, 'Draft RFQs are not accessible to supplier verifiers', req.originalUrl);
        return;
      }
      res.json(apiSuccess('RFQ retrieved successfully', verifierOnly ? { ...rfq, invitations: [] } : rfq));
    },
  );

  router.post(
    '/rfqs',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const body = req.body ?? {};
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
      const currencyCode = typeof body.currencyCode === 'string' ? body.currencyCode.trim().toUpperCase() : 'INR';
      const submissionDeadline = typeof body.submissionDeadline === 'string' ? body.submissionDeadline : '';
      const rawLines = Array.isArray(body.lines) ? body.lines : [];

      if (!title) {
        sendError(res, 400, 'RFQ title is required', req.originalUrl);
        return;
      }
      const deadlineDate = new Date(submissionDeadline);
      if (!submissionDeadline || Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
        sendError(res, 400, 'Submission deadline must be a valid future date and time', req.originalUrl);
        return;
      }
      if (rawLines.length === 0) {
        sendError(res, 400, 'At least one RFQ line with an SAP Material Code is required', req.originalUrl);
        return;
      }

      const lines: RfqLineRecord[] = [];
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const sapMaterialCode = typeof line?.sapMaterialCode === 'string' ? line.sapMaterialCode.trim().toUpperCase() : '';
        const materialDescription = typeof line?.materialDescription === 'string' ? line.materialDescription.trim() : '';
        const quantity = Number(line?.quantity);
        const uom = typeof line?.uom === 'string' ? line.uom.trim().toUpperCase() : 'NOS';
        const targetPrice = line?.targetPrice !== undefined && line?.targetPrice !== null && line?.targetPrice !== ''
          ? Number(line.targetPrice)
          : null;

        if (!sapMaterialCode || !materialDescription || !Number.isFinite(quantity) || quantity <= 0 || !uom) {
          sendError(res, 400, `Line ${i + 1}: SAP Material Code, description, positive quantity, and UOM are required`, req.originalUrl);
          return;
        }
        lines.push({
          rfqLineId: newId(),
          lineNumber: i + 1,
          sapMaterialCode,
          materialDescription,
          quantity,
          uom,
          targetPrice,
          plantCode: typeof line?.plantCode === 'string' && line.plantCode.trim() ? line.plantCode.trim().toUpperCase() : null,
          deliveryDate: typeof line?.deliveryDate === 'string' && line.deliveryDate.trim() ? line.deliveryDate.trim() : null,
        });
      }

      const store = getStore();
      const openStatuses = ['DRAFT', 'PUBLISHED', 'INVITATIONS_SENT', 'QUOTATION_OPEN', 'EVALUATION', 'NEGOTIATION', 'APPROVAL_PENDING'];
      const duplicateWarnings: string[] = [];
      for (const line of lines) {
        const matchingRfqs = store.rfqs
          .filter((r) => openStatuses.includes(r.status) && r.lines.some((rl) => rl.sapMaterialCode === line.sapMaterialCode))
          .map((r) => r.rfqNumber);
        if (matchingRfqs.length > 0) {
          duplicateWarnings.push(
            `Material ${line.sapMaterialCode} already appears in active RFQ(s): ${matchingRfqs.join(', ')}`,
          );
        }
      }

      const now = new Date().toISOString();
      const rfqId = newId();
      const rfqNumber = `RFQ-2026-${String(store.rfqSeq++).padStart(4, '0')}`;

      const rfq: RfqRecord = {
        rfqId,
        rfqNumber,
        title,
        description,
        buyerUserId: auth.sub,
        buyerName: auth.fullName,
        projectCode: typeof body.projectCode === 'string' && body.projectCode.trim() ? body.projectCode.trim() : null,
        department: typeof body.department === 'string' && body.department.trim() ? body.department.trim() : null,
        plantCode: typeof body.plantCode === 'string' && body.plantCode.trim() ? body.plantCode.trim().toUpperCase() : null,
        purchasingGroup: typeof body.purchasingGroup === 'string' && body.purchasingGroup.trim() ? body.purchasingGroup.trim().toUpperCase() : null,
        currencyCode: currencyCode.slice(0, 3) || 'INR',
        submissionDeadline: deadlineDate.toISOString(),
        requiredDeliveryDate: typeof body.requiredDeliveryDate === 'string' && body.requiredDeliveryDate.trim() ? body.requiredDeliveryDate.trim() : null,
        paymentTerms: typeof body.paymentTerms === 'string' && body.paymentTerms.trim() ? body.paymentTerms.trim() : null,
        incoterms: typeof body.incoterms === 'string' && body.incoterms.trim() ? body.incoterms.trim() : null,
        status: 'DRAFT',
        lines,
        invitations: [],
        createdAt: now,
        updatedAt: now,
      };

      store.rfqs.unshift(rfq);

      recordAudit({
        auth,
        actionCode: 'RFQ_CREATED',
        entityType: 'RFQ',
        entityId: rfqId,
        rfqId,
        outcome: 'SUCCESS',
        changedFields: { rfqNumber, lineCount: lines.length, duplicateWarnings },
      });

      res.status(201).json(
        apiSuccess(`RFQ ${rfqNumber} created in DRAFT status`, {
          ...rfq,
          duplicateWarnings,
        }),
      );
    },
  );

  // Edit DRAFT RFQ
  router.put(
    '/rfqs/:rfqId',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (rfq.status !== 'DRAFT') {
        sendError(res, 409, 'Only DRAFT RFQs can be edited before publishing', req.originalUrl);
        return;
      }

      const body = req.body ?? {};
      const title = typeof body.title === 'string' ? body.title.trim() : rfq.title;
      const description = typeof body.description === 'string' ? (body.description.trim() || null) : rfq.description;
      const currencyCode = typeof body.currencyCode === 'string' ? body.currencyCode.trim().toUpperCase() : rfq.currencyCode;
      const submissionDeadline = typeof body.submissionDeadline === 'string' ? body.submissionDeadline : rfq.submissionDeadline;
      const rawLines = Array.isArray(body.lines) ? body.lines : null;

      if (!title) {
        sendError(res, 400, 'RFQ title is required', req.originalUrl);
        return;
      }
      const deadlineDate = new Date(submissionDeadline);
      if (!submissionDeadline || Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
        sendError(res, 400, 'Submission deadline must be a valid future date and time', req.originalUrl);
        return;
      }

      if (rawLines) {
        if (rawLines.length === 0) {
          sendError(res, 400, 'At least one RFQ line is required', req.originalUrl);
          return;
        }
        const updatedLines: RfqLineRecord[] = [];
        for (let i = 0; i < rawLines.length; i++) {
          const line = rawLines[i];
          const sapMaterialCode = typeof line?.sapMaterialCode === 'string' ? line.sapMaterialCode.trim().toUpperCase() : '';
          const materialDescription = typeof line?.materialDescription === 'string' ? line.materialDescription.trim() : '';
          const quantity = Number(line?.quantity);
          const uom = typeof line?.uom === 'string' ? line.uom.trim().toUpperCase() : 'NOS';
          const targetPrice = line?.targetPrice !== undefined && line?.targetPrice !== null && line?.targetPrice !== ''
            ? Number(line.targetPrice)
            : null;
          if (!sapMaterialCode || !materialDescription || !Number.isFinite(quantity) || quantity <= 0 || !uom) {
            sendError(res, 400, `Line ${i + 1}: SAP Material Code, description, positive quantity, and UOM are required`, req.originalUrl);
            return;
          }
          updatedLines.push({
            rfqLineId: typeof line?.rfqLineId === 'string' && line.rfqLineId ? line.rfqLineId : newId(),
            lineNumber: i + 1,
            sapMaterialCode,
            materialDescription,
            quantity,
            uom,
            targetPrice,
            plantCode: typeof line?.plantCode === 'string' && line.plantCode.trim() ? line.plantCode.trim().toUpperCase() : null,
            deliveryDate: typeof line?.deliveryDate === 'string' && line.deliveryDate.trim() ? line.deliveryDate.trim() : null,
          });
        }
        rfq.lines = updatedLines;
      }

      rfq.title = title;
      rfq.description = description;
      rfq.currencyCode = currencyCode.slice(0, 3) || 'INR';
      rfq.submissionDeadline = deadlineDate.toISOString();
      if (typeof body.projectCode === 'string') rfq.projectCode = body.projectCode.trim() || null;
      if (typeof body.plantCode === 'string') rfq.plantCode = body.plantCode.trim().toUpperCase() || null;
      if (typeof body.purchasingGroup === 'string') rfq.purchasingGroup = body.purchasingGroup.trim().toUpperCase() || null;
      if (typeof body.paymentTerms === 'string') rfq.paymentTerms = body.paymentTerms.trim() || null;
      if (typeof body.incoterms === 'string') rfq.incoterms = body.incoterms.trim() || null;
      rfq.updatedAt = new Date().toISOString();

      recordAudit({
        auth,
        actionCode: 'RFQ_UPDATED',
        entityType: 'RFQ',
        entityId: rfqId,
        rfqId,
        outcome: 'SUCCESS',
        changedFields: { rfqNumber: rfq.rfqNumber, lineCount: rfq.lines.length },
      });

      res.json(apiSuccess(`Draft RFQ ${rfq.rfqNumber} updated`, rfq));
    },
  );

  // Invite qualified suppliers (BR-001)
  router.post(
    '/rfqs/:rfqId/invite',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const supplierIds: string[] = Array.isArray(req.body?.supplierIds) ? req.body.supplierIds : [];

      if (supplierIds.length === 0) {
        sendError(res, 400, 'Select at least one qualified supplier to invite', req.originalUrl);
        return;
      }

      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
        sendError(res, 409, 'Cannot invite suppliers to a closed, awarded, or cancelled RFQ', req.originalUrl);
        return;
      }

      const added: string[] = [];
      for (const sid of supplierIds) {
        const supplier = store.suppliers.find((s) => s.supplierId === sid);
        if (!supplier) {
          sendError(res, 404, `Supplier ${sid} not found`, req.originalUrl);
          return;
        }
        if (!['APPROVED', 'ACTIVE'].includes(supplier.lifecycleStatus)) {
          sendError(
            res,
            409,
            `Supplier ${supplier.legalName} (${supplier.lifecycleStatus}) is not qualified/active for RFQ invitations`,
            req.originalUrl,
          );
          return;
        }
        if (rfq.invitations.some((inv) => inv.supplierId === sid)) {
          continue; // skip duplicates gracefully
        }

        rfq.invitations.push({
          invitationId: newId(),
          rfqId,
          supplierId: sid,
          supplierNumber: supplier.supplierNumber,
          supplierName: supplier.legalName,
          invitationStatus: 'INVITED',
          declineReason: null,
          invitedAt: new Date().toISOString(),
          acknowledgedAt: null,
        });
        added.push(supplier.supplierNumber);

        notifySupplierUsers(
          sid,
          'RFQ_INVITATION_SENT',
          `New RFQ Invitation: ${rfq.rfqNumber}`,
          `You are invited to quote on "${rfq.title}". Deadline: ${rfq.submissionDeadline.slice(0, 10)}.`,
        );
      }

      rfq.updatedAt = new Date().toISOString();

      recordAudit({
        auth,
        actionCode: 'RFQ_SUPPLIERS_INVITED',
        entityType: 'RFQ',
        entityId: rfqId,
        rfqId,
        outcome: 'SUCCESS',
        changedFields: { invitedSuppliers: added },
      });

      res.json(apiSuccess(`Invited ${added.length} supplier(s) to ${rfq.rfqNumber}`, rfq));
    },
  );

  // Publish RFQ & open quotations
  router.post(
    '/rfqs/:rfqId/publish',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (rfq.status !== 'DRAFT') {
        sendError(res, 409, 'Only DRAFT RFQs can be published', req.originalUrl);
        return;
      }
      if (rfq.lines.length === 0) {
        sendError(res, 400, 'Add at least one RFQ line before publishing', req.originalUrl);
        return;
      }
      if (rfq.invitations.length === 0) {
        sendError(res, 400, 'Invite at least one qualified supplier before publishing', req.originalUrl);
        return;
      }

      rfq.status = 'QUOTATION_OPEN';
      rfq.updatedAt = new Date().toISOString();

      recordAudit({
        auth,
        actionCode: 'RFQ_PUBLISHED',
        entityType: 'RFQ',
        entityId: rfqId,
        rfqId,
        outcome: 'SUCCESS',
        changedFields: { status: { old: 'DRAFT', new: 'QUOTATION_OPEN' } },
      });

      res.json(apiSuccess(`${rfq.rfqNumber} published and open for supplier quotations`, rfq));
    },
  );

  // Extend RFQ deadline
  router.post(
    '/rfqs/:rfqId/extend-deadline',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const newDeadline = typeof req.body?.submissionDeadline === 'string' ? req.body.submissionDeadline : '';
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      const parsed = new Date(newDeadline);
      if (!newDeadline || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        sendError(res, 400, 'New deadline must be a valid future date and time', req.originalUrl);
        return;
      }
      if (!reason) {
        sendError(res, 400, 'Reason is required to extend an RFQ deadline', req.originalUrl);
        return;
      }

      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
        sendError(res, 409, 'Cannot extend deadline on finalized RFQ', req.originalUrl);
        return;
      }

      const oldDeadline = rfq.submissionDeadline;
      rfq.submissionDeadline = parsed.toISOString();
      rfq.updatedAt = new Date().toISOString();

      for (const inv of rfq.invitations) {
        notifySupplierUsers(
          inv.supplierId,
          'RFQ_DEADLINE_EXTENDED',
          `Deadline extended: ${rfq.rfqNumber}`,
          `Submission deadline for ${rfq.title} extended to ${rfq.submissionDeadline.slice(0, 16)}. Reason: ${reason}`,
        );
      }

      recordAudit({
        auth,
        actionCode: 'RFQ_DEADLINE_EXTENDED',
        entityType: 'RFQ',
        entityId: rfqId,
        rfqId,
        outcome: 'SUCCESS',
        reason,
        changedFields: { submissionDeadline: { old: oldDeadline, new: rfq.submissionDeadline } },
      });

      res.json(apiSuccess('RFQ submission deadline extended', rfq));
    },
  );

  // Close or cancel RFQ
  router.post(
    '/rfqs/:rfqId/close',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const targetStatus = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : 'CLOSED';
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      if (!['CLOSED', 'CANCELLED'].includes(targetStatus)) {
        sendError(res, 400, 'Target status must be CLOSED or CANCELLED', req.originalUrl);
        return;
      }
      if (!reason) {
        sendError(res, 400, 'Reason is required to close or cancel an RFQ', req.originalUrl);
        return;
      }

      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (rfq.status === 'AWARDED') {
        sendError(res, 409, 'Cannot cancel or close an already awarded RFQ', req.originalUrl);
        return;
      }

      const oldStatus = rfq.status;
      rfq.status = targetStatus as 'CLOSED' | 'CANCELLED';
      rfq.updatedAt = new Date().toISOString();

      recordAudit({
        auth,
        actionCode: `RFQ_${targetStatus}`,
        entityType: 'RFQ',
        entityId: rfqId,
        rfqId,
        outcome: 'SUCCESS',
        reason,
        changedFields: { status: { old: oldStatus, new: targetStatus } },
      });

      res.json(apiSuccess(`RFQ ${rfq.rfqNumber} marked as ${targetStatus}`, rfq));
    },
  );

  // Supplier acknowledges or declines RFQ invitation
  router.post(
    '/rfqs/:rfqId/invitations/respond',
    authenticate,
    requireRoles('SUPPLIER_USER'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const action = typeof req.body?.action === 'string' ? req.body.action.trim().toUpperCase() : '';
      const declineReason = typeof req.body?.declineReason === 'string' ? req.body.declineReason.trim() : '';

      if (!['ACKNOWLEDGE', 'DECLINE'].includes(action)) {
        sendError(res, 400, 'Action must be ACKNOWLEDGE or DECLINE', req.originalUrl);
        return;
      }
      if (action === 'DECLINE' && !declineReason) {
        sendError(res, 400, 'Decline reason is required when declining an RFQ invitation', req.originalUrl);
        return;
      }

      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      const inv = rfq.invitations.find((i) => i.supplierId === auth.supplierId);
      if (!inv) {
        sendError(res, 403, 'Your supplier organization is not invited to this RFQ', req.originalUrl);
        return;
      }

      inv.invitationStatus = action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGED' : 'DECLINED';
      inv.declineReason = action === 'DECLINE' ? declineReason : null;
      inv.acknowledgedAt = new Date().toISOString();

      recordAudit({
        auth,
        actionCode: `RFQ_INVITATION_${inv.invitationStatus}`,
        entityType: 'RFQ_INVITATION',
        entityId: inv.invitationId,
        supplierId: auth.supplierId,
        rfqId,
        outcome: 'SUCCESS',
        reason: declineReason || null,
      });

      res.json(apiSuccess(`Invitation ${inv.invitationStatus.toLowerCase()}`, inv));
    },
  );

  // ==================== QUOTATIONS, EVALUATION & NEGOTIATION ====================

  router.get(
    '/rfqs/:rfqId/quotations',
    authenticate,
    requireRoles(
      'PROCUREMENT_BUYER',
      'PROCUREMENT_APPROVER',
      'SUPPLIER_VERIFIER',
      'SRM_ADMIN',
      'SUPER_ADMIN',
      'AUDITOR',
      'SUPPLIER_USER',
    ),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }

      if (isSupplierScopedOnly(auth)) {
        const isInvited = rfq.invitations.some((inv) => inv.supplierId === auth.supplierId);
        if (rfq.status === 'DRAFT' || !isInvited) {
          recordAudit({
            auth,
            actionCode: 'QUOTATIONS_ACCESS_DENIED',
            entityType: 'RFQ',
            entityId: rfqId,
            rfqId,
            outcome: 'DENIED',
            reason: 'Uninvited supplier attempted to view quotations',
          });
          sendError(res, 403, 'You are not invited to view quotations for this RFQ', req.originalUrl);
          return;
        }
      }

      // BR-003: Suppliers may ONLY see their own quotations; never competitor identities or pricing
      const list = isSupplierScopedOnly(auth)
        ? store.quotations.filter((q) => q.rfqId === rfqId && q.supplierId === auth.supplierId)
        : store.quotations.filter((q) => q.rfqId === rfqId);

      // Compute L1/L2/L3 ranks for internal comparison view based on latest non-withdrawn version totalLandedCost
      const latestTotals = list
        .map((q) => {
          const activeVersions = q.versions.filter((v) => v.versionStatus !== 'WITHDRAWN');
          const latest = activeVersions[activeVersions.length - 1];
          return {
            quotationId: q.quotationId,
            supplierId: q.supplierId,
            total: latest?.totalLandedCost ?? Number.MAX_SAFE_INTEGER,
            hasActive: Boolean(latest),
          };
        })
        .filter((x) => x.hasActive)
        .sort((a, b) => a.total - b.total);

      const enriched = list.map((q) => {
        const rankIndex = latestTotals.findIndex((item) => item.quotationId === q.quotationId);
        return {
          ...q,
          computedRank: isSupplierScopedOnly(auth) ? null : rankIndex >= 0 ? rankIndex + 1 : null,
        };
      });

      res.json(apiSuccess('Quotations retrieved successfully', enriched));
    },
  );

  // Submit quotation or revised quotation version (BR-004, BR-005: never overwrites prior versions)
  router.post(
    '/rfqs/:rfqId/quotations',
    authenticate,
    requireRoles('SUPPLIER_USER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }

      if (['DRAFT', 'AWARDED', 'CLOSED', 'CANCELLED', 'APPROVED'].includes(rfq.status)) {
        sendError(res, 409, `Quotations cannot be submitted when RFQ is in ${rfq.status} status`, req.originalUrl);
        return;
      }

      if (new Date(rfq.submissionDeadline).getTime() < Date.now() && rfq.status !== 'NEGOTIATION') {
        sendError(res, 409, 'RFQ submission deadline has passed; request a deadline extension from the buyer', req.originalUrl);
        return;
      }

      const supplierId = isSupplierScopedOnly(auth)
        ? auth.supplierId
        : (typeof req.body?.supplierId === 'string' ? req.body.supplierId : auth.supplierId);

      if (!supplierId) {
        sendError(res, 400, 'Supplier organization context is required', req.originalUrl);
        return;
      }

      const invitation = rfq.invitations.find((inv) => inv.supplierId === supplierId);
      if (!invitation || invitation.invitationStatus === 'DECLINED') {
        sendError(res, 403, 'Only invited suppliers who have not declined can submit quotations', req.originalUrl);
        return;
      }

      const supplier = store.suppliers.find((s) => s.supplierId === supplierId);
      if (!supplier) {
        sendError(res, 404, 'Supplier organization not found', req.originalUrl);
        return;
      }
      if (!['APPROVED', 'ACTIVE'].includes(supplier.lifecycleStatus)) {
        sendError(
          res,
          409,
          `Supplier organization (${supplier.lifecycleStatus}) must be APPROVED or ACTIVE to submit quotations`,
          req.originalUrl,
        );
        return;
      }

      const body = req.body ?? {};
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      if (rawLines.length !== rfq.lines.length) {
        sendError(res, 400, 'Quotation must include pricing for every RFQ line item', req.originalUrl);
        return;
      }

      const leadTimeDays = Number(body.leadTimeDays ?? 14);
      if (!Number.isFinite(leadTimeDays) || leadTimeDays < 0) {
        sendError(res, 400, 'Lead time days must be 0 or greater', req.originalUrl);
        return;
      }

      const qLines: QuotationLineRecord[] = [];
      let totalLandedCost = 0;

      for (const rfqLine of rfq.lines) {
        const submittedLine = rawLines.find((l: Record<string, unknown>) => l['rfqLineId'] === rfqLine.rfqLineId);
        if (!submittedLine) {
          sendError(res, 400, `Missing quotation line for material ${rfqLine.sapMaterialCode}`, req.originalUrl);
          return;
        }
        const basicUnitPrice = Number(submittedLine.basicUnitPrice ?? 0);
        const discountAmount = Number(submittedLine.discountAmount ?? 0);
        const taxAmount = Number(submittedLine.taxAmount ?? 0);
        const freightAmount = Number(submittedLine.freightAmount ?? 0);
        const packingAmount = Number(submittedLine.packingAmount ?? 0);
        const toolingAmount = Number(submittedLine.toolingAmount ?? 0);
        const insuranceAmount = Number(submittedLine.insuranceAmount ?? 0);
        const otherCharges = Number(submittedLine.otherCharges ?? 0);

        if (basicUnitPrice < 0 || discountAmount < 0 || taxAmount < 0 || freightAmount < 0) {
          sendError(res, 400, 'Unit prices and charges must be non-negative', req.originalUrl);
          return;
        }

        const gross = basicUnitPrice * rfqLine.quantity;
        const netTotal = Math.max(0, gross - discountAmount);
        const netUnitPrice = Number((netTotal / rfqLine.quantity).toFixed(4));
        const landedLineTotal = Number(
          (netTotal + taxAmount + freightAmount + packingAmount + toolingAmount + insuranceAmount + otherCharges).toFixed(2),
        );
        totalLandedCost += landedLineTotal;

        qLines.push({
          quotationLineId: newId(),
          rfqLineId: rfqLine.rfqLineId,
          sapMaterialCode: rfqLine.sapMaterialCode,
          materialDescription: rfqLine.materialDescription,
          quantity: rfqLine.quantity,
          uom: rfqLine.uom,
          basicUnitPrice,
          discountAmount,
          netUnitPrice,
          taxAmount,
          freightAmount,
          packingAmount,
          toolingAmount,
          insuranceAmount,
          otherCharges,
          landedLineTotal,
        });
      }

      totalLandedCost = Number(totalLandedCost.toFixed(2));
      const now = new Date().toISOString();

      let quotation: QuotationRecord | undefined = store.quotations.find(
        (q) => q.rfqId === rfqId && q.supplierId === supplierId,
      );

      if (!quotation) {
        quotation = {
          quotationId: newId(),
          rfqId,
          supplierId,
          supplierNumber: supplier.supplierNumber,
          supplierName: supplier.legalName,
          lifecycleStatus: 'SUBMITTED',
          versions: [],
          createdAt: now,
        };
        store.quotations.push(quotation);
      } else {
        // Mark previous latest version as REVISED
        const prevLatest = quotation.versions[quotation.versions.length - 1];
        if (prevLatest && prevLatest.versionStatus === 'SUBMITTED') {
          prevLatest.versionStatus = 'REVISED';
        }
        quotation.lifecycleStatus = 'REVISED';
      }

      const nextVersionNum = quotation.versions.length + 1;
      const newVersion: QuotationVersionRecord = {
        quotationVersionId: newId(),
        quotationId: quotation.quotationId,
        versionNumber: nextVersionNum,
        submittedBy: auth.sub,
        submittedByName: auth.fullName,
        submittedAt: now,
        currencyCode: rfq.currencyCode,
        validityDate: typeof body.validityDate === 'string' && body.validityDate.trim() ? body.validityDate.trim() : null,
        paymentTerms: typeof body.paymentTerms === 'string' && body.paymentTerms.trim() ? body.paymentTerms.trim() : rfq.paymentTerms,
        incoterms: typeof body.incoterms === 'string' && body.incoterms.trim() ? body.incoterms.trim() : rfq.incoterms,
        leadTimeDays,
        minimumOrderQuantity: body.minimumOrderQuantity ? Number(body.minimumOrderQuantity) : null,
        warrantyTerms: typeof body.warrantyTerms === 'string' && body.warrantyTerms.trim() ? body.warrantyTerms.trim() : null,
        remarks: typeof body.remarks === 'string' && body.remarks.trim() ? body.remarks.trim() : null,
        totalLandedCost,
        versionStatus: 'SUBMITTED',
        lines: qLines,
        technicalEvaluation: null,
        commercialEvaluation: null,
      };

      quotation.versions.push(newVersion);
      invitation.invitationStatus = 'SUBMITTED';
      if (!invitation.acknowledgedAt) invitation.acknowledgedAt = now;
      if (rfq.status === 'PUBLISHED' || rfq.status === 'INVITATIONS_SENT') {
        rfq.status = 'QUOTATION_OPEN';
      }

      // If open negotiation round exists for this supplier, update settledAmount & add note
      const openRound = store.negotiations.find(
        (n) => n.rfqId === rfqId && n.supplierId === supplierId && n.status === 'OPEN',
      );
      if (openRound) {
        openRound.settledAmount = totalLandedCost;
        openRound.messages.push({
          messageId: newId(),
          negotiationRoundId: openRound.negotiationRoundId,
          senderUserId: auth.sub,
          senderName: auth.fullName,
          senderRole: auth.roles[0] ?? 'SUPPLIER_USER',
          messageType: 'SUPPLIER_RESPONSE',
          proposedTotal: totalLandedCost,
          messageText: `Submitted revised Quotation v${nextVersionNum} with total landed cost ${rfq.currencyCode} ${totalLandedCost.toLocaleString('en-IN')}.`,
          createdAt: now,
        });
      }

      queueNotification({
        recipientUserId: rfq.buyerUserId,
        recipientEmail: 'buyer@srm.local',
        eventType: 'QUOTATION_SUBMITTED',
        title: `Quotation v${nextVersionNum} received for ${rfq.rfqNumber}`,
        message: `${supplier.legalName} submitted Quotation v${nextVersionNum} (${rfq.currencyCode} ${totalLandedCost}).`,
      });

      recordAudit({
        auth,
        actionCode: nextVersionNum > 1 ? 'QUOTATION_REVISED' : 'QUOTATION_SUBMITTED',
        entityType: 'QUOTATION_VERSION',
        entityId: newVersion.quotationVersionId,
        supplierId,
        rfqId,
        quotationId: quotation.quotationId,
        outcome: 'SUCCESS',
        changedFields: { versionNumber: nextVersionNum, totalLandedCost },
      });

      res.status(201).json(apiSuccess(`Quotation v${nextVersionNum} submitted successfully`, quotation));
    },
  );

  // Technical evaluation
  router.post(
    '/quotations/:quotationVersionId/technical-evaluation',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SUPPLIER_VERIFIER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const versionId = String(req.params['quotationVersionId']);
      const technicalStatus = (typeof req.body?.technicalStatus === 'string'
        ? req.body.technicalStatus.trim().toUpperCase()
        : '') as TechnicalStatus;
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';

      if (!['TECH_ACCEPTED', 'TECH_REJECTED', 'CLARIFICATION_REQUIRED', 'CONDITIONALLY_ACCEPTED'].includes(technicalStatus)) {
        sendError(res, 400, 'Invalid technical evaluation status', req.originalUrl);
        return;
      }

      const store = getStore();
      for (const q of store.quotations) {
        const ver = q.versions.find((v) => v.quotationVersionId === versionId);
        if (ver) {
          ver.technicalEvaluation = {
            technicalStatus,
            evaluatorName: auth.fullName,
            remarks: remarks || null,
            evaluatedAt: new Date().toISOString(),
          };
          q.lifecycleStatus = 'UNDER_EVALUATION';
          const rfq = store.rfqs.find((r) => r.rfqId === q.rfqId);
          if (rfq && rfq.status === 'QUOTATION_OPEN') {
            rfq.status = 'EVALUATION';
          }

          recordAudit({
            auth,
            actionCode: 'TECHNICAL_EVALUATION_RECORDED',
            entityType: 'QUOTATION_VERSION',
            entityId: versionId,
            supplierId: q.supplierId,
            rfqId: q.rfqId,
            quotationId: q.quotationId,
            outcome: 'SUCCESS',
            reason: remarks || null,
            changedFields: { technicalStatus },
          });

          res.json(apiSuccess('Technical evaluation recorded', ver));
          return;
        }
      }
      sendError(res, 404, 'Quotation version not found', req.originalUrl);
    },
  );

  // Commercial evaluation
  router.post(
    '/quotations/:quotationVersionId/commercial-evaluation',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const versionId = String(req.params['quotationVersionId']);
      const score = req.body?.score !== undefined ? Number(req.body.score) : null;
      const rankNumber = Number(req.body?.rankNumber ?? 1);
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';

      const store = getStore();
      for (const q of store.quotations) {
        const ver = q.versions.find((v) => v.quotationVersionId === versionId);
        if (ver) {
          ver.commercialEvaluation = {
            comparisonBasis: 'TOTAL_LANDED_COST',
            rankNumber,
            score,
            evaluatorName: auth.fullName,
            remarks: remarks || null,
            evaluatedAt: new Date().toISOString(),
          };
          q.lifecycleStatus = 'UNDER_EVALUATION';

          recordAudit({
            auth,
            actionCode: 'COMMERCIAL_EVALUATION_RECORDED',
            entityType: 'QUOTATION_VERSION',
            entityId: versionId,
            supplierId: q.supplierId,
            rfqId: q.rfqId,
            quotationId: q.quotationId,
            outcome: 'SUCCESS',
            reason: remarks || null,
            changedFields: { rankNumber, score },
          });

          res.json(apiSuccess('Commercial evaluation recorded', ver));
          return;
        }
      }
      sendError(res, 404, 'Quotation version not found', req.originalUrl);
    },
  );

  // Withdraw quotation version (supplier or SRM admin before award)
  router.post(
    '/quotations/:quotationVersionId/withdraw',
    authenticate,
    requireRoles('SUPPLIER_USER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const versionId = String(req.params['quotationVersionId']);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      const store = getStore();
      for (const q of store.quotations) {
        const ver = q.versions.find((v) => v.quotationVersionId === versionId);
        if (ver) {
          if (isSupplierScopedOnly(auth) && q.supplierId !== auth.supplierId) {
            sendError(res, 403, 'You can only withdraw quotations from your own supplier organization', req.originalUrl);
            return;
          }
          const rfq = store.rfqs.find((r) => r.rfqId === q.rfqId);
          if (rfq && ['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
            sendError(res, 409, `Cannot withdraw quotation when RFQ is ${rfq.status}`, req.originalUrl);
            return;
          }
          if (ver.versionStatus === 'ACCEPTED' || ver.versionStatus === 'WITHDRAWN') {
            sendError(res, 409, `Quotation version is already ${ver.versionStatus}`, req.originalUrl);
            return;
          }

          ver.versionStatus = 'WITHDRAWN';
          const remainingActive = q.versions.some((v) => v.versionStatus !== 'WITHDRAWN');
          if (!remainingActive) {
            q.lifecycleStatus = 'NOT_SELECTED';
          }

          recordAudit({
            auth,
            actionCode: 'QUOTATION_WITHDRAWN',
            entityType: 'QUOTATION_VERSION',
            entityId: versionId,
            supplierId: q.supplierId,
            rfqId: q.rfqId,
            quotationId: q.quotationId,
            outcome: 'SUCCESS',
            reason: reason || 'Quotation withdrawn prior to award',
          });

          res.json(apiSuccess(`Quotation v${ver.versionNumber} withdrawn`, q));
          return;
        }
      }

      sendError(res, 404, 'Quotation version not found', req.originalUrl);
    },
  );

  // Negotiations list (supplier isolation & role-restricted)
  router.get(
    '/rfqs/:rfqId/negotiations',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'SUPPLIER_USER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (isSupplierScopedOnly(auth)) {
        const isInvited = rfq.invitations.some((inv) => inv.supplierId === auth.supplierId);
        if (rfq.status === 'DRAFT' || !isInvited) {
          sendError(res, 403, 'You are not invited to view negotiations for this RFQ', req.originalUrl);
          return;
        }
      }
      const rounds = isSupplierScopedOnly(auth)
        ? store.negotiations.filter((n) => n.rfqId === rfqId && n.supplierId === auth.supplierId)
        : store.negotiations.filter((n) => n.rfqId === rfqId);

      res.json(apiSuccess('Negotiation rounds retrieved', rounds));
    },
  );

  // Open negotiation round
  router.post(
    '/rfqs/:rfqId/negotiations',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
      const messageText = typeof req.body?.messageText === 'string' ? req.body.messageText.trim() : '';
      const targetAmount = req.body?.targetAmount ? Number(req.body.targetAmount) : null;

      if (!supplierId || !messageText) {
        sendError(res, 400, 'Supplier and negotiation request message are required', req.originalUrl);
        return;
      }

      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      const quotation = store.quotations.find((q) => q.rfqId === rfqId && q.supplierId === supplierId);
      if (!quotation || quotation.versions.length === 0) {
        sendError(res, 409, 'Supplier must submit an initial quotation before opening negotiation', req.originalUrl);
        return;
      }

      const existingRounds = store.negotiations.filter((n) => n.rfqId === rfqId && n.supplierId === supplierId);
      if (existingRounds.some((r) => r.status === 'OPEN')) {
        sendError(res, 409, 'An open negotiation round already exists for this supplier', req.originalUrl);
        return;
      }

      const latestVersion = quotation.versions[quotation.versions.length - 1]!;
      const roundId = newId();
      const now = new Date().toISOString();
      const round: NegotiationRoundRecord = {
        negotiationRoundId: roundId,
        rfqId,
        supplierId,
        supplierName: quotation.supplierName,
        roundNumber: existingRounds.length + 1,
        status: 'OPEN',
        baselineAmount: quotation.versions[0]!.totalLandedCost,
        targetAmount,
        settledAmount: latestVersion.totalLandedCost,
        openedAt: now,
        closedAt: null,
        messages: [
          {
            messageId: newId(),
            negotiationRoundId: roundId,
            senderUserId: auth.sub,
            senderName: auth.fullName,
            senderRole: auth.roles[0] ?? 'PROCUREMENT_BUYER',
            messageType: 'BUYER_REQUEST',
            proposedTotal: targetAmount,
            messageText,
            createdAt: now,
          },
        ],
      };

      store.negotiations.push(round);
      quotation.lifecycleStatus = 'NEGOTIATION_REQUESTED';
      rfq.status = 'NEGOTIATION';
      rfq.updatedAt = now;

      notifySupplierUsers(
        supplierId,
        'NEGOTIATION_OPENED',
        `Negotiation Round ${round.roundNumber}: ${rfq.rfqNumber}`,
        messageText,
      );

      recordAudit({
        auth,
        actionCode: 'NEGOTIATION_ROUND_OPENED',
        entityType: 'NEGOTIATION_ROUND',
        entityId: roundId,
        supplierId,
        rfqId,
        quotationId: quotation.quotationId,
        outcome: 'SUCCESS',
        reason: messageText,
      });

      res.status(201).json(apiSuccess(`Negotiation Round ${round.roundNumber} opened`, round));
    },
  );

  // Append message or close round
  router.post(
    '/negotiations/:roundId/messages',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SUPPLIER_USER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const roundId = String(req.params['roundId']);
      const messageText = typeof req.body?.messageText === 'string' ? req.body.messageText.trim() : '';
      const closeRound = Boolean(req.body?.closeRound);
      const proposedTotal = req.body?.proposedTotal ? Number(req.body.proposedTotal) : null;

      const store = getStore();
      const round = store.negotiations.find((n) => n.negotiationRoundId === roundId);
      if (!round) {
        sendError(res, 404, 'Negotiation round not found', req.originalUrl);
        return;
      }
      if (isSupplierScopedOnly(auth) && round.supplierId !== auth.supplierId) {
        sendError(res, 403, 'You can only respond in your own negotiation round', req.originalUrl);
        return;
      }
      if (round.status === 'CLOSED') {
        sendError(res, 409, 'This negotiation round is already closed', req.originalUrl);
        return;
      }
      if (!messageText && !closeRound) {
        sendError(res, 400, 'Message text is required', req.originalUrl);
        return;
      }

      const now = new Date().toISOString();
      if (messageText) {
        round.messages.push({
          messageId: newId(),
          negotiationRoundId: roundId,
          senderUserId: auth.sub,
          senderName: auth.fullName,
          senderRole: auth.roles[0] ?? 'PROCUREMENT_BUYER',
          messageType: isSupplierScopedOnly(auth) ? 'SUPPLIER_RESPONSE' : 'COUNTEROFFER',
          proposedTotal,
          messageText,
          createdAt: now,
        });
      }

      if (closeRound && hasAnyRole(auth, ['PROCUREMENT_BUYER', 'SRM_ADMIN'])) {
        round.status = 'CLOSED';
        round.closedAt = now;
        if (proposedTotal !== null) round.settledAmount = proposedTotal;
      }

      recordAudit({
        auth,
        actionCode: closeRound ? 'NEGOTIATION_ROUND_CLOSED' : 'NEGOTIATION_MESSAGE_SENT',
        entityType: 'NEGOTIATION_ROUND',
        entityId: roundId,
        supplierId: round.supplierId,
        rfqId: round.rfqId,
        outcome: 'SUCCESS',
      });

      res.json(apiSuccess(closeRound ? 'Negotiation round closed' : 'Negotiation message posted', round));
    },
  );

  // ==================== RECOMMENDATIONS, APPROVALS, AWARDS & SAP PIR ====================

  // Recommend supplier for award -> creates Approval Request + Task
  router.post(
    '/rfqs/:rfqId/recommend',
    authenticate,
    requireRoles('PROCUREMENT_BUYER'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const quotationVersionId = typeof req.body?.quotationVersionId === 'string' ? req.body.quotationVersionId : '';
      const justification = typeof req.body?.justification === 'string' ? req.body.justification.trim() : '';

      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (['APPROVAL_PENDING', 'APPROVED', 'AWARDED', 'CLOSED', 'CANCELLED'].includes(rfq.status)) {
        sendError(res, 409, `RFQ is already in ${rfq.status} status`, req.originalUrl);
        return;
      }

      const rfqQuotations = store.quotations.filter((q) => q.rfqId === rfqId);
      let targetQuotation: QuotationRecord | undefined;
      let targetVersion: QuotationVersionRecord | undefined;

      for (const q of rfqQuotations) {
        const ver = q.versions.find((v) => v.quotationVersionId === quotationVersionId);
        if (ver) {
          targetQuotation = q;
          targetVersion = ver;
          break;
        }
      }
      if (!targetQuotation || !targetVersion) {
        sendError(res, 404, 'Recommended quotation version not found for this RFQ', req.originalUrl);
        return;
      }

      // Check L1 landed cost
      const latestCosts = rfqQuotations
        .map((q) => q.versions[q.versions.length - 1]!)
        .filter(Boolean)
        .map((v) => v.totalLandedCost);
      const l1Amount = Math.min(...latestCosts);
      const isNonL1 = targetVersion.totalLandedCost > l1Amount;

      if (isNonL1 && !justification) {
        sendError(res, 400, 'Commercial justification is mandatory when recommending a non-L1 supplier', req.originalUrl);
        return;
      }

      const initialV1Cost = targetQuotation.versions[0]!.totalLandedCost;
      const savingsAmount = Math.max(0, Number((initialV1Cost - targetVersion.totalLandedCost).toFixed(2)));
      const now = new Date().toISOString();
      const approver = store.users.find((u) => u.roles.includes('PROCUREMENT_APPROVER') && u.userId !== auth.sub);
      const approvalRequestId = newId();

      const approvalRequest: ApprovalRequestRecord = {
        approvalRequestId,
        entityType: 'RFQ_AWARD',
        entityId: rfqId,
        workflowCode: isNonL1 ? 'NON_L1_EXCEPTION_AWARD' : 'SRM_STANDARD_AWARD',
        status: 'PENDING',
        requestedBy: auth.sub,
        requestedByName: auth.fullName,
        createdAt: now,
        recommendation: {
          recommendationId: newId(),
          rfqId,
          rfqNumber: rfq.rfqNumber,
          rfqTitle: rfq.title,
          supplierId: targetQuotation.supplierId,
          supplierName: targetQuotation.supplierName,
          quotationVersionId: targetVersion.quotationVersionId,
          versionNumber: targetVersion.versionNumber,
          recommendedBy: auth.sub,
          recommendedByName: auth.fullName,
          recommendedAmount: targetVersion.totalLandedCost,
          l1Amount,
          savingsAmount,
          currencyCode: rfq.currencyCode,
          isNonL1,
          justification: justification || null,
          createdAt: now,
        },
        tasks: [
          {
            approvalTaskId: newId(),
            approvalRequestId,
            stageCode: isNonL1 ? 'NON_L1_PROCUREMENT_APPROVAL' : 'PROCUREMENT_APPROVAL',
            sequenceNumber: 1,
            assignedUserId: approver?.userId ?? null,
            assignedGroup: 'PROCUREMENT_APPROVERS',
            taskStatus: 'PENDING',
            decidedBy: null,
            decidedByName: null,
            remarks: null,
            decidedAt: null,
            dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
          },
        ],
      };

      store.approvalRequests.unshift(approvalRequest);
      rfq.status = 'APPROVAL_PENDING';
      rfq.updatedAt = now;

      // Close any open negotiation rounds for this RFQ
      for (const n of store.negotiations) {
        if (n.rfqId === rfqId && n.status === 'OPEN') {
          n.status = 'CLOSED';
          n.closedAt = now;
        }
      }

      if (approver) {
        queueNotification({
          recipientUserId: approver.userId,
          recipientEmail: approver.email,
          eventType: 'APPROVAL_TASK_ASSIGNED',
          title: `Approval required: ${rfq.rfqNumber}`,
          message: `${auth.fullName} recommended ${targetQuotation.supplierName} (${rfq.currencyCode} ${targetVersion.totalLandedCost}).`,
        });
      }

      recordAudit({
        auth,
        actionCode: 'SUPPLIER_RECOMMENDED',
        entityType: 'APPROVAL_REQUEST',
        entityId: approvalRequestId,
        supplierId: targetQuotation.supplierId,
        rfqId,
        quotationId: targetQuotation.quotationId,
        approvalRequestId,
        outcome: 'SUCCESS',
        reason: justification || null,
        changedFields: { isNonL1, recommendedAmount: targetVersion.totalLandedCost },
      });

      res.status(201).json(apiSuccess('Supplier recommendation submitted for procurement approval', approvalRequest));
    },
  );

  // List approval requests, awards, and SAP PIR integrations
  router.get(
    '/approvals',
    authenticate,
    requireRoles('PROCUREMENT_APPROVER', 'PROCUREMENT_BUYER', 'SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR'),
    (_req, res) => {
      const store = getStore();
      res.json(
        apiSuccess('Approvals and awards retrieved', {
          approvalRequests: store.approvalRequests,
          awards: store.awards,
          sapIntegrations: store.sapIntegrations,
        }),
      );
    },
  );

  // Decide approval task (BR-006 Segregation of Duties enforced!)
  router.post(
    '/approvals/:requestId/tasks/:taskId/decide',
    authenticate,
    requireRoles('PROCUREMENT_APPROVER'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const requestId = String(req.params['requestId']);
      const taskId = String(req.params['taskId']);
      const decision = typeof req.body?.decision === 'string' ? req.body.decision.trim().toUpperCase() : '';
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';

      if (!['APPROVED', 'RETURNED', 'REJECTED'].includes(decision)) {
        sendError(res, 400, 'Decision must be APPROVED, RETURNED, or REJECTED', req.originalUrl);
        return;
      }
      if (decision !== 'APPROVED' && !remarks) {
        sendError(res, 400, 'Remarks are required when returning or rejecting an approval request', req.originalUrl);
        return;
      }

      const store = getStore();
      const approvalReq = store.approvalRequests.find((a) => a.approvalRequestId === requestId);
      if (!approvalReq) {
        sendError(res, 404, 'Approval request not found', req.originalUrl);
        return;
      }
      const task = approvalReq.tasks.find((t) => t.approvalTaskId === taskId);
      if (!task || task.taskStatus !== 'PENDING') {
        sendError(res, 409, 'Pending approval task not found', req.originalUrl);
        return;
      }

      // Segregation of duties check (BR-006)
      if (approvalReq.recommendation.recommendedBy === auth.sub) {
        recordAudit({
          auth,
          actionCode: 'APPROVAL_SOD_DENIED',
          entityType: 'APPROVAL_REQUEST',
          entityId: requestId,
          rfqId: approvalReq.recommendation.rfqId,
          approvalRequestId: requestId,
          outcome: 'DENIED',
          reason: 'Segregation of duties violation: recommender cannot approve own recommendation',
        });
        sendError(res, 403, 'Segregation of duties: the buyer who recommended this supplier cannot approve it', req.originalUrl);
        return;
      }

      const now = new Date().toISOString();
      task.taskStatus = decision as 'APPROVED' | 'RETURNED' | 'REJECTED';
      task.decidedBy = auth.sub;
      task.decidedByName = auth.fullName;
      task.remarks = remarks || null;
      task.decidedAt = now;
      approvalReq.status = decision as 'APPROVED' | 'RETURNED' | 'REJECTED';

      const rfq = store.rfqs.find((r) => r.rfqId === approvalReq.recommendation.rfqId);
      if (rfq) {
        rfq.status = decision === 'APPROVED' ? 'APPROVED' : decision === 'RETURNED' ? 'EVALUATION' : 'CLOSED';
        rfq.updatedAt = now;
      }

      queueNotification({
        recipientUserId: approvalReq.requestedBy,
        recipientEmail: 'buyer@srm.local',
        eventType: `APPROVAL_${decision}`,
        title: `Approval ${decision}: ${approvalReq.recommendation.rfqNumber}`,
        message: remarks || `Your recommendation for ${approvalReq.recommendation.supplierName} was ${decision}.`,
      });

      recordAudit({
        auth,
        actionCode: `APPROVAL_${decision}`,
        entityType: 'APPROVAL_REQUEST',
        entityId: requestId,
        supplierId: approvalReq.recommendation.supplierId,
        rfqId: approvalReq.recommendation.rfqId,
        approvalRequestId: requestId,
        outcome: 'SUCCESS',
        reason: remarks || null,
        changedFields: { status: { old: 'PENDING', new: decision } },
      });

      res.json(apiSuccess(`Approval decision (${decision}) recorded`, approvalReq));
    },
  );

  // Record formal Award (BR-008: permitted ONLY after required approval)
  router.post(
    '/rfqs/:rfqId/award',
    authenticate,
    requireRoles('PROCUREMENT_BUYER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const rfqId = String(req.params['rfqId']);
      const store = getStore();
      const rfq = store.rfqs.find((r) => r.rfqId === rfqId);
      if (!rfq) {
        sendError(res, 404, 'RFQ not found', req.originalUrl);
        return;
      }
      if (rfq.status !== 'APPROVED') {
        sendError(res, 409, 'Award can only be recorded after procurement approval is complete', req.originalUrl);
        return;
      }

      const approvedReq = store.approvalRequests.find(
        (a) => a.entityId === rfqId && a.status === 'APPROVED',
      );
      if (!approvedReq) {
        sendError(res, 409, 'Approved procurement request not found', req.originalUrl);
        return;
      }

      const rec = approvedReq.recommendation;
      const supplier = store.suppliers.find((s) => s.supplierId === rec.supplierId);
      const now = new Date().toISOString();
      const awardId = newId();

      const award = {
        awardId,
        rfqId,
        rfqNumber: rfq.rfqNumber,
        rfqTitle: rfq.title,
        supplierId: rec.supplierId,
        supplierNumber: supplier?.supplierNumber ?? 'SUP',
        supplierName: rec.supplierName,
        sapVendorCode: supplier?.sapVendorCode ?? null,
        quotationVersionId: rec.quotationVersionId,
        approvalRequestId: approvedReq.approvalRequestId,
        approvedValue: rec.recommendedAmount,
        currencyCode: rec.currencyCode,
        awardStatus: 'AWARDED' as const,
        awardedBy: auth.sub,
        awardedByName: auth.fullName,
        awardedAt: now,
      };
      store.awards.unshift(award);
      rfq.status = 'AWARDED';
      rfq.updatedAt = now;

      // Mark winning quotation ACCEPTED and others NOT_SELECTED
      for (const q of store.quotations.filter((q) => q.rfqId === rfqId)) {
        const latest = q.versions[q.versions.length - 1];
        if (q.supplierId === rec.supplierId) {
          q.lifecycleStatus = 'ACCEPTED';
          if (latest) latest.versionStatus = 'ACCEPTED';
        } else {
          q.lifecycleStatus = 'NOT_SELECTED';
          if (latest) latest.versionStatus = 'NOT_SELECTED';
        }
      }

      // Create pending SAP PIR integration record
      store.sapIntegrations.unshift({
        integrationEventId: newId(),
        supplierId: rec.supplierId,
        supplierNumber: supplier?.supplierNumber ?? 'SUP',
        supplierName: rec.supplierName,
        sapVendorCode: supplier?.sapVendorCode ?? null,
        awardId,
        rfqNumber: rfq.rfqNumber,
        approvedValue: rec.recommendedAmount,
        currencyCode: rec.currencyCode,
        operationType: 'PIR_CREATE_OR_UPDATE',
        status: 'PENDING',
        externalReference: null,
        sanitizedError: null,
        idempotencyKey: `PIR-${awardId}`,
        createdAt: now,
        updatedAt: now,
      });

      // Notify winning and unsuccessful suppliers (BR-009)
      for (const inv of rfq.invitations) {
        if (inv.supplierId === rec.supplierId) {
          notifySupplierUsers(
            inv.supplierId,
            'AWARD_ISSUED',
            `Award Notification: ${rfq.rfqNumber}`,
            `Congratulations! Your quotation for ${rfq.title} (${rec.currencyCode} ${rec.recommendedAmount}) has been awarded.`,
          );
        } else if (inv.invitationStatus === 'SUBMITTED') {
          notifySupplierUsers(
            inv.supplierId,
            'AWARD_UNSUCCESSFUL',
            `RFQ Outcome: ${rfq.rfqNumber}`,
            `Thank you for participating in ${rfq.title}. Another offer was selected for award.`,
          );
        }
      }

      recordAudit({
        auth,
        actionCode: 'RFQ_AWARDED',
        entityType: 'AWARD',
        entityId: awardId,
        supplierId: rec.supplierId,
        rfqId,
        approvalRequestId: approvedReq.approvalRequestId,
        outcome: 'SUCCESS',
        changedFields: { approvedValue: rec.recommendedAmount, status: 'AWARDED' },
      });

      res.status(201).json(apiSuccess(`Award recorded for ${rfq.rfqNumber}`, award));
    },
  );

  // Cancel recorded Award (requires mandatory reason)
  router.post(
    '/awards/:awardId/cancel',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const awardId = String(req.params['awardId']);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      if (!reason) {
        sendError(res, 400, 'Mandatory cancellation reason is required', req.originalUrl);
        return;
      }

      const store = getStore();
      const award = store.awards.find((a) => a.awardId === awardId);
      if (!award) {
        sendError(res, 404, 'Award record not found', req.originalUrl);
        return;
      }
      if (award.awardStatus === 'CANCELLED') {
        sendError(res, 409, 'Award is already cancelled', req.originalUrl);
        return;
      }

      const now = new Date().toISOString();
      award.awardStatus = 'CANCELLED';

      const rfq = store.rfqs.find((r) => r.rfqId === award.rfqId);
      if (rfq) {
        rfq.status = 'EVALUATION';
        rfq.updatedAt = now;
      }

      for (const q of store.quotations.filter((q) => q.rfqId === award.rfqId)) {
        const latest = q.versions[q.versions.length - 1];
        if (q.lifecycleStatus === 'ACCEPTED' || q.lifecycleStatus === 'NOT_SELECTED') {
          q.lifecycleStatus = 'UNDER_EVALUATION';
        }
        if (latest && (latest.versionStatus === 'ACCEPTED' || latest.versionStatus === 'NOT_SELECTED')) {
          latest.versionStatus = 'SUBMITTED';
        }
      }

      const sapEvent = store.sapIntegrations.find((e) => e.awardId === awardId);
      if (sapEvent && sapEvent.status === 'PENDING') {
        sapEvent.status = 'FAILED';
        sapEvent.sanitizedError = `Award cancelled: ${reason}`;
        sapEvent.updatedAt = now;
      }

      notifySupplierUsers(
        award.supplierId,
        'AWARD_CANCELLED',
        `Award Cancelled: ${award.rfqNumber}`,
        `The award for ${award.rfqTitle} has been cancelled. Reason: ${reason}`,
      );

      recordAudit({
        auth,
        actionCode: 'AWARD_CANCELLED',
        entityType: 'AWARD',
        entityId: awardId,
        supplierId: award.supplierId,
        rfqId: award.rfqId,
        approvalRequestId: award.approvalRequestId,
        outcome: 'SUCCESS',
        reason,
        changedFields: { awardStatus: { old: 'AWARDED', new: 'CANCELLED' } },
      });

      res.json(apiSuccess(`Award for ${award.rfqNumber} cancelled and RFQ reopened for evaluation`, award));
    },
  );

  // Controlled SAP PIR integration sync (idempotent, validates SAP Vendor Code mapping)
  router.post(
    '/sap-integrations/:awardId/sync-pir',
    authenticate,
    requireRoles('PROCUREMENT_BUYER', 'SRM_ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const awardId = String(req.params['awardId']);
      const store = getStore();
      const event = store.sapIntegrations.find((e) => e.awardId === awardId);
      if (!event) {
        sendError(res, 404, 'SAP integration record for award not found', req.originalUrl);
        return;
      }
      const award = store.awards.find((a) => a.awardId === awardId);
      if (award?.awardStatus === 'CANCELLED') {
        sendError(res, 409, 'Cannot sync SAP PIR for a cancelled award', req.originalUrl);
        return;
      }
      if (event.status === 'SUCCESS') {
        res.json(apiSuccess(`SAP PIR already synced (${event.externalReference})`, event));
        return;
      }

      const supplier = store.suppliers.find((s) => s.supplierId === event.supplierId);
      const now = new Date().toISOString();
      event.updatedAt = now;

      if (!supplier?.sapVendorCode) {
        event.status = 'FAILED';
        event.sanitizedError = 'Supplier does not have an active mapped SAP Vendor Code. Map an existing SAP Vendor Code before syncing PIR.';
        recordAudit({
          auth,
          actionCode: 'SAP_PIR_SYNC_FAILED',
          entityType: 'SAP_INTEGRATION',
          entityId: event.integrationEventId,
          supplierId: event.supplierId,
          outcome: 'FAILURE',
          reason: event.sanitizedError,
        });
        sendError(res, 409, event.sanitizedError, req.originalUrl);
        return;
      }

      event.sapVendorCode = supplier.sapVendorCode;
      event.status = 'SUCCESS';
      event.externalReference = `PIR-${store.pirSeq++}`;
      event.sanitizedError = null;

      recordAudit({
        auth,
        actionCode: 'SAP_PIR_SYNCED',
        entityType: 'SAP_INTEGRATION',
        entityId: event.integrationEventId,
        supplierId: event.supplierId,
        outcome: 'SUCCESS',
        reason: `Created/updated SAP PIR ${event.externalReference} via authorized SAP API`,
        changedFields: { externalReference: event.externalReference, sapVendorCode: supplier.sapVendorCode },
      });

      res.json(apiSuccess(`SAP Purchase Info Record ${event.externalReference} synced`, event));
    },
  );

  // ==================== AUDIT TRAIL, NOTIFICATIONS & IAM ADMIN ====================

  router.get(
    '/audit-events',
    authenticate,
    requireRoles('AUDITOR', 'SUPER_ADMIN', 'SRM_ADMIN', 'PROCUREMENT_BUYER', 'PROCUREMENT_APPROVER', 'SUPPLIER_VERIFIER'),
    (req: AuthenticatedRequest, res) => {
      const store = getStore();
      const actionFilter = typeof req.query['action'] === 'string' ? req.query['action'].trim().toUpperCase() : '';
      const outcomeFilter = typeof req.query['outcome'] === 'string' ? req.query['outcome'].trim().toUpperCase() : '';
      const entityFilter = typeof req.query['entityType'] === 'string' ? req.query['entityType'].trim().toUpperCase() : '';
      const q = typeof req.query['q'] === 'string' ? req.query['q'].trim().toLowerCase() : '';

      const filtered = store.auditEvents.filter((ev) => {
        if (actionFilter && !ev.actionCode.toUpperCase().includes(actionFilter)) return false;
        if (outcomeFilter && ev.outcome !== outcomeFilter) return false;
        if (entityFilter && ev.entityType !== entityFilter) return false;
        if (q) {
          const hay = `${ev.actorName} ${ev.actionCode} ${ev.entityType} ${ev.reason ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      res.json(apiSuccess('Audit events retrieved', filtered));
    },
  );

  router.post(
    '/audit-events/export-log',
    authenticate,
    requireRoles('AUDITOR', 'SUPER_ADMIN', 'SRM_ADMIN'),
    (req: AuthenticatedRequest, res) => {
      recordAudit({
        auth: req.auth,
        actionCode: 'AUDIT_LOG_EXPORTED',
        entityType: 'AUDIT_EVENT',
        outcome: 'SUCCESS',
        reason: 'Authorized audit trail CSV export',
      });
      res.json(apiSuccess('Audit export recorded', null));
    },
  );

  router.get('/notifications', authenticate, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const store = getStore();
    const list = hasAnyRole(auth, ['SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR'])
      ? store.notifications
      : store.notifications.filter((n) => n.recipientUserId === auth.sub);
    res.json(apiSuccess('Notifications retrieved', list));
  });

  router.post(
    '/notifications/:notificationId/retry',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPER_ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const notificationId = String(req.params['notificationId']);
      const store = getStore();
      const notif = store.notifications.find((n) => n.notificationId === notificationId);
      if (!notif) {
        sendError(res, 404, 'Notification not found', req.originalUrl);
        return;
      }

      notif.retryCount += 1;
      notif.deliveryStatus = 'SENT';
      notif.sentAt = new Date().toISOString();

      recordAudit({
        auth,
        actionCode: 'NOTIFICATION_RETRIED',
        entityType: 'NOTIFICATION',
        entityId: notificationId,
        outcome: 'SUCCESS',
      });

      res.json(apiSuccess('Notification delivery retried successfully', notif));
    },
  );

  // Admin & Org-Scoped IAM Users
  router.get(
    '/admin/users',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'SUPPLIER_USER'),
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const store = getStore();
      const supplierOnly = isSupplierScopedOnly(auth);

      const sourceUsers = supplierOnly
        ? store.users.filter((u) => u.supplierId && u.supplierId === auth.supplierId)
        : store.users;

      const safeUsers = sourceUsers.map((u) => {
        const sup = u.supplierId ? store.suppliers.find((s) => s.supplierId === u.supplierId) : null;
        return {
          userId: u.userId,
          email: u.email,
          fullName: u.fullName,
          accountStatus: u.accountStatus,
          roles: u.roles,
          supplierId: u.supplierId,
          supplierName: sup?.legalName ?? null,
          supplierNumber: sup?.supplierNumber ?? null,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        };
      });
      res.json(apiSuccess('Users retrieved', safeUsers));
    },
  );

  router.post(
    '/admin/users',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPER_ADMIN', 'SUPPLIER_USER'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierOnly = isSupplierScopedOnly(auth);
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const requestedRoles: RoleCode[] = Array.isArray(req.body?.roles) ? req.body.roles : [];
      const requestedStatus = typeof req.body?.accountStatus === 'string'
        ? req.body.accountStatus.trim().toUpperCase()
        : 'ACTIVE';
      let supplierId = typeof req.body?.supplierId === 'string' && req.body.supplierId.trim()
        ? req.body.supplierId.trim()
        : null;

      if (!email || !EMAIL_REGEX.test(email)) {
        sendError(res, 400, 'Valid email is required', req.originalUrl);
        return;
      }
      if (!fullName) {
        sendError(res, 400, 'Full name is required', req.originalUrl);
        return;
      }
      if (!password || password.length < 8) {
        sendError(res, 400, 'Password must be at least 8 characters', req.originalUrl);
        return;
      }
      if (!['ACTIVE', 'PENDING'].includes(requestedStatus)) {
        sendError(res, 400, 'Initial account status must be ACTIVE or PENDING', req.originalUrl);
        return;
      }

      let roles: RoleCode[] = requestedRoles;
      if (supplierOnly) {
        if (!auth.supplierId) {
          sendError(res, 403, 'Your account is not linked to a supplier organization', req.originalUrl);
          return;
        }
        if (roles.some((r) => r !== 'SUPPLIER_USER')) {
          sendError(res, 403, 'Supplier organization admins can only provision SUPPLIER_USER accounts', req.originalUrl);
          return;
        }
        if (supplierId && supplierId !== auth.supplierId) {
          sendError(res, 403, 'You can only provision colleague users within your own supplier organization', req.originalUrl);
          return;
        }
        roles = ['SUPPLIER_USER'];
        supplierId = auth.supplierId;
      } else {
        if (roles.length === 0 || roles.some((r) => !ALL_ROLES.includes(r))) {
          sendError(res, 400, 'Assign at least one valid SRM role', req.originalUrl);
          return;
        }
        if (roles.includes('SUPER_ADMIN') && !auth.roles.includes('SUPER_ADMIN')) {
          sendError(res, 403, 'Only SUPER_ADMIN may assign the SUPER_ADMIN role', req.originalUrl);
          return;
        }
        if (roles.includes('SUPPLIER_USER') && !supplierId) {
          sendError(res, 400, 'Supplier organization must be selected for SUPPLIER_USER accounts', req.originalUrl);
          return;
        }
      }

      const store = getStore();
      if (supplierId && !store.suppliers.some((s) => s.supplierId === supplierId)) {
        sendError(res, 404, 'Linked supplier organization not found', req.originalUrl);
        return;
      }
      if (store.users.some((u) => u.email.toLowerCase() === email)) {
        sendError(res, 409, 'A user with this email already exists', req.originalUrl);
        return;
      }

      const now = new Date().toISOString();
      const user = {
        userId: newId(),
        email,
        passwordHash: hashPassword(password),
        fullName,
        accountStatus: requestedStatus as 'ACTIVE' | 'PENDING',
        roles,
        supplierId,
        createdAt: now,
        updatedAt: now,
      };
      store.users.unshift(user);
      const sup = supplierId ? store.suppliers.find((s) => s.supplierId === supplierId) : null;

      recordAudit({
        auth,
        actionCode: 'USER_PROVISIONED',
        entityType: 'USER',
        entityId: user.userId,
        supplierId,
        outcome: 'SUCCESS',
        changedFields: { email, roles, accountStatus: user.accountStatus },
      });

      res.status(201).json(
        apiSuccess('User provisioned successfully', {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          accountStatus: user.accountStatus,
          roles: user.roles,
          supplierId: user.supplierId,
          supplierName: sup?.legalName ?? null,
          supplierNumber: sup?.supplierNumber ?? null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
      );
    },
  );

  router.patch(
    '/admin/users/:userId',
    authenticate,
    requireRoles('SRM_ADMIN', 'SUPER_ADMIN', 'SUPPLIER_USER'),
    jsonParser,
    (req: AuthenticatedRequest, res) => {
      const auth = req.auth!;
      const supplierOnly = isSupplierScopedOnly(auth);
      const userId = String(req.params['userId']);
      const store = getStore();
      const user = store.users.find((u) => u.userId === userId);
      if (!user) {
        sendError(res, 404, 'User not found', req.originalUrl);
        return;
      }

      if (supplierOnly) {
        if (!auth.supplierId || user.supplierId !== auth.supplierId) {
          sendError(res, 403, 'You can only manage colleague users within your own supplier organization', req.originalUrl);
          return;
        }
      }

      if (user.roles.includes('SUPER_ADMIN') && !auth.roles.includes('SUPER_ADMIN')) {
        sendError(res, 403, 'Only SUPER_ADMIN may modify a SUPER_ADMIN account', req.originalUrl);
        return;
      }

      const body = req.body ?? {};
      const changed: Record<string, unknown> = {};

      if (typeof body.fullName === 'string' && body.fullName.trim()) {
        const nextName = body.fullName.trim();
        if (nextName !== user.fullName) {
          changed['fullName'] = { old: user.fullName, new: nextName };
          user.fullName = nextName;
        }
      }

      if (typeof body.accountStatus === 'string') {
        const accountStatus = body.accountStatus.trim().toUpperCase();
        if (!['ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING'].includes(accountStatus)) {
          sendError(res, 400, 'Account status must be ACTIVE, PENDING, SUSPENDED, or DISABLED', req.originalUrl);
          return;
        }
        if (user.userId === auth.sub && accountStatus !== 'ACTIVE') {
          sendError(res, 409, 'You cannot suspend or disable your own active account', req.originalUrl);
          return;
        }
        if (accountStatus !== user.accountStatus) {
          changed['accountStatus'] = { old: user.accountStatus, new: accountStatus };
          user.accountStatus = accountStatus as 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';
        }
      }

      if (Array.isArray(body.roles)) {
        const nextRoles: RoleCode[] = body.roles;
        if (nextRoles.length === 0 || nextRoles.some((r) => !ALL_ROLES.includes(r))) {
          sendError(res, 400, 'Assign at least one valid SRM role', req.originalUrl);
          return;
        }
        if (supplierOnly && nextRoles.some((r) => r !== 'SUPPLIER_USER')) {
          sendError(res, 403, 'Supplier organization admins cannot assign internal SRM roles', req.originalUrl);
          return;
        }
        if (nextRoles.includes('SUPER_ADMIN') && !auth.roles.includes('SUPER_ADMIN')) {
          sendError(res, 403, 'Only SUPER_ADMIN may assign the SUPER_ADMIN role', req.originalUrl);
          return;
        }
        changed['roles'] = { old: user.roles, new: nextRoles };
        user.roles = nextRoles;
      }

      if (body.supplierId !== undefined && !supplierOnly) {
        const nextSupId = typeof body.supplierId === 'string' && body.supplierId.trim() ? body.supplierId.trim() : null;
        if (user.roles.includes('SUPPLIER_USER') && !nextSupId) {
          sendError(res, 400, 'Supplier organization is required for SUPPLIER_USER accounts', req.originalUrl);
          return;
        }
        if (nextSupId && !store.suppliers.some((s) => s.supplierId === nextSupId)) {
          sendError(res, 404, 'Linked supplier organization not found', req.originalUrl);
          return;
        }
        if (nextSupId !== user.supplierId) {
          changed['supplierId'] = { old: user.supplierId, new: nextSupId };
          user.supplierId = nextSupId;
        }
      }

      if (typeof body.password === 'string' && body.password.length > 0) {
        if (body.password.length < 8) {
          sendError(res, 400, 'New password must be at least 8 characters', req.originalUrl);
          return;
        }
        user.passwordHash = hashPassword(body.password);
        changed['passwordReset'] = true;
      }

      user.updatedAt = new Date().toISOString();
      const sup = user.supplierId ? store.suppliers.find((s) => s.supplierId === user.supplierId) : null;

      recordAudit({
        auth,
        actionCode: changed['accountStatus'] && Object.keys(changed).length === 1 ? 'USER_STATUS_CHANGED' : 'USER_UPDATED',
        entityType: 'USER',
        entityId: userId,
        supplierId: user.supplierId,
        outcome: 'SUCCESS',
        changedFields: changed,
      });

      res.json(
        apiSuccess('User account updated successfully', {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          accountStatus: user.accountStatus,
          roles: user.roles,
          supplierId: user.supplierId,
          supplierName: sup?.legalName ?? null,
          supplierNumber: sup?.supplierNumber ?? null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
      );
    },
  );

  return router;
}
