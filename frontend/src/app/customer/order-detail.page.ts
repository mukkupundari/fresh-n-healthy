import { DatePipe, Location } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CustomerApi, toApiError } from '../core/api';
import { statusLabel } from '../core/format';
import { Order, OrderStatus } from '../core/models';
import { ToastService } from '../core/toast.service';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { InrPipe, QtyPipe } from '../shared/pipes';
import { EmptyStateComponent, PaymentBadgeComponent, StatusBadgeComponent } from '../shared/ui.components';

const FLOW: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'ReadyForDelivery', 'Completed'];
const STEP_COPY: Record<OrderStatus, string> = {
  Pending: 'Waiting for the store to confirm',
  Confirmed: 'Store accepted your order',
  Processing: 'Your vegetables are being packed',
  ReadyForDelivery: 'Packed and ready',
  Completed: 'Delivered — enjoy!',
  Cancelled: 'Order cancelled',
};

@Component({
  selector: 'app-order-detail',
  imports: [DatePipe, RouterLink, LucideAngularModule, InrPipe, QtyPipe, StatusBadgeComponent, PaymentBadgeComponent, EmptyStateComponent, BottomSheetComponent],
  template: `
    <div class="container narrow">
      <header class="page-head">
        <button class="icon-btn" type="button" (click)="location.back()" aria-label="Back"><lucide-icon name="arrow-left" [size]="20" /></button>
        <div class="ttl"><h1 class="display">Order details</h1><small class="muted tabular">{{ number() }}</small></div>
        <button class="icon-btn" type="button" (click)="load(true)" aria-label="Refresh"><lucide-icon name="refresh-cw" [size]="18" [class.spin]="refreshing()" /></button>
      </header>

      @let o = order();
      @if (loading()) {
        <div class="skeleton" style="height: 220px; border-radius: 20px"></div>
        <div class="skeleton" style="height: 260px; border-radius: 20px"></div>
      } @else if (o) {
        <section class="card card-pad status page-enter">
          <div class="st-head">
            <div><small class="muted">{{ o.shopName }}</small><h2>{{ headline() }}</h2></div>
            <app-status-badge [status]="o.status" />
          </div>

          @if (o.status === 'Cancelled') {
            <div class="cancelled"><lucide-icon name="ban" [size]="18" /><div><strong>This order was cancelled.</strong>@if (o.cancelReason) { <p>{{ o.cancelReason }}</p> }</div></div>
          } @else {
            <ol class="timeline">
              @for (s of flow; track s; let i = $index) {
                <li [class.done]="i <= stepIndex()" [class.current]="i === stepIndex()">
                  <span class="dot">@if (i < stepIndex() || (i === stepIndex() && s === 'Completed')) { <lucide-icon name="check" [size]="13" [strokeWidth]="3" /> }</span>
                  <div class="tl-text">
                    <strong>{{ label(s, o.fulfillment) }}</strong>
                    <small class="muted">@if (when(s); as t) { {{ t | date: 'd MMM, h:mm a' }} } @else if (i === stepIndex() + 1) { Up next }</small>
                  </div>
                </li>
              }
            </ol>
          }
        </section>

        @if (o.paymentMethod === 'Upi' && o.paymentStatus === 'Pending' && o.status !== 'Cancelled' && o.payment.upiId) {
          <section class="card card-pad pay page-enter">
            @if (o.paymentClaimedAt || o.paymentReference) {
              <div class="st-head"><h2>Payment being verified</h2><app-payment-badge [status]="o.paymentStatus" /></div>
              <p class="muted">You confirmed paying {{ o.total | inr }}@if (o.paymentReference) { (reference <strong class="tabular">{{ o.paymentReference }}</strong>)}. The store will mark it paid after checking.</p>
            } @else {
              <div class="st-head"><h2>UPI payment pending</h2><app-payment-badge [status]="o.paymentStatus" /></div>
              <p class="muted">Your vegetables are reserved. Pay {{ o.total | inr }} to {{ o.shopName }} to confirm the order.</p>
              <a class="btn btn-primary btn-block" [routerLink]="['/order-success', o.orderNumber]"><lucide-icon name="qr-code" [size]="18" /> Pay {{ o.total | inr }} now</a>
            }
          </section>
        }

        <section class="card card-pad page-enter">
          <h2 class="sec-title">{{ o.items.length }} items</h2>
          <ul class="items">
            @for (i of o.items; track i.productId) {
              <li>
                <img [src]="i.imageUrl" alt="" />
                <div class="it"><strong>{{ i.productName }}</strong><small class="muted">{{ i.quantity | qty: i.unit }} × {{ i.unitPrice | inr }}</small></div>
                <span class="tabular">{{ i.lineTotal | inr }}</span>
              </li>
            }
          </ul>
          <div class="totals">
            <div><span>Item total</span><span class="tabular">{{ o.subtotal | inr }}</span></div>
            <div><span>{{ o.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery fee' }}</span><span class="tabular">{{ o.deliveryFee ? (o.deliveryFee | inr) : 'Free' }}</span></div>
            <div class="grand"><span>Total</span><span class="tabular">{{ o.total | inr }}</span></div>
          </div>
        </section>

        <section class="card card-pad info page-enter">
          <div class="info-row"><lucide-icon [name]="o.fulfillment === 'Pickup' ? 'store' : 'map-pin'" [size]="18" />
            <div><small class="muted">{{ o.fulfillment === 'Pickup' ? 'Store pickup' : 'Deliver to' }}</small><span>{{ o.customerName }} · +91 {{ o.customerPhone }}</span>@if (o.deliveryAddress) { <span class="muted">{{ o.deliveryAddress }}</span> }</div>
          </div>
          <div class="info-row"><lucide-icon name="wallet" [size]="18" />
            <div><small class="muted">Payment</small><span>{{ o.paymentMethod === 'Upi' ? 'UPI' : (o.fulfillment === 'Pickup' ? 'Pay at store' : 'Cash on delivery') }} · <app-payment-badge [status]="o.paymentStatus" /></span></div>
          </div>
          @if (o.notes) {
            <div class="info-row"><lucide-icon name="pencil" [size]="18" /><div><small class="muted">Instructions</small><span>{{ o.notes }}</span></div></div>
          }
          <div class="info-row"><lucide-icon name="phone" [size]="18" />
            <div><small class="muted">Need help?</small><a class="link" [href]="'tel:+91' + o.payment.contactPhone">Call {{ o.shopName }} · +91 {{ o.payment.contactPhone }}</a></div>
          </div>
        </section>

        @if (o.status === 'Pending') {
          <button class="btn btn-ghost cancel-btn" type="button" (click)="cancelOpen.set(true)"><lucide-icon name="x" [size]="16" /> Cancel order</button>
        }
        <div class="bottom-actions">
          <a class="btn btn-outline" [routerLink]="['/orders', o.orderNumber, 'invoice']"><lucide-icon name="receipt-text" [size]="17" /> View invoice</a>
          <a class="btn btn-outline" routerLink="/">Continue shopping</a>
        </div>

        <app-bottom-sheet [open]="cancelOpen()" title="Cancel this order?" subtitle="Items go back to the store's stock right away." (close)="cancelOpen.set(false)">
          <div class="cancel-body">
            <div class="reasons">
              @for (r of reasons; track r) {
                <button type="button" class="chip" [class.active]="cancelReason === r" (click)="cancelReason = r">{{ r }}</button>
              }
            </div>
          </div>
          <div sheet-footer class="cancel-actions">
            <button class="btn btn-outline" type="button" (click)="cancelOpen.set(false)">Keep order</button>
            <button class="btn btn-danger" type="button" [disabled]="busy()" (click)="cancel()">@if (busy()) { <span class="spinner"></span> } Yes, cancel</button>
          </div>
        </app-bottom-sheet>
      } @else {
        <app-empty-state icon="receipt-text" title="Order not found" [message]="error()">
          <a class="btn btn-primary" routerLink="/orders">My orders</a>
        </app-empty-state>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 680px; display: flex; flex-direction: column; gap: 14px; padding-bottom: 40px; }
    .page-head { display: flex; align-items: center; gap: 10px; padding: 14px 0 0; }
    .ttl { flex: 1; display: flex; flex-direction: column; line-height: 1.2; }
    .ttl h1 { font-size: 21px; }
    .spin { animation: spin 0.8s linear infinite; display: inline-flex; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-family: var(--font-ui); font-size: 17px; font-weight: 700; }
    .st-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
    .status { display: flex; flex-direction: column; gap: 18px; }
    .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .timeline li { display: flex; gap: 14px; position: relative; padding-bottom: 18px; }
    .timeline li:last-child { padding-bottom: 0; }
    .timeline li:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 24px; bottom: 0; width: 2px; background: var(--line); }
    .timeline li.done:not(.current)::before { background: var(--leaf-500); }
    .dot { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--line); background: var(--white); display: grid; place-items: center; flex-shrink: 0; color: var(--white); z-index: 1; }
    .done .dot { background: var(--leaf-500); border-color: var(--leaf-500); }
    .current .dot { box-shadow: 0 0 0 5px var(--leaf-100); }
    .current:not(:last-child) .dot { background: var(--white); border: 7px solid var(--leaf-500); }
    .tl-text { display: flex; flex-direction: column; line-height: 1.3; padding-top: 1px; }
    .tl-text strong { font-size: 14.5px; color: var(--muted); font-weight: 600; }
    .done .tl-text strong { color: var(--ink); font-weight: 700; }
    .tl-text small { font-size: 12px; min-height: 15px; }
    .cancelled { display: flex; gap: 10px; padding: 14px; border-radius: 14px; background: var(--danger-50); color: var(--danger); font-size: 14px; }
    .cancelled p { color: var(--ink-2); margin-top: 2px; }
    .pay { display: flex; flex-direction: column; gap: 12px; border: 1.5px solid var(--lime-300); }
    .bottom-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sec-title { margin-bottom: 4px; }
    .items { list-style: none; margin: 0; padding: 12px 0; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--line-2); }
    .items li { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .items img { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; }
    .it { flex: 1; display: flex; flex-direction: column; line-height: 1.3; }
    .it small { font-size: 12.5px; }
    .totals { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; font-size: 14px; color: var(--ink-2); }
    .totals div { display: flex; justify-content: space-between; }
    .grand { padding-top: 10px; border-top: 1px dashed var(--line); color: var(--ink); font-weight: 800; font-size: 16px; }
    .info { display: flex; flex-direction: column; gap: 16px; }
    .info-row { display: flex; gap: 12px; color: var(--ink-2); }
    .info-row lucide-icon { color: var(--leaf-600); margin-top: 2px; }
    .info-row div { display: flex; flex-direction: column; gap: 2px; font-size: 14px; line-height: 1.4; }
    .info-row small { font-size: 12px; }
    .link { color: var(--leaf-600); font-weight: 700; }
    .cancel-btn { color: var(--danger); align-self: center; }
    .cancel-body { padding: 4px 0 8px; }
    .reasons { display: flex; flex-wrap: wrap; gap: 8px; }
    .cancel-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  `,
})
export class OrderDetailPage {
  readonly number = input.required<string>();
  protected location = inject(Location);
  private api = inject(CustomerApi);
  private toast = inject(ToastService);

  readonly flow = FLOW;
  readonly reasons = ['Ordered by mistake', 'Need to change items', 'Delivery is too late', 'Found a better price', 'Other'];
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly cancelOpen = signal(false);
  cancelReason = 'Ordered by mistake';

  readonly stepIndex = computed(() => FLOW.indexOf(this.order()?.status ?? 'Pending'));
  readonly headline = computed(() => {
    const o = this.order();
    if (!o) return '';
    if (o.status === 'ReadyForDelivery') return o.fulfillment === 'Pickup' ? 'Ready for pickup at the store' : 'Out for delivery soon';
    return STEP_COPY[o.status];
  });
  constructor() {
    effect(() => { this.number(); void this.load(); });
    // Customers aren't on a realtime channel; a light poll keeps an open order page current.
    const timer = setInterval(() => {
      const s = this.order()?.status;
      if (s && s !== 'Completed' && s !== 'Cancelled' && document.visibilityState === 'visible') void this.load(true);
    }, 30000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  label(s: OrderStatus, fulfillment: string): string {
    if (s === 'ReadyForDelivery') return fulfillment === 'Pickup' ? 'Ready for pickup' : 'Ready for delivery';
    if (s === 'Completed') return fulfillment === 'Pickup' ? 'Picked up' : 'Delivered';
    if (s === 'Pending') return 'Order placed';
    return statusLabel(s);
  }

  when(s: OrderStatus): string | null {
    const o = this.order();
    if (!o) return null;
    if (s === 'Pending') return o.createdAt;
    return o.history.find((h) => h.status === s)?.changedAt ?? null;
  }

  async load(silent = false) {
    if (silent) this.refreshing.set(true); else this.loading.set(true);
    try {
      this.order.set(await firstValueFrom(this.api.order(this.number())));
      this.error.set(null);
    } catch (e) {
      if (!silent) this.error.set(toApiError(e).title);
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  async cancel() {
    this.busy.set(true);
    try {
      this.order.set(await firstValueFrom(this.api.cancelOrder(this.number(), this.cancelReason)));
      this.cancelOpen.set(false);
      this.toast.success('Your order has been cancelled.');
    } catch (e) {
      this.toast.error(toApiError(e).title);
      void this.load(true);
    } finally {
      this.busy.set(false);
    }
  }
}
