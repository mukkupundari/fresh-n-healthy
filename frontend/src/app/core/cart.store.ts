import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { floorToStep, formatQty, roundQty } from './format';
import { CartLine, Product } from './models';
import { ShopStore } from './shop.store';
import { ToastService } from './toast.service';

const CART_KEY = 'fh_cart_v1';

export interface CartItem { product: Product; quantity: number; lineTotal: number; }

function load(): Record<number, CartLine[]> {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? '{}'); } catch { return {}; }
}

export function lineTotal(price: number, qty: number) {
  return Math.round(price * qty * 100) / 100;
}

/** Largest orderable quantity for a product given current stock. */
export function maxOrderable(p: Product): number {
  return p.stockQuantity >= p.minOrderQuantity ? floorToStep(p.stockQuantity, p.stepQuantity) : 0;
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  private shopStore = inject(ShopStore);
  private toast = inject(ToastService);
  private byShop = signal<Record<number, CartLine[]>>(load());

  /** Incremented on every change so the floating cart can play a subtle bump animation. */
  readonly pulse = signal(0);
  readonly sheetOpen = signal(false);

  readonly lines = computed(() => {
    const shop = this.shopStore.shop();
    return shop ? this.byShop()[shop.id] ?? [] : [];
  });

  readonly items = computed<CartItem[]>(() => {
    const map = this.shopStore.productMap();
    return this.lines()
      .map((l) => ({ product: map.get(l.productId)!, quantity: l.quantity }))
      .filter((i) => !!i.product)
      .map((i) => ({ ...i, lineTotal: lineTotal(i.product.price, i.quantity) }));
  });

  readonly count = computed(() => this.items().length);
  readonly subtotal = computed(() => Math.round(this.items().reduce((s, i) => s + i.lineTotal, 0) * 100) / 100);
  readonly isEmpty = computed(() => this.count() === 0);

  constructor() {
    effect(() => localStorage.setItem(CART_KEY, JSON.stringify(this.byShop())));

    // Reconcile the cart whenever another customer's order (or an admin edit) changes stock.
    effect(() => {
      const updated = this.shopStore.lastRealtimeUpdate();
      untracked(() => this.reconcile(updated, true));
    });
  }

  quantityOf(productId: number): number {
    return this.lines().find((l) => l.productId === productId)?.quantity ?? 0;
  }

  add(product: Product, quantity: number) {
    const max = maxOrderable(product);
    if (max <= 0) { this.toast.warning(`${product.name} is sold out.`); return; }
    const current = this.quantityOf(product.id);
    const next = Math.min(roundQty(current + quantity), max);
    if (next === current) { this.toast.warning(`Only ${formatQty(max, product.unit)} of ${product.name} available.`); return; }
    if (current + quantity > max) this.toast.warning(`Only ${formatQty(max, product.unit)} of ${product.name} available — added the maximum.`);
    this.write(product.shopId, product.id, next);
  }

  increment(product: Product) {
    const current = this.quantityOf(product.id);
    const max = maxOrderable(product);
    if (current >= max) { this.toast.warning(`That's all the ${product.name} we have right now.`); return; }
    this.write(product.shopId, product.id, Math.min(roundQty(current + product.stepQuantity), max));
  }

  decrement(product: Product) {
    const next = roundQty(this.quantityOf(product.id) - product.stepQuantity);
    this.write(product.shopId, product.id, next < product.minOrderQuantity ? 0 : next);
  }

  remove(product: Product) { this.write(product.shopId, product.id, 0); }

  clear(shopId?: number) {
    const id = shopId ?? this.shopStore.shop()?.id;
    if (id == null) return;
    this.byShop.update((all) => ({ ...all, [id]: [] }));
  }

  /** Clamps cart lines to the given (fresh) product data. Returns true when anything changed. */
  reconcile(products: Product[], notify: boolean): boolean {
    let changed = false;
    for (const p of products) {
      const qty = this.quantityOf(p.id);
      if (!qty) continue;
      const max = p.isActive ? maxOrderable(p) : 0;
      if (qty <= max) continue;
      changed = true;
      this.write(p.shopId, p.id, max, false);
      if (!notify) continue;
      if (max === 0) this.toast.warning(`${p.name} just sold out and was removed from your cart.`);
      else this.toast.warning(`Only ${formatQty(max, p.unit)} of ${p.name} left — your cart was updated.`);
    }
    return changed;
  }

  private write(shopId: number, productId: number, quantity: number, pulse = true) {
    this.byShop.update((all) => {
      const lines = (all[shopId] ?? []).filter((l) => l.productId !== productId);
      const existingIndex = (all[shopId] ?? []).findIndex((l) => l.productId === productId);
      if (quantity > 0) {
        const line = { productId, quantity: roundQty(quantity) };
        if (existingIndex >= 0) lines.splice(existingIndex, 0, line);
        else lines.push(line);
      }
      return { ...all, [shopId]: lines };
    });
    if (pulse) this.pulse.update((n) => n + 1);
  }
}
