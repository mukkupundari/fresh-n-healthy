import { Injectable, inject } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdminAuth } from './auth';
import { Product } from './models';

export function createHub(tokenFactory?: () => string | null): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${environment.hubOrigin}/hubs/store`, tokenFactory ? { accessTokenFactory: () => tokenFactory() ?? '' } : {})
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();
}

export async function startHub(hub: HubConnection): Promise<boolean> {
  if (hub.state !== HubConnectionState.Disconnected) return hub.state === HubConnectionState.Connected;
  try {
    await hub.start();
    return true;
  } catch {
    return false;
  }
}

/** Admin connection: authenticated so the server places it in the shop's admin group for order notifications. */
@Injectable({ providedIn: 'root' })
export class AdminRealtime {
  private auth = inject(AdminAuth);
  private hub: HubConnection | null = null;

  readonly orderChanged = new Subject<{ orderNumber: string; status: string }>();
  readonly productsChanged = new Subject<Product[]>();

  async connect() {
    if (this.hub) return;
    this.hub = createHub(() => this.auth.token());
    this.hub.on('orderChanged', (e) => this.orderChanged.next(e));
    this.hub.on('productsChanged', (p: Product[]) => this.productsChanged.next(p));
    await startHub(this.hub);
  }

  async disconnect() {
    const hub = this.hub;
    this.hub = null;
    if (hub) await hub.stop().catch(() => undefined);
  }
}
