import { DatePipe, Location } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CustomerApi, toApiError } from '../core/api';
import { formatInr, formatQty } from '../core/format';
import { Order } from '../core/models';
import { InrPipe, QtyPipe } from '../shared/pipes';
import { EmptyStateComponent } from '../shared/ui.components';

/** Printable tax-style invoice for one order. "Save as PDF" uses the browser's print dialog. */
@Component({
  selector: 'app-invoice',
  imports: [DatePipe, RouterLink, LucideAngularModule, InrPipe, QtyPipe, EmptyStateComponent],
  template: `
    <div class="toolbar no-print">
      <button class="icon-btn" type="button" (click)="location.back()" aria-label="Back"><lucide-icon name="arrow-left" [size]="20" /></button>
      <h1 class="display">Invoice</h1>
      <span class="grow"></span>
      @if (order()) {
        <a class="btn btn-sm btn-outline wa" [href]="whatsappLink()" target="_blank" rel="noopener"><lucide-icon name="phone" [size]="15" /> Send to my WhatsApp</a>
        <button class="btn btn-sm btn-dark" type="button" (click)="print()"><lucide-icon name="receipt-text" [size]="15" /> Print / PDF</button>
      }
    </div>

    @let o = order();
    @if (loading()) {
      <div class="loading"><span class="spinner lg"></span></div>
    } @else if (o) {
      <article class="sheet">
        <header class="top">
          <div class="seller">
            <strong class="shop display">{{ o.shopName }}</strong>
            <span>{{ o.seller.addressLine }}, {{ o.seller.city }} - {{ o.seller.pincode }}</span>
            <span>Phone +91 {{ o.payment.contactPhone }}</span>
            @let ids = sellerIds(o);
            @if (ids) { <span>{{ ids }}</span> }
          </div>
          <div class="doc">
            <span class="tag">{{ o.status === 'Cancelled' ? 'Cancelled invoice' : 'Invoice' }}</span>
            <dl>
              <div><dt>Invoice no.</dt><dd class="tabular">{{ o.orderNumber }}</dd></div>
              <div><dt>Date</dt><dd>{{ o.createdAt | date: 'd MMM yyyy, h:mm a' }}</dd></div>
            </dl>
          </div>
        </header>

        <section class="parties">
          <div>
            <small>Billed to</small>
            <strong>{{ o.customerName }}</strong>
            <span>+91 {{ o.customerPhone }}</span>
            @if (o.deliveryAddress) { <span>{{ o.deliveryAddress }}</span> }
          </div>
          <div>
            <small>{{ o.fulfillment === 'Pickup' ? 'Store pickup' : 'Home delivery' }}</small>
            <strong>{{ paymentLabel() }}</strong>
            <span>{{ paymentStatusLabel() }}@if (o.paymentReference) { · UTR {{ o.paymentReference }} }</span>
          </div>
        </section>

        <table class="lines">
          <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
          <tbody>
            @for (i of o.items; track i.productId; let n = $index) {
              <tr><td>{{ n + 1 }}</td><td>{{ i.productName }}</td><td class="r">{{ i.quantity | qty: i.unit }}</td><td class="r tabular">{{ i.unitPrice | inr }}</td><td class="r tabular">{{ i.lineTotal | inr }}</td></tr>
            }
          </tbody>
        </table>

        <div class="sum">
          <div><span>Item total</span><span class="tabular">{{ o.subtotal | inr }}</span></div>
          <div><span>{{ o.fulfillment === 'Pickup' ? 'Pickup' : 'Delivery fee' }}</span><span class="tabular">{{ o.deliveryFee ? (o.deliveryFee | inr) : 'Free' }}</span></div>
          <div class="grand"><span>Total</span><span class="tabular">{{ o.total | inr }}</span></div>
        </div>

        <footer class="foot">Fresh vegetables are exempt from GST. Thank you for shopping local with {{ o.shopName }}.</footer>
      </article>
    } @else {
      <app-empty-state icon="receipt-text" title="Invoice not available" [message]="error()">
        <a class="btn btn-primary" routerLink="/orders">My orders</a>
      </app-empty-state>
    }
  `,
  styles: `
    :host { display: block; min-height: 100svh; background: var(--cream-100, #f4efe4); padding: 0 12px 40px; }
    .toolbar { max-width: 760px; margin: 0 auto; display: flex; align-items: center; gap: 8px; padding: 14px 0; flex-wrap: wrap; }
    .toolbar h1 { font-size: 22px; }
    .grow { flex: 1; }
    .loading { display: grid; place-items: center; min-height: 60svh; }
    .sheet { max-width: 760px; margin: 0 auto; background: var(--white); border-radius: 20px; padding: 26px 22px; box-shadow: var(--shadow-sm); border: 1px solid var(--line-2); display: flex; flex-direction: column; gap: 22px; color: var(--ink); }
    .top { display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; padding-bottom: 18px; border-bottom: 2px solid var(--forest-900); }
    .seller { display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: var(--ink-2); }
    .shop { font-size: 24px; color: var(--forest-900); margin-bottom: 4px; }
    .doc { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .tag { font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--leaf-600); }
    .doc dl { margin: 0; display: flex; flex-direction: column; gap: 4px; text-align: right; }
    .doc dt { font-size: 11.5px; color: var(--muted); }
    .doc dd { margin: 0; font-weight: 700; font-size: 14px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .parties div { display: flex; flex-direction: column; gap: 3px; font-size: 13.5px; color: var(--ink-2); }
    .parties small { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    .parties strong { color: var(--ink); font-size: 15px; }
    .lines { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .lines th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 8px 6px; border-bottom: 1px solid var(--line); }
    .lines td { padding: 10px 6px; border-bottom: 1px solid var(--line-2); }
    .r { text-align: right !important; white-space: nowrap; }
    .sum { align-self: flex-end; width: min(300px, 100%); display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: var(--ink-2); }
    .sum div { display: flex; justify-content: space-between; }
    .grand { padding-top: 10px; border-top: 2px solid var(--forest-900); color: var(--ink); font-weight: 800; font-size: 17px; }
    .foot { font-size: 12px; color: var(--muted); text-align: center; padding-top: 14px; border-top: 1px dashed var(--line); }
    @media (max-width: 520px) { .parties { grid-template-columns: 1fr; } .doc { align-items: flex-start; } .doc dl { text-align: left; } .wa { order: 5; } }
    @media print {
      :host { background: #fff; padding: 0; }
      .no-print { display: none !important; }
      .sheet { box-shadow: none; border: 0; border-radius: 0; padding: 0; max-width: none; }
    }
  `,
})
export class InvoicePage {
  readonly number = input.required<string>();
  protected location = inject(Location);
  private api = inject(CustomerApi);

  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly paymentLabel = computed(() => {
    const o = this.order();
    if (!o) return '';
    return o.paymentMethod === 'Upi' ? 'UPI' : o.fulfillment === 'Pickup' ? 'Pay at store' : 'Cash on delivery';
  });
  readonly paymentStatusLabel = computed(() => {
    const o = this.order();
    if (!o) return '';
    if (o.paymentStatus === 'Paid') return 'Paid';
    if (o.paymentStatus === 'Refunded') return 'Refunded';
    if (o.paymentMethod === 'Upi') return o.paymentClaimedAt ? 'Payment being verified' : 'Payment pending';
    return 'To be paid on ' + (o.fulfillment === 'Pickup' ? 'pickup' : 'delivery');
  });

  /** wa.me opens a chat with the customer's own number ("Message yourself") pre-filled with the invoice — free, no SMS gateway. */
  readonly whatsappLink = computed(() => {
    const o = this.order();
    if (!o) return '';
    const lines = [
      `*${o.shopName} - Invoice ${o.orderNumber}*`,
      new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      '',
      ...o.items.map((i) => `${i.productName} ${formatQty(i.quantity, i.unit)} x ${formatInr(i.unitPrice)} = ${formatInr(i.lineTotal)}`),
      '',
      `Items: ${formatInr(o.subtotal)}`,
      o.fulfillment === 'Pickup' ? 'Store pickup' : `Delivery: ${o.deliveryFee ? formatInr(o.deliveryFee) : 'Free'}`,
      `*Total: ${formatInr(o.total)}* (${this.paymentLabel()}, ${this.paymentStatusLabel().toLowerCase()})`,
      '',
      ...(this.sellerIds(o) ? [this.sellerIds(o)] : []),
      `${window.location.origin}/orders/${o.orderNumber}/invoice`,
    ];
    return `https://wa.me/91${o.customerPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
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

  print() { window.print(); }

  sellerIds(o: Order): string {
    return [o.seller.licenseNumber && `Licence ${o.seller.licenseNumber}`, o.seller.gstNumber && `GSTIN ${o.seller.gstNumber}`]
      .filter(Boolean).join(' · ');
  }
}
