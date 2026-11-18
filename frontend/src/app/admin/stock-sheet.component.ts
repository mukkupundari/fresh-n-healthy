import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, toApiError } from '../core/api';
import { formatQty, roundQty } from '../core/format';
import { Product, StockAdjustMode } from '../core/models';
import { ToastService } from '../core/toast.service';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { productName, QtyPipe } from '../shared/pipes';

/** Quick restock / correction for one product. Every change is written to the stock movement log. */
@Component({
  selector: 'app-stock-sheet',
  imports: [FormsModule, LucideAngularModule, BottomSheetComponent, QtyPipe],
  template: `
    <app-bottom-sheet [open]="!!product()" [title]="'Update stock'" [subtitle]="product() ? productName(product()!) : null" (close)="close.emit()">
      @if (product(); as p) {
        <div class="body">
          <div class="current">
            <img [src]="p.imageUrl" alt="" />
            <div><small class="muted">Current stock</small><strong class="tabular">{{ p.stockQuantity | qty: p.unit }}</strong></div>
            <lucide-icon name="arrow-right" [size]="18" class="muted" />
            <div><small class="muted">After update</small><strong class="tabular" [class.bad]="after() < 0">{{ after() < 0 ? 'Not enough' : (after() | qty: p.unit) }}</strong></div>
          </div>

          <div class="segmented full">
            <button type="button" [class.active]="mode() === 'Add'" (click)="mode.set('Add')"><lucide-icon name="plus" [size]="15" /> Restock</button>
            <button type="button" [class.active]="mode() === 'Remove'" (click)="mode.set('Remove')"><lucide-icon name="minus" [size]="15" /> Remove</button>
            <button type="button" [class.active]="mode() === 'Set'" (click)="mode.set('Set')"><lucide-icon name="pencil" [size]="14" /> Set exact</button>
          </div>

          <div class="field">
            <label class="label" for="sq">{{ mode() === 'Set' ? 'New stock level' : mode() === 'Add' ? 'Quantity received' : 'Quantity to remove (spoiled, damaged…)' }}</label>
            <div class="input-group">
              <input id="sq" class="input qty tabular" type="number" inputmode="decimal" min="0" [step]="p.unit === 'Kg' ? 0.25 : 1" [ngModel]="qty()" (ngModelChange)="qty.set(+$event || 0)" />
              <span class="suffix unit">{{ p.unit === 'Kg' ? 'kg' : p.unit.toLowerCase() + 's' }}</span>
            </div>
            @if (mode() !== 'Set') {
              <div class="quick">
                @for (q of quick(); track q) { <button type="button" class="chip" (click)="qty.set(roundQty(qty() + q))">+{{ q }}</button> }
                <button type="button" class="chip" (click)="qty.set(0)">Clear</button>
              </div>
            }
          </div>

          <div class="field">
            <label class="label" for="sn">Note <span class="muted">(optional)</span></label>
            <input id="sn" class="input" maxlength="300" [placeholder]="mode() === 'Add' ? 'e.g. Morning mandi purchase' : 'e.g. Spoiled in storage'" [(ngModel)]="note" />
          </div>
        </div>
      }
      <div sheet-footer class="foot">
        <button class="btn btn-outline" type="button" (click)="close.emit()">Cancel</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !valid()" (click)="save()">@if (busy()) { <span class="spinner"></span> } Save stock</button>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 18px; padding-bottom: 8px; }
    .current { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; background: var(--white); border: 1px solid var(--line-2); }
    .current img { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; }
    .current div { flex: 1; display: flex; flex-direction: column; line-height: 1.3; }
    .current small { font-size: 12px; }
    .current strong { font-size: 17px; }
    .bad { color: var(--danger); }
    .segmented.full { display: flex; } .segmented.full button { flex: 1; justify-content: center; padding: 0 8px; }
    .qty { font-size: 22px; font-weight: 700; height: 56px; padding-right: 70px; }
    .unit { font-weight: 700; color: var(--muted); padding-right: 10px; }
    .quick { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .quick .chip { height: 34px; padding: 0 14px; }
    .foot { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; }
  `,
})
export class StockSheetComponent {
  protected readonly productName = productName;
  readonly product = input<Product | null>(null);
  readonly close = output<void>();
  readonly saved = output<Product>();
  private api = inject(AdminApi);
  private toast = inject(ToastService);

  readonly mode = signal<StockAdjustMode>('Add');
  readonly qty = signal(0);
  readonly busy = signal(false);
  note = '';
  protected roundQty = roundQty;

  readonly quick = computed(() => (this.product()?.unit === 'Kg' ? [1, 5, 10, 25] : [1, 5, 10, 20]));
  readonly after = computed(() => {
    const p = this.product();
    if (!p) return 0;
    const q = this.qty();
    return roundQty(this.mode() === 'Add' ? p.stockQuantity + q : this.mode() === 'Remove' ? p.stockQuantity - q : q);
  });
  readonly valid = computed(() => {
    const p = this.product();
    if (!p || this.qty() < 0 || this.after() < 0) return false;
    if (p.unit !== 'Kg' && !Number.isInteger(this.qty())) return false;
    return this.mode() === 'Set' ? this.qty() !== p.stockQuantity : this.qty() > 0;
  });

  constructor() {
    effect(() => {
      const p = this.product();
      if (!p) return;
      this.mode.set('Add');
      this.qty.set(0);
      this.note = '';
    });
  }

  async save() {
    const p = this.product();
    if (!p || !this.valid()) return;
    this.busy.set(true);
    try {
      const updated = await firstValueFrom(this.api.adjustStock(p.id, this.mode(), this.qty(), this.note.trim() || undefined));
      this.toast.success(`${p.name}: stock is now ${formatQty(updated.stockQuantity, updated.unit)}`);
      this.saved.emit(updated);
      this.close.emit();
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.busy.set(false);
    }
  }
}
