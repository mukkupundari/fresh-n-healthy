import { Component, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import QRCode from 'qrcode';
import { OrderStatus, PaymentStatus } from '../core/models';
import { ToastService } from '../core/toast.service';
import { PaymentTonePipe, StatusLabelPipe, StatusTonePipe } from './pipes';

@Component({
  selector: 'app-toasts',
  imports: [LucideAngularModule],
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.tone" (click)="toast.dismiss(t.id)">
          <lucide-icon [name]="icon(t.tone)" [size]="18" />
          <span>{{ t.message }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; top: calc(12px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); z-index: 200; display: flex; flex-direction: column; gap: 8px; width: min(440px, calc(100vw - 24px)); pointer-events: none; }
    .toast {
      pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: 16px; background: var(--forest-900); color: var(--white);
      box-shadow: var(--shadow-lg); font-size: 14px; font-weight: 500; line-height: 1.4; animation: toast-in 0.35s var(--ease-spring) both; cursor: pointer;
    }
    .toast lucide-icon { flex-shrink: 0; margin-top: 1px; }
    .toast.success lucide-icon { color: var(--lime-400); }
    .toast.error { background: #5b1d13; }
    .toast.warning lucide-icon { color: #f5c46b; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(-12px) scale(0.98); } to { opacity: 1; transform: none; } }
  `,
})
export class ToastsComponent {
  protected toast = inject(ToastService);
  icon(tone: string) {
    return { success: 'check-circle-2', error: 'circle-alert', warning: 'alert-triangle', info: 'info' }[tone] ?? 'info';
  }
}

@Component({
  selector: 'app-status-badge',
  imports: [StatusLabelPipe, StatusTonePipe],
  template: `<span class="badge" [class]="'badge ' + (status() | statusTone)"><span class="dot"></span>{{ status() | statusLabel }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<OrderStatus>();
}

@Component({
  selector: 'app-payment-badge',
  imports: [PaymentTonePipe],
  template: `<span class="badge" [class]="'badge ' + (status() | paymentTone)">@if (method(); as m) { {{ m === 'Cod' ? 'Cash' : 'UPI' }} · }{{ status() }}</span>`,
})
export class PaymentBadgeComponent {
  readonly status = input.required<PaymentStatus>();
  readonly method = input<'Upi' | 'Cod' | null>(null);
}

@Component({
  selector: 'app-empty-state',
  imports: [LucideAngularModule],
  template: `
    <div class="empty">
      <div class="icon"><lucide-icon [name]="icon()" [size]="28" /></div>
      <h3 class="display">{{ title() }}</h3>
      @if (message()) { <p class="muted">{{ message() }}</p> }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 20px; gap: 10px; animation: fade-up 0.4s var(--ease-out) backwards; }
    .icon { width: 68px; height: 68px; border-radius: 22px; display: grid; place-items: center; background: var(--leaf-100); color: var(--leaf-600); margin-bottom: 6px; }
    h3 { font-size: 21px; }
    p { max-width: 340px; font-size: 14px; }
    .actions:not(:empty) { margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('leaf');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
}

/** Shows the shop's uploaded UPI QR, or generates one from the UPI payment link. */
@Component({
  selector: 'app-upi-qr',
  template: `
    @if (imageUrl()) {
      <img class="qr" [src]="imageUrl()" alt="UPI QR code" />
    } @else {
      <canvas #canvas class="qr" aria-label="UPI QR code"></canvas>
    }
  `,
  styles: `.qr { width: 100% !important; height: auto !important; max-width: 200px; aspect-ratio: 1; border-radius: 14px; background: var(--white); padding: 8px; border: 1px solid var(--line); display: block; margin: 0 auto; object-fit: contain; }`,
})
export class UpiQrComponent {
  readonly link = input<string>('');
  readonly imageUrl = input<string | null>(null);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect(() => {
      const el = this.canvas()?.nativeElement;
      const link = this.link();
      if (el && link) QRCode.toCanvas(el, link, { width: 360, margin: 1, color: { dark: '#12301f', light: '#ffffff' } }).catch(() => undefined);
    });
  }
}

export async function copyText(text: string, toast: ToastService, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} to clipboard`);
  } catch {
    toast.error('Could not copy. Please copy it manually.');
  }
}
