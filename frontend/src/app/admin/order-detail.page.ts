import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, toApiError } from '../core/api';
import { ORDER_STATUSES, statusLabel } from '../core/format';
import { Order, OrderStatus, PaymentStatus } from '../core/models';
import { AdminRealtime } from '../core/realtime';
import { ToastService } from '../core/toast.service';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { InrPipe, QtyPipe } from '../shared/pipes';
import { EmptyStateComponent, PaymentBadgeComponent, StatusBadgeComponent } from '../shared/ui.components';
import { AdminState } from './admin-state';

interface NextStep { status: OrderStatus; label: string; icon: string; hint: string; }

@Component({
  selector: 'app-admin-order-detail',
  imports: [DatePipe, FormsModule, RouterLink, LucideAngularModule, InrPipe, QtyPipe, StatusBadgeComponent, PaymentBadgeComponent, EmptyStateComponent, BottomSheetComponent],
  template: `
    @let o = order();
    @if (loading() && !o) {
      <div class="skeleton" style="height: 120px; border-radius: 20px; margin-bottom: 16px"></div>
      <div class="skeleton" style="height: 360px; border-radius: 20px"></div>
    } @else if (o) {
      <header class="page-header">
        <div>
          <a routerLink="/admin/orders" class="crumb"><lucide-icon name="arrow-left" [size]="15" /> Orders</a>
          <h1 class="display tabular">{{ o.orderNumber }} <app-status-badge [status]="o.status" /></h1>
          <p>Placed {{ o.createdAt | date: 'EEE, d MMM y · h:mm a' }} · {{ o.fulfillment === 'Pickup' ? 'Store pickup' : 'Home delivery' }}</p>
        </div>
        <div class="actions">
          <a class="btn btn-outline" [href]="'tel:+91' + o.customerPhone"><lucide-icon name="phone" [size]="16" /> Call customer</a>
          <button class="btn btn-outline" type="button" (click)="print()"><lucide-icon name="receipt-text" [size]="16" /> Print</button>
        </div>
      </header>

      <div class="layout">
        <div class="main-col">
          @if (o.status !== 'Completed' && o.status !== 'Cancelled') {
            <section class="card card-pad action">
              @if (next(); as n) {
                <div class="a-text">
                  <small class="muted">Next step</small>
                  <strong>{{ n.hint }}</strong>
                </div>
                <button class="btn btn-primary btn-lg" type="button" [disabled]="busy()" (click)="setStatus(n.status)">
                  @if (busy()) { <span class="spinner"></span> } @else { <lucide-icon [name]="n.icon" [size]="18" /> } {{ n.label }}
                </button>
              }
              <div class="a-more">
                <label class="label" for="st">Or set status</label>
                <select id="st" class="select sm" [ngModel]="o.status" (ngModelChange)="pickStatus($event)" [disabled]="busy()">
                  @for (s of statuses; track s) { <option [ngValue]="s">{{ label(s, o.fulfillment) }}</option> }
                </select>
                <button class="btn btn-ghost cancel" type="button" (click)="cancelOpen.set(true)"><lucide-icon name="ban" [size]="16" /> Cancel order</button>
              </div>
            </section>
          } @else if (o.status === 'Cancelled') {
            <section class="card card-pad banner red"><lucide-icon name="ban" [size]="18" /><div><strong>Order cancelled</strong><p>{{ o.cancelReason || 'No reason given' }} · Stock was returned to inventory.</p></div></section>
          } @else {
            <section class="card card-pad banner green"><lucide-icon name="badge-check" [size]="18" /><div><strong>Order completed</strong><p>{{ o.fulfillment === 'Pickup' ? 'Picked up by the customer.' : 'Delivered to the customer.' }}</p></div></section>
          }

          <section class="card items-card">
            <h2 class="pad">{{ o.items.length }} items</h2>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
                <tbody>
                  @for (i of o.items; track i.productId) {
                    <tr>
                      <td><span class="cell-main"><img class="thumb" [src]="i.imageUrl" alt="" /><div><strong>{{ i.productName }}</strong></div></span></td>
                      <td class="text-right tabular"><strong>{{ i.quantity | qty: i.unit }}</strong></td>
                      <td class="text-right tabular muted">{{ i.unitPrice | inr }}</td>
                      <td class="text-right tabular"><strong>{{ i.lineTotal | inr }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="totals">
              <div><span>Item total</span><span class="tabular">{{ o.subtotal | inr }}</span></div>
              <div><span>{{ o.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery fee' }}</span><span class="tabular">{{ o.deliveryFee ? (o.deliveryFee | inr) : 'Free' }}</span></div>
              <div class="grand"><span>Total</span><span class="tabular">{{ o.total | inr }}</span></div>
            </div>
          </section>
        </div>

        <aside class="side-col">
          <section class="card card-pad info">
            <h2>Customer</h2>
            <div class="who"><span class="avatar">{{ o.customerName[0] }}</span><div><strong>{{ o.customerName }}</strong><a class="link tabular" [href]="'tel:+91' + o.customerPhone">+91 {{ o.customerPhone }}</a></div></div>
            @if (o.deliveryAddress) {
              <div class="kv"><lucide-icon name="map-pin" [size]="16" /><span>{{ o.deliveryAddress }}</span></div>
            } @else {
              <div class="kv"><lucide-icon name="store" [size]="16" /><span>Customer will pick up from the store</span></div>
            }
            @if (o.notes) { <div class="kv note"><lucide-icon name="pencil" [size]="16" /><span>{{ o.notes }}</span></div> }
          </section>

          <section class="card card-pad info">
            <div class="row-head"><h2>Payment</h2><app-payment-badge [status]="o.paymentStatus" /></div>
            <div class="kv"><lucide-icon [name]="o.paymentMethod === 'Upi' ? 'qr-code' : 'banknote'" [size]="16" /><span>{{ o.paymentMethod === 'Upi' ? 'UPI' : (o.fulfillment === 'Pickup' ? 'Pay at store' : 'Cash on delivery') }} · <strong class="tabular">{{ o.total | inr }}</strong></span></div>
            @if (o.paymentMethod === 'Upi' && o.paymentClaimedAt && o.paymentStatus === 'Pending') {
              <div class="kv ref"><lucide-icon name="check-circle-2" [size]="16" /><span>Customer says they paid · {{ o.paymentClaimedAt | date: 'd MMM, h:mm a' }}</span></div>
            }
            @if (o.paymentReference) {
              <div class="kv ref"><lucide-icon name="receipt-text" [size]="16" /><span>Customer's UPI ref: <strong class="tabular">{{ o.paymentReference }}</strong></span></div>
            } @else if (o.paymentMethod === 'Upi' && o.paymentStatus === 'Pending') {
              <p class="hint">Check your UPI app for {{ o.total | inr }} from {{ o.customerName }} before marking paid.</p>
            }
            <div class="pay-actions">
              @if (o.paymentStatus !== 'Paid') {
                <button class="btn btn-sm btn-primary" type="button" [disabled]="busy()" (click)="setPayment('Paid')"><lucide-icon name="check" [size]="14" /> Mark as paid</button>
              }
              @if (o.paymentStatus === 'Paid') {
                @if (o.status === 'Cancelled') {
                  <button class="btn btn-sm btn-outline" type="button" [disabled]="busy()" (click)="setPayment('Refunded')">Mark refunded</button>
                }
                <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()" (click)="setPayment('Pending')">Undo paid</button>
              }
              @if (o.paymentMethod === 'Upi' && o.paymentStatus === 'Pending') {
                <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()" (click)="setPayment('Failed')">Mark failed</button>
              }
            </div>
          </section>

          <section class="card card-pad info">
            <h2>Timeline</h2>
            <ol class="timeline">
              @for (h of timeline(); track $index) {
                <li [class]="'t-' + h.status">
                  <span class="dot"></span>
                  <div><strong>{{ label(h.status, o.fulfillment) }}</strong><small class="muted">{{ h.changedAt | date: 'd MMM, h:mm a' }} · {{ h.changedBy }}</small>@if (h.note && h.note !== label(h.status, o.fulfillment)) { <p>{{ h.note }}</p> }</div>
                </li>
              }
            </ol>
          </section>
        </aside>
      </div>

      <app-bottom-sheet [open]="cancelOpen()" title="Cancel this order?" subtitle="Items go back into stock and the customer sees the reason." (close)="cancelOpen.set(false)">
        <div class="reasons">
          @for (r of reasons; track r) { <button type="button" class="chip" [class.active]="cancelReason === r" (click)="cancelReason = r">{{ r }}</button> }
        </div>
        <div class="field note-field">
          <label class="label" for="cr">Reason shown to customer</label>
          <input id="cr" class="input" maxlength="300" [(ngModel)]="cancelReason" />
        </div>
        <div sheet-footer class="sheet-actions">
          <button class="btn btn-outline" type="button" (click)="cancelOpen.set(false)">Keep order</button>
          <button class="btn btn-danger" type="button" [disabled]="busy() || !cancelReason.trim()" (click)="setStatus('Cancelled', cancelReason)">@if (busy()) { <span class="spinner"></span> } Cancel order</button>
        </div>
      </app-bottom-sheet>
    } @else {
      <app-empty-state icon="receipt-text" title="Order not found" [message]="error()"><a class="btn btn-primary" routerLink="/admin/orders">Back to orders</a></app-empty-state>
    }
  `,
  styles: `
    .crumb { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--leaf-600); margin-bottom: 6px; }
    .page-header h1 { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .layout { display: grid; gap: 16px; }
    .main-col, .side-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; }
    h2.pad { padding: 18px 18px 6px; }
    .action { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; border: 1.5px solid var(--lime-300); background: linear-gradient(135deg, var(--white), var(--leaf-50)); }
    .a-text { flex: 1; min-width: 200px; display: flex; flex-direction: column; line-height: 1.35; }
    .a-text strong { font-size: 17px; }
    .a-more { width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 14px; border-top: 1px dashed var(--line); }
    .a-more .label { margin: 0; }
    .select.sm { width: auto; min-width: 190px; height: 40px; background-color: var(--white); }
    .cancel { color: var(--danger); margin-left: auto; }
    .banner { display: flex; gap: 12px; align-items: flex-start; }
    .banner p { font-size: 13.5px; margin-top: 2px; color: var(--ink-2); }
    .banner.red { background: var(--danger-50); border-color: #f2cfc6; color: var(--danger); }
    .banner.green { background: var(--leaf-50); border-color: var(--leaf-200); color: var(--leaf-600); }
    .totals { display: flex; flex-direction: column; gap: 8px; padding: 14px 18px 18px; border-top: 1px solid var(--line-2); font-size: 14px; color: var(--ink-2); max-width: 360px; margin-left: auto; width: 100%; }
    .totals div { display: flex; justify-content: space-between; }
    .grand { padding-top: 10px; border-top: 1px dashed var(--line); color: var(--ink); font-weight: 800; font-size: 17px; }
    .info { display: flex; flex-direction: column; gap: 12px; }
    .row-head { display: flex; justify-content: space-between; align-items: center; }
    .who { display: flex; align-items: center; gap: 12px; }
    .who div { display: flex; flex-direction: column; line-height: 1.35; }
    .avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--leaf-100); color: var(--leaf-600); display: grid; place-items: center; font-weight: 800; text-transform: uppercase; }
    .link { color: var(--leaf-600); font-weight: 700; font-size: 14px; }
    .kv { display: flex; gap: 10px; font-size: 14px; color: var(--ink-2); line-height: 1.45; }
    .kv lucide-icon { color: var(--leaf-600); flex-shrink: 0; margin-top: 2px; }
    .kv.note { padding: 10px 12px; border-radius: 12px; background: var(--amber-50); color: #7a4f08; }
    .kv.note lucide-icon { color: var(--amber); }
    .kv.ref { padding: 10px 12px; border-radius: 12px; background: var(--sky-50); }
    .pay-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .timeline li { display: flex; gap: 12px; position: relative; padding-bottom: 16px; }
    .timeline li:last-child { padding-bottom: 0; }
    .timeline li:not(:last-child)::before { content: ''; position: absolute; left: 5px; top: 16px; bottom: 0; width: 2px; background: var(--line); }
    .timeline .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--leaf-500); margin-top: 4px; flex-shrink: 0; color: transparent; }
    .t-Cancelled .dot { background: var(--danger); }
    .t-Pending .dot { background: #e0a43a; }
    .timeline div { display: flex; flex-direction: column; line-height: 1.35; font-size: 14px; }
    .timeline small { font-size: 12px; }
    .timeline p { font-size: 13px; color: var(--ink-2); margin-top: 2px; }
    .reasons { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .note-field { padding-bottom: 10px; }
    .sheet-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (min-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr) 360px; align-items: start; } }
    @media print {
      .actions, .action, .pay-actions, .crumb { display: none !important; }
    }
  `,
})
export class AdminOrderDetailPage {
  readonly id = input.required<string>();
  private api = inject(AdminApi);
  private toast = inject(ToastService);
  private state = inject(AdminState);

  readonly statuses = ORDER_STATUSES;
  readonly reasons = ['Item out of stock', 'Unable to deliver to this address', 'Customer requested cancellation', 'Payment not received', 'Store closed'];
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly cancelOpen = signal(false);
  cancelReason = 'Item out of stock';

  readonly next = computed<NextStep | null>(() => {
    const o = this.order();
    if (!o) return null;
    const pickup = o.fulfillment === 'Pickup';
    switch (o.status) {
      case 'Pending': return { status: 'Confirmed', label: 'Accept order', icon: 'check', hint: 'Review the items and accept this order' };
      case 'Confirmed': return { status: 'Processing', label: 'Start packing', icon: 'package', hint: 'Pick and pack the vegetables' };
      case 'Processing': return { status: 'ReadyForDelivery', label: pickup ? 'Ready for pickup' : 'Ready for delivery', icon: 'package-check', hint: pickup ? 'Let the customer know it is ready' : 'Hand it over for delivery' };
      case 'ReadyForDelivery': return { status: 'Completed', label: pickup ? 'Mark picked up' : 'Mark delivered', icon: 'badge-check', hint: pickup ? 'Customer collected the order' : 'Order reached the customer' };
      default: return null;
    }
  });
  readonly timeline = computed(() => {
    const o = this.order();
    if (!o) return [];
    const hasPending = o.history.some((h) => h.status === 'Pending');
    const list = hasPending ? o.history : [{ status: 'Pending' as OrderStatus, note: null, changedBy: o.customerName, changedAt: o.createdAt }, ...o.history];
    return [...list].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  });

  constructor() {
    effect(() => { this.id(); void this.load(); });
    inject(AdminRealtime).orderChanged.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((e) => {
      if (e.orderNumber === this.order()?.orderNumber && !this.busy()) void this.load(true);
    });
  }

  label(s: OrderStatus, fulfillment: string) {
    if (s === 'Pending') return 'Order placed';
    if (s === 'ReadyForDelivery') return fulfillment === 'Pickup' ? 'Ready for pickup' : 'Ready for delivery';
    return statusLabel(s);
  }

  async load(silent = false) {
    if (!silent) this.loading.set(true);
    try {
      this.order.set(await firstValueFrom(this.api.order(Number(this.id()))));
      this.error.set(null);
    } catch (e) {
      if (!silent) this.error.set(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }

  pickStatus(s: OrderStatus) {
    if (s === 'Cancelled') { this.cancelOpen.set(true); return; }
    void this.setStatus(s);
  }

  async setStatus(status: OrderStatus, note?: string) {
    const o = this.order();
    if (!o || this.busy()) return;
    this.busy.set(true);
    try {
      this.order.set(await firstValueFrom(this.api.updateOrderStatus(o.id, status, note)));
      this.cancelOpen.set(false);
      this.toast.success(status === 'Cancelled' ? 'Order cancelled and stock restored' : `Order marked as ${this.label(status, o.fulfillment).toLowerCase()}`);
      void this.state.refreshPending();
    } catch (e) {
      this.toast.error(toApiError(e).title);
      void this.load(true);
    } finally {
      this.busy.set(false);
    }
  }

  async setPayment(status: PaymentStatus) {
    const o = this.order();
    if (!o) return;
    this.busy.set(true);
    try {
      this.order.set(await firstValueFrom(this.api.updatePaymentStatus(o.id, status)));
      this.toast.success(`Payment marked ${status.toLowerCase()}`);
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.busy.set(false);
    }
  }

  print() { window.print(); }
}
