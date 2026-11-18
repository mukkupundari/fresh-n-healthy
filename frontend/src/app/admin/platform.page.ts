import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, toApiError } from '../core/api';
import { PlatformOverview, PlatformShop } from '../core/models';
import { ToastService } from '../core/toast.service';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { InrPipe } from '../shared/pipes';
import { EmptyStateComponent } from '../shared/ui.components';

@Component({
  selector: 'app-platform',
  imports: [DatePipe, FormsModule, LucideAngularModule, InrPipe, EmptyStateComponent, BottomSheetComponent],
  template: `
    <header class="page-header">
      <div>
        <h1 class="display">Shops on the platform</h1>
        <p>Every registered vegetable shop, its owner details and performance.</p>
      </div>
    </header>

    @if (overview(); as o) {
      <section class="stats">
        <div class="card stat dark"><small>Shops</small><strong class="display tabular">{{ o.shops }}</strong><span>{{ o.activeShops }} active</span></div>
        <div class="card stat"><small>Customers</small><strong class="display tabular">{{ o.customers }}</strong><span>across all shops</span></div>
        <div class="card stat"><small>Orders</small><strong class="display tabular">{{ o.orders }}</strong><span>all time</span></div>
        <div class="card stat"><small>Gross sales</small><strong class="display tabular">{{ o.sales | inr }}</strong><span>excluding cancelled</span></div>
      </section>
    }

    <div class="toolbar">
      <label class="search-box">
        <lucide-icon name="search" [size]="17" />
        <input class="input" type="search" placeholder="Search shop, owner, city or licence" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </label>
    </div>

    @if (loading()) {
      <div class="card">@for (i of [1, 2, 3]; track i) { <div class="skeleton sk"></div> }</div>
    } @else if (!visible().length) {
      <div class="card"><app-empty-state icon="building-2" title="No shops found" message="Shops appear here once they register." /></div>
    } @else {
      <div class="shops">
        @for (s of visible(); track s.id) {
          <article class="card shop" [class.suspended]="!s.isActive">
            <div class="s-head">
              <span class="ini">{{ s.name[0] }}</span>
              <div class="s-title">
                <strong>{{ s.name }}</strong>
                <small class="muted">{{ s.city }} · joined {{ s.createdAt | date: 'd MMM y' }}</small>
              </div>
              @if (s.isActive) { <span class="badge green"><span class="dot"></span> Active</span> } @else { <span class="badge red">Suspended</span> }
            </div>
            <dl class="facts">
              <div><dt>Owner</dt><dd>{{ s.ownerName }}</dd></div>
              <div><dt>Licence</dt><dd class="tabular">{{ s.licenseNumber ?? '—' }}</dd></div>
              <div><dt>Phone</dt><dd><a class="link tabular" [href]="'tel:+91' + s.phone">+91 {{ s.phone }}</a></dd></div>
              <div><dt>Email</dt><dd><a class="link" [href]="'mailto:' + s.email">{{ s.email }}</a></dd></div>
            </dl>
            <div class="nums">
              <div><strong class="tabular">{{ s.products }}</strong><small>Products</small></div>
              <div><strong class="tabular">{{ s.orders }}</strong><small>Orders</small></div>
              <div><strong class="tabular">{{ s.sales | inr }}</strong><small>Sales</small></div>
              <div><strong [class.closed]="!s.isOpen">{{ s.isOpen ? 'Open' : 'Closed' }}</strong><small>Store</small></div>
            </div>
            <div class="s-actions">
              <a class="btn btn-sm btn-ghost" [href]="'/?shop=' + s.slug" target="_blank" rel="noopener"><lucide-icon name="store" [size]="14" /> Storefront</a>
              @if (s.isActive) {
                <button class="btn btn-sm btn-outline danger" type="button" (click)="confirm.set(s)"><lucide-icon name="ban" [size]="14" /> Suspend</button>
              } @else {
                <button class="btn btn-sm btn-primary" type="button" [disabled]="busyId() === s.id" (click)="setActive(s, true)"><lucide-icon name="power" [size]="14" /> Reactivate</button>
              }
            </div>
          </article>
        }
      </div>
    }

    <app-bottom-sheet [open]="!!confirm()" title="Suspend this shop?" [subtitle]="confirm()?.name ?? null" (close)="confirm.set(null)">
      <p class="copy">The shop disappears from the storefront, its admins are signed out immediately, and they cannot sign in until you reactivate it. Orders and data are kept.</p>
      <div sheet-footer class="sheet-actions">
        <button class="btn btn-outline" type="button" (click)="confirm.set(null)">Cancel</button>
        <button class="btn btn-danger" type="button" [disabled]="!!busyId()" (click)="setActive(confirm()!, false)">@if (busyId()) { <span class="spinner"></span> } Suspend shop</button>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; }
    .stat { padding: 16px 18px; display: flex; flex-direction: column; gap: 2px; }
    .stat small { font-size: 12.5px; font-weight: 600; color: var(--muted); }
    .stat strong { font-size: 28px; }
    .stat span { font-size: 12px; color: var(--muted); }
    .stat.dark { background: var(--forest-950); border: 0; color: var(--white); }
    .stat.dark small, .stat.dark span { color: rgba(255,255,255,.7); }
    .sk { height: 120px; margin: 12px 16px; }
    .shops { display: grid; gap: 14px; }
    .shop { padding: 18px; display: flex; flex-direction: column; gap: 16px; }
    .shop.suspended { background: var(--cream-50); }
    .shop.suspended .s-head, .shop.suspended .facts, .shop.suspended .nums { opacity: .65; }
    .s-head { display: flex; align-items: center; gap: 12px; }
    .ini { width: 46px; height: 46px; border-radius: 14px; background: var(--forest-900); color: var(--lime-300); display: grid; place-items: center; font-weight: 800; font-size: 19px; text-transform: uppercase; flex-shrink: 0; }
    .s-title { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
    .s-title strong { font-size: 16px; }
    .s-title small { font-size: 12.5px; }
    .facts { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; font-size: 13.5px; }
    .facts dt { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .facts dd { margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .link { color: var(--leaf-600); font-weight: 600; }
    .nums { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; border-radius: 14px; background: var(--cream-50); }
    .nums div { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .nums strong { font-size: 15px; }
    .nums strong.closed { color: var(--danger); }
    .nums small { font-size: 11.5px; color: var(--muted); }
    .s-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .danger { color: var(--danger); border-color: #f2cfc6; }
    .copy { font-size: 14px; color: var(--ink-2); padding-bottom: 10px; }
    .sheet-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (min-width: 900px) { .stats { grid-template-columns: repeat(4, 1fr); } .shops { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1400px) { .shops { grid-template-columns: repeat(3, 1fr); } }
  `,
})
export class PlatformPage {
  private api = inject(AdminApi);
  private toast = inject(ToastService);
  readonly overview = signal<PlatformOverview | null>(null);
  readonly shops = signal<PlatformShop[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly busyId = signal<number | null>(null);
  readonly confirm = signal<PlatformShop | null>(null);

  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.shops().filter((s) => !q || [s.name, s.ownerName, s.city, s.licenseNumber ?? '', s.email].some((v) => v.toLowerCase().includes(q)));
  });

  constructor() { void this.load(); }

  async load() {
    this.loading.set(true);
    try {
      const [overview, shops] = await Promise.all([firstValueFrom(this.api.platformOverview()), firstValueFrom(this.api.platformShops())]);
      this.overview.set(overview);
      this.shops.set(shops);
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }

  async setActive(shop: PlatformShop, value: boolean) {
    this.busyId.set(shop.id);
    try {
      await firstValueFrom(this.api.setShopActive(shop.id, value));
      this.shops.update((list) => list.map((s) => (s.id === shop.id ? { ...s, isActive: value } : s)));
      this.toast.success(value ? `${shop.name} reactivated` : `${shop.name} suspended`);
      this.confirm.set(null);
      this.api.platformOverview().subscribe((o) => this.overview.set(o));
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.busyId.set(null);
    }
  }
}
