import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CartStore, maxOrderable } from '../core/cart.store';
import { formatQty } from '../core/format';
import { Product } from '../core/models';
import { InrPipe, ProductNamePipe, QtyPipe, UnitPipe } from './pipes';
import { QtyStepperComponent } from './qty-stepper.component';

const isStep = (q: number, step: number) => step <= 0 || Math.abs(q / step - Math.round(q / step)) < 1e-6;

export function quantityPresets(p: Product): number[] {
  const max = maxOrderable(p);
  const base = p.unit === 'Kg' ? [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5] : [1, 2, 3, 4, 5, 6];
  const list = base.filter((q) => q >= p.minOrderQuantity - 1e-9 && q <= max + 1e-9 && isStep(q, p.stepQuantity));
  if (!list.length && max >= p.minOrderQuantity) return [p.minOrderQuantity];
  return list.slice(0, 7);
}

export function defaultPreset(p: Product, options: number[]): number {
  if (p.unit === 'Kg') return options.find((q) => q >= 0.5) ?? options[0];
  return options[0];
}

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, LucideAngularModule, InrPipe, ProductNamePipe, QtyPipe, UnitPipe, QtyStepperComponent],
  template: `
    @let p = product();
    <article class="pcard" [class.sold-out]="soldOut()" [class.just-added]="justAdded()">
      <a class="media" [routerLink]="preview() ? null : ['/product', p.id]" [attr.aria-label]="p | productName">
        <img [src]="p.imageUrl" [alt]="p | productName" loading="lazy" decoding="async" />
        @if (soldOut()) {
          <div class="stamp"><span>Sold out</span></div>
        } @else if (p.isFeatured) {
          <span class="tag badge lime"><lucide-icon name="sparkles" [size]="12" /> Fresh pick</span>
        }
        @if (inCart() > 0) {
          <span class="in-cart"><lucide-icon name="check" [size]="12" [strokeWidth]="3" /> {{ inCart() | qty: p.unit }}</span>
        }
      </a>

      <div class="body">
        <h3 class="name">{{ p.name }}@if (p.localName) {<span class="te"> / {{ p.localName }}</span>}</h3>
        <div class="price">
          <span class="amount">{{ p.price | inr }}</span>
          <span class="per">/ {{ p.unit | unit }}</span>
        </div>
        <div class="avail" [class]="'avail ' + availability().tone">
          <span class="dot"></span>{{ availability().text }}
        </div>

        <div class="actions">
          @if (soldOut()) {
            <button class="btn btn-block sold-btn" disabled>
              <lucide-icon name="package-x" [size]="16" /> Sold out
            </button>
          } @else if (inCart() > 0) {
            <app-qty-stepper
              [quantity]="inCart()" [unit]="p.unit" [min]="p.minOrderQuantity" [atMax]="inCart() >= max()"
              (increase)="cart.increment(p)" (decrease)="cart.decrement(p)" />
          } @else {
            <div class="add-row">
              <label class="sr-only" [attr.for]="'qty-' + p.id">Quantity</label>
              <select class="qty-select" [id]="'qty-' + p.id" [value]="selected()" (change)="onSelect($event)" [disabled]="preview()">
                @for (q of options(); track q) {
                  <option [value]="q" [selected]="q === selected()">{{ q | qty: p.unit }}</option>
                }
              </select>
              <button class="add-btn" type="button" (click)="add()" [attr.aria-label]="'Add ' + p.name + ' to cart'">
                <lucide-icon name="plus" [size]="16" [strokeWidth]="2.75" /><span>Add</span>
              </button>
            </div>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .pcard {
      height: 100%; display: flex; flex-direction: column; background: var(--white); border-radius: 22px;
      border: 1px solid var(--line-2); box-shadow: var(--shadow-xs); overflow: hidden;
      transition: transform 0.25s var(--ease-out), box-shadow 0.25s var(--ease-out);
    }
    @media (hover: hover) { .pcard:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); } .pcard:hover img { transform: scale(1.04); } }
    .pcard.just-added { animation: card-pulse 0.6s var(--ease-out); }
    @keyframes card-pulse { 0% { box-shadow: 0 0 0 0 rgba(46,125,62,.45); } 100% { box-shadow: 0 0 0 14px rgba(46,125,62,0); } }

    .media { position: relative; display: block; aspect-ratio: 1 / 0.86; margin: 8px 8px 0; border-radius: 16px; overflow: hidden; background: var(--cream-200); }
    .media img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s var(--ease-out), filter 0.4s; }
    .tag { position: absolute; top: 8px; left: 8px; height: 22px; font-size: 10.5px; }
    .in-cart {
      position: absolute; right: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px;
      background: var(--forest-900); color: var(--white); border-radius: 99px; font-size: 11px; font-weight: 700; animation: pop 0.3s var(--ease-spring);
    }

    .body { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; flex: 1; }
    .name { font-size: 15px; font-weight: 700; font-family: var(--font-ui); color: var(--ink); line-height: 1.3; min-height: 2.6em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
    .name .te { font-weight: 600; color: var(--muted); }
    .price { display: flex; align-items: baseline; gap: 4px; }
    .amount { font-family: var(--font-display); font-weight: 600; font-size: 20px; color: var(--forest-900); letter-spacing: -0.01em; }
    .per { font-size: 12.5px; color: var(--muted); font-weight: 500; }
    .avail { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; min-height: 18px; }
    .avail.green { color: var(--leaf-600); }
    .avail.amber { color: var(--amber); }
    .avail.red { color: var(--danger); }
    .avail .dot { width: 6px; height: 6px; }
    .actions { margin-top: auto; padding-top: 8px; min-height: 50px; display: flex; align-items: flex-end; }
    .actions > * { width: 100%; }

    .add-row { display: flex; gap: 6px; height: 42px; }
    .qty-select {
      flex: 1; min-width: 0; height: 42px; padding: 0 20px 0 10px; border-radius: 99px; border: 1.5px solid var(--line); background: var(--cream-50);
      font-weight: 700; font-size: 13px; color: var(--forest-900); appearance: none; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%2312301f' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 4.5 3 3 3-3'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center;
    }
    .qty-select:focus { outline: none; border-color: var(--leaf-600); }
    .add-btn {
      flex-shrink: 0; height: 42px; padding: 0 12px 0 9px; border: 0; border-radius: 99px; background: var(--leaf-600); color: var(--white);
      display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: 13.5px;
      box-shadow: 0 4px 12px rgba(46,125,62,.28); transition: transform 0.15s var(--ease-out), background-color 0.15s;
    }
    .add-btn:hover { background: var(--leaf-500); }
    .add-btn:active { transform: scale(0.94); }
    .sold-btn { height: 42px; background: var(--cream-200); color: var(--muted); font-size: 13.5px; opacity: 1 !important; }

    /* Sold out: same layout, monochrome photo and a clear stamp. */
    .sold-out .media img { filter: grayscale(1) contrast(0.92) brightness(1.02); opacity: 0.78; }
    .sold-out .name, .sold-out .amount { color: var(--muted); }
    .stamp { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(24, 34, 28, 0.12); }
    .stamp span {
      padding: 7px 14px; border-radius: 10px; background: rgba(18, 48, 31, 0.92); color: var(--white); font-weight: 800; font-size: 12.5px;
      letter-spacing: 0.14em; text-transform: uppercase; transform: rotate(-6deg); box-shadow: var(--shadow-md); border: 1.5px solid rgba(255,255,255,.35);
    }

    .body { container-type: inline-size; }
    @container (max-width: 140px) { .add-btn span { display: none; } .add-btn { width: 42px; padding: 0; justify-content: center; } }
    @media (min-width: 640px) { .name { font-size: 16px; } .amount { font-size: 21px; } }
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  /** Admin preview mode: renders the card without touching the cart. */
  readonly preview = input(false);
  protected cart = inject(CartStore);

  readonly max = computed(() => maxOrderable(this.product()));
  readonly soldOut = computed(() => this.max() <= 0);
  readonly inCart = computed(() => (this.preview() ? 0 : this.cart.quantityOf(this.product().id)));
  readonly options = computed(() => quantityPresets(this.product()));
  private chosen = signal<number | null>(null);
  readonly selected = computed(() => {
    const opts = this.options();
    const c = this.chosen();
    return c !== null && opts.includes(c) ? c : defaultPreset(this.product(), opts);
  });
  readonly justAdded = signal(false);

  readonly availability = computed(() => {
    const p = this.product();
    if (this.soldOut()) return { tone: 'red', text: 'Sold out' };
    if (p.stockQuantity <= p.lowStockThreshold) return { tone: 'amber', text: `Only ${formatQty(p.stockQuantity, p.unit)} left` };
    return { tone: 'green', text: 'In stock' };
  });

  onSelect(event: Event) {
    this.chosen.set(Number((event.target as HTMLSelectElement).value));
  }

  add() {
    if (this.preview()) return;
    this.cart.add(this.product(), this.selected());
    this.justAdded.set(true);
    setTimeout(() => this.justAdded.set(false), 650);
  }
}
