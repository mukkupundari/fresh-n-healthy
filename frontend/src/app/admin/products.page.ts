import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, CatalogApi, toApiError } from '../core/api';
import { Category, Product } from '../core/models';
import { AdminRealtime } from '../core/realtime';
import { ToastService } from '../core/toast.service';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { InrPipe, ProductNamePipe, QtyPipe, UnitPipe } from '../shared/pipes';
import { EmptyStateComponent } from '../shared/ui.components';
import { StockSheetComponent } from './stock-sheet.component';

type StatusFilter = 'all' | 'available' | 'low' | 'soldout' | 'inactive' | 'featured';

export function stockState(p: Product): { tone: 'green' | 'amber' | 'red' | 'neutral'; label: string } {
  if (!p.isActive) return { tone: 'neutral', label: 'Hidden' };
  if (p.stockQuantity <= 0) return { tone: 'red', label: 'Sold out' };
  if (p.stockQuantity <= p.lowStockThreshold) return { tone: 'amber', label: 'Low stock' };
  return { tone: 'green', label: 'In stock' };
}

@Component({
  selector: 'app-admin-products',
  imports: [FormsModule, RouterLink, LucideAngularModule, InrPipe, ProductNamePipe, QtyPipe, UnitPipe, EmptyStateComponent, StockSheetComponent, BottomSheetComponent],
  template: `
    <header class="page-header">
      <div>
        <h1 class="display">Products</h1>
        <p>{{ products().length }} vegetables · {{ counts().available }} available to customers</p>
      </div>
      <div class="actions">
        <a class="btn btn-primary" routerLink="/admin/products/new"><lucide-icon name="plus" [size]="17" /> Add vegetables</a>
      </div>
    </header>

    <div class="toolbar">
      <label class="search-box">
        <lucide-icon name="search" [size]="17" />
        <input class="input" type="search" placeholder="Search vegetables…" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </label>
      <select class="select cat" [ngModel]="categoryId()" (ngModelChange)="categoryId.set(+$event || null)">
        <option [ngValue]="null">All categories</option>
        @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
      </select>
    </div>
    <div class="chip-row no-scrollbar filters">
      @for (f of filters; track f.key) {
        <button type="button" class="chip" [class.active]="filter() === f.key" (click)="filter.set(f.key)">
          {{ f.label }} <span class="n">{{ counts()[f.key] }}</span>
        </button>
      }
    </div>

    @if (loading()) {
      <div class="card">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton row-sk"></div> }</div>
    } @else if (!visible().length) {
      <div class="card">
        <app-empty-state icon="package" [title]="products().length ? 'No products match' : 'Add your first vegetable'"
          [message]="products().length ? 'Try a different search or filter.' : 'Add vegetables with a photo, price and stock to start selling.'">
          @if (!products().length) { <a class="btn btn-primary" routerLink="/admin/products/new"><lucide-icon name="plus" [size]="16" /> Add vegetables</a> }
        </app-empty-state>
      </div>
    } @else {
      <div class="card table-wrap only-desktop">
        <table class="table">
          <thead>
            <tr><th>Product</th><th>Price</th><th>Stock</th><th>Visible</th><th>Featured</th><th class="text-right">Actions</th></tr>
          </thead>
          <tbody>
            @for (p of visible(); track p.id) {
              @let st = state(p);
              <tr [class.inactive]="!p.isActive">
                <td>
                  <a class="cell-main" [routerLink]="['/admin/products', p.id]">
                    <img class="thumb" [src]="p.imageUrl" alt="" />
                    <div><strong>{{ p | productName }}</strong><small>{{ p.categoryName }}</small></div>
                  </a>
                </td>
                <td class="tabular"><strong>{{ p.price | inr }}</strong> <span class="muted">/ {{ p.unit | unit }}</span></td>
                <td>
                  <button type="button" class="stock-btn" (click)="stockFor.set(p)" title="Update stock">
                    <span class="tabular">{{ p.stockQuantity | qty: p.unit }}</span>
                    <span class="badge" [class]="'badge ' + st.tone">{{ st.label }}</span>
                  </button>
                </td>
                <td>
                  <label class="switch" [title]="p.isActive ? 'Visible to customers' : 'Hidden from customers'">
                    <input type="checkbox" [checked]="p.isActive" [disabled]="busyId() === p.id" (change)="toggleActive(p)" />
                    <span class="track"></span>
                  </label>
                </td>
                <td>
                  <button type="button" class="star" [class.on]="p.isFeatured" [disabled]="busyId() === p.id" (click)="toggleFeatured(p)" [attr.aria-label]="p.isFeatured ? 'Remove from featured' : 'Mark as featured'">
                    <lucide-icon name="star" [size]="18" />
                  </button>
                </td>
                <td class="text-right">
                  <div class="row-actions">
                    <button type="button" class="btn btn-sm btn-outline" (click)="stockFor.set(p)"><lucide-icon name="boxes" [size]="14" /> Stock</button>
                    <a class="icon-btn sm" [routerLink]="['/admin/products', p.id]" aria-label="Edit"><lucide-icon name="pencil" [size]="15" /></a>
                    <button type="button" class="icon-btn sm danger" (click)="toDelete.set(p)" aria-label="Delete"><lucide-icon name="trash-2" [size]="15" /></button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <ul class="m-list only-mobile">
        @for (p of visible(); track p.id) {
          @let st = state(p);
          <li class="card m-card" [class.inactive]="!p.isActive">
            <a class="m-top" [routerLink]="['/admin/products', p.id]">
              <img class="thumb lg" [src]="p.imageUrl" alt="" />
              <div class="m-info">
                <strong>{{ p | productName }} @if (p.isFeatured) { <lucide-icon name="star" [size]="13" class="fstar" /> }</strong>
                <span class="tabular">{{ p.price | inr }} <span class="muted">/ {{ p.unit | unit }}</span></span>
                <span class="m-stock"><span class="badge" [class]="'badge ' + st.tone">{{ st.label }}</span> <span class="tabular muted">{{ p.stockQuantity | qty: p.unit }}</span></span>
              </div>
              <lucide-icon name="chevron-right" [size]="18" class="muted" />
            </a>
            <div class="m-actions">
              <label class="switch">
                <input type="checkbox" [checked]="p.isActive" [disabled]="busyId() === p.id" (change)="toggleActive(p)" />
                <span class="track"></span><span class="sw-l">{{ p.isActive ? 'Visible' : 'Hidden' }}</span>
              </label>
              <button type="button" class="star" [class.on]="p.isFeatured" (click)="toggleFeatured(p)" aria-label="Featured"><lucide-icon name="star" [size]="18" /></button>
              <button type="button" class="btn btn-sm btn-dark" (click)="stockFor.set(p)"><lucide-icon name="boxes" [size]="14" /> Stock</button>
            </div>
          </li>
        }
      </ul>
    }

    <app-stock-sheet [product]="stockFor()" (close)="stockFor.set(null)" (saved)="upsert($event)" />

    <app-bottom-sheet [open]="!!toDelete()" title="Delete product?" [subtitle]="toDelete()?.name ?? null" (close)="toDelete.set(null)">
      <p class="del-copy">If this vegetable has past orders it will be hidden from customers instead, so your order history stays intact.</p>
      <div sheet-footer class="del-actions">
        <button class="btn btn-outline" type="button" (click)="toDelete.set(null)">Keep</button>
        <button class="btn btn-danger" type="button" [disabled]="deleting()" (click)="remove()">@if (deleting()) { <span class="spinner"></span> } Delete</button>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .cat { width: auto; min-width: 180px; height: 44px; background-color: var(--white); }
    .filters { margin-bottom: 16px; }
    .chip .n { font-size: 11.5px; padding: 1px 7px; border-radius: 99px; background: var(--cream-200); color: var(--ink-2); }
    .chip.active .n { background: rgba(255,255,255,.18); color: var(--white); }
    .row-sk { height: 64px; margin: 10px 16px; }
    tr.inactive td { opacity: .6; }
    tr.inactive td:last-child, tr.inactive td:nth-child(4) { opacity: 1; }
    .cell-main strong { font-size: 14.5px; }
    .stock-btn { border: 0; background: none; padding: 6px 8px; margin: -6px -8px; border-radius: 10px; display: inline-flex; align-items: center; gap: 10px; font-weight: 700; color: var(--ink); }
    .stock-btn:hover { background: var(--cream-100); }
    .badge.neutral { background: var(--cream-200); color: var(--muted); }
    .star { border: 0; background: none; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: var(--cream-300); transition: color .15s, transform .15s; }
    .star:hover { color: var(--amber); }
    .star.on { color: #e3a21a; }
    .star.on ::ng-deep svg { fill: currentColor; }
    .row-actions { display: inline-flex; gap: 6px; align-items: center; }
    .icon-btn.sm { width: 36px; height: 36px; }
    .icon-btn.danger { color: var(--danger); }
    .m-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .m-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .m-card.inactive .m-top { opacity: .6; }
    .m-top { display: flex; align-items: center; gap: 12px; }
    .thumb.lg { width: 60px; height: 60px; border-radius: 14px; }
    .m-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: 14px; }
    .m-info strong { font-size: 15px; display: flex; align-items: center; gap: 5px; }
    .fstar { color: #e3a21a; }
    .m-stock { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .m-actions { display: flex; align-items: center; gap: 8px; padding-top: 10px; border-top: 1px solid var(--line-2); }
    .m-actions .switch { flex: 1; }
    .sw-l { font-size: 13px; font-weight: 600; color: var(--ink-2); }
    .del-copy { font-size: 14px; color: var(--ink-2); padding-bottom: 8px; }
    .del-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  `,
})
export class AdminProductsPage implements OnInit {
  readonly status = input<string | undefined>();
  private api = inject(AdminApi);
  private catalog = inject(CatalogApi);
  private toast = inject(ToastService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly categoryId = signal<number | null>(null);
  readonly filter = signal<StatusFilter>('all');
  readonly busyId = signal<number | null>(null);
  readonly stockFor = signal<Product | null>(null);
  readonly toDelete = signal<Product | null>(null);
  readonly deleting = signal(false);

  readonly filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'available', label: 'Available' }, { key: 'low', label: 'Low stock' },
    { key: 'soldout', label: 'Sold out' }, { key: 'inactive', label: 'Hidden' }, { key: 'featured', label: 'Featured' },
  ];
  private matches: Record<StatusFilter, (p: Product) => boolean> = {
    all: () => true,
    available: (p) => p.isActive && p.stockQuantity > 0,
    low: (p) => p.isActive && p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold,
    soldout: (p) => p.isActive && p.stockQuantity <= 0,
    inactive: (p) => !p.isActive,
    featured: (p) => p.isFeatured,
  };

  readonly counts = computed(() => {
    const list = this.products();
    return Object.fromEntries(this.filters.map((f) => [f.key, list.filter(this.matches[f.key]).length])) as Record<StatusFilter, number>;
  });
  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.categoryId();
    const match = this.matches[this.filter()];
    return this.products().filter((p) => match(p) && (!cat || p.categoryId === cat) && (!q || p.name.toLowerCase().includes(q) || !!p.localName?.includes(q)));
  });

  constructor() {
    void this.load();
    inject(AdminRealtime).productsChanged.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((list) => list.forEach((p) => this.upsert(p)));
  }

  ngOnInit() {
    const s = this.status() as StatusFilter;
    if (s && s in this.matches) this.filter.set(s);
  }

  state(p: Product) { return stockState(p); }

  async load() {
    this.loading.set(true);
    try {
      const [products, categories] = await Promise.all([firstValueFrom(this.api.products()), firstValueFrom(this.catalog.categories())]);
      this.products.set(products);
      this.categories.set(categories);
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }

  upsert(p: Product) {
    this.products.update((list) => {
      const i = list.findIndex((x) => x.id === p.id);
      if (i < 0) return [...list, p];
      const next = [...list];
      next[i] = p;
      return next;
    });
  }

  async toggleActive(p: Product) {
    this.busyId.set(p.id);
    try {
      const updated = await firstValueFrom(this.api.setProductActive(p.id, !p.isActive));
      this.upsert(updated);
      this.toast.success(updated.isActive ? `${p.name} is now visible to customers` : `${p.name} is hidden from customers`);
    } catch (e) {
      this.toast.error(toApiError(e).title);
      this.upsert({ ...p });
    } finally {
      this.busyId.set(null);
    }
  }

  async toggleFeatured(p: Product) {
    this.busyId.set(p.id);
    try {
      this.upsert(await firstValueFrom(this.api.setProductFeatured(p.id, !p.isFeatured)));
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.busyId.set(null);
    }
  }

  async remove() {
    const p = this.toDelete();
    if (!p) return;
    this.deleting.set(true);
    try {
      const res = await firstValueFrom(this.api.deleteProduct(p.id));
      if (res.deleted) this.products.update((list) => list.filter((x) => x.id !== p.id));
      else this.upsert({ ...p, isActive: false });
      this.toast.success(res.message);
      this.toDelete.set(null);
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.deleting.set(false);
    }
  }
}
