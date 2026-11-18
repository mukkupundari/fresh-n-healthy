import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Order } from '../core/models';
import { InrPipe } from '../shared/pipes';

const AUTO_CLOSE_MS = 6000;

/** Full-screen confirmation shown once an order is placed (and, for UPI, paid). Closes itself after a few seconds. */
@Component({
  selector: 'app-order-placed-dialog',
  imports: [LucideAngularModule, InrPipe],
  template: `
    <div class="backdrop" (click)="done.emit()"></div>
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="op-title" aria-describedby="op-desc">
      <div class="check"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg></div>
      <h2 id="op-title" class="display">Order placed!</h2>
      <p id="op-desc">{{ message() }}</p>

      <dl class="facts">
        <div><dt>Order number</dt><dd class="tabular">{{ order().orderNumber }}</dd></div>
        <div><dt>{{ order().paymentMethod === 'Upi' ? 'Paid by UPI' : (order().fulfillment === 'Pickup' ? 'Pay at store' : 'Cash on delivery') }}</dt><dd class="tabular">{{ order().total | inr }}</dd></div>
      </dl>

      @if (order().invoiceSentAt) {
        <div class="sms"><lucide-icon name="receipt-text" [size]="16" /> Invoice sent by SMS to +91 {{ order().customerPhone }}</div>
      }

      <button #doneBtn type="button" class="btn btn-dark btn-lg btn-block" (click)="done.emit()">Done</button>
      <div class="timer" aria-hidden="true"><span [style.animation-duration.ms]="autoCloseMs"></span></div>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 20px; }
    .backdrop { position: absolute; inset: 0; background: rgba(10, 28, 18, .55); backdrop-filter: blur(4px); animation: fade .25s ease-out both; }
    .dialog { position: relative; width: min(400px, 100%); background: var(--white); border-radius: 28px; padding: 28px 22px 18px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; box-shadow: 0 30px 80px rgba(0,0,0,.3); animation: rise .4s var(--ease-spring) both; overflow: hidden; }
    .check { width: 84px; height: 84px; }
    .check svg { width: 100%; height: 100%; }
    .check circle { fill: var(--lime-400); transform-origin: center; animation: pop .5s var(--ease-spring) both; }
    .check path { fill: none; stroke: var(--forest-950); stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw .45s .3s var(--ease-out) forwards; }
    h2 { font-size: 30px; color: var(--forest-900); }
    p { color: var(--ink-2); font-size: 14.5px; max-width: 320px; }
    .facts { margin: 4px 0 0; width: 100%; display: grid; grid-template-columns: 1fr 1fr; border-radius: 16px; background: var(--cream-50); border: 1px dashed var(--line); }
    .facts div { padding: 12px; display: flex; flex-direction: column; gap: 2px; }
    .facts div + div { border-left: 1px dashed var(--line); }
    dt { font-size: 12px; color: var(--muted); }
    dd { margin: 0; font-weight: 800; font-size: 16px; color: var(--forest-900); }
    .sms { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--leaf-600); }
    .btn-block { margin-top: 6px; }
    .timer { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--cream-200); }
    .timer span { display: block; height: 100%; background: var(--leaf-600); transform-origin: left; animation: shrink linear forwards; }
    @keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes fade { from { opacity: 0; } }
    @keyframes rise { from { opacity: 0; transform: translateY(24px) scale(.96); } }
  `,
})
export class OrderPlacedDialogComponent {
  readonly order = input.required<Order>();
  readonly done = output<void>();
  protected readonly autoCloseMs = AUTO_CLOSE_MS;
  private doneBtn = viewChild<ElementRef<HTMLButtonElement>>('doneBtn');

  readonly message = computed(() => {
    const o = this.order();
    const first = o.customerName.split(' ')[0];
    return o.paymentMethod === 'Upi'
      ? `Thank you, ${first}. ${o.shopName} will verify your payment and start packing your vegetables.`
      : `Thank you, ${first}. ${o.shopName} has received your order and will confirm it shortly.`;
  });

  constructor() {
    const timer = setTimeout(() => this.done.emit(), AUTO_CLOSE_MS);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inject(DestroyRef).onDestroy(() => { clearTimeout(timer); document.body.style.overflow = prevOverflow; });
    afterNextRender(() => this.doneBtn()?.nativeElement.focus());
  }
}
