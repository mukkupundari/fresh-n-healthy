import { Injectable, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { AdminApi } from '../core/api';
import { AdminRealtime } from '../core/realtime';
import { ToastService } from '../core/toast.service';

/** Console-wide state: the realtime connection and the pending-orders badge. */
@Injectable({ providedIn: 'root' })
export class AdminState {
  private api = inject(AdminApi);
  private realtime = inject(AdminRealtime);
  private toast = inject(ToastService);
  private sub: Subscription | null = null;

  readonly pendingOrders = signal(0);
  readonly storeOpen = signal<boolean | null>(null);

  async start() {
    if (this.sub) return;
    this.sub = this.realtime.orderChanged.subscribe((e) => {
      if (e.status === 'Pending') this.toast.success(`New order ${e.orderNumber} received`);
      void this.refreshPending();
    });
    await this.realtime.connect();
    void this.refreshPending();
    firstValueFrom(this.api.settings()).then((s) => this.storeOpen.set(s.isOpen)).catch(() => undefined);
  }

  async stop() {
    this.sub?.unsubscribe();
    this.sub = null;
    await this.realtime.disconnect();
  }

  async refreshPending() {
    try {
      const res = await firstValueFrom(this.api.orders({ status: 'Pending', page: 1, pageSize: 1 }));
      this.pendingOrders.set(res.total);
    } catch { /* badge is best-effort */ }
  }
}
