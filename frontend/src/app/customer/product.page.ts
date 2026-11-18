import { Location } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CartStore, lineTotal, maxOrderable } from '../core/cart.store';
import { formatQty, roundQty } from '../core/format';
import { ShopStore } from '../core/shop.store';
import { InrPipe, QtyPipe, UnitPipe } from '../shared/pipes';
import { ProductCardComponent, defaultPreset, quantityPresets } from '../shared/product-card.component';
import { QtyStepperComponent } from '../shared/qty-stepper.component';
import { EmptyStateComponent } from '../shared/ui.components';

@Component({
  selector: 'app-product',
  imports: [RouterLink, LucideAngularModule, InrPipe, QtyPipe, UnitPipe, QtyStepperComponent, ProductCardComponent, EmptyStateComponent],
  template: `
    @if (product(); as p) {
      <div class="page" [class.sold-out]="soldOut()">
        <div class="visual">
          <img [src]="p.imageUrl" [alt]="p.name" />
          @if (soldOut()) { <div class="stamp"><span>Sold out</span></div> }
          <div class="overlay-actions">
            <button class="icon-btn glass" type="button" (click)="back()" aria-label="Go back"><lucide-icon name="arrow-left" [size]="20" /></button>
            <button class="icon-btn glass" type="button" (click)="cart.sheetOpen.set(true)" [disabled]="cart.isEmpty()" aria-label="Open cart">
              <lucide-icon name="shopping-bag" [size]="19" />
              @if (cart.count()) { <span class="count">{{ cart.count() }}</span> }
            </button>
          </div>
        </div>

        <section class="panel">
          <div class="grabber"></div>
          <div class="title-row">
            <div>
              <span class="cat">{{ p.categoryName }}</span>
              <h1 class="display">{{ p.name }}</h1>
            </div>
            <div class="price">
              <span class="amount">{{ p.price | inr }}</span>
              <span class="per">per {{ p.unit | unit }}</span>
            </div>
          </div>

          <div class="avail" [class]="'avail ' + availability().tone"><span class="dot"></span>{{ availability().text }}</div>

          @if (p.description) {
            <div class="block">
              <h2>About this vegetable</h2>
              <p class="desc">{{ p.description }}</p>
            </div>
          }

          <div class="tiles">
            <div class="tile"><span class="ic"><lucide-icon name="bike" [size]="18" /></span><div><small>Delivery time</small><strong>{{ shop()?.deliveryEta }}</strong></div></div>
            <div class="tile"><span class="ic"><lucide-icon name="package" [size]="18" /></span><div><small>Sold in steps of</small><strong>{{ p.stepQuantity | qty: p.unit }}</strong></div></div>
          </div>

          @if (!soldOut()) {
            <div class="block">
              <h2>Choose quantity</h2>
              <div class="presets no-scrollbar">
                @for (q of presets(); track q) {
                  <button class="chip" type="button" [class.active]="q === qty()" (click)="setQty(q)">{{ q | qty: p.unit }}</button>
                }
              </div>
            </div>
          }

          @if (related().length) {
            <div class="block">
              <h2>More from {{ p.categoryName }}</h2>
              <div class="related no-scrollbar">
                @for (r of related(); track r.id) { <app-product-card class="rel" [product]="r" /> }
              </div>
            </div>
          }
        </section>

        <div class="buybar">
          @if (soldOut()) {
            <button class="btn btn-lg btn-block" disabled><lucide-icon name="package-x" [size]="18" /> Sold out — check back tomorrow</button>
          } @else if (inCart() > 0) {
            <div class="incart">
              <app-qty-stepper class="step" [quantity]="inCart()" [unit]="p.unit" [min]="p.minOrderQuantity" [atMax]="inCart() >= max()"
                (increase)="cart.increment(p)" (decrease)="cart.decrement(p)" />
              <a class="btn btn-dark btn-lg" routerLink="/checkout">Checkout <lucide-icon name="arrow-right" [size]="18" /></a>
            </div>
          } @else {
            <div class="pill">
              <div class="pill-qty">
                <button type="button" (click)="step(-1)" [disabled]="qty() <= p.minOrderQuantity" aria-label="Less"><lucide-icon name="minus" [size]="16" [strokeWidth]="2.5" /></button>
                <span class="tabular">{{ qty() | qty: p.unit }}</span>
                <button type="button" (click)="step(1)" [disabled]="qty() >= max()" aria-label="More"><lucide-icon name="plus" [size]="16" [strokeWidth]="2.5" /></button>
              </div>
              <button class="add" type="button" (click)="add()">
                <span>Add to Cart</span><span class="tabular sum">{{ total() | inr }}</span>
              </button>
            </div>
          }
        </div>
      </div>
    } @else if (!store.loading()) {
      <div class="container">
        <app-empty-state icon="package-x" title="Vegetable not found" message="It may have been removed from this store.">
          <a class="btn btn-dark" routerLink="/">Back to shop</a>
        </app-empty-state>
      </div>
    }
  `,
  styles: `
    .page { max-width: 1100px; margin: 0 auto; padding-bottom: 110px; }
    .visual { position: relative; height: 46svh; min-height: 300px; max-height: 480px; background: var(--cream-200); overflow: hidden; }
    .visual img { width: 100%; height: 100%; object-fit: cover; animation: pop .6s var(--ease-out) both; }
    .sold-out .visual img { filter: grayscale(1) contrast(.92); opacity: .8; }
    .stamp { position: absolute; inset: 0; display: grid; place-items: center; }
    .stamp span { padding: 10px 20px; border-radius: 12px; background: rgba(18,48,31,.92); color: var(--white); font-weight: 800; letter-spacing: .16em; text-transform: uppercase; transform: rotate(-6deg); }
    .overlay-actions { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); left: 12px; right: 12px; display: flex; justify-content: space-between; }
    .glass { background: rgba(255,255,255,.85); backdrop-filter: blur(10px); border-color: transparent; position: relative; width: 44px; height: 44px; }
    .count { position: absolute; top: -4px; right: -4px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 99px; background: var(--leaf-600); color: var(--white); font-size: 11px; font-weight: 800; display: grid; place-items: center; }
    .panel { position: relative; margin-top: -28px; background: var(--cream-50); border-radius: 28px 28px 0 0; padding: 8px 18px 20px; display: flex; flex-direction: column; gap: 16px; animation: fade-up .45s var(--ease-out) backwards; }
    .grabber { width: 42px; height: 5px; border-radius: 9px; background: var(--cream-300); margin: 4px auto 0; }
    .title-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
    .cat { font-size: 12px; font-weight: 700; color: var(--leaf-600); text-transform: uppercase; letter-spacing: .08em; }
    h1 { font-size: 32px; margin-top: 4px; }
    .price { text-align: right; display: flex; flex-direction: column; }
    .amount { font-family: var(--font-display); font-size: 30px; font-weight: 600; color: var(--forest-900); line-height: 1; }
    .per { font-size: 12.5px; color: var(--muted); margin-top: 4px; }
    .avail { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13.5px; }
    .avail.green { color: var(--leaf-600); } .avail.amber { color: var(--amber); } .avail.red { color: var(--danger); }
    .block h2 { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
    .desc { color: var(--ink-2); font-size: 14.5px; line-height: 1.6; }
    .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tile { display: flex; gap: 10px; align-items: center; padding: 12px; border-radius: 16px; background: var(--white); border: 1px solid var(--line-2); }
    .tile .ic { width: 36px; height: 36px; border-radius: 12px; background: var(--leaf-100); color: var(--leaf-600); display: grid; place-items: center; flex-shrink: 0; }
    .tile div { display: flex; flex-direction: column; line-height: 1.25; }
    .tile small { font-size: 11.5px; color: var(--muted); }
    .tile strong { font-size: 14px; }
    .presets { display: flex; gap: 8px; overflow-x: auto; }
    .related { display: grid; grid-auto-flow: column; grid-auto-columns: 170px; gap: 12px; overflow-x: auto; padding-bottom: 4px; }

    .buybar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 12px 14px calc(12px + var(--safe-bottom)); background: linear-gradient(180deg, rgba(251,248,241,0), var(--cream-50) 35%); }
    .buybar > * { max-width: 620px; margin: 0 auto; }
    .pill { display: flex; align-items: center; gap: 6px; height: 64px; padding: 6px; border-radius: 99px; background: var(--leaf-600); box-shadow: 0 14px 30px rgba(46,125,62,.35); }
    .pill-qty { display: flex; align-items: center; gap: 4px; color: var(--white); padding-left: 2px; }
    .pill-qty button { width: 36px; height: 36px; border-radius: 50%; border: 0; background: rgba(255,255,255,.18); color: var(--white); display: grid; place-items: center; }
    .pill-qty button:disabled { opacity: .4; }
    .pill-qty span { min-width: 58px; text-align: center; font-weight: 700; font-size: 14px; }
    .add { flex: 1; height: 52px; border: 0; border-radius: 99px; background: var(--white); color: var(--forest-900); font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform .15s var(--ease-out); }
    .add:active { transform: scale(.97); }
    .sum { color: var(--leaf-600); }
    .incart { display: flex; gap: 10px; align-items: center; }
    .incart .step { flex: 1; }
    .incart .btn { flex-shrink: 0; }

    @media (min-width: 900px) {
      .page { display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px; padding: 28px 28px 120px; align-items: start; }
      .visual { height: 560px; max-height: none; border-radius: 32px; position: sticky; top: 96px; }
      .overlay-actions { display: none; }
      .panel { margin-top: 0; border-radius: 0; padding: 8px 0; background: transparent; }
      .grabber { display: none; }
      h1 { font-size: 44px; }
      .buybar { position: sticky; bottom: 20px; grid-column: 2; padding: 0; background: none; }
    }
  `,
})
export class ProductPage {
  readonly id = input.required<string>();
  protected store = inject(ShopStore);
  protected cart = inject(CartStore);
  private location = inject(Location);
  protected shop = this.store.shop;

  readonly product = computed(() => this.store.productMap().get(Number(this.id())) ?? null);
  readonly max = computed(() => { const p = this.product(); return p ? maxOrderable(p) : 0; });
  readonly soldOut = computed(() => this.max() <= 0);
  readonly inCart = computed(() => { const p = this.product(); return p ? this.cart.quantityOf(p.id) : 0; });
  readonly presets = computed(() => { const p = this.product(); return p ? quantityPresets(p) : []; });
  readonly qty = signal(0);
  readonly total = computed(() => lineTotal(this.product()?.price ?? 0, this.qty()));
  readonly related = computed(() => {
    const p = this.product();
    return p ? this.store.products().filter((x) => x.categorySlug === p.categorySlug && x.id !== p.id).slice(0, 8) : [];
  });
  readonly availability = computed(() => {
    const p = this.product();
    if (!p || this.soldOut()) return { tone: 'red', text: 'Sold out for today' };
    if (p.stockQuantity <= p.lowStockThreshold) return { tone: 'amber', text: `Hurry — only ${formatQty(p.stockQuantity, p.unit)} left` };
    return { tone: 'green', text: `In stock · ${formatQty(p.stockQuantity, p.unit)} available` };
  });

  constructor() {
    void this.store.init();
    effect(() => {
      const p = this.product();
      const opts = this.presets();
      if (!p) return;
      const q = this.qty();
      if (q === 0 || q > this.max()) this.qty.set(opts.length ? defaultPreset(p, opts) : p.minOrderQuantity);
    });
  }

  setQty(q: number) { this.qty.set(q); }

  step(dir: 1 | -1) {
    const p = this.product();
    if (!p) return;
    const next = roundQty(this.qty() + dir * p.stepQuantity);
    if (next >= p.minOrderQuantity && next <= this.max()) this.qty.set(next);
  }

  add() {
    const p = this.product();
    if (p) this.cart.add(p, this.qty());
  }

  back() {
    if (history.length > 1) this.location.back();
    else window.location.href = '/';
  }
}
