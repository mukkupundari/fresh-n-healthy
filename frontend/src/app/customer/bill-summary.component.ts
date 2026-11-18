import { Component, computed, inject, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CartStore } from '../core/cart.store';
import { FulfillmentType, ShopPublic } from '../core/models';
import { ShopStore } from '../core/shop.store';
import { InrPipe } from '../shared/pipes';

export function deliveryFeeFor(shop: ShopPublic | null, subtotal: number, fulfillment: FulfillmentType): number {
  if (!shop || fulfillment === 'Pickup') return 0;
  if (shop.freeDeliveryAbove != null && subtotal >= shop.freeDeliveryAbove) return 0;
  return shop.deliveryFee;
}

export function defaultFulfillment(shop: ShopPublic | null): FulfillmentType {
  return shop && !shop.deliveryEnabled ? 'Pickup' : 'Delivery';
}

export function payableTotal(shop: ShopPublic | null, subtotal: number, fulfillment = defaultFulfillment(shop)): number {
  return subtotal + deliveryFeeFor(shop, subtotal, fulfillment);
}

@Component({
  selector: 'app-bill-summary',
  imports: [LucideAngularModule, InrPipe],
  template: `
    @if (freeGap() > 0) {
      <div class="free">
        <div class="free-text"><lucide-icon name="truck" [size]="16" /> Add <strong>{{ freeGap() | inr }}</strong> more for free delivery</div>
        <div class="bar"><span [style.width.%]="freeProgress()"></span></div>
      </div>
    } @else if (fulfillment() === 'Delivery' && fee() === 0 && cart.subtotal() > 0) {
      <div class="free done"><lucide-icon name="badge-check" [size]="16" /> You've unlocked free delivery</div>
    }
    <dl class="bill">
      <div><dt>Item total</dt><dd class="tabular">{{ cart.subtotal() | inr }}</dd></div>
      <div><dt>{{ fulfillment() === 'Pickup' ? 'Store pickup' : 'Delivery fee' }}</dt>
        <dd class="tabular">@if (fee() === 0) { <span class="free-tag">Free</span> } @else { {{ fee() | inr }} }</dd></div>
      <div class="total"><dt>To pay</dt><dd class="tabular">{{ total() | inr }}</dd></div>
    </dl>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .free { padding: 12px 14px; border-radius: 14px; background: var(--leaf-50); border: 1px dashed var(--leaf-200); font-size: 13px; color: var(--forest-800); }
    .free.done { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--leaf-600); }
    .free-text { display: flex; align-items: center; gap: 8px; }
    .bar { height: 5px; border-radius: 9px; background: var(--leaf-200); margin-top: 8px; overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--leaf-600); border-radius: 9px; transition: width 0.4s var(--ease-out); }
    .bill { margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
    .bill > div { display: flex; justify-content: space-between; }
    dt { color: var(--muted); }
    dd { margin: 0; font-weight: 600; }
    .total { padding-top: 10px; border-top: 1px dashed var(--line); font-size: 16px; }
    .total dt { color: var(--ink); font-weight: 700; }
    .total dd { font-family: var(--font-display); font-size: 20px; color: var(--forest-900); }
    .free-tag { color: var(--leaf-600); font-weight: 700; }
  `,
})
export class BillSummaryComponent {
  readonly fulfillmentInput = input<FulfillmentType | null>(null, { alias: 'fulfillment' });
  protected cart = inject(CartStore);
  protected shop = inject(ShopStore).shop;
  readonly fulfillment = computed(() => this.fulfillmentInput() ?? defaultFulfillment(this.shop()));

  readonly fee = computed(() => deliveryFeeFor(this.shop(), this.cart.subtotal(), this.fulfillment()));
  readonly total = computed(() => this.cart.subtotal() + this.fee());
  readonly freeGap = computed(() => {
    const s = this.shop();
    if (!s || this.fulfillment() === 'Pickup' || s.freeDeliveryAbove == null || s.deliveryFee === 0) return 0;
    return Math.max(0, s.freeDeliveryAbove - this.cart.subtotal());
  });
  readonly freeProgress = computed(() => {
    const s = this.shop();
    return s?.freeDeliveryAbove ? Math.min(100, (this.cart.subtotal() / s.freeDeliveryAbove) * 100) : 0;
  });
}
