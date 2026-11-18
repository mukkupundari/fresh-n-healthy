import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CartStore } from '../core/cart.store';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { InrPipe } from '../shared/pipes';
import { ShopStore } from '../core/shop.store';
import { BillSummaryComponent, payableTotal } from './bill-summary.component';
import { CartListComponent } from './cart-list.component';

/** Signature floating cart: slides up once the cart has items and opens a compact cart sheet. */
@Component({
  selector: 'app-mini-cart',
  imports: [LucideAngularModule, InrPipe, BottomSheetComponent, CartListComponent, BillSummaryComponent],
  template: `
    @if (visible()) {
      <div class="dock" [class.raised]="raised()">
        <button class="bar" type="button" [class.bump]="bumping()" (click)="cart.sheetOpen.set(true)" aria-label="View cart">
          <span class="thumbs">
            @for (item of thumbs(); track item.product.id) {
              <img [src]="item.product.imageUrl" alt="" />
            }
          </span>
          <span class="meta">
            <span class="count">{{ cart.count() }} {{ cart.count() === 1 ? 'item' : 'items' }}</span>
            <span class="amount tabular">{{ cart.subtotal() | inr }}</span>
          </span>
          <span class="cta">View cart <lucide-icon name="chevron-right" [size]="18" [strokeWidth]="2.5" /></span>
        </button>
      </div>
    }

    <app-bottom-sheet [open]="cart.sheetOpen()" title="Your basket" [subtitle]="cart.count() + ' items'" (close)="cart.sheetOpen.set(false)">
      <div class="sheet-body">
        <app-cart-list />
        <div class="bill card card-pad"><app-bill-summary /></div>
      </div>
      <div sheet-footer class="sheet-foot">
        <button class="btn btn-dark btn-lg btn-block checkout" type="button" (click)="checkout()">
          <span class="tabular">{{ payable() | inr }}</span>
          <span class="go">Proceed to Checkout <lucide-icon name="arrow-right" [size]="18" /></span>
        </button>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .dock {
      position: fixed; left: 0; right: 0; z-index: 60; padding: 0 12px; pointer-events: none;
      bottom: calc(14px + var(--safe-bottom)); animation: dock-in 0.45s var(--ease-spring) both;
    }
    .dock.raised { bottom: calc(var(--tabbar-h) + 10px + var(--safe-bottom)); }
    @media (min-width: 900px) { .dock, .dock.raised { bottom: 24px; } }
    @keyframes dock-in { from { transform: translateY(140%); opacity: 0; } to { transform: none; opacity: 1; } }
    .bar {
      pointer-events: auto; width: 100%; max-width: 560px; margin: 0 auto; display: flex; align-items: center; gap: 12px;
      height: 64px; padding: 0 8px 0 10px; border: 0; border-radius: 22px; background: var(--forest-900); color: var(--white);
      box-shadow: 0 14px 34px rgba(12, 33, 22, 0.35); text-align: left; transition: transform 0.2s var(--ease-out);
    }
    .bar:active { transform: scale(0.98); }
    .bar.bump { animation: bump 0.4s var(--ease-out); }
    .thumbs { display: flex; flex-shrink: 0; }
    .thumbs img { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; border: 2px solid var(--forest-900); background: var(--cream-200); }
    .thumbs img + img { margin-left: -14px; }
    .meta { display: flex; flex-direction: column; line-height: 1.2; flex: 1; min-width: 0; }
    .count { font-size: 12px; color: rgba(255,255,255,.7); font-weight: 600; }
    .amount { font-family: var(--font-display); font-size: 19px; font-weight: 600; }
    .cta {
      display: inline-flex; align-items: center; gap: 4px; height: 48px; padding: 0 14px 0 18px; border-radius: 16px;
      background: var(--lime-400); color: var(--forest-950); font-weight: 800; font-size: 14px; white-space: nowrap;
    }
    .sheet-body { display: flex; flex-direction: column; gap: 14px; padding-bottom: 16px; }
    .checkout { justify-content: space-between; padding: 0 8px 0 22px; }
    .go { display: inline-flex; align-items: center; gap: 6px; height: 42px; padding: 0 16px; border-radius: 99px; background: var(--lime-400); color: var(--forest-950); }
  `,
})
export class MiniCartComponent {
  readonly hidden = input(false);
  readonly raised = input(true);
  protected cart = inject(CartStore);
  private router = inject(Router);
  private shop = inject(ShopStore).shop;
  readonly payable = computed(() => payableTotal(this.shop(), this.cart.subtotal()));

  readonly visible = computed(() => !this.hidden() && !this.cart.isEmpty());
  readonly thumbs = computed(() => this.cart.items().slice(-3).reverse());
  readonly bumping = signal(false);

  constructor() {
    let first = true;
    effect(() => {
      this.cart.pulse();
      if (first) { first = false; return; }
      this.bumping.set(false);
      requestAnimationFrame(() => this.bumping.set(true));
      setTimeout(() => this.bumping.set(false), 420);
    });
    effect(() => { if (this.cart.isEmpty()) this.cart.sheetOpen.set(false); });
  }

  checkout() {
    this.cart.sheetOpen.set(false);
    this.router.navigate(['/checkout']);
  }
}
