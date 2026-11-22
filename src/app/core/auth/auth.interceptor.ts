import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).getToken();
  if (!token || request.url.endsWith('/api/v1/auth/login') || request.url.endsWith('/api/v1/auth/demo-accounts')) {
    return next(request);
  }
  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
