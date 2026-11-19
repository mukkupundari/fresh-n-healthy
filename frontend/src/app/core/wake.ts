import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { defer, finalize, retry, throwError, timer } from 'rxjs';
import { environment } from '../../environments/environment';

/** The free API host sleeps when idle and takes up to a minute to start; this tracks that wait. */
@Injectable({ providedIn: 'root' })
export class ServerStatus {
  private pending = 0;
  readonly waking = signal(false);

  begin() { this.pending++; this.waking.set(true); }
  end() { this.pending = Math.max(0, this.pending - 1); if (!this.pending) this.waking.set(false); }

  /** Starts the API booting as soon as the page opens, before the first real request needs it. */
  ping() {
    if (environment.hubOrigin) void fetch(`${environment.hubOrigin}/healthz`, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined);
  }
}

const RETRY_DELAY_MS = 3000;
const MAX_WAIT_MS = 100_000;
const SAFE_POSTS = ['/api/cart/validate', '/api/auth/otp/request', '/api/auth/refresh', '/api/admin/auth/refresh'];

const isWakeError = (e: unknown) => e instanceof HttpErrorResponse && [0, 502, 503, 504].includes(e.status);

/** Retries reads (and repeat-safe auth calls) while the API is starting, instead of failing straight away. */
export const wakeInterceptor: HttpInterceptorFn = (req, next) => {
  const retryable = req.url.startsWith('/api/') && (req.method === 'GET' || SAFE_POSTS.includes(req.url));
  if (!retryable) return next(req);

  const status = inject(ServerStatus);
  const started = Date.now();
  let waiting = false;
  return defer(() => next(req)).pipe(
    retry({
      delay: (error) => {
        if (!isWakeError(error) || Date.now() - started > MAX_WAIT_MS) return throwError(() => error);
        if (!waiting) { waiting = true; status.begin(); }
        return timer(RETRY_DELAY_MS);
      },
    }),
    finalize(() => { if (waiting) status.end(); }),
  );
};
