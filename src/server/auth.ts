import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RoleCode } from './models';

export interface AuthClaims {
  sub: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
  supplierId: string | null;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthClaims;
}

const JWT_TTL_SECONDS = 3600;

function getJwtSecret(): string {
  return process.env['SRM_JWT_SECRET'] || 'dev-srm-jwt-secret-key-change-in-production-32bytes';
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(keyBuf, derivedBuf);
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signJwt(claims: Omit<AuthClaims, 'iat' | 'exp'>): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: AuthClaims = {
    ...claims,
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(fullClaims));
  const signature = createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest('base64url');
  return { token: `${header}.${payload}.${signature}`, expiresIn: JWT_TTL_SECONDS };
}

export function verifyJwt(token: string): AuthClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  if (!header || !payload || !sig) return null;

  const expectedSig = createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as AuthClaims;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.sub || !parsed.exp || parsed.exp < now) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function apiSuccess<T>(message: string, data: T) {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  path: string,
  fieldErrors: Record<string, string> = {},
) {
  return res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error: statusLabel(status),
    message,
    path,
    fieldErrors,
  });
}

function statusLabel(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    default:
      return 'Internal Server Error';
  }
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    sendError(res, 401, 'Authentication required', req.originalUrl);
    return;
  }
  const claims = verifyJwt(token);
  if (!claims) {
    sendError(res, 401, 'Invalid or expired access token', req.originalUrl);
    return;
  }
  req.auth = claims;
  next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) {
    const claims = verifyJwt(token);
    if (claims) {
      req.auth = claims;
    }
  }
  next();
}

export function hasAnyRole(claims: AuthClaims | undefined, allowed: RoleCode[]): boolean {
  if (!claims) return false;
  return claims.roles.some((role) => allowed.includes(role));
}

export function requireRoles(...allowed: RoleCode[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      sendError(res, 401, 'Authentication required', req.originalUrl);
      return;
    }
    if (!hasAnyRole(req.auth, allowed)) {
      sendError(res, 403, 'You do not have permission to perform this action', req.originalUrl);
      return;
    }
    next();
  };
}

export function newId(): string {
  return randomUUID();
}
