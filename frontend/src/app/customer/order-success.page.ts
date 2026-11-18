import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CustomerApi, toApiError } from '../core/api';
import { upiLink } from '../core/format';
import { Order } from '../core/models';
import { ToastService } from '../core/toast.service';
import { InrPipe, QtyPipe } from '../shared/pipes';
import { EmptyStateComponent, PaymentBadgeComponent, UpiQrComponent, copyText } from '../shared/ui.components';
import { OrderPlacedDialogComponent } from './order-placed-dialog.component';

/** UPI payment step after checkout. Once the customer confirms payment it shows the "Order placed" popup and returns to the home page. */
@Component({
  selector: 'app-order-success',
  imports: [DatePipe, FormsModule, RouterLink, LucideAngularModule, InrPipe, QtyPipe, PaymentBadgeComponent, UpiQrComponent, EmptyStateComponent, OrderPlacedDialogComponent],
  template: `
    <div class="container narrow">
      @let o = order();
      @if (loading()) {
        <div class="loading"><span class="spinner lg"></span></div>
      } @else if (o && awaitingPayment()) {
        <section class="pay-hero page-enter">
          <span class="step"><lucide-icon name="lock" [size]="13" /> Secure UPI payment</span>
          <small>Amount to pay</small>
          <strong class="amount tabular">{{ o.total | inr }}</strong>
          <p>to <b>{{ o.payment.upiPayeeName || o.shopName }}</b> · Order <span class="tabular">{{ o.orderNumber }}</span></p>
        </section>

        <section class="card card-pad pay page-enter">
          <h2>Scan &amp; pay with any UPI app</h2>
          <p class="muted">GPay, PhonePe, Paytm or your bank app. Your vegetables are reserved while you pay.</p>
          <app-upi-qr [imageUrl]="o.payment.upiQrUrl" [link]="link()" />
          <div class="upi-row">
            <div><small class="muted">UPI ID</small><strong class="tabular">{{ o.payment.upiId }}</strong></div>
            <button type="button" class="btn btn-sm btn-outline" (click)="copy(o.payment.upiId!, 'UPI ID copied')"><lucide-icon name="copy" [size]="14" /> Copy</button>
          </div>
          <a class="btn btn-primary btn-lg btn-block" [href]="link()"><lucide-icon name="qr-code" [size]="18" /> Open UPI app to pay {{ o.total | inr }}</a>

          <div class="ref">
            <label class="label" for="utr">UPI reference / UTR <span class="muted">(optional — helps the shop verify faster)</span></label>
            <input id="utr" class="input tabular" name="utr" maxlength="40" inputmode="numeric" placeholder="12-digit UTR from your UPI app" [(ngModel)]="reference" />
          </div>
        </section>

        <a class="later" [routerLink]="['/orders', o.orderNumber]">I'll pay later — view my order</a>

        <div class="paybar">
          <button class="btn btn-dark btn-lg btn-block" type="button" (click)="confirm()" [disabled]="confirming()">
            @if (confirming()) { <span class="spinner"></span> Confirming… } @else { <lucide-icon name="check-circle-2" [size]="18" /> I've paid {{ o.total | inr }} }
          </button>
        </div>
      } @else if (o) {
        <section class="hero page-enter">
          <div class="check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg></div>
          <h1 class="display">Order placed!</h1>
          <p>Thank you, {{ firstName() }}. {{ o.shopName }} has received your order and will confirm it shortly.</p>
          <button type="button" class="order-no" (click)="copy(o.orderNumber, 'Order number copied')">
            <small>Order number</small>
            <strong class="tabular">{{ o.orderNumber }}</strong>
            <lucide-icon name="copy" [size]="14" />
          </button>
        </section>

        @if (o.paymentMethod === 'Upi' && o.paymentStatus === 'Pending' && o.paymentClaimedAt) {
          <div class="note card page-enter"><lucide-icon name="check-circle-2" [size]="18" />
            <span>Payment confirmed@if (o.paymentReference) { with reference <strong class="tabular">{{ o.paymentReference }}</strong>} — the shop will verify it.</span>
          </div>
        }

        <section class="card card-pad page-enter">
          <div class="meta">
            <div><small class="muted">Placed</small><span>{{ o.createdAt | date: 'd MMM, h:mm a' }}</span></div>
            <div><small class="muted">Payment</small><span>{{ o.paymentMethod === 'Upi' ? 'UPI' : (o.fulfillment === 'Pickup' ? 'Pay at store' : 'Cash on delivery') }}</span></div>
            <div><small class="muted">Status</small><app-payment-badge [status]="o.paymentStatus" [method]="o.paymentMethod" /></div>
          </div>
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

        <div class="actions">
          <a class="btn btn-dark btn-lg" [routerLink]="['/orders', o.orderNumber]"><lucide-icon name="truck" [size]="18" /> Track order</a>
          <a class="btn btn-outline btn-lg" [routerLink]="['/orders', o.orderNumber, 'invoice']"><lucide-icon name="receipt-text" [size]="18" /> Invoice</a>
        </div>
      } @else {
        <app-empty-state icon="receipt-text" title="Order not found" [message]="error()">
          <a class="btn btn-primary" routerLink="/orders">My orders</a>
        </app-empty-state>
      }

      @if (placed(); as p) {
        <app-order-placed-dialog [order]="p" (done)="finish()" />
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 560px; display: flex; flex-direction: column; gap: 14px; padding-top: 12px; padding-bottom: 120px; }
    .loading { display: grid; place-items: center; min-height: 60svh; }
    .pay-hero { text-align: center; padding: 22px 18px 24px; border-radius: var(--r-xl); background: radial-gradient(120% 90% at 50% 0%, #1f4a30, var(--forest-950)); color: var(--white); display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .step { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; background: rgba(255,255,255,.12); font-size: 12px; font-weight: 700; margin-bottom: 8px; }
    .pay-hero small { opacity: .75; font-size: 13px; }
    .amount { font-family: var(--font-display); font-size: 44px; line-height: 1.1; color: var(--lime-300); }
    .pay-hero p { opacity: .85; font-size: 13.5px; }
    .pay { display: flex; flex-direction: column; gap: 14px; }
    h2 { font-family: var(--font-ui); font-size: 17px; font-weight: 700; }
    .pay > p { font-size: 13.5px; margin-top: -8px; }
    .upi-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: var(--cream-50); border: 1px dashed var(--line); }
    .upi-row div { display: flex; flex-direction: column; line-height: 1.3; }
    .ref { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; border-top: 1px solid var(--line-2); }
    .ref .label { font-weight: 600; font-size: 13px; color: var(--ink-2); }
    .ref .label .muted { font-weight: 500; }
    .later { text-align: center; font-size: 13.5px; font-weight: 600; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
    .paybar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 12px 16px calc(12px + var(--safe-bottom)); background: rgba(255,255,255,.95); backdrop-filter: blur(12px); border-top: 1px solid var(--line-2); }
    .paybar .btn { display: flex; width: 100%; max-width: 528px; margin: 0 auto; }

    .hero { text-align: center; padding: 28px 18px 26px; border-radius: var(--r-xl); background: radial-gradient(120% 90% at 50% 0%, #1f4a30, var(--forest-950)); color: var(--white); display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .hero h1 { color: var(--white); font-size: 30px; }
    .hero p { opacity: .85; font-size: 14.5px; max-width: 420px; }
    .check { width: 76px; height: 76px; }
    .check svg { width: 100%; height: 100%; }
    .check circle { fill: var(--lime-400); stroke: none; transform-origin: center; animation: pop .5s var(--ease-spring) both; }
    .check path { fill: none; stroke: var(--forest-950); stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw .45s .35s var(--ease-out) forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    .order-no { margin-top: 6px; display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 99px; border: 1px dashed rgba(255,255,255,.35); background: rgba(255,255,255,.08); color: var(--white); }
    .order-no small { opacity: .7; font-size: 12px; }
    .order-no strong { font-size: 16px; letter-spacing: .03em; }
    .note { display: flex; align-items: center; gap: 8px; padding: 14px 16px; background: var(--leaf-50); color: var(--forest-900); font-size: 14px; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--line-2); }
    .meta div { display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; font-weight: 600; align-items: flex-start; }
    .meta small { font-weight: 500; font-size: 12px; }
    .items { list-style: none; margin: 0; padding: 14px 0; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--line-2); }
    .items li { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .items img { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; }
    .it { flex: 1; display: flex; flex-direction: column; line-height: 1.3; }
    .it small { font-size: 12.5px; }
    .totals { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; font-size: 14px; color: var(--ink-2); }
    .totals div { display: flex; justify-content: space-between; }
    .grand { padding-top: 10px; border-top: 1px dashed var(--line); color: var(--ink); font-weight: 800; font-size: 16px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 420px) { .actions { grid-template-columns: 1fr; } }
  `,
})
export class OrderSuccessPage {
  readonly number = input.required<string>();
  private api = inject(CustomerApi);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly order = signal<Order | null>(null);
  readonly placed = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly confirming = signal(false);
  reference = '';

  readonly firstName = computed(() => this.order()?.customerName.split(' ')[0] ?? '');
  readonly awaitingPayment = computed(() => {
    const o = this.order();
    return !!o && o.paymentMethod === 'Upi' && o.paymentStatus === 'Pending' && !o.paymentClaimedAt && o.status !== 'Cancelled' && !!o.payment.upiId;
  });
  readonly link = computed(() => {
    const o = this.order();
    return o?.payment.upiId ? upiLink(o.payment.upiId, o.payment.upiPayeeName, o.total, `Order ${o.orderNumber}`) : '';
  });

  constructor() {
    effect(() => { void this.load(this.number()); });
  }

  private async load(number: string) {
    this.loading.set(true);
    try {
      this.order.set(await firstValueFrom(this.api.order(number)));
    } catch (e) {
      this.error.set(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }

  copy(text: string, label: string) { void copyText(text, this.toast, label); }

  async confirm() {
    const o = this.order();
    if (!o || this.confirming()) return;
    const ref = this.reference.trim();
    if (ref && ref.length < 6) { this.toast.error('That reference looks too short. Check it or leave it blank.'); return; }
    this.confirming.set(true);
    try {
      this.placed.set(await firstValueFrom(this.api.confirmPayment(o.orderNumber, ref || null)));
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.confirming.set(false);
    }
  }

  finish() {
    void this.router.navigate(['/'], { replaceUrl: true });
  }
}
