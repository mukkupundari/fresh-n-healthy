import { Location } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, CatalogApi, fieldErrors, toApiError } from '../core/api';
import { Category, Product, ProductUnit, SaveProductRequest } from '../core/models';
import { ToastService } from '../core/toast.service';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { QtyPipe } from '../shared/pipes';
import { ProductCardComponent } from '../shared/product-card.component';
import { StockSheetComponent } from './stock-sheet.component';
import { CategorySlug, VEGETABLE_CATALOG, VegetableTemplate, catalogPhoto, matchTemplate } from './vegetable-catalog';

const UNIT_DEFAULTS: Record<ProductUnit, { min: number; step: number; low: number }> = {
  Kg: { min: 0.25, step: 0.25, low: 5 },
  Piece: { min: 1, step: 1, low: 5 },
  Bunch: { min: 1, step: 1, low: 5 },
  Pack: { min: 1, step: 1, low: 5 },
};

@Component({
  selector: 'app-product-form',
  imports: [FormsModule, RouterLink, LucideAngularModule, QtyPipe, ProductCardComponent, BottomSheetComponent, StockSheetComponent],
  template: `
    <header class="page-header">
      <div>
        <a routerLink="/admin/products" class="crumb"><lucide-icon name="arrow-left" [size]="15" /> Products</a>
        <h1 class="display">{{ isEdit() ? 'Edit ' + (original()?.name ?? 'product') : 'Add a vegetable' }}</h1>
        <p>{{ isEdit() ? 'Changes go live for customers as soon as you save.' : 'Fill in the details customers see. You can change them any time.' }}</p>
      </div>
    </header>

    @if (loading()) {
      <div class="skeleton" style="height: 420px; border-radius: 20px"></div>
    } @else {
      <form class="layout" (ngSubmit)="save()" novalidate>
        <div class="main-col">
          <section class="card card-pad sec">
            <h2>Photo</h2>
            <div class="photo-row">
              <div class="photo" [class.empty]="!f.imageUrl" [class.invalid]="err('imageUrl')">
                @if (f.imageUrl) { <img [src]="f.imageUrl" alt="Product photo" /> } @else { <lucide-icon name="image-plus" [size]="30" /><span>No photo yet</span> }
                @if (uploading()) { <div class="uploading"><span class="spinner"></span></div> }
              </div>
              <div class="photo-actions">
                <label class="btn btn-dark">
                  <lucide-icon name="upload" [size]="16" /> Upload photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="upload($event)" />
                </label>
                <button type="button" class="btn btn-outline" (click)="libraryOpen.set(true)"><lucide-icon name="sparkles" [size]="16" /> Choose from library</button>
                <p class="hint">JPG, PNG or WebP up to 5 MB. A square, well-lit photo on a plain background works best.</p>
                @if (autoPicked()) { <p class="auto"><lucide-icon name="sparkles" [size]="14" /> We matched a photo for "{{ f.name }}". Upload your own any time.</p> }
                @if (err('imageUrl')) { <span class="error-text">{{ err('imageUrl') }}</span> }
              </div>
            </div>
          </section>

          <section class="card card-pad sec">
            <h2>Details</h2>
            <div class="form-grid">
              <div class="field">
                <label class="label" for="pname">Vegetable name</label>
                <input id="pname" class="input" name="name" maxlength="100" placeholder="e.g. Tomato (Desi)" [class.invalid]="err('name')" [ngModel]="f.name" (ngModelChange)="onName($event)" />
                @if (err('name')) { <span class="error-text">{{ err('name') }}</span> }
              </div>
              <div class="field">
                <label class="label" for="pcat">Category</label>
                <select id="pcat" class="select" name="categoryId" [class.invalid]="err('categoryId')" [(ngModel)]="f.categoryId" (ngModelChange)="touch()">
                  <option [ngValue]="0" disabled>Choose a category</option>
                  @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                </select>
                @if (err('categoryId')) { <span class="error-text">{{ err('categoryId') }}</span> }
              </div>
              <div class="field span-2">
                <label class="label" for="pdesc">Description <span class="muted">(optional)</span></label>
                <textarea id="pdesc" class="textarea" name="description" maxlength="1000" rows="3" placeholder="Where it's from, taste, best usesâ€¦" [(ngModel)]="f.description" (ngModelChange)="touch()"></textarea>
              </div>
            </div>
          </section>

          <section class="card card-pad sec">
            <h2>Price &amp; quantity</h2>
            <div class="field">
              <span class="label">Sold by</span>
              <div class="segmented units">
                @for (u of units; track u.value) {
                  <button type="button" [class.active]="f.unit === u.value" (click)="setUnit(u.value)">{{ u.label }}</button>
                }
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label class="label" for="pprice">Price per {{ unitWord() }}</label>
                <div class="input-group">
                  <span class="prefix">â‚¹</span>
                  <input id="pprice" class="input has-prefix big tabular" name="price" type="number" inputmode="decimal" min="0" step="0.5" [class.invalid]="err('price')" [(ngModel)]="f.price" (ngModelChange)="touch()" />
                  <span class="suffix per">/ {{ unitShort() }}</span>
                </div>
                @if (err('price')) { <span class="error-text">{{ err('price') }}</span> }
              </div>
              <div class="field">
                @if (isEdit()) {
                  <span class="label">Stock available</span>
                  <div class="stock-now">
                    <strong class="tabular">{{ original()!.stockQuantity | qty: f.unit }}</strong>
                    <button type="button" class="btn btn-sm btn-outline" (click)="stockOpen.set(true)"><lucide-icon name="boxes" [size]="14" /> Update stock</button>
                  </div>
                  <span class="hint">Stock changes are logged in Inventory.</span>
                } @else {
                  <label class="label" for="pstock">Opening stock</label>
                  <div class="input-group">
                    <input id="pstock" class="input big tabular" name="stock" type="number" inputmode="decimal" min="0" [step]="f.unit === 'Kg' ? 0.5 : 1" [class.invalid]="err('stockQuantity')" [(ngModel)]="f.stock" (ngModelChange)="touch()" />
                    <span class="suffix per">{{ unitShort() }}</span>
                  </div>
                  @if (err('stockQuantity')) { <span class="error-text">{{ err('stockQuantity') }}</span> } @else { <span class="hint">How much you have to sell right now.</span> }
                }
              </div>
            </div>

            <details class="rules" [open]="rulesOpen()">
              <summary (click)="$event.preventDefault(); rulesOpen.set(!rulesOpen())">
                <lucide-icon name="settings" [size]="16" /> Ordering rules
                <span class="muted">Min {{ f.min | qty: f.unit }} Â· steps of {{ f.step | qty: f.unit }} Â· alert below {{ f.low | qty: f.unit }}</span>
                <lucide-icon [name]="rulesOpen() ? 'chevron-down' : 'chevron-right'" [size]="16" />
              </summary>
              <div class="rules-grid">
                <div class="field">
                  <label class="label" for="pmin">Minimum order</label>
                  <input id="pmin" class="input tabular" name="min" type="number" min="0" [step]="f.unit === 'Kg' ? 0.05 : 1" [class.invalid]="err('minOrderQuantity')" [(ngModel)]="f.min" (ngModelChange)="touch()" />
                  @if (err('minOrderQuantity')) { <span class="error-text">{{ err('minOrderQuantity') }}</span> }
                </div>
                <div class="field">
                  <label class="label" for="pstep">Quantity step</label>
                  <input id="pstep" class="input tabular" name="step" type="number" min="0" [step]="f.unit === 'Kg' ? 0.05 : 1" [class.invalid]="err('stepQuantity')" [(ngModel)]="f.step" (ngModelChange)="touch()" />
                  @if (err('stepQuantity')) { <span class="error-text">{{ err('stepQuantity') }}</span> }
                </div>
                <div class="field">
                  <label class="label" for="plow">Low-stock alert at</label>
                  <input id="plow" class="input tabular" name="low" type="number" min="0" [class.invalid]="err('lowStockThreshold')" [(ngModel)]="f.low" (ngModelChange)="touch()" />
                </div>
              </div>
              <p class="hint">Customers see "Only X left" once stock drops to the alert level, and can only order in these steps.</p>
            </details>
          </section>

          <section class="card card-pad sec toggles">
            <label class="switch row">
              <input type="checkbox" name="isActive" [(ngModel)]="f.isActive" (ngModelChange)="touch()" />
              <span class="track"></span>
              <span class="t-text"><strong>Visible to customers</strong><small class="muted">Turn off to hide this item without deleting it.</small></span>
            </label>
            <label class="switch row">
              <input type="checkbox" name="isFeatured" [(ngModel)]="f.isFeatured" (ngModelChange)="touch()" />
              <span class="track"></span>
              <span class="t-text"><strong>Featured "Fresh pick"</strong><small class="muted">Shown first with a highlight badge.</small></span>
            </label>
          </section>
        </div>

        <aside class="side-col">
          <div class="preview card card-pad">
            <h2>Customer preview</h2>
            <p class="muted">This is how the item appears in your store.</p>
            <div class="pv"><app-product-card [product]="preview()" [preview]="true" /></div>
          </div>
        </aside>

        <div class="savebar">
          <div class="savebar-inner">
            <span class="muted dirty">{{ dirty() ? 'Unsaved changes' : (isEdit() ? 'All changes saved' : '') }}</span>
            <button type="button" class="btn btn-outline" (click)="location.back()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving() || uploading()">
              @if (saving()) { <span class="spinner"></span> } {{ isEdit() ? 'Save changes' : 'Add product' }}
            </button>
          </div>
        </div>
      </form>
    }

    <app-bottom-sheet [open]="libraryOpen()" title="Photo library" subtitle="Real photos of common vegetables" [wide]="true" (close)="libraryOpen.set(false)">
      <div class="library">
        @for (ph of library; track ph.key) {
          <button type="button" class="lib-item" [class.selected]="f.imageUrl === url(ph.key)" (click)="pick(ph)">
            <img [src]="url(ph.key)" [alt]="ph.name" loading="lazy" />
            <span>{{ ph.name }}</span>
          </button>
        }
      </div>
    </app-bottom-sheet>

    <app-stock-sheet [product]="stockOpen() ? original() : null" (close)="stockOpen.set(false)" (saved)="original.set($event)" />
  `,
  styles: `
    .crumb { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--leaf-600); margin-bottom: 6px; }
    .layout { display: grid; gap: 16px; padding-bottom: 90px; }
    .main-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .sec { display: flex; flex-direction: column; gap: 16px; }
    h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; }
    .photo-row { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
    .photo { position: relative; width: 150px; aspect-ratio: 1; border-radius: 20px; overflow: hidden; background: var(--cream-100); border: 1.5px dashed var(--line); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--muted); font-size: 12.5px; flex-shrink: 0; }
    .photo:not(.empty) { border-style: solid; border-color: var(--line-2); }
    .photo.invalid { border-color: var(--danger); }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .uploading { position: absolute; inset: 0; background: rgba(255,255,255,.7); display: grid; place-items: center; color: var(--forest-900); }
    .photo-actions { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
    .auto { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--leaf-600); font-weight: 600; }
    .units { display: flex; width: 100%; max-width: 440px; } .units button { flex: 1; justify-content: center; }
    .big { font-size: 18px; font-weight: 700; height: 52px; }
    .per { color: var(--muted); font-weight: 600; padding-right: 8px; font-size: 14px; }
    .input-group .input.big:not(.has-prefix) { padding-right: 56px; }
    .input-group .input.has-prefix.big { padding-right: 60px; padding-left: 36px; }
    .input-group .prefix { left: 16px; }
    .stock-now { display: flex; align-items: center; justify-content: space-between; gap: 10px; height: 52px; padding: 0 8px 0 14px; border-radius: var(--r-md); background: var(--cream-50); border: 1.5px solid var(--line); }
    .stock-now strong { font-size: 18px; }
    .rules { border-radius: 16px; background: var(--cream-50); border: 1px solid var(--line-2); }
    .rules summary { list-style: none; display: flex; align-items: center; gap: 10px; padding: 14px; cursor: pointer; font-weight: 700; font-size: 14px; flex-wrap: wrap; }
    .rules summary::-webkit-details-marker { display: none; }
    .rules summary .muted { flex: 1; font-weight: 500; font-size: 12.5px; }
    .rules-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 0 14px; }
    .rules > .hint { padding: 10px 14px 14px; }
    .toggles { gap: 18px; }
    .switch.row { align-items: flex-start; }
    .t-text { display: flex; flex-direction: column; line-height: 1.35; font-size: 14px; }
    .t-text small { font-size: 12.5px; }
    .preview h2 { margin-bottom: 2px; }
    .preview p { font-size: 13px; margin-bottom: 14px; }
    .pv { max-width: 240px; margin: 0 auto; }
    .savebar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: rgba(255,255,255,.94); backdrop-filter: blur(10px); border-top: 1px solid var(--line); padding: 12px 14px calc(12px + var(--safe-bottom)); }
    .savebar-inner { max-width: 1260px; margin: 0 auto; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
    .dirty { flex: 1; font-size: 13px; }
    .library { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding-bottom: 16px; }
    .lib-item { border: 2px solid transparent; background: var(--white); border-radius: 16px; padding: 6px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); transition: border-color .15s, transform .15s; }
    .lib-item:hover { transform: translateY(-2px); }
    .lib-item.selected { border-color: var(--leaf-600); }
    .lib-item img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 11px; }
    @media (max-width: 560px) { .rules-grid { grid-template-columns: 1fr 1fr; } .photo { width: 120px; } }
    @media (min-width: 640px) { .library { grid-template-columns: repeat(4, 1fr); } }
    @media (min-width: 1024px) {
      .layout { grid-template-columns: minmax(0, 1fr) 300px; align-items: start; }
      .side-col { position: sticky; top: 24px; }
      .savebar { left: 268px; }
      .savebar-inner { padding: 0 18px; }
    }
  `,
})
export class ProductFormPage {
  readonly id = input<string>();
  protected location = inject(Location);
  private api = inject(AdminApi);
  private catalog = inject(CatalogApi);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly library = VEGETABLE_CATALOG;
  readonly units: { value: ProductUnit; label: string }[] = [
    { value: 'Kg', label: 'Kilogram' }, { value: 'Piece', label: 'Piece' }, { value: 'Bunch', label: 'Bunch' }, { value: 'Pack', label: 'Pack' },
  ];

  readonly categories = signal<Category[]>([]);
  readonly original = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly libraryOpen = signal(false);
  readonly stockOpen = signal(false);
  readonly rulesOpen = signal(false);
  readonly autoPicked = signal(false);
  readonly dirty = signal(false);
  private version = signal(0);
  private imageChosenByUser = false;

  f = { name: '', description: '', categoryId: 0, imageUrl: '', unit: 'Kg' as ProductUnit, price: null as number | null, stock: null as number | null, min: 0.25, step: 0.25, low: 5, isActive: true, isFeatured: false };

  readonly isEdit = computed(() => !!this.id() && this.id() !== 'new');
  readonly unitWord = computed(() => { this.version(); return { Kg: 'kg', Piece: 'piece', Bunch: 'bunch', Pack: 'pack' }[this.f.unit]; });
  readonly unitShort = computed(() => { this.version(); return { Kg: 'kg', Piece: 'pc', Bunch: 'bunch', Pack: 'pack' }[this.f.unit]; });
  readonly preview = computed<Product>(() => {
    this.version();
    const o = this.original();
    const cat = this.categories().find((c) => c.id === this.f.categoryId);
    return {
      id: o?.id ?? 0, shopId: o?.shopId ?? 0, categoryId: this.f.categoryId, categoryName: cat?.name ?? '', categorySlug: cat?.slug ?? '',
      name: this.f.name || 'Vegetable name', description: this.f.description || null,
      imageUrl: this.f.imageUrl || '/images/catalog/tomato.jpg', unit: this.f.unit, price: Number(this.f.price) || 0,
      stockQuantity: o ? o.stockQuantity : Number(this.f.stock) || 0, minOrderQuantity: Number(this.f.min) || 0, stepQuantity: Number(this.f.step) || 0,
      lowStockThreshold: Number(this.f.low) || 0, isActive: this.f.isActive, isFeatured: this.f.isFeatured, sortOrder: 0, updatedAt: '',
    };
  });

  constructor() {
    queueMicrotask(() => void this.load());
  }

  url(key: string) { return catalogPhoto(key); }
  err(key: string) { return this.errors()[key]; }

  touch() {
    this.dirty.set(true);
    this.version.update((v) => v + 1);
  }

  private async load() {
    try {
      const cats = await firstValueFrom(this.catalog.categories());
      this.categories.set(cats);
      if (this.isEdit()) {
        const p = await firstValueFrom(this.api.product(Number(this.id())));
        this.original.set(p);
        this.f = { name: p.name, description: p.description ?? '', categoryId: p.categoryId, imageUrl: p.imageUrl, unit: p.unit, price: p.price, stock: null,
          min: p.minOrderQuantity, step: p.stepQuantity, low: p.lowStockThreshold, isActive: p.isActive, isFeatured: p.isFeatured };
        this.imageChosenByUser = true;
      }
      this.version.update((v) => v + 1);
    } catch (e) {
      this.toast.error(toApiError(e).title);
      this.router.navigateByUrl('/admin/products');
    } finally {
      this.loading.set(false);
    }
  }

  onName(name: string) {
    this.f.name = name;
    this.touch();
    if (this.imageChosenByUser) return;
    const match = matchTemplate(name);
    if (match) {
      this.f.imageUrl = catalogPhoto(match.key);
      this.autoPicked.set(true);
      if (!this.f.categoryId) this.f.categoryId = this.categoryId(match.category);
    } else if (this.autoPicked()) {
      this.f.imageUrl = '';
      this.autoPicked.set(false);
    }
  }

  private categoryId(slug: CategorySlug): number {
    return this.categories().find((c) => c.slug === slug)?.id ?? 0;
  }

  pick(ph: VegetableTemplate) {
    this.f.imageUrl = catalogPhoto(ph.key);
    this.imageChosenByUser = true;
    this.autoPicked.set(false);
    if (!this.f.name.trim()) this.f.name = ph.name;
    if (!this.f.categoryId) this.f.categoryId = this.categoryId(ph.category);
    this.libraryOpen.set(false);
    this.touch();
  }

  async upload(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { this.toast.error('Photo must be 5 MB or smaller.'); return; }
    this.uploading.set(true);
    try {
      const res = await firstValueFrom(this.api.upload(file, 'products'));
      this.f.imageUrl = res.url;
      this.imageChosenByUser = true;
      this.autoPicked.set(false);
      this.touch();
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.uploading.set(false);
    }
  }

  setUnit(unit: ProductUnit) {
    if (this.f.unit === unit) return;
    const d = UNIT_DEFAULTS[unit];
    this.f.unit = unit;
    this.f.min = d.min;
    this.f.step = d.step;
    this.f.low = d.low;
    if (unit !== 'Kg' && this.f.stock !== null) this.f.stock = Math.floor(this.f.stock);
    this.touch();
  }

  private validate(): Record<string, string> {
    const f = this.f;
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e['name'] = 'Enter the vegetable name.';
    if (!f.categoryId) e['categoryId'] = 'Choose a category.';
    if (!f.imageUrl) e['imageUrl'] = 'Add a photo â€” upload one or pick from the library.';
    if (!(Number(f.price) > 0)) e['price'] = 'Enter a price greater than â‚¹0.';
    if (!this.isEdit() && (f.stock === null || Number(f.stock) < 0)) e['stockQuantity'] = 'Enter the stock you have (0 if none yet).';
    if (!(Number(f.step) > 0)) e['stepQuantity'] = 'Step must be greater than 0.';
    if (!(Number(f.min) > 0)) e['minOrderQuantity'] = 'Minimum must be greater than 0.';
    else if (Number(f.min) < Number(f.step)) e['minOrderQuantity'] = 'Minimum cannot be smaller than the step.';
    if (f.unit !== 'Kg' && (!Number.isInteger(Number(f.min)) || !Number.isInteger(Number(f.step)))) e['stepQuantity'] = 'Use whole numbers for pieces, bunches and packs.';
    if (Number(f.low) < 0) e['lowStockThreshold'] = 'Cannot be negative.';
    return e;
  }

  async save() {
    const e = this.validate();
    this.errors.set(e);
    if (Object.keys(e).length) {
      if (e['minOrderQuantity'] || e['stepQuantity'] || e['lowStockThreshold']) this.rulesOpen.set(true);
      this.toast.error(Object.values(e)[0]);
      return;
    }
    const f = this.f;
    const body: SaveProductRequest = {
      name: f.name.trim(), description: f.description.trim() || null, categoryId: f.categoryId, imageUrl: f.imageUrl, unit: f.unit,
      price: Number(f.price), stockQuantity: this.isEdit() ? null : Number(f.stock), minOrderQuantity: Number(f.min), stepQuantity: Number(f.step),
      lowStockThreshold: Number(f.low), isActive: f.isActive, isFeatured: f.isFeatured,
    };
    this.saving.set(true);
    try {
      const saved = this.isEdit()
        ? await firstValueFrom(this.api.updateProduct(this.original()!.id, body))
        : await firstValueFrom(this.api.createProduct(body));
      this.dirty.set(false);
      this.toast.success(this.isEdit() ? `${saved.name} updated` : `${saved.name} added to your store`);
      this.router.navigateByUrl('/admin/products');
    } catch (err) {
      const apiErr = toApiError(err);
      this.errors.set(fieldErrors(apiErr));
      this.toast.error(apiErr.title);
    } finally {
      this.saving.set(false);
    }
  }
}
