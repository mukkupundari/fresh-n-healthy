import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CartStore, maxOrderable } from '../core/cart.store';
import { InrPipe, UnitPipe } from '../shared/pipes';
import { QtyStepperComponent } from '../shared/qty-stepper.component';

@Component({
  selector: 'app-cart-list',
  imports: [LucideAngularModule, InrPipe, UnitPipe, QtyStepperComponent],
  template: `
    <ul class="lines">
      @for (item of cart.items(); track item.product.id) {
        <li class="line">
          <img [src]="item.product.imageUrl" [alt]="item.product.name" />
          <div class="info">
            <div class="top">
              <h4>{{ item.product.name }}</h4>
              <button class="remove" type="button" (click)="cart.remove(item.product)" [attr.aria-label]="'Remove ' + item.product.name">
                <lucide-icon name="trash-2" [size]="16" />
              </button>
            </div>
            <p class="unit muted">{{ item.product.price | inr }} / {{ item.product.unit | unit }}</p>
            <div class="bottom">
              <app-qty-stepper class="stepper" [compact]="true" tone="light"
                [quantity]="item.quantity" [unit]="item.product.unit" [min]="item.product.minOrderQuantity"
                [atMax]="item.quantity >= max(item.product)"
                (increase)="cart.increment(item.product)" (decrease)="cart.decrement(item.product)" />
              <strong class="total tabular">{{ item.lineTotal | inr }}</strong>
            </div>
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .line { display: flex; gap: 12px; padding: 10px; background: var(--white); border: 1px solid var(--line-2); border-radius: 18px; animation: fade-up 0.3s var(--ease-out) backwards; }
    img { width: 76px; height: 76px; border-radius: 14px; object-fit: cover; background: var(--cream-200); flex-shrink: 0; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    h4 { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--ink); }
    .remove { border: 0; background: transparent; color: var(--muted); padding: 2px; border-radius: 8px; }
    .remove:hover { color: var(--danger); }
    .unit { font-size: 12.5px; }
    .bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 6px; }
    .stepper { width: 132px; }
    .total { font-size: 15px; color: var(--forest-900); }
  `,
})
export class CartListComponent {
  protected cart = inject(CartStore);
  protected max = maxOrderable;
}
