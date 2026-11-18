import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { filter, map, startWith } from 'rxjs';
import { CustomerAuth } from '../core/auth';
import { CartStore } from '../core/cart.store';
import { ShopStore } from '../core/shop.store';
import { MiniCartComponent } from './mini-cart.component';

@Component({
  selector: 'app-customer-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, MiniCartComponent],
  template: `
    <header class="topbar" [class.mobile-hidden]="minimal()">
      <div class="container bar">
        <a routerLink="/" class="brand" aria-label="Fresh n Healthy home">
          <span class="logo"><lucide-icon name="leaf" [size]="18" [strokeWidth]="2.5" /></span>
          <span class="word display">Fresh <em>n</em> Healthy</span>
        </a>

        <a routerLink="/stores" class="store-picker">
          <lucide-icon name="map-pin" [size]="16" class="pin" />
          <span class="store-text">
            <small>Delivering from</small>
            <strong>{{ shopStore.shop()?.name ?? 'Choose a store' }}</strong>
          </span>
          <lucide-icon name="chevron-down" [size]="16" />
        </a>

        <nav class="desk-nav" aria-label="Main">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Shop</a>
          <a routerLink="/orders" routerLinkActive="active">My orders</a>
          <a routerLink="/stores" routerLinkActive="active">Stores</a>
        </nav>

        <div class="actions">
          <button class="icon-btn cart-btn desk-only" type="button" (click)="openCart()" aria-label="Open cart">
            <lucide-icon name="shopping-bag" [size]="19" />
            @if (cart.count()) { <span class="count">{{ cart.count() }}</span> }
          </button>
          @if (auth.customer(); as c) {
            <a routerLink="/profile" class="avatar" [attr.aria-label]="'Profile of ' + c.name">{{ initials() }}</a>
          } @else {
            <a routerLink="/login" class="btn btn-dark btn-sm">Sign in</a>
          }
        </div>
      </div>
    </header>

    <main class="main" [class.with-tabbar]="!minimal()" [class.with-cart]="showCart()">
      <router-outlet />
    </main>

    <app-mini-cart [hidden]="hideCart()" [raised]="!minimal()" />

    @if (!minimal()) {
      <nav class="tabbar" aria-label="Bottom navigation">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><lucide-icon name="home" [size]="21" /><span>Home</span></a>
        <a routerLink="/stores" routerLinkActive="active"><lucide-icon name="store" [size]="21" /><span>Stores</span></a>
        <button type="button" (click)="openCart()" [class.has-items]="cart.count()">
          <span class="ico"><lucide-icon name="shopping-bag" [size]="21" />@if (cart.count()) { <span class="count">{{ cart.count() }}</span> }</span><span>Cart</span>
        </button>
        <a routerLink="/orders" routerLinkActive="active"><lucide-icon name="receipt-text" [size]="21" /><span>Orders</span></a>
        <a routerLink="/profile" routerLinkActive="active"><lucide-icon name="user" [size]="21" /><span>Profile</span></a>
      </nav>
    }
  `,
  styles: `
    :host { display: block; min-height: 100svh; }
    .topbar { position: sticky; top: 0; z-index: 50; background: rgba(251, 248, 241, 0.86); backdrop-filter: saturate(1.4) blur(14px); -webkit-backdrop-filter: saturate(1.4) blur(14px); border-bottom: 1px solid transparent; }
    .bar { display: flex; align-items: center; gap: 12px; height: 64px; }
    .brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .logo { width: 38px; height: 38px; border-radius: 12px; background: var(--forest-900); color: var(--lime-400); display: grid; place-items: center; }
    .word { display: none; font-size: 20px; color: var(--forest-900); }
    .word em { font-style: italic; color: var(--leaf-600); }
    .store-picker { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; padding: 6px 10px; border-radius: 14px; transition: background-color 0.2s; }
    .store-picker:hover { background: var(--cream-200); }
    .pin { color: var(--leaf-600); flex-shrink: 0; }
    .store-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
    .store-text small { font-size: 11px; color: var(--muted); font-weight: 600; }
    .store-text strong { font-size: 14.5px; color: var(--forest-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .desk-nav { display: none; gap: 4px; }
    .desk-nav a { padding: 8px 14px; border-radius: 99px; font-weight: 600; font-size: 14px; color: var(--ink-2); transition: background-color .2s; }
    .desk-nav a:hover { background: var(--cream-200); }
    .desk-nav a.active { background: var(--forest-900); color: var(--white); }
    .actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--leaf-100); color: var(--leaf-600); display: grid; place-items: center; font-weight: 800; font-size: 14px; border: 2px solid var(--white); box-shadow: var(--shadow-sm); }
    .cart-btn { position: relative; }
    .count { position: absolute; top: -4px; right: -4px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 99px; background: var(--leaf-600); color: var(--white); font-size: 11px; font-weight: 800; display: grid; place-items: center; border: 2px solid var(--cream-50); }
    .desk-only { display: none; }

    .main { padding-bottom: 24px; }
    .main.with-tabbar { padding-bottom: calc(var(--tabbar-h) + 24px + var(--safe-bottom)); }
    .main.with-cart { padding-bottom: calc(var(--tabbar-h) + 100px + var(--safe-bottom)); }

    .tabbar {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 55; height: calc(var(--tabbar-h) + var(--safe-bottom)); padding: 0 6px var(--safe-bottom);
      display: grid; grid-template-columns: repeat(5, 1fr); background: rgba(255,255,255,.94); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid var(--line-2); box-shadow: 0 -6px 24px rgba(18,48,31,.06);
    }
    .tabbar a, .tabbar button { border: 0; background: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; font-weight: 600; color: var(--muted); position: relative; transition: color .2s; }
    .tabbar a.active { color: var(--forest-900); }
    .tabbar a.active::before { content: ''; position: absolute; top: 0; width: 28px; height: 3px; border-radius: 0 0 4px 4px; background: var(--leaf-600); }
    .tabbar .ico { position: relative; display: grid; }
    .tabbar .count { top: -7px; right: -10px; border-color: var(--white); }
    .tabbar button.has-items { color: var(--leaf-600); }

    @media (max-width: 899px) { .topbar.mobile-hidden { display: none; } }
    @media (min-width: 480px) { .word { display: inline; } }
    @media (min-width: 900px) {
      .bar { height: 72px; gap: 20px; }
      .store-picker { flex: 0 1 280px; }
      .desk-nav { display: flex; margin-left: auto; }
      .desk-only { display: grid; }
      .tabbar { display: none; }
      .main.with-tabbar, .main.with-cart { padding-bottom: 110px; }
    }
  `,
})
export class CustomerShellComponent {
  protected shopStore = inject(ShopStore);
  protected cart = inject(CartStore);
  protected auth = inject(CustomerAuth);
  private router = inject(Router);

  private data = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let r = this.router.routerState.snapshot.root;
        while (r.firstChild) r = r.firstChild;
        return r.data as { chrome?: string; hideCart?: boolean };
      }),
    ),
    { initialValue: {} as { chrome?: string; hideCart?: boolean } },
  );

  readonly minimal = computed(() => this.data().chrome === 'minimal');
  readonly hideCart = computed(() => !!this.data().hideCart);
  readonly showCart = computed(() => !this.hideCart() && !this.cart.isEmpty());
  readonly initials = computed(() =>
    (this.auth.customer()?.name ?? '').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join(''),
  );

  constructor() {
    void this.shopStore.init();
    void this.auth.restore();
  }

  openCart() {
    if (this.cart.isEmpty()) this.router.navigate(['/cart']);
    else this.cart.sheetOpen.set(true);
  }
}
