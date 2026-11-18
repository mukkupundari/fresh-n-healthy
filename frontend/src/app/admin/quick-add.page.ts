import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, CatalogApi, fieldErrors, toApiError } from '../core/api';
import { Category, ProductUnit, SaveProductRequest } from '../core/models';
import { ToastService } from '../core/toast.service';
import { CategorySlug, VEGETABLE_CATALOG, catalogPhoto } from './vegetable-catalog';

interface Row {
  key: string;
  category: CategorySlug;
  description: string;
  step: number;
  name: string;
  unit: ProductUnit;
  price: number | null;
  stock: number | null;
  selected: boolean;
  owned: boolean;
}

const UNIT_RULES: Record<ProductUnit, { min: number; step: number; low: number }> = {
  Kg: { min: 0.25, step: 0.25, low: 5 },
  Piece: { min: 1, step: 1, low: 5 },
  Bunch: { min: 1, step: 1, low: 5 },
  Pack: { min: 1, step: 1, low: 5 },
};

@Component({
  selector: 'app-quick-add',
  imports: [FormsModule, RouterLink, LucideAngularModule],
  template: `
    <header class="page-header">
      <div>
        <a routerLink="/admin/products" class="crumb"><lucide-icon name="arrow-left" [size]="15" /> Products</a>
        <h1 class="display">Add vegetables</h1>
        <p>{{ rows().length }} common vegetables with typical prices. Tick what you sell, adjust the name, price and stock, then add them all at once.</p>
      </div>
    </header>

    @if (loading()) {
      <div class="skeleton" style="height: 480px; border-radius: 20px"></div>
    } @else {
      <div class="filters">
        <label class="search">
          <lucide-icon name="search" [size]="17" />
          <input type="search" placeholder="Search tomato, methi, dondakaya…" [ngModel]="query()" (ngModelChange)="query.set($event)" />
        </label>
        <div class="chips no-scrollbar">
          <button type="button" class="chip" [class.active]="category() === 'all'" (click)="category.set('all')">All</button>
          @for (c of categories(); track c.id) {
            <button type="button" class="chip" [class.active]="category() === c.slug" (click)="category.set(c.slug)">{{ c.name }}</button>
          }
        </div>
      </div>

      <section class="card list">
        <div class="list-head">
          <label class="check-all">
            <input type="checkbox" [checked]="allShownSelected()" [indeterminate]="someShownSelected()" (change)="toggleShown($any($event.target).checked)" [disabled]="!selectableShown().length" />
            <span>{{ shown().length }} shown</span>
          </label>
          <span class="col">Price</span>
          <span class="col">Opening stock</span>
        </div>

        @for (r of shown(); track r.key) {
          <div class="row" [class.selected]="r.selected" [class.owned]="r.owned" [class.invalid]="rowError(r.key)">
            <label class="pick">
              <input type="checkbox" [checked]="r.selected" [disabled]="r.owned" (change)="setSelected(r, $any($event.target).checked)" [attr.aria-label]="'Add ' + r.name" />
            </label>
            <img class="thumb" [src]="photo(r.key)" [alt]="r.name" loading="lazy" />
            <div class="name">
              <input class="input sm" [ngModel]="r.name" (ngModelChange)="edit(r, 'name', $event)" [disabled]="r.owned" maxlength="100" [attr.aria-label]="'Name for ' + r.key" />
              @if (r.owned) {
                <span class="tag">Already in your shop</span>
              } @else {
                <select class="unit" [ngModel]="r.unit" (ngModelChange)="edit(r, 'unit', $event)" aria-label="Sold by">
                  @for (u of units; track u.value) { <option [value]="u.value">per {{ u.label }}</option> }
                </select>
              }
              @if (rowError(r.key); as e) { <span class="error-text">{{ e }}</span> }
            </div>
            <label class="money">
              <span class="pre">₹</span>
              <input class="input sm" type="number" inputmode="decimal" min="0" step="1" [ngModel]="r.price" (ngModelChange)="edit(r, 'price', $event)" [disabled]="r.owned" aria-label="Price" />
              <span class="suf">/{{ short(r.unit) }}</span>
            </label>
            <label class="money">
              <input class="input sm" type="number" inputmode="decimal" min="0" [step]="r.unit === 'Kg' ? 0.5 : 1" [ngModel]="r.stock" (ngModelChange)="edit(r, 'stock', $event)" [disabled]="r.owned" aria-label="Opening stock" />
              <span class="suf">{{ short(r.unit) }}</span>
            </label>
          </div>
        } @empty {
          <div class="empty">
            <lucide-icon name="search" [size]="22" />
            <p>No vegetable matches "{{ query() }}". Add it as a custom product below.</p>
          </div>
        }
      </section>

      <a class="card custom" routerLink="/admin/products/custom">
        <span class="ic"><lucide-icon name="plus" [size]="20" /></span>
        <span class="txt"><strong>Add a new product</strong><small>Not in the list? Add any vegetable with your own name, photo and pricing.</small></span>
        <lucide-icon name="chevron-right" [size]="18" />
      </a>

      <div class="savebar">
        <div class="savebar-inner">
          <span class="summary">
            @if (selectedCount()) { <strong>{{ selectedCount() }}</strong> selected } @else { Tick vegetables to add them }
          </span>
          @if (selectedCount()) { <button type="button" class="btn btn-ghost" (click)="clear()">Clear</button> }
          <button type="button" class="btn btn-primary" [disabled]="!selectedCount() || saving()" (click)="save()">
            @if (saving()) { <span class="spinner"></span> } Add {{ selectedCount() || '' }} {{ selectedCount() === 1 ? 'vegetable' : 'vegetables' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; padding-bottom: 96px; }
    .crumb { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--leaf-600); margin-bottom: 6px; }
    .filters { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; min-width: 0; }
    .search { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 14px; border-radius: 14px; background: var(--white); border: 1.5px solid var(--line); color: var(--muted); }
    .search:focus-within { border-color: var(--leaf-600); }
    .search input { flex: 1; border: 0; outline: 0; background: none; font: inherit; color: var(--ink, inherit); min-width: 0; }
    .chips { display: flex; gap: 8px; overflow-x: auto; min-width: 0; }
    .list { padding: 0; overflow: hidden; }
    .list-head, .row { display: grid; grid-template-columns: 28px 52px minmax(0, 1fr) minmax(0, 1fr); column-gap: 10px; row-gap: 8px; align-items: center; padding: 10px 14px; }
    .row .name { grid-column: 3 / 5; }
    .list-head { background: var(--cream-50); border-bottom: 1px solid var(--line-2); font-size: 12.5px; font-weight: 700; color: var(--muted); }
    .list-head .col { display: none; }
    .check-all { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .row + .row { border-top: 1px solid var(--line-2); }
    .row { transition: background-color .15s; }
    .row.selected { background: color-mix(in srgb, var(--lime-400) 12%, var(--white)); }
    .row.owned { opacity: .6; }
    .row.invalid { background: var(--danger-50); }
    input[type=checkbox] { width: 20px; height: 20px; accent-color: var(--leaf-600); cursor: pointer; }
    .pick { display: grid; place-items: center; grid-row: span 2; }
    .thumb { width: 52px; height: 52px; border-radius: 12px; object-fit: cover; grid-row: span 2; background: var(--cream-100); }
    .name { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .input.sm { height: 38px; padding: 0 10px; font-size: 14px; border-radius: 10px; }
    .name .input { font-weight: 700; }
    .unit { align-self: flex-start; border: 0; background: none; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--leaf-600); padding: 0; cursor: pointer; }
    .tag { font-size: 12px; font-weight: 700; color: var(--muted); }
    .money { position: relative; display: flex; align-items: center; }
    .money .input { width: 100%; padding-right: 46px; }
    .money .pre { position: absolute; left: 10px; color: var(--muted); font-size: 14px; pointer-events: none; }
    .money .pre + .input { padding-left: 24px; }
    .money .suf { position: absolute; right: 10px; color: var(--muted); font-size: 12.5px; pointer-events: none; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; color: var(--muted); text-align: center; }
    .custom { display: flex; align-items: center; gap: 14px; margin-top: 12px; padding: 16px; border: 1.5px dashed var(--line); color: var(--forest-900); transition: border-color .15s, background-color .15s; }
    .custom:hover { border-color: var(--leaf-600); background: var(--cream-50); }
    .custom .ic { width: 42px; height: 42px; border-radius: 14px; background: var(--forest-900); color: var(--lime-400); display: grid; place-items: center; flex-shrink: 0; }
    .custom .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .custom small { color: var(--muted); font-size: 13px; }
    .savebar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: rgba(255,255,255,.94); backdrop-filter: blur(10px); border-top: 1px solid var(--line); padding: 12px 14px calc(12px + var(--safe-bottom)); }
    .savebar-inner { max-width: 1260px; margin: 0 auto; display: flex; align-items: center; gap: 10px; }
    .summary { flex: 1; font-size: 14px; color: var(--muted); }
    .summary strong { color: var(--forest-900); }
    @media (min-width: 560px) {
      .list-head, .row { grid-template-columns: 28px 52px minmax(0, 1fr) 130px 130px; }
      .row .name { grid-column: auto; }
      .list-head .col { display: block; }
      .check-all { grid-column: 1 / 4; }
      .pick, .thumb { grid-row: auto; }
    }
    @media (min-width: 1024px) {
      .filters { flex-direction: row; align-items: center; }
      .search { width: 320px; flex-shrink: 0; }
      .savebar { left: 268px; }
      .savebar-inner { padding: 0 18px; }
    }
  `,
})
export class QuickAddPage {
  private api = inject(AdminApi);
  private catalog = inject(CatalogApi);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly units: { value: ProductUnit; label: string }[] = [
    { value: 'Kg', label: 'kg' }, { value: 'Piece', label: 'piece' }, { value: 'Bunch', label: 'bunch' }, { value: 'Pack', label: 'pack' },
  ];
  readonly categories = signal<Category[]>([]);
  readonly rows = signal<Row[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly query = signal('');
  readonly category = signal<'all' | string>('all');

  readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.rows().filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false;
      if (!q) return true;
      const t = VEGETABLE_CATALOG.find((v) => v.key === r.key);
      return r.name.toLowerCase().includes(q) || !!t?.keywords.some((k) => k.includes(q));
    });
  });
  readonly selectableShown = computed(() => this.shown().filter((r) => !r.owned));
  readonly allShownSelected = computed(() => this.selectableShown().length > 0 && this.selectableShown().every((r) => r.selected));
  readonly someShownSelected = computed(() => !this.allShownSelected() && this.selectableShown().some((r) => r.selected));
  readonly selectedCount = computed(() => this.rows().filter((r) => r.selected).length);

  constructor() {
    void this.load();
  }

  photo(key: string) { return catalogPhoto(key); }
  short(unit: ProductUnit) { return { Kg: 'kg', Piece: 'pc', Bunch: 'bunch', Pack: 'pack' }[unit]; }
  rowError(key: string) { return this.errors()[key]; }

  private async load() {
    try {
      const [cats, products] = await Promise.all([firstValueFrom(this.catalog.categories()), firstValueFrom(this.api.products())]);
      this.categories.set(cats);
      const owned = new Set(products.map((p) => p.name.trim().toLowerCase()));
      const ownedPhotos = new Set(products.map((p) => p.imageUrl));
      this.rows.set(VEGETABLE_CATALOG.map((t) => ({
        key: t.key, category: t.category, description: t.description, step: t.step, name: t.name, unit: t.unit, price: t.price, stock: t.stock,
        selected: false, owned: owned.has(t.name.toLowerCase()) || ownedPhotos.has(catalogPhoto(t.key)),
      })).sort((a, b) => Number(a.owned) - Number(b.owned)));
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }

  private update(key: string, change: (r: Row) => Partial<Row>) {
    this.rows.update((rows) => rows.map((r) => (r.key === key ? { ...r, ...change(r) } : r)));
    if (this.errors()[key]) {
      const { [key]: _, ...rest } = this.errors();
      this.errors.set(rest);
    }
  }

  edit(r: Row, field: 'name' | 'unit' | 'price' | 'stock', value: string | number | null) {
    this.update(r.key, (cur) => {
      const next: Partial<Row> = { [field]: value, selected: true };
      if (field === 'unit' && value !== 'Kg' && cur.stock !== null) next.stock = Math.floor(Number(cur.stock));
      return next;
    });
  }

  setSelected(r: Row, selected: boolean) {
    this.update(r.key, () => ({ selected }));
  }

  toggleShown(selected: boolean) {
    const keys = new Set(this.selectableShown().map((r) => r.key));
    this.rows.update((rows) => rows.map((r) => (keys.has(r.key) ? { ...r, selected } : r)));
  }

  clear() {
    this.rows.update((rows) => rows.map((r) => ({ ...r, selected: false })));
    this.errors.set({});
  }

  private validate(rows: Row[]): Record<string, string> {
    const e: Record<string, string> = {};
    const seen = new Set<string>();
    for (const r of rows) {
      const name = r.name.trim();
      if (name.length < 2) e[r.key] = 'Enter a name.';
      else if (seen.has(name.toLowerCase())) e[r.key] = `${name} is listed twice.`;
      else if (!(Number(r.price) > 0)) e[r.key] = 'Enter a price greater than ₹0.';
      else if (r.stock === null || Number(r.stock) < 0) e[r.key] = 'Enter the stock you have (0 if none yet).';
      else if (r.unit !== 'Kg' && !Number.isInteger(Number(r.stock))) e[r.key] = 'Use whole numbers for pieces, bunches and packs.';
      seen.add(name.toLowerCase());
    }
    return e;
  }

  async save() {
    const picked = this.rows().filter((r) => r.selected);
    const e = this.validate(picked);
    this.errors.set(e);
    if (Object.keys(e).length) {
      this.query.set('');
      this.category.set('all');
      this.toast.error(`Fix ${Object.keys(e).length === 1 ? '1 vegetable' : Object.keys(e).length + ' vegetables'} highlighted in red.`);
      return;
    }

    const items: SaveProductRequest[] = picked.map((r) => {
      const rules = UNIT_RULES[r.unit];
      const step = r.unit === 'Kg' ? r.step : rules.step;
      return {
        name: r.name.trim(), description: r.description, categoryId: this.categories().find((c) => c.slug === r.category)?.id ?? 0,
        imageUrl: catalogPhoto(r.key), unit: r.unit, price: Number(r.price), stockQuantity: Number(r.stock),
        minOrderQuantity: r.unit === 'Kg' ? Math.max(step, rules.min) : rules.min, stepQuantity: step, lowStockThreshold: rules.low,
        isActive: true, isFeatured: false,
      };
    });

    this.saving.set(true);
    try {
      const res = await firstValueFrom(this.api.createProducts(items));
      this.toast.success(`${res.created} ${res.created === 1 ? 'vegetable' : 'vegetables'} added to your store`);
      this.router.navigateByUrl('/admin/products');
    } catch (err) {
      const apiErr = toApiError(err);
      const byIndex = fieldErrors(apiErr);
      this.errors.set(Object.fromEntries(Object.entries(byIndex).map(([i, msg]) => [picked[Number(i)]?.key ?? i, msg])));
      this.toast.error(apiErr.title);
    } finally {
      this.saving.set(false);
    }
  }
}
