import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ProductUnit } from '../core/models';
import { QtyPipe } from './pipes';

@Component({
  selector: 'app-qty-stepper',
  imports: [LucideAngularModule, QtyPipe],
  template: `
    <div class="stepper" [class.compact]="compact()" [class.light]="tone() === 'light'">
      <button type="button" (click)="decrease.emit(); $event.stopPropagation()" [attr.aria-label]="'Decrease quantity'">
        <lucide-icon [name]="quantity() <= min() ? 'trash-2' : 'minus'" [size]="compact() ? 14 : 16" [strokeWidth]="2.5" />
      </button>
      <span class="value tabular" aria-live="polite">{{ quantity() | qty: unit() }}</span>
      <button type="button" (click)="increase.emit(); $event.stopPropagation()" [disabled]="atMax()" [attr.aria-label]="'Increase quantity'">
        <lucide-icon name="plus" [size]="compact() ? 14 : 16" [strokeWidth]="2.5" />
      </button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .stepper {
      display: flex; align-items: center; justify-content: space-between; height: 42px; padding: 4px;
      background: var(--leaf-600); color: var(--white); border-radius: var(--r-pill);
      animation: pop 0.32s var(--ease-spring) both;
    }
    .stepper.compact { height: 36px; }
    .stepper.light { background: var(--leaf-100); color: var(--forest-900); }
    button {
      width: 34px; height: 34px; border-radius: 50%; border: 0; display: grid; place-items: center;
      background: rgba(255, 255, 255, 0.18); color: inherit; transition: transform 0.15s var(--ease-out), background-color 0.15s;
    }
    .compact button { width: 28px; height: 28px; }
    .light button { background: var(--white); box-shadow: var(--shadow-xs); }
    button:active:not(:disabled) { transform: scale(0.88); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .value { font-weight: 700; font-size: 14px; min-width: 56px; text-align: center; }
    .compact .value { font-size: 13px; min-width: 48px; }
  `,
})
export class QtyStepperComponent {
  readonly quantity = input.required<number>();
  readonly unit = input.required<ProductUnit>();
  readonly min = input(0);
  readonly atMax = input(false);
  readonly compact = input(false);
  readonly tone = input<'solid' | 'light'>('solid');
  readonly increase = output<void>();
  readonly decrease = output<void>();
}
