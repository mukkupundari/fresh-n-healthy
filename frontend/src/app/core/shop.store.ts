import { Injectable, computed, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { firstValueFrom } from 'rxjs';
import { CatalogApi, toApiError } from './api';
import { Category, Product, ShopPublic, ShopSummary } from './models';
import { createHub, startHub } from './realtime';

const SHOP_KEY = 'fh_shop';

/** Current shop, its live product list, and the realtime subscription that keeps stock in sync across customers. */
@Injectable({ providedIn: 'root' })
export class ShopStore {
  private api = inject(CatalogApi);
  private hub: HubConnection | null = null;
  private joinedShopId: number | null = null;
  private initPromise: Promise<void> | null = null;

  readonly shops = signal<ShopSummary[]>([]);
  readonly shop = signal<ShopPublic | null>(null);
  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly productMap = computed(() => new Map(this.products().map((p) => [p.id, p])));
  /** Fires with products whose stock or price just changed via realtime, so the cart can reconcile. */
  readonly lastRealtimeUpdate = signal<Product[]>([]);

  init(): Promise<void> {
    this.initPromise ??= this.load();
    return this.initPromise;
  }

  private async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [shops, categories] = await Promise.all([firstValueFrom(this.api.shops()), firstValueFrom(this.api.categories())]);
      this.shops.set(shops);
      this.categories.set(categories);
      // A direct ?shop= link may point at a shop that is still empty and therefore not listed publicly.
      const linked = new URLSearchParams(window.location.search).get('shop');
      if (linked) {
        await this.select(linked);
        if (!this.error()) return;
      }
      const saved = localStorage.getItem(SHOP_KEY);
      const busiest = [...shops].sort((a, b) => b.productCount - a.productCount)[0];
      const slug = shops.find((s) => s.slug === saved)?.slug ?? busiest?.slug;
      if (slug) await this.select(slug);
      else this.loading.set(false);
    } catch (e) {
      this.error.set(toApiError(e).title);
      this.loading.set(false);
      this.initPromise = null;
    }
  }

  async select(slug: string) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [shop, products] = await Promise.all([firstValueFrom(this.api.shop(slug)), firstValueFrom(this.api.products(slug))]);
      this.shop.set(shop);
      this.products.set(products);
      localStorage.setItem(SHOP_KEY, slug);
      void this.subscribe(shop.id);
    } catch (e) {
      this.error.set(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }

  async reloadProducts() {
    const shop = this.shop();
    if (!shop) return;
    const products = await firstValueFrom(this.api.products(shop.slug));
    this.products.set(products);
    this.lastRealtimeUpdate.set(products);
  }

  applyProducts(updated: Product[]) {
    if (!updated.length) return;
    const shopId = this.shop()?.id;
    this.products.update((list) => {
      const next = [...list];
      for (const p of updated) {
        if (p.shopId !== shopId) continue;
        const idx = next.findIndex((x) => x.id === p.id);
        if (!p.isActive) { if (idx >= 0) next.splice(idx, 1); continue; }
        if (idx >= 0) next[idx] = p;
        else next.push(p);
      }
      return next;
    });
    this.lastRealtimeUpdate.set(updated);
  }

  private async subscribe(shopId: number) {
    if (!this.hub) {
      this.hub = createHub();
      this.hub.on('productsChanged', (products: Product[]) => this.applyProducts(products));
      this.hub.on('productRemoved', (id: number) => this.products.update((list) => list.filter((p) => p.id !== id)));
      this.hub.on('shopChanged', (shop: ShopPublic) => { if (shop.id === this.shop()?.id) this.shop.set(shop); });
      this.hub.onreconnected(async () => {
        if (this.joinedShopId) await this.hub!.invoke('JoinShop', this.joinedShopId);
        await this.reloadProducts().catch(() => undefined);
      });
    }
    if (!(await startHub(this.hub)) || this.hub.state !== HubConnectionState.Connected) return;
    if (this.joinedShopId === shopId) return;
    if (this.joinedShopId) await this.hub.invoke('LeaveShop', this.joinedShopId).catch(() => undefined);
    await this.hub.invoke('JoinShop', shopId);
    this.joinedShopId = shopId;
  }
}
