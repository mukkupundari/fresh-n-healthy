import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { AdminApi, CustomerApi } from './api';
import { Admin, AdminAuthResult, Customer, CustomerAuthResult } from './models';

const CUSTOMER_HINT = 'fh_customer_session';
const ADMIN_HINT = 'fh_admin_session';

/** Access tokens live in memory only; sessions survive reloads through the HttpOnly refresh-token cookie. */
abstract class SessionStore<TUser, TResult extends { accessToken: string }> {
  readonly user = signal<TUser | null>(null);
  readonly token = signal<string | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  private pending: Promise<string | null> | null = null;

  protected abstract hintKey: string;
  protected abstract callRefresh(): Promise<TResult>;
  protected abstract userOf(result: TResult): TUser;
  protected abstract callLogout(): Promise<unknown>;

  set(result: TResult) {
    this.token.set(result.accessToken);
    this.user.set(this.userOf(result));
    localStorage.setItem(this.hintKey, '1');
  }

  clear() {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem(this.hintKey);
  }

  /** Restores the session on app start. Resolves true when signed in. */
  async restore(): Promise<boolean> {
    if (this.token()) return true;
    if (!localStorage.getItem(this.hintKey)) return false;
    return (await this.refresh()) !== null;
  }

  /**
   * De-duplicated token refresh used by the interceptor and on startup. Only a rejection from the server ends
   * the session; a network error or server hiccup keeps the device signed in so the next attempt can succeed.
   */
  refresh(): Promise<string | null> {
    this.pending ??= this.callRefresh()
      .then((r) => { this.set(r); return r.accessToken; })
      .catch((err: unknown) => {
        if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 400)) this.clear();
        return null;
      })
      .finally(() => { this.pending = null; });
    return this.pending;
  }

  async logout() {
    try { await this.callLogout(); } catch { /* the session is cleared locally regardless */ }
    this.clear();
  }
}

@Injectable({ providedIn: 'root' })
export class CustomerAuth extends SessionStore<Customer, CustomerAuthResult> {
  private api = inject(CustomerApi);
  protected hintKey = CUSTOMER_HINT;
  readonly customer = this.user;
  protected callRefresh() { return firstValueFrom(this.api.refresh()); }
  protected callLogout() { return firstValueFrom(this.api.logout()); }
  protected userOf(r: CustomerAuthResult) { return r.customer; }
  updateCustomer(c: Customer) { this.user.set(c); }
}

@Injectable({ providedIn: 'root' })
export class AdminAuth extends SessionStore<Admin, AdminAuthResult> {
  private api = inject(AdminApi);
  protected hintKey = ADMIN_HINT;
  readonly admin = this.user;
  readonly isSuperAdmin = computed(() => this.user()?.role === 'SuperAdmin');
  protected callRefresh() { return firstValueFrom(this.api.refresh()); }
  protected callLogout() { return firstValueFrom(this.api.logout()); }
  protected userOf(r: AdminAuthResult) { return r.admin; }
}

const isAdminUrl = (url: string) => url.startsWith('/api/admin') || url.startsWith('/api/platform');
const isAuthEndpoint = (url: string) => /\/auth\/(refresh|login|logout|otp|register)/.test(url);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const admin = inject(AdminAuth);
  const customer = inject(CustomerAuth);
  const router = inject(Router);
  const store = isAdminUrl(req.url) ? admin : customer;

  const withToken = (r: HttpRequest<unknown>, token: string | null) =>
    token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;

  return next(withToken(req, store.token())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isAuthEndpoint(req.url)) return throwError(() => err);
      return from(store.refresh()).pipe(
        switchMap((token) => {
          if (!token) {
            const target = store === admin ? '/admin/login' : '/login';
            router.navigate([target], { queryParams: { returnUrl: router.url } });
            return throwError(() => err);
          }
          return next(withToken(req, token));
        }),
      );
    }),
  );
};

export const customerGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(CustomerAuth);
  const router = inject(Router);
  return (await auth.restore()) ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Sends customers who are already signed in on to where they were heading instead of asking for a code again. */
export const customerGuestGuard: CanActivateFn = async (route) => {
  const auth = inject(CustomerAuth);
  const router = inject(Router);
  if (!(await auth.restore())) return true;
  const returnUrl = route.queryParamMap.get('returnUrl');
  return router.parseUrl(returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/');
};

export const shopAdminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AdminAuth);
  const router = inject(Router);
  if (!(await auth.restore())) return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
  return auth.isSuperAdmin() ? router.createUrlTree(['/admin/platform']) : true;
};

export const superAdminGuard: CanActivateFn = async () => {
  const auth = inject(AdminAuth);
  const router = inject(Router);
  if (!(await auth.restore())) return router.createUrlTree(['/admin/login']);
  return auth.isSuperAdmin() ? true : router.createUrlTree(['/admin']);
};

export const adminGuestGuard: CanActivateFn = async () => {
  const auth = inject(AdminAuth);
  const router = inject(Router);
  if (!(await auth.restore())) return true;
  return router.createUrlTree([auth.isSuperAdmin() ? '/admin/platform' : '/admin']);
};
