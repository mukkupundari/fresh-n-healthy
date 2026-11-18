import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { AdminApi, toApiError } from '../core/api';
import { ORDER_STATUSES, statusLabel } from '../core/format';
import { OrderStatus, OrderSummary, PagedResult, PaymentStatus } from '../core/models';
import { AdminRealtime } from '../core/realtime';
import { ToastService } from '../core/toast.service';
import { InrPipe, TimeAgoPipe } from '../shared/pipes';
import { EmptyStateComponent, PaymentBadgeComponent, StatusBadgeComponent } from '../shared/ui.components';
import { AdminState } from './admin-state';

@Component({
  selector: 'app-admin-orders',
  imports: [DatePipe, FormsModule, RouterLink, LucideAngularModule, InrPipe, TimeAgoPipe, StatusBadgeComponent, PaymentBadgeComponent, EmptyStateComponent],
  template: `
    <header class="page-header">
      <div>
        <h1 class="display">Orders</h1>
        <p>
          @if (state.pendingOrders() > 0) { <span class="pending-pill"><span class="pulse"></span>{{ state.pendingOrders() }} waiting for confirmation</span> }
          @else { New orders appear here instantly. }
        </p>
      </div>
      <div class="actions">
        <button class="btn btn-outline" type="button" (click)="load()"><lucide-icon name="refresh-cw" [size]="16" /> Refresh</button>
      </div>
    </header>

    <div class="chip-row no-scrollbar tabs">
      <button type="button" class="chip" [class.active]="status() === null" (click)="setStatus(null)">All</button>
      @for (s of statuses; track s) {
        <button type="button" class="chip" [class.active]="status() === s" (click)="setStatus(s)">
          {{ label(s) }}
          @if (s === 'Pending' && state.pendingOrders() > 0) { <span class="n">{{ state.pendingOrders() }}</span> }
        </button>
      }
    </div>

    <div class="toolbar">
      <label class="search-box">
        <lucide-icon name="search" [size]="17" />
        <input class="input" type="search" placeholder="Order number, customer name or phone" [ngModel]="search" (ngModelChange)="onSearch($event)" />
      </label>
      <select class="select pay" [ngModel]="payment()" (ngModelChange)="payment.set($event); page.set(1); load()">
        <option [ngValue]="null">Any payment</option>
        <option [ngValue]="'Pending'">Payment pending</option>
        <option [ngValue]="'Paid'">Paid</option>
        <option [ngValue]="'Refunded'">Refunded</option>
        <option [ngValue]="'Failed'">Failed</option>
      </select>
    </div>

    @let r = result();
    @if (loading() && !r) {
      <div class="card">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton sk"></div> }</div>
    } @else if (r) {
      @if (!r.items.length) {
        <div class="card">
          <app-empty-state icon="receipt-text" title="No orders found" [message]="search || status() || payment() ? 'Try clearing the filters.' : 'Share your storefront link to get your first order.'" />
        </div>
      } @else {
        <div class="card table-wrap only-desktop" [class.dim]="loading()">
          <table class="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th class="text-right">Total</th><th></th></tr></thead>
            <tbody>
              @for (o of r.items; track o.id) {
                <tr class="clickable" [class.fresh]="fresh().has(o.orderNumber)" (click)="open(o)">
                  <td><strong class="tabular">{{ o.orderNumber }}</strong><small class="sub">{{ o.createdAt | date: 'd MMM, h:mm a' }}</small></td>
                  <td><span>{{ o.customerName }}</span><small class="sub tabular">+91 {{ o.customerPhone }}</small></td>
                  <td>
                    <span class="thumbs">@for (t of o.thumbnails.slice(0, 3); track $index) { <img [src]="t" alt="" /> }</span>
                    <small class="sub">{{ o.itemCount }} items · {{ o.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery' }}</small>
                  </td>
                  <td><span class="method">{{ o.paymentMethod === 'Upi' ? 'UPI' : 'COD' }}</span> <app-payment-badge [status]="o.paymentStatus" /></td>
                  <td><app-status-badge [status]="o.status" /></td>
                  <td class="text-right tabular"><strong>{{ o.total | inr }}</strong></td>
                  <td class="text-right"><lucide-icon name="chevron-right" [size]="18" class="muted" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <ul class="m-list only-mobile">
          @for (o of r.items; track o.id) {
            <li>
              <a class="card m-card" [class.fresh]="fresh().has(o.orderNumber)" [routerLink]="['/admin/orders', o.id]">
                <div class="m-top">
                  <div><strong class="tabular">{{ o.orderNumber }}</strong><small class="sub">{{ o.customerName }} · {{ o.createdAt | timeAgo }}</small></div>
                  <app-status-badge [status]="o.status" />
                </div>
                <div class="m-bottom">
                  <span class="thumbs">@for (t of o.thumbnails.slice(0, 4); track $index) { <img [src]="t" alt="" /> }</span>
                  <span class="m-pay"><small class="muted">{{ o.itemCount }} items · {{ o.paymentMethod === 'Upi' ? 'UPI' : 'COD' }}</small><app-payment-badge [status]="o.paymentStatus" /></span>
                  <strong class="tabular">{{ o.total | inr }}</strong>
                </div>
              </a>
            </li>
          }
        </ul>

        <nav class="pager">
          <span class="muted">Showing {{ from() }}–{{ to() }} of {{ r.total }}</span>
          <div>
            <button type="button" class="icon-btn" [disabled]="page() <= 1" (click)="go(-1)" aria-label="Previous page"><lucide-icon name="chevron-left" [size]="18" /></button>
            <button type="button" class="icon-btn" [disabled]="to() >= r.total" (click)="go(1)" aria-label="Next page"><lucide-icon name="chevron-right" [size]="18" /></button>
          </div>
        </nav>
      }
    }
  `,
  styles: `
    .pending-pill { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: var(--amber); }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #e0a43a; box-shadow: 0 0 0 0 rgba(224,164,58,.6); animation: ring 1.6s infinite; }
    @keyframes ring { to { box-shadow: 0 0 0 10px rgba(224,164,58,0); } }
    .tabs { margin-bottom: 12px; }
    .chip .n { font-size: 11px; padding: 1px 7px; border-radius: 99px; background: #e8603f; color: var(--white); }
    .pay { width: auto; min-width: 170px; height: 44px; background-color: var(--white); }
    .sk { height: 60px; margin: 10px 16px; }
    .dim { opacity: .6; transition: opacity .2s; }
    .clickable { cursor: pointer; }
    .sub { display: block; font-size: 12.5px; color: var(--muted); margin-top: 2px; }
    .thumbs { display: inline-flex; }
    .thumbs img { width: 28px; height: 28px; border-radius: 8px; object-fit: cover; border: 2px solid var(--white); }
    .thumbs img + img { margin-left: -8px; }
    .method { font-weight: 700; font-size: 12.5px; margin-right: 4px; }
    tr.fresh td, .m-card.fresh { animation: flash 2.4s ease-out; }
    @keyframes flash { 0%, 30% { background: var(--lime-300); } 100% { background: transparent; } }
    .m-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .m-card { display: flex; flex-direction: column; gap: 12px; padding: 14px; }
    .m-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
    .m-bottom { display: flex; align-items: center; gap: 12px; }
    .m-bottom .thumbs img { width: 34px; height: 34px; }
    .m-pay { flex: 1; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
    .m-pay small { font-size: 12px; }
    .m-bottom > strong { font-size: 16px; }
    .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 13.5px; }
    .pager div { display: flex; gap: 8px; }
    .pager .icon-btn:disabled { opacity: .4; }
  `,
})
export class AdminOrdersPage implements OnInit {
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  protected state = inject(AdminState);
  private api = inject(AdminApi);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly statuses = ORDER_STATUSES;
  readonly status = signal<OrderStatus | null>(null);
  readonly payment = signal<PaymentStatus | null>(null);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly result = signal<PagedResult<OrderSummary> | null>(null);
  readonly loading = signal(true);
  readonly fresh = signal(new Set<string>());
  search = '';
  private search$ = new Subject<string>();

  readonly from = computed(() => ((this.result()?.total ?? 0) === 0 ? 0 : (this.page() - 1) * this.pageSize + 1));
  readonly to = computed(() => Math.min(this.page() * this.pageSize, this.result()?.total ?? 0));

  constructor() {
    const destroy = inject(DestroyRef);
    this.search$.pipe(debounceTime(350), takeUntilDestroyed(destroy)).subscribe(() => { this.page.set(1); void this.load(); });
    inject(AdminRealtime).orderChanged.pipe(takeUntilDestroyed(destroy)).subscribe((e) => {
      this.fresh.update((s) => new Set(s).add(e.orderNumber));
      setTimeout(() => this.fresh.update((s) => { const n = new Set(s); n.delete(e.orderNumber); return n; }), 3000);
      void this.load(true);
    });
  }

  ngOnInit() {
    const s = this.statusParam() as OrderStatus;
    if (ORDER_STATUSES.includes(s)) this.status.set(s);
    void this.load();
  }

  label(s: OrderStatus) { return statusLabel(s); }

  setStatus(s: OrderStatus | null) {
    this.status.set(s);
    this.page.set(1);
    this.router.navigate([], { queryParams: { status: s }, replaceUrl: true });
    void this.load();
  }

  onSearch(v: string) {
    this.search = v;
    this.search$.next(v);
  }

  go(delta: number) {
    this.page.update((p) => Math.max(1, p + delta));
    void this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  open(o: OrderSummary) { this.router.navigate(['/admin/orders', o.id]); }

  async load(silent = false) {
    if (!silent) this.loading.set(true);
    try {
      this.result.set(await firstValueFrom(this.api.orders({
        status: this.status(), paymentStatus: this.payment(), search: this.search.trim() || undefined, page: this.page(), pageSize: this.pageSize,
      })));
    } catch (e) {
      if (!silent) this.toast.error(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }
}
