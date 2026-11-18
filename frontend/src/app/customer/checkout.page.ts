import { Location } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CatalogApi, CustomerApi, fieldErrors, toApiError } from '../core/api';
import { CustomerAuth } from '../core/auth';
import { CartStore } from '../core/cart.store';
import { formatQty, uuid } from '../core/format';
import { FulfillmentType, Order, PaymentMethod, StockIssue } from '../core/models';
import { ShopStore } from '../core/shop.store';
import { ToastService } from '../core/toast.service';
import { InrPipe, QtyPipe } from '../shared/pipes';
import { EmptyStateComponent, copyText } from '../shared/ui.components';
import { BillSummaryComponent, deliveryFeeFor } from './bill-summary.component';
import { OrderPlacedDialogComponent } from './order-placed-dialog.component';

const KEY = 'fh_checkout_key';

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, LucideAngularModule, InrPipe, QtyPipe, EmptyStateComponent, BillSummaryComponent, OrderPlacedDialogComponent],
  template: `
    <div class="container page-enter">
      <header class="page-head">
        <button class="icon-btn" type="button" (click)="location.back()" aria-label="Back"><lucide-icon name="arrow-left" [size]="20" /></button>
        <h1 class="display">Checkout</h1>
        <span class="secure"><lucide-icon name="lock" [size]="14" /> Secure</span>
      </header>

      @let s = shop();
      @if (placedOrder(); as placed) {
        <app-order-placed-dialog [order]="placed" (done)="finish()" />
      } @else if (cart.isEmpty() && !placing()) {
        <app-empty-state icon="shopping-basket" title="Nothing to check out" message="Your basket is empty. Add some fresh vegetables first.">
          <a class="btn btn-primary" routerLink="/">Browse vegetables</a>
        </app-empty-state>
      } @else if (s) {
        <div class="layout">
          <div class="main-col">
            @if (issues().length) {
              <div class="issues card">
                <div class="issues-head"><lucide-icon name="alert-triangle" [size]="18" /> <strong>We updated your basket</strong></div>
                <ul>
                  @for (i of issues(); track i.productId) { <li>{{ describe(i) }}</li> }
                </ul>
                <button class="btn btn-sm btn-outline" type="button" (click)="issues.set([])">Got it</button>
              </div>
            }
            @if (!s.isOpen) {
              <div class="issues card"><div class="issues-head"><lucide-icon name="clock" [size]="18" /> <strong>{{ s.name }} is closed right now.</strong></div><p>You can place your order once the store reopens.</p></div>
            }

            <section class="card card-pad sec">
              <div class="sec-head">
                <h2><span class="num">1</span> Your order</h2>
                <a routerLink="/cart" class="link">Edit</a>
              </div>
              <button type="button" class="summary-toggle" (click)="showItems.set(!showItems())">
                <span class="thumbs">@for (i of cart.items().slice(0, 4); track i.product.id) { <img [src]="i.product.imageUrl" alt="" /> }</span>
                <span class="sum-text"><strong>{{ cart.count() }} {{ cart.count() === 1 ? 'item' : 'items' }}</strong> from {{ s.name }}</span>
                <lucide-icon [name]="showItems() ? 'chevron-down' : 'chevron-right'" [size]="18" />
              </button>
              @if (showItems()) {
                <ul class="items">
                  @for (i of cart.items(); track i.product.id) {
                    <li><span>{{ i.product.name }} <small class="muted">× {{ i.quantity | qty: i.product.unit }}</small></span><span class="tabular">{{ i.lineTotal | inr }}</span></li>
                  }
                </ul>
              }
            </section>

            <section class="card card-pad sec">
              <div class="sec-head"><h2><span class="num">2</span> Delivery details</h2></div>
              @if (s.deliveryEnabled && s.pickupEnabled) {
                <div class="segmented full">
                  <button type="button" [class.active]="fulfillment() === 'Delivery'" (click)="fulfillment.set('Delivery')"><lucide-icon name="bike" [size]="16" /> Home delivery</button>
                  <button type="button" [class.active]="fulfillment() === 'Pickup'" (click)="fulfillment.set('Pickup')"><lucide-icon name="store" [size]="16" /> Store pickup</button>
                </div>
              }

              <div class="form-grid">
                <div class="field">
                  <label class="label" for="name">Full name</label>
                  <input id="name" class="input" [class.invalid]="errors()['customerName']" name="name" autocomplete="name" [(ngModel)]="name" />
                  @if (errors()['customerName']) { <span class="error-text">{{ errors()['customerName'] }}</span> }
                </div>
                <div class="field">
                  <label class="label" for="mobile">Mobile number</label>
                  <div class="input-group">
                    <input id="mobile" class="input" [value]="'+91 ' + (auth.customer()?.phone ?? '')" readonly />
                    <span class="suffix verified"><lucide-icon name="badge-check" [size]="16" /> Verified</span>
                  </div>
                </div>

                @if (fulfillment() === 'Delivery') {
                  <div class="field span-2">
                    <label class="label" for="address">House / flat, street, area</label>
                    <input id="address" class="input" [class.invalid]="errors()['addressLine']" name="address" autocomplete="street-address" placeholder="Flat 302, Lake View Apartments, Road No. 3" [(ngModel)]="addressLine" />
                    @if (errors()['addressLine']) { <span class="error-text">{{ errors()['addressLine'] }}</span> }
                  </div>
                  <div class="field">
                    <label class="label" for="landmark">Landmark <span class="muted">(optional)</span></label>
                    <input id="landmark" class="input" name="landmark" placeholder="Near KBR Park" [(ngModel)]="landmark" />
                  </div>
                  <div class="row2">
                    <div class="field">
                      <label class="label" for="city">City</label>
                      <input id="city" class="input" name="city" autocomplete="address-level2" [(ngModel)]="city" />
                    </div>
                    <div class="field">
                      <label class="label" for="pincode">Pincode</label>
                      <input id="pincode" class="input" [class.invalid]="errors()['pincode']" name="pincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" [(ngModel)]="pincode" />
                    </div>
                  </div>
                  @if (errors()['pincode']) { <span class="error-text span-2">{{ errors()['pincode'] }}</span> }
                } @else {
                  <div class="pickup span-2">
                    <lucide-icon name="map-pin" [size]="18" />
                    <div><strong>Pick up from {{ s.name }}</strong><p class="muted">{{ s.addressLine }}, {{ s.city }} {{ s.pincode }}</p></div>
                  </div>
                }
              </div>
            </section>

            <section class="card card-pad sec">
              <div class="sec-head"><h2><span class="num">3</span> Payment</h2></div>
              <div class="pay-options">
                @if (upiAvailable()) {
                  <label class="pay" [class.selected]="payment() === 'Upi'">
                    <input type="radio" name="pay" [checked]="payment() === 'Upi'" (change)="payment.set('Upi')" />
                    <span class="pay-ic"><lucide-icon name="qr-code" [size]="20" /></span>
                    <span class="pay-text"><strong>UPI</strong><small>GPay, PhonePe, Paytm or any UPI app</small></span>
                    <span class="radio"></span>
                  </label>
                }
                @if (s.acceptsCod) {
                  <label class="pay" [class.selected]="payment() === 'Cod'">
                    <input type="radio" name="pay" [checked]="payment() === 'Cod'" (change)="payment.set('Cod')" />
                    <span class="pay-ic"><lucide-icon name="banknote" [size]="20" /></span>
                    <span class="pay-text"><strong>{{ fulfillment() === 'Pickup' ? 'Pay at store' : 'Cash on delivery' }}</strong><small>Pay with cash or UPI when you receive your order</small></span>
                    <span class="radio"></span>
                  </label>
                }
              </div>
              @if (payment() === 'Upi' && s.upiId) {
                <div class="upi">
                  <div><small class="muted">Pay to UPI ID</small><strong class="tabular">{{ s.upiId }}</strong>@if (s.upiPayeeName) { <small class="muted">{{ s.upiPayeeName }}</small> }</div>
                  <button type="button" class="btn btn-sm btn-outline" (click)="copy(s.upiId)"><lucide-icon name="copy" [size]="14" /> Copy</button>
                </div>
                <p class="hint">You'll see a QR code and a "Pay with UPI app" button right after placing your order.</p>
              }
            </section>

            <section class="card card-pad sec">
              <button type="button" class="notes-toggle" (click)="showNotes.set(!showNotes())">
                <lucide-icon name="pencil" [size]="16" /> {{ showNotes() ? 'Delivery instructions' : 'Add delivery instructions (optional)' }}
              </button>
              @if (showNotes()) {
                <textarea class="textarea" maxlength="500" placeholder="e.g. Ring the bell twice, leave with the security guard" [(ngModel)]="notes"></textarea>
              }
            </section>
          </div>

          <aside class="side-col">
            <div class="card card-pad bill">
              <h2>Bill details</h2>
              <app-bill-summary [fulfillment]="fulfillment()" />
            </div>
          </aside>
        </div>

        <div class="placebar">
          <button class="btn btn-dark btn-lg place" type="button" (click)="place()" [disabled]="placing() || !s.isOpen || cart.isEmpty()">
            <span class="amt"><small>Total</small><span class="tabular">{{ total() | inr }}</span></span>
            <span class="go">@if (placing()) { <span class="spinner"></span> Placing… } @else { Place Order <lucide-icon name="arrow-right" [size]="18" /> }</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .page-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; }
    .page-head h1 { font-size: 22px; }
    .secure { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--leaf-600); }
    .layout { display: grid; gap: 14px; padding-bottom: 120px; }
    .main-col { display: flex; flex-direction: column; gap: 14px; }
    .sec { display: flex; flex-direction: column; gap: 14px; }
    .sec-head { display: flex; justify-content: space-between; align-items: center; }
    .sec-head h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .num { width: 26px; height: 26px; border-radius: 50%; background: var(--forest-900); color: var(--white); display: grid; place-items: center; font-size: 13px; }
    .link { color: var(--leaf-600); font-weight: 700; font-size: 14px; }
    .summary-toggle { display: flex; align-items: center; gap: 12px; border: 0; background: var(--cream-50); padding: 10px 12px; border-radius: 14px; text-align: left; }
    .thumbs { display: flex; }
    .thumbs img { width: 36px; height: 36px; border-radius: 10px; object-fit: cover; border: 2px solid var(--cream-50); }
    .thumbs img + img { margin-left: -10px; }
    .sum-text { flex: 1; font-size: 14px; color: var(--ink-2); }
    .items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
    .items li { display: flex; justify-content: space-between; gap: 12px; }
    .segmented.full { display: flex; } .segmented.full button { flex: 1; justify-content: center; }
    .row2 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
    .verified { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--leaf-600); padding-right: 6px; }
    .pickup { display: flex; gap: 12px; padding: 14px; border-radius: 14px; background: var(--leaf-50); color: var(--forest-900); }
    .pickup p { font-size: 13px; margin-top: 2px; }
    .pay-options { display: flex; flex-direction: column; gap: 10px; }
    .pay { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; border: 1.5px solid var(--line); cursor: pointer; transition: border-color .2s, background-color .2s; }
    .pay input { position: absolute; opacity: 0; pointer-events: none; }
    .pay.selected { border-color: var(--leaf-600); background: var(--leaf-50); }
    .pay-ic { width: 42px; height: 42px; border-radius: 13px; background: var(--white); border: 1px solid var(--line-2); display: grid; place-items: center; color: var(--forest-900); flex-shrink: 0; }
    .pay-text { flex: 1; display: flex; flex-direction: column; line-height: 1.3; }
    .pay-text small { color: var(--muted); font-size: 12.5px; }
    .radio { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--line); flex-shrink: 0; transition: all .2s; }
    .pay.selected .radio { border: 7px solid var(--leaf-600); }
    .upi { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: var(--cream-50); border: 1px dashed var(--line); }
    .upi div { display: flex; flex-direction: column; line-height: 1.3; }
    .upi strong { font-size: 15px; }
    .notes-toggle { border: 0; background: none; padding: 0; display: inline-flex; align-items: center; gap: 8px; color: var(--leaf-600); font-weight: 700; align-self: flex-start; }
    .issues { padding: 14px 16px; background: var(--amber-50); border-color: #f2dcb3; color: #7a4f08; display: flex; flex-direction: column; gap: 8px; }
    .issues-head { display: flex; align-items: center; gap: 8px; }
    .issues ul { margin: 0; padding-left: 20px; font-size: 13.5px; }
    .issues .btn { align-self: flex-start; }
    .bill h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; margin-bottom: 14px; }
    .placebar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 12px 14px calc(12px + var(--safe-bottom)); background: linear-gradient(180deg, rgba(251,248,241,0), var(--cream-50) 30%); }
    .place { width: 100%; max-width: 620px; margin: 0 auto; display: flex; justify-content: space-between; height: 64px; padding: 0 8px 0 22px; box-shadow: 0 14px 30px rgba(12,33,22,.3); }
    .amt { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
    .amt small { font-size: 11px; opacity: .7; font-weight: 600; }
    .amt span { font-family: var(--font-display); font-size: 21px; }
    .go { display: inline-flex; align-items: center; gap: 8px; height: 48px; padding: 0 20px; border-radius: 99px; background: var(--lime-400); color: var(--forest-950); }
    @media (min-width: 900px) {
      .page-head h1 { font-size: 30px; }
      .layout { grid-template-columns: 1.5fr 1fr; align-items: start; gap: 24px; }
      .side-col { position: sticky; top: 96px; }
      .placebar { left: auto; right: max(28px, calc((100vw - var(--container)) / 2 + 28px)); width: min(420px, 34vw); bottom: 24px; padding: 0; background: none; }
    }
  `,
})
export class CheckoutPage {
  protected cart = inject(CartStore);
  protected auth = inject(CustomerAuth);
  protected location = inject(Location);
  private store = inject(ShopStore);
  private catalog = inject(CatalogApi);
  private api = inject(CustomerApi);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected shop = this.store.shop;

  name = '';
  addressLine = '';
  landmark = '';
  city = '';
  pincode = '';
  notes = '';

  readonly fulfillment = signal<FulfillmentType>('Delivery');
  readonly payment = signal<PaymentMethod>('Cod');
  readonly placing = signal(false);
  readonly placedOrder = signal<Order | null>(null);
  readonly issues = signal<StockIssue[]>([]);
  readonly errors = signal<Record<string, string>>({});
  readonly showItems = signal(false);
  readonly showNotes = signal(false);
  readonly upiAvailable = computed(() => !!this.shop()?.acceptsUpi && !!this.shop()?.upiId);
  readonly total = computed(() => this.cart.subtotal() + deliveryFeeFor(this.shop(), this.cart.subtotal(), this.fulfillment()));

  constructor() {
    const c = this.auth.customer();
    if (c) {
      this.name = c.name;
      this.addressLine = c.addressLine ?? '';
      this.landmark = c.landmark ?? '';
      this.city = c.city ?? '';
      this.pincode = c.pincode ?? '';
    }
    let initialised = false;
    effect(() => {
      const s = this.shop();
      if (!s || initialised) return;
      initialised = true;
      this.fulfillment.set(s.deliveryEnabled ? 'Delivery' : 'Pickup');
      this.payment.set(s.acceptsUpi && s.upiId ? 'Upi' : 'Cod');
      if (!this.city) this.city = s.city;
      void this.revalidate();
    });
    void this.store.init();
  }

  /** Re-checks the basket against live stock before the customer commits. */
  private async revalidate() {
    const s = this.shop();
    if (!s || this.cart.isEmpty()) return;
    try {
      const res = await firstValueFrom(this.catalog.validateCart(s.id, this.cart.lines()));
      this.store.applyProducts(res.products);
      if (res.issues.length) this.issues.set(res.issues);
    } catch { /* checkout still validates on submit */ }
  }

  describe(i: StockIssue): string {
    const p = this.store.productMap().get(i.productId);
    const unit = p?.unit ?? 'Kg';
    switch (i.reason) {
      case 'sold_out': case 'unavailable': case 'not_found': return `${i.productName} is no longer available and was removed.`;
      case 'insufficient_stock': return `Only ${formatQty(i.available, unit)} of ${i.productName} left — we reduced your quantity.`;
      default: return `${i.productName}: please review the quantity.`;
    }
  }

  copy(text: string) { void copyText(text, this.toast, 'UPI ID copied'); }

  private validate(): boolean {
    const e: Record<string, string> = {};
    if (this.name.trim().length < 2) e['customerName'] = 'Please enter your name.';
    if (this.fulfillment() === 'Delivery') {
      if (this.addressLine.trim().length < 5) e['addressLine'] = 'Please enter your full address.';
      if (!/^\d{6}$/.test(this.pincode.trim())) e['pincode'] = 'Enter a valid 6-digit pincode.';
    }
    this.errors.set(e);
    if (Object.keys(e).length) { this.toast.error(Object.values(e)[0]); return false; }
    if (this.cart.isEmpty()) { this.toast.error('Add at least one vegetable to your cart.'); return false; }
    return true;
  }

  finish() {
    void this.router.navigate(['/'], { replaceUrl: true });
  }

  async place() {
    const s = this.shop();
    if (!s || this.placing() || !this.validate()) return;
    let key = sessionStorage.getItem(KEY);
    if (!key) { key = uuid(); sessionStorage.setItem(KEY, key); }

    this.placing.set(true);
    try {
      const delivery = this.fulfillment() === 'Delivery';
      const order = await firstValueFrom(this.api.placeOrder({
        shopId: s.id,
        items: this.cart.lines(),
        paymentMethod: this.payment(),
        fulfillment: this.fulfillment(),
        customerName: this.name.trim(),
        addressLine: delivery ? this.addressLine.trim() : null,
        landmark: delivery ? this.landmark.trim() || null : null,
        city: delivery ? this.city.trim() || null : null,
        pincode: delivery ? this.pincode.trim() : null,
        notes: this.notes.trim() || null,
        idempotencyKey: key,
      }));
      sessionStorage.removeItem(KEY);
      const c = this.auth.customer();
      if (c) this.auth.updateCustomer({ ...c, name: order.customerName, ...(delivery ? { addressLine: this.addressLine.trim(), landmark: this.landmark.trim(), city: this.city.trim(), pincode: this.pincode.trim() } : {}) });
      this.cart.clear(s.id);
      if (order.paymentMethod === 'Upi') {
        await this.router.navigate(['/order-success', order.orderNumber], { replaceUrl: true });
      } else {
        this.placedOrder.set(order);
      }
    } catch (e) {
      const err = toApiError(e);
      if (err.code === 'stock_conflict') {
        this.issues.set((err.details as StockIssue[]) ?? []);
        await this.store.reloadProducts().catch(() => undefined);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        this.errors.set(fieldErrors(err));
      }
      this.toast.error(err.title);
    } finally {
      this.placing.set(false);
    }
  }
}
