import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { debounceTime, firstValueFrom } from 'rxjs';
import { AdminApi, toApiError } from '../core/api';
import { trimNumber } from '../core/format';
import { Product, StockMovement, StockMovementReason } from '../core/models';
import { AdminRealtime } from '../core/realtime';
import { ToastService } from '../core/toast.service';
import { QtyPipe, UnitPipe } from '../shared/pipes';
import { EmptyStateComponent } from '../shared/ui.components';
import { stockState } from './products.page';
import { StockSheetComponent } from './stock-sheet.component';

const REASON: Record<StockMovementReason, { label: string; tone: string }> = {
  Initial: { label: 'Opening stock', tone: 'blue' },
  Restock: { label: 'Restock', tone: 'green' },
  Sale: { label: 'Sale', tone: '' },
  Cancellation: { label: 'Order cancelled', tone: 'blue' },
  Correction: { label: 'Correction', tone: 'amber' },
};

@Component({
  selector: 'app-inventory',
  imports: [DatePipe, FormsModule, RouterLink, LucideAngularModule, QtyPipe, UnitPipe, EmptyStateComponent, StockSheetComponent],
  template: `
    <header class="page-header">
      <div>
        <h1 class="display">Inventory</h1>
        <p>Every sale, restock and correction is recorded. Stock can never go below zero.</p>
      </div>
    </header>

    <div class="grid">
      <section class="card levels">
        <div class="head">
          <h2>Stock levels</h2>
          <label class="search-box sm">
            <lucide-icon name="search" [size]="16" />
            <input class="input" type="search" placeholder="Find a vegetable" [ngModel]="search()" (ngModelChange)="search.set($event)" />
          </label>
        </div>
        @if (loading()) {
          @for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="skeleton sk"></div> }
        } @else {
          <ul class="rows">
            @for (p of levels(); track p.id) {
              @let st = state(p);
              <li [class.selected]="selected() === p.id">
                <button type="button" class="row-main" (click)="selectProduct(p.id)">
                  <img class="thumb" [src]="p.imageUrl" alt="" />
                  <div class="info">
                    <div class="line"><strong>{{ p.name }}</strong><span class="tabular qty" [class]="'tabular qty ' + st.tone">{{ p.stockQuantity | qty: p.unit }}</span></div>
                    <div class="bar"><span [style.width.%]="fill(p)" [class]="st.tone"></span></div>
                    <small class="muted">{{ st.label }} · alert at {{ p.lowStockThreshold | qty: p.unit }}</small>
                  </div>
                </button>
                <button type="button" class="icon-btn add" (click)="stockFor.set(p)" [attr.aria-label]="'Update stock for ' + p.name"><lucide-icon name="plus" [size]="17" /></button>
              </li>
            } @empty {
              <app-empty-state icon="package" title="No products" message="Add products to start tracking stock.">
                <a class="btn btn-primary" routerLink="/admin/products/new">Add vegetables</a>
              </app-empty-state>
            }
          </ul>
        }
      </section>

      <section class="card log">
        <div class="head">
          <div>
            <h2>Stock movements</h2>
            <p class="muted">{{ selectedName() ? 'Showing ' + selectedName() : 'All products · latest 200' }}</p>
          </div>
          @if (selected()) { <button type="button" class="btn btn-sm btn-ghost" (click)="selectProduct(null)"><lucide-icon name="x" [size]="14" /> Clear filter</button> }
        </div>
        @if (logLoading()) {
          @for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton sk"></div> }
        } @else if (!movements().length) {
          <app-empty-state icon="boxes" title="No movements yet" message="Stock changes will appear here." />
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>When</th>@if (!selected()) { <th>Product</th> }<th>Type</th><th class="text-right">Change</th><th class="text-right">Balance</th><th class="only-desktop">By</th></tr></thead>
              <tbody>
                @for (m of movements(); track m.id) {
                  @let unit = unitOf(m.productId);
                  <tr>
                    <td class="when"><span>{{ m.createdAt | date: 'd MMM' }}</span><small class="muted">{{ m.createdAt | date: 'h:mm a' }}</small></td>
                    @if (!selected()) { <td><button type="button" class="link-btn" (click)="selectProduct(m.productId)">{{ m.productName }}</button></td> }
                    <td>
                      <span class="badge" [class]="'badge ' + reason(m.reason).tone">{{ reason(m.reason).label }}</span>
                      @if (m.orderNumber) { <small class="muted ref tabular">{{ m.orderNumber }}</small> }
                      @else if (m.note) { <small class="muted ref">{{ m.note }}</small> }
                    </td>
                    <td class="text-right tabular change" [class.pos]="m.change > 0" [class.neg]="m.change < 0">{{ signed(m.change) }} {{ unit | unit }}</td>
                    <td class="text-right tabular"><strong>{{ m.balanceAfter | qty: unit }}</strong></td>
                    <td class="only-desktop muted by">{{ m.createdBy }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    <app-stock-sheet [product]="stockFor()" (close)="stockFor.set(null)" (saved)="onSaved($event)" />
  `,
  styles: `
    .grid { display: grid; gap: 16px; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px 18px 10px; flex-wrap: wrap; }
    .head h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; }
    .head p { font-size: 12.5px; margin-top: 2px; }
    .search-box.sm { flex: 0 1 220px; min-width: 160px; }
    .search-box.sm .input { height: 40px; }
    .sk { height: 58px; margin: 8px 16px; }
    .rows { list-style: none; margin: 0; padding: 0 8px 10px; max-height: 70vh; overflow-y: auto; }
    .rows li { display: flex; align-items: center; gap: 6px; border-radius: 14px; padding-right: 6px; }
    .rows li:hover, .rows li.selected { background: var(--cream-50); }
    .rows li.selected { box-shadow: inset 3px 0 0 var(--leaf-600); }
    .row-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px; border: 0; background: none; text-align: left; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .line { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; }
    .line strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .qty { font-weight: 800; }
    .qty.red { color: var(--danger); } .qty.amber { color: var(--amber); } .qty.neutral { color: var(--muted); }
    .bar { height: 6px; border-radius: 6px; background: var(--cream-200); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 6px; background: var(--leaf-500); transition: width .4s var(--ease-out); }
    .bar span.amber { background: #e0a43a; } .bar span.red { background: var(--danger); } .bar span.neutral { background: var(--cream-300); }
    .info small { font-size: 11.5px; }
    .add { width: 36px; height: 36px; flex-shrink: 0; }
    .when { display: flex; flex-direction: column; line-height: 1.3; white-space: nowrap; }
    .when small { font-size: 12px; }
    .ref { display: block; font-size: 12px; margin-top: 3px; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .change { font-weight: 800; white-space: nowrap; }
    .change.pos { color: var(--leaf-600); } .change.neg { color: var(--danger); }
    .by { font-size: 13px; white-space: nowrap; }
    .link-btn { border: 0; background: none; padding: 0; font-weight: 700; color: var(--ink); text-align: left; }
    .link-btn:hover { color: var(--leaf-600); }
    .table td, .table th { padding: 12px 14px; }
    @media (min-width: 1100px) { .grid { grid-template-columns: 380px minmax(0, 1fr); align-items: start; } .levels { position: sticky; top: 24px; } }
  `,
})
export class InventoryPage {
  private api = inject(AdminApi);
  private toast = inject(ToastService);

  readonly products = signal<Product[]>([]);
  readonly movements = signal<StockMovement[]>([]);
  readonly loading = signal(true);
  readonly logLoading = signal(true);
  readonly search = signal('');
  readonly selected = signal<number | null>(null);
  readonly stockFor = signal<Product | null>(null);

  readonly levels = computed(() => {
    const q = this.search().trim().toLowerCase();
    const rank = (p: Product) => (!p.isActive ? 3 : p.stockQuantity <= 0 ? 0 : p.stockQuantity <= p.lowStockThreshold ? 1 : 2);
    return this.products()
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.stockQuantity / Math.max(1, a.lowStockThreshold) - b.stockQuantity / Math.max(1, b.lowStockThreshold));
  });
  private unitMap = computed(() => new Map(this.products().map((p) => [p.id, p.unit])));
  readonly selectedName = computed(() => this.products().find((p) => p.id === this.selected())?.name ?? null);

  constructor() {
    void this.loadProducts();
    void this.loadLog();
    inject(AdminRealtime).productsChanged.pipe(debounceTime(500), takeUntilDestroyed(inject(DestroyRef))).subscribe((list) => {
      list.forEach((p) => this.upsert(p));
      void this.loadLog(true);
    });
  }

  state(p: Product) { return stockState(p); }
  reason(r: StockMovementReason) { return REASON[r]; }
  unitOf(id: number) { return this.unitMap().get(id) ?? 'Kg'; }
  signed(n: number) { return (n > 0 ? '+' : n < 0 ? '−' : '') + trimNumber(Math.abs(n)); }
  fill(p: Product) { return Math.min(100, (p.stockQuantity / Math.max(p.lowStockThreshold * 4, 1)) * 100); }

  selectProduct(id: number | null) {
    this.selected.set(this.selected() === id ? null : id);
    void this.loadLog();
  }

  onSaved(p: Product) {
    this.upsert(p);
    void this.loadLog(true);
  }

  private upsert(p: Product) {
    this.products.update((list) => list.map((x) => (x.id === p.id ? p : x)));
  }

  private async loadProducts() {
    try {
      this.products.set(await firstValueFrom(this.api.products()));
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadLog(silent = false) {
    if (!silent) this.logLoading.set(true);
    try {
      this.movements.set(await firstValueFrom(this.api.movements(this.selected(), 200)));
    } catch (e) {
      if (!silent) this.toast.error(toApiError(e).title);
    } finally {
      this.logLoading.set(false);
    }
  }
}
