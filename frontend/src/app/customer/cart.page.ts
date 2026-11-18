import { Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CartStore } from '../core/cart.store';
import { ShopStore } from '../core/shop.store';
import { InrPipe } from '../shared/pipes';
import { EmptyStateComponent } from '../shared/ui.components';
import { BillSummaryComponent, payableTotal } from './bill-summary.component';
import { CartListComponent } from './cart-list.component';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, LucideAngularModule, InrPipe, EmptyStateComponent, CartListComponent, BillSummaryComponent],
  template: `
    <div class="container page-enter">
      <header class="page-head">
        <button class="icon-btn" type="button" (click)="location.back()" aria-label="Back"><lucide-icon name="arrow-left" [size]="20" /></button>
        <h1 class="display">Cart</h1>
        @if (!cart.isEmpty()) { <button class="btn btn-ghost btn-sm" (click)="cart.clear()">Clear</button> } @else { <span style="width:42px"></span> }
      </header>

      @if (cart.isEmpty()) {
        <app-empty-state icon="shopping-basket" title="Your basket is empty" message="Fresh vegetables are just a tap away. Add a few favourites to get started.">
          <a class="btn btn-primary" routerLink="/">Start shopping</a>
        </app-empty-state>
      } @else {
        <div class="layout">
          <section>
            <p class="from muted"><lucide-icon name="store" [size]="15" /> From <strong>{{ shop()?.name }}</strong> · {{ cart.count() }} {{ cart.count() === 1 ? 'item' : 'items' }}</p>
            <app-cart-list />
          </section>
          <aside class="summary card card-pad">
            <h2>Order summary</h2>
            <app-bill-summary />
            <a class="btn btn-dark btn-lg btn-block go" routerLink="/checkout">
              <span class="tabular">{{ payable() | inr }}</span>
              <span class="pill">Checkout <lucide-icon name="arrow-right" [size]="18" /></span>
            </a>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .page-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; }
    .page-head h1 { font-size: 22px; }
    .from { display: flex; align-items: center; gap: 6px; font-size: 13.5px; margin-bottom: 12px; }
    .from strong { color: var(--forest-900); }
    .layout { display: grid; gap: 16px; }
    .summary { display: flex; flex-direction: column; gap: 14px; }
    .summary h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; }
    .go { justify-content: space-between; padding: 0 8px 0 22px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; height: 42px; padding: 0 16px; border-radius: 99px; background: var(--lime-400); color: var(--forest-950); }
    @media (min-width: 900px) { .layout { grid-template-columns: 1.4fr 1fr; align-items: start; gap: 28px; } .summary { position: sticky; top: 96px; } .page-head h1 { font-size: 30px; } }
  `,
})
export class CartPage {
  protected cart = inject(CartStore);
  protected shop = inject(ShopStore).shop;
  protected location = inject(Location);
  readonly payable = computed(() => payableTotal(this.shop(), this.cart.subtotal()));
  constructor() { void inject(ShopStore).init(); }
}
