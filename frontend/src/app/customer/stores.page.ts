import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ShopStore } from '../core/shop.store';
import { ShopSummary } from '../core/models';

@Component({
  selector: 'app-stores',
  imports: [LucideAngularModule],
  template: `
    <div class="container page-enter">
      <header class="head">
        <h1 class="display">Choose your store</h1>
        <p class="muted">Each store sets its own prices and stock. Your basket is saved separately for every store.</p>
      </header>

      <div class="list">
        @for (s of store.shops(); track s.id; let i = $index) {
          <button class="store card" type="button" [class.current]="s.id === store.shop()?.id" (click)="choose(s)" [style.animation-delay.ms]="i * 60">
            <span class="logo" [style.background]="colors[i % colors.length]">
              @if (s.logoUrl) { <img [src]="s.logoUrl" alt="" /> } @else { {{ s.name[0] }} }
            </span>
            <span class="info">
              <strong>{{ s.name }}</strong>
              @if (s.tagline) { <small class="tagline">{{ s.tagline }}</small> }
              <span class="meta">
                <span><lucide-icon name="map-pin" [size]="13" /> {{ s.city }}</span>
                <span><lucide-icon name="clock" [size]="13" /> {{ s.deliveryEta }}</span>
                <span><lucide-icon name="package" [size]="13" /> {{ s.productCount }} items</span>
              </span>
            </span>
            <span class="side">
              <span class="badge" [class.green]="s.isOpen" [class.red]="!s.isOpen"><span class="dot"></span>{{ s.isOpen ? 'Open' : 'Closed' }}</span>
              @if (s.id === store.shop()?.id) { <span class="selected"><lucide-icon name="check" [size]="14" [strokeWidth]="3" /> Selected</span> }
            </span>
          </button>
        } @empty {
          @if (!store.loading()) { <p class="muted">No stores are available right now.</p> }
        }
      </div>
    </div>
  `,
  styles: `
    .head { padding: 20px 0 18px; }
    .head h1 { font-size: 30px; }
    .head p { margin-top: 6px; font-size: 14px; max-width: 520px; }
    .list { display: grid; gap: 12px; grid-template-columns: 1fr; }
    @media (min-width: 900px) { .list { grid-template-columns: 1fr 1fr; } .head h1 { font-size: 38px; } }
    .store { display: flex; align-items: center; gap: 14px; padding: 16px; text-align: left; border: 1.5px solid var(--line-2); transition: border-color .2s, transform .2s var(--ease-out), box-shadow .2s; animation: fade-up .4s var(--ease-out) backwards; }
    .store:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .store.current { border-color: var(--leaf-600); box-shadow: 0 0 0 4px rgba(46,125,62,.1); }
    .logo { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; color: var(--white); font-family: var(--font-display); font-size: 26px; font-weight: 600; flex-shrink: 0; overflow: hidden; }
    .logo img { width: 100%; height: 100%; object-fit: cover; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .info strong { font-size: 16px; color: var(--forest-900); }
    .tagline { font-size: 13px; color: var(--muted); }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; color: var(--ink-2); margin-top: 4px; }
    .meta span { display: inline-flex; align-items: center; gap: 4px; }
    .side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .selected { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--leaf-600); }
  `,
})
export class StoresPage {
  protected store = inject(ShopStore);
  private router = inject(Router);
  readonly colors = ['#2e7d3e', '#b9770e', '#2f6f9f', '#7b4bb0', '#c2412d'];

  constructor() { void this.store.init(); }

  async choose(s: ShopSummary) {
    if (s.id !== this.store.shop()?.id) await this.store.select(s.slug);
    this.router.navigate(['/']);
  }
}
