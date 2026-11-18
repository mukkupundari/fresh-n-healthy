import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { debounceTime, firstValueFrom, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApi, toApiError } from '../core/api';
import { AdminAuth } from '../core/auth';
import { formatInr, statusLabel } from '../core/format';
import { Dashboard, OrderStatus, Product } from '../core/models';
import { AdminRealtime } from '../core/realtime';
import { InrPipe, QtyPipe, TimeAgoPipe } from '../shared/pipes';
import { EmptyStateComponent, PaymentBadgeComponent, StatusBadgeComponent } from '../shared/ui.components';
import { StockSheetComponent } from './stock-sheet.component';

const STATUS_COLORS: Record<OrderStatus, string> = {
  Pending: '#d99a2b', Confirmed: '#2f6f9f', Processing: '#7aa2c8', ReadyForDelivery: '#a8d45b', Completed: '#2e7d3e', Cancelled: '#c2412d',
};

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, LucideAngularModule, InrPipe, QtyPipe, TimeAgoPipe, StatusBadgeComponent, PaymentBadgeComponent, EmptyStateComponent, StockSheetComponent],
  template: `
    <header class="page-header">
      <div>
        <h1 class="display">{{ greeting() }}, {{ firstName() }}</h1>
        <p>{{ today | date: 'EEEE, d MMMM' }} · Here's how {{ auth.admin()?.shopName }} is doing.</p>
      </div>
      <div class="actions">
        <a class="btn btn-outline" routerLink="/admin/orders"><lucide-icon name="shopping-bag" [size]="17" /> Orders</a>
        <a class="btn btn-primary" routerLink="/admin/products/new"><lucide-icon name="plus" [size]="17" /> Add vegetables</a>
      </div>
    </header>

    @let d = data();
    @if (loading() && !d) {
      <div class="stats">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton" style="height: 128px; border-radius: 20px"></div> }</div>
      <div class="skeleton" style="height: 320px; border-radius: 20px; margin-top: 16px"></div>
    } @else if (d) {
      @if (d.availableProducts + d.soldOutProducts === 0) {
        <div class="hidden-notice card">
          <span class="ic"><lucide-icon name="eye-off" [size]="20" /></span>
          <div>
            <strong>Customers can't see your shop yet</strong>
            <p>Shops appear in the customer store list once they have at least one active vegetable. Add a few to go live.</p>
          </div>
          <a class="btn btn-primary" routerLink="/admin/products/new"><lucide-icon name="plus" [size]="17" /> Add vegetables</a>
        </div>
      }
      <section class="stats">
        <div class="stat hero-stat">
          <span class="s-ic"><lucide-icon name="indian-rupee" [size]="18" /></span>
          <small>Today's sales</small>
          <strong class="display tabular">{{ d.todaySales | inr }}</strong>
          <span class="s-foot">{{ d.todayOrders }} {{ d.todayOrders === 1 ? 'order' : 'orders' }} today</span>
        </div>
        <a class="stat" routerLink="/admin/orders">
          <span class="s-ic amber"><lucide-icon name="clock" [size]="18" /></span>
          <small>Open orders</small>
          <strong class="display tabular">{{ d.pendingOrders }}</strong>
          <span class="s-foot link">Manage orders <lucide-icon name="arrow-right" [size]="13" /></span>
        </a>
        <div class="stat">
          <span class="s-ic green"><lucide-icon name="trending-up" [size]="18" /></span>
          <small>Total sales</small>
          <strong class="display tabular">{{ d.totalSales | inr }}</strong>
          <span class="s-foot">{{ d.completedOrders }} completed · {{ d.cancelledOrders }} cancelled</span>
        </div>
        <a class="stat" routerLink="/admin/customers">
          <span class="s-ic blue"><lucide-icon name="users" [size]="18" /></span>
          <small>Customers</small>
          <strong class="display tabular">{{ d.totalCustomers }}</strong>
          <span class="s-foot">{{ d.totalOrders }} orders all time</span>
        </a>
      </section>

      <section class="inv">
        <a class="inv-tile" routerLink="/admin/products" [queryParams]="{ status: 'available' }"><span class="dot g"></span><strong class="tabular">{{ d.availableProducts }}</strong><small>Available</small></a>
        <a class="inv-tile" routerLink="/admin/products" [queryParams]="{ status: 'low' }"><span class="dot a"></span><strong class="tabular">{{ d.lowStockProducts }}</strong><small>Low stock</small></a>
        <a class="inv-tile" routerLink="/admin/products" [queryParams]="{ status: 'soldout' }"><span class="dot r"></span><strong class="tabular">{{ d.soldOutProducts }}</strong><small>Sold out</small></a>
        <a class="inv-tile" routerLink="/admin/products" [queryParams]="{ status: 'inactive' }"><span class="dot n"></span><strong class="tabular">{{ d.inactiveProducts }}</strong><small>Hidden</small></a>
      </section>

      <div class="grid">
        <section class="card card-pad chart-card">
          <div class="card-head">
            <div><h2>Sales — last 14 days</h2><p class="muted">{{ chartTotal() }}</p></div>
            <div class="segmented sm">
              <button type="button" [class.active]="metric() === 'amount'" (click)="metric.set('amount')">Revenue</button>
              <button type="button" [class.active]="metric() === 'orders'" (click)="metric.set('orders')">Orders</button>
            </div>
          </div>
          <div class="chart" (mouseleave)="hover.set(null)">
            <svg viewBox="0 0 700 230" preserveAspectRatio="none" role="img" aria-label="Sales chart">
              @for (g of gridLines(); track g.y) {
                <line x1="0" x2="700" [attr.y1]="g.y" [attr.y2]="g.y" class="grid-line" />
              }
              @for (b of bars(); track b.date; let i = $index) {
                <rect class="hit" [attr.x]="b.x - 6" y="0" [attr.width]="b.w + 12" height="200" (mouseenter)="hover.set(i)" (click)="hover.set(i)" />
                <rect class="bar" [class.today]="i === bars().length - 1" [class.dim]="hover() !== null && hover() !== i"
                  [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="7" />
              }
            </svg>
            <div class="x-labels">
              @for (b of bars(); track b.date; let i = $index) {
                <span [class.show]="i % 2 === 1 || i === bars().length - 1">{{ b.date | date: 'd MMM' }}</span>
              }
            </div>
            @if (hover() !== null) {
              @let h = bars()[hover()!];
              <div class="tip" [style.left.%]="((h.x + h.w / 2) / 700) * 100">
                <small>{{ h.date | date: 'EEE, d MMM' }}</small>
                <strong>{{ h.amount | inr }}</strong>
                <small>{{ h.orders }} orders</small>
              </div>
            }
          </div>
        </section>

        <section class="card card-pad donut-card">
          <div class="card-head"><div><h2>Orders by status</h2><p class="muted">{{ d.totalOrders }} total</p></div></div>
          <div class="donut-wrap">
            <svg viewBox="0 0 120 120" class="donut">
              <circle cx="60" cy="60" r="46" class="track" />
              @for (s of donut(); track s.status) {
                <circle cx="60" cy="60" r="46" class="seg" [attr.stroke]="s.color" [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset" />
              }
            </svg>
            <div class="donut-center"><strong class="display tabular">{{ d.totalOrders }}</strong><small>orders</small></div>
          </div>
          <ul class="legend">
            @for (s of d.statusBreakdown; track s.status) {
              <li><span class="sw" [style.background]="color(s.status)"></span><span>{{ label(s.status) }}</span><strong class="tabular">{{ s.count }}</strong></li>
            }
          </ul>
        </section>

        <section class="card list-card">
          <div class="card-head pad"><div><h2>Low stock</h2><p class="muted">Restock before customers see "sold out"</p></div><a routerLink="/admin/inventory" class="link">Inventory</a></div>
          @if (d.lowStock.length) {
            <ul class="rows">
              @for (p of d.lowStock; track p.id) {
                <li>
                  <img class="thumb" [src]="p.imageUrl" alt="" />
                  <div class="r-main"><strong>{{ p.name }}</strong>
                    <small [class.red]="p.stockQuantity <= 0">{{ p.stockQuantity <= 0 ? 'Sold out' : (p.stockQuantity | qty: p.unit) + ' left' }}</small>
                  </div>
                  <button class="btn btn-sm btn-outline" type="button" (click)="stockFor.set(p)"><lucide-icon name="plus" [size]="14" /> Restock</button>
                </li>
              }
            </ul>
          } @else {
            <app-empty-state icon="package-check" title="All stocked up" message="No products are running low right now." />
          }
        </section>

        <section class="card list-card">
          <div class="card-head pad"><div><h2>Top sellers</h2><p class="muted">Last 30 days by revenue</p></div></div>
          @if (d.topProducts.length) {
            <ul class="rows">
              @for (t of d.topProducts; track t.productId; let i = $index) {
                <li>
                  <span class="rank">{{ i + 1 }}</span>
                  <img class="thumb" [src]="t.imageUrl" alt="" />
                  <div class="r-main"><strong>{{ t.name }}</strong><small class="muted">{{ t.quantity | qty: t.unit }} sold</small></div>
                  <strong class="tabular">{{ t.revenue | inr }}</strong>
                </li>
              }
            </ul>
          } @else {
            <app-empty-state icon="bar-chart-3" title="No sales yet" message="Your best-selling vegetables will appear here." />
          }
        </section>

        <section class="card recent">
          <div class="card-head pad"><div><h2>Recent orders</h2></div><a routerLink="/admin/orders" class="link">View all</a></div>
          @if (d.recentOrders.length) {
            <ul class="rows">
              @for (o of d.recentOrders; track o.id) {
                <li>
                  <a class="order-row" [routerLink]="['/admin/orders', o.id]">
                    <div class="r-main"><strong class="tabular">{{ o.orderNumber }}</strong><small class="muted">{{ o.customerName }} · {{ o.createdAt | timeAgo }}</small></div>
                    <div class="r-mid only-desktop"><app-payment-badge [status]="o.paymentStatus" [method]="o.paymentMethod" /></div>
                    <app-status-badge [status]="o.status" />
                    <strong class="tabular amt">{{ o.total | inr }}</strong>
                  </a>
                </li>
              }
            </ul>
          } @else {
            <app-empty-state icon="receipt-text" title="No orders yet" message="Share your storefront link to get your first order." />
          }
        </section>
      </div>
    } @else if (error()) {
      <app-empty-state icon="circle-alert" title="Couldn't load the dashboard" [message]="error()">
        <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
      </app-empty-state>
    }

    <app-stock-sheet [product]="stockFor()" (close)="stockFor.set(null)" (saved)="load()" />
  `,
  styles: `
    .hidden-notice { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 16px 18px; margin-bottom: 16px; border: 1px solid #f0d9a8; background: #fdf6e6; }
    .hidden-notice .ic { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: #f7e4b8; color: #8a5a00; flex-shrink: 0; }
    .hidden-notice div { flex: 1 1 240px; min-width: 0; }
    .hidden-notice strong { display: block; font-size: 15px; }
    .hidden-notice p { margin: 2px 0 0; font-size: 13.5px; color: var(--ink-600, #5b6560); }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .stat { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 16px; border-radius: var(--r-lg); background: var(--white); border: 1px solid var(--line-2); box-shadow: var(--shadow-xs); transition: transform .2s var(--ease-out), box-shadow .2s; }
    a.stat:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .stat small { font-size: 12.5px; font-weight: 600; color: var(--muted); margin-top: 8px; }
    .stat strong { font-size: 26px; line-height: 1.1; }
    .s-foot { font-size: 12px; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
    .s-foot.link { color: var(--leaf-600); font-weight: 700; }
    .s-ic { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; background: var(--leaf-100); color: var(--leaf-600); }
    .s-ic.amber { background: var(--amber-50); color: var(--amber); } .s-ic.blue { background: var(--sky-50); color: var(--sky); } .s-ic.green { background: var(--leaf-100); color: var(--leaf-600); }
    .hero-stat { background: radial-gradient(130% 120% at 100% 0%, #2a5a3b, var(--forest-950)); border: 0; color: var(--white); }
    .hero-stat small, .hero-stat .s-foot { color: rgba(255,255,255,.7); }
    .hero-stat .s-ic { background: var(--lime-400); color: var(--forest-950); }
    .inv { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0 16px; }
    .inv-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 14px; border-radius: 16px; background: var(--white); border: 1px solid var(--line-2); position: relative; }
    .inv-tile strong { font-size: 20px; }
    .inv-tile small { font-size: 12px; color: var(--muted); font-weight: 600; }
    .inv-tile .dot { position: absolute; top: 14px; right: 14px; }
    .dot.g { color: var(--leaf-500); } .dot.a { color: var(--amber); } .dot.r { color: var(--danger); } .dot.n { color: var(--cream-300); }
    .grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .card-head.pad { padding: 18px 18px 0; margin-bottom: 6px; }
    .card-head h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; }
    .card-head p { font-size: 13px; margin-top: 2px; }
    .link { color: var(--leaf-600); font-weight: 700; font-size: 13.5px; }
    .segmented.sm button { height: 32px; padding: 0 12px; font-size: 12.5px; }
    .chart { position: relative; }
    .chart svg { width: 100%; height: 220px; display: block; overflow: visible; }
    .grid-line { stroke: var(--line-2); stroke-width: 1; stroke-dasharray: 4 4; }
    .bar { fill: var(--leaf-200); transition: fill .15s, opacity .15s; }
    .bar.today { fill: var(--leaf-600); }
    .bar.dim { opacity: .45; }
    .hit { fill: transparent; cursor: pointer; }
    .hit:hover + .bar { fill: var(--forest-800); }
    .x-labels { display: grid; grid-template-columns: repeat(14, 1fr); margin-top: 6px; font-size: 10.5px; color: var(--muted); text-align: center; }
    .x-labels span { visibility: hidden; white-space: nowrap; }
    .x-labels span.show { visibility: visible; }
    .tip { position: absolute; top: -6px; transform: translateX(-50%); background: var(--forest-950); color: var(--white); padding: 8px 12px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; line-height: 1.25; pointer-events: none; box-shadow: var(--shadow-md); white-space: nowrap; }
    .tip small { font-size: 11px; opacity: .75; }
    .tip strong { font-size: 15px; }
    .donut-wrap { position: relative; width: 170px; margin: 4px auto 18px; }
    .donut { width: 100%; transform: rotate(-90deg); }
    .donut circle { fill: none; stroke-width: 14; }
    .donut .track { stroke: var(--cream-200); }
    .donut .seg { transition: stroke-dasharray .6s var(--ease-out); }
    .donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .donut-center strong { font-size: 30px; line-height: 1; }
    .donut-center small { font-size: 12px; color: var(--muted); }
    .legend { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 13px; }
    .legend li { display: flex; align-items: center; gap: 8px; }
    .legend span:nth-child(2) { flex: 1; color: var(--ink-2); }
    .sw { width: 10px; height: 10px; border-radius: 3px; }
    .rows { list-style: none; margin: 0; padding: 4px 8px 10px; }
    .rows li { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 14px; }
    .rows li:hover { background: var(--cream-50); }
    .r-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
    .r-main strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .r-main small { font-size: 12.5px; color: var(--amber); font-weight: 600; }
    .r-main small.muted { color: var(--muted); font-weight: 500; }
    .r-main small.red { color: var(--danger); }
    .rank { width: 22px; font-weight: 800; color: var(--muted); font-size: 13px; text-align: center; }
    .recent .rows li { padding: 0; }
    .order-row { display: flex; align-items: center; gap: 12px; padding: 12px 10px; width: 100%; }
    .amt { min-width: 72px; text-align: right; }
    @media (min-width: 900px) {
      .stats { grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .stat { padding: 20px; }
      .stat strong { font-size: 30px; }
      .grid { grid-template-columns: repeat(12, 1fr); }
      .chart-card { grid-column: span 8; }
      .donut-card { grid-column: span 4; }
      .list-card { grid-column: span 6; }
      .recent { grid-column: span 12; }
    }
    @media (max-width: 520px) { .inv-tile strong { font-size: 17px; } .inv-tile { padding: 10px; } .inv-tile .dot { top: 12px; right: 10px; } }
  `,
})
export class DashboardPage {
  protected auth = inject(AdminAuth);
  private api = inject(AdminApi);
  readonly today = new Date();
  readonly data = signal<Dashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly metric = signal<'amount' | 'orders'>('amount');
  readonly hover = signal<number | null>(null);
  readonly stockFor = signal<Product | null>(null);

  readonly firstName = computed(() => this.auth.admin()?.fullName.split(' ')[0] ?? '');
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });

  readonly bars = computed(() => {
    const series = this.data()?.salesLast14Days ?? [];
    const key = this.metric();
    const max = Math.max(1, ...series.map((s) => (key === 'amount' ? s.amount : s.orders)));
    const slot = 700 / Math.max(1, series.length);
    const w = slot * 0.62;
    return series.map((s, i) => {
      const v = key === 'amount' ? s.amount : s.orders;
      const h = Math.max(v > 0 ? 6 : 3, (v / max) * 190);
      return { ...s, x: i * slot + (slot - w) / 2, w, h, y: 200 - h };
    });
  });
  readonly gridLines = computed(() => [0, 1, 2, 3].map((i) => ({ y: 10 + i * 63.3 })));
  readonly chartTotal = computed(() => {
    const s = this.data()?.salesLast14Days ?? [];
    const amount = s.reduce((t, d) => t + d.amount, 0);
    const orders = s.reduce((t, d) => t + d.orders, 0);
    return `${formatInr(amount)} from ${orders} orders`;
  });
  readonly donut = computed(() => {
    const list = this.data()?.statusBreakdown ?? [];
    const total = list.reduce((t, s) => t + s.count, 0) || 1;
    const c = 2 * Math.PI * 46;
    let acc = 0;
    return list.filter((s) => s.count > 0).map((s) => {
      const len = (s.count / total) * c;
      const seg = { status: s.status, color: STATUS_COLORS[s.status], dash: `${Math.max(0, len - 1.5)} ${c}`, offset: -acc };
      acc += len;
      return seg;
    });
  });

  constructor() {
    void this.load();
    const rt = inject(AdminRealtime);
    merge(rt.orderChanged, rt.productsChanged).pipe(debounceTime(800), takeUntilDestroyed(inject(DestroyRef))).subscribe(() => void this.load());
  }

  color(s: OrderStatus) { return STATUS_COLORS[s]; }
  label(s: OrderStatus) { return statusLabel(s); }

  async load() {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.api.dashboard()));
      this.error.set(null);
    } catch (e) {
      this.error.set(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }
}
