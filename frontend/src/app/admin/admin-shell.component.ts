import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AdminAuth } from '../core/auth';
import { ToastService } from '../core/toast.service';
import { AdminState } from './admin-state';

interface NavItem { label: string; icon: string; link: string; exact?: boolean; badge?: () => number; }

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <div class="admin">
      <aside class="sidebar" [class.open]="drawer()">
        <div class="brand">
          <span class="logo"><lucide-icon name="leaf" [size]="18" [strokeWidth]="2.5" /></span>
          <div><strong>Fresh n Healthy</strong><small>{{ auth.isSuperAdmin() ? 'Platform console' : 'Shop console' }}</small></div>
          <button class="icon-btn close" type="button" (click)="drawer.set(false)" aria-label="Close menu"><lucide-icon name="x" [size]="18" /></button>
        </div>

        @if (admin(); as a) {
          @if (a.shopName) {
            <div class="shop">
              @if (a.shopLogoUrl) { <img [src]="a.shopLogoUrl" alt="" /> } @else { <span class="shop-ini">{{ a.shopName[0] }}</span> }
              <div>
                <strong>{{ a.shopName }}</strong>
                @if (state.storeOpen() !== null) {
                  <small [class.closed]="!state.storeOpen()"><span class="dot"></span>{{ state.storeOpen() ? 'Open for orders' : 'Store closed' }}</small>
                }
              </div>
            </div>
          }
        }

        <nav class="nav">
          @for (n of nav(); track n.link) {
            <a [routerLink]="n.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!n.exact }" (click)="drawer.set(false)">
              <lucide-icon [name]="n.icon" [size]="19" />
              <span>{{ n.label }}</span>
              @if (n.badge && n.badge() > 0) { <span class="count">{{ n.badge() }}</span> }
            </a>
          }
        </nav>

        <div class="side-foot">
          @if (admin()?.shopSlug; as slug) {
            <a class="store-link" [href]="'/?shop=' + slug" target="_blank" rel="noopener"><lucide-icon name="store" [size]="17" /> View storefront</a>
          }
          <div class="me">
            <span class="avatar">{{ initials() }}</span>
            <div><strong>{{ admin()?.fullName }}</strong><small>&#64;{{ admin()?.username }}</small></div>
            <button class="icon-btn" type="button" (click)="logout()" aria-label="Sign out" title="Sign out"><lucide-icon name="log-out" [size]="18" /></button>
          </div>
        </div>
      </aside>
      @if (drawer()) { <div class="scrim" (click)="drawer.set(false)"></div> }

      <div class="content">
        <header class="mobile-top">
          <button class="icon-btn" type="button" (click)="drawer.set(true)" aria-label="Open menu"><lucide-icon name="menu" [size]="20" /></button>
          <strong>{{ admin()?.shopName ?? 'Platform' }}</strong>
          @if (!auth.isSuperAdmin()) {
            <a class="icon-btn bell" routerLink="/admin/orders" [queryParams]="{ status: 'Pending' }" aria-label="Pending orders">
              <lucide-icon name="shopping-bag" [size]="19" />
              @if (state.pendingOrders() > 0) { <span class="count">{{ state.pendingOrders() }}</span> }
            </a>
          } @else { <span></span> }
        </header>
        <main class="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; background: var(--cream-100); min-height: 100svh; }
    .admin { display: flex; min-height: 100svh; }
    .sidebar { position: fixed; inset: 0 auto 0 0; width: 268px; z-index: 60; background: var(--forest-950); color: rgba(255,255,255,.86); display: flex; flex-direction: column; padding: 18px 14px; transform: translateX(-100%); transition: transform .3s var(--ease-out); }
    .sidebar.open { transform: none; box-shadow: var(--shadow-lg); }
    .scrim { position: fixed; inset: 0; background: rgba(12,33,22,.45); z-index: 55; animation: fade-in .2s both; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 4px 6px 18px; }
    .brand div { flex: 1; display: flex; flex-direction: column; line-height: 1.2; }
    .brand strong { color: var(--white); font-family: var(--font-display); font-size: 17px; }
    .brand small { font-size: 11.5px; opacity: .6; }
    .logo { width: 36px; height: 36px; border-radius: 11px; background: var(--lime-400); color: var(--forest-950); display: grid; place-items: center; }
    .close { background: rgba(255,255,255,.08); color: var(--white); border: 0; }
    .shop { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 16px; background: rgba(255,255,255,.06); margin-bottom: 14px; }
    .shop img, .shop-ini { width: 38px; height: 38px; border-radius: 11px; object-fit: cover; background: var(--forest-700); display: grid; place-items: center; color: var(--lime-300); font-weight: 800; }
    .shop div { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
    .shop strong { color: var(--white); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .shop small { font-size: 11.5px; color: var(--lime-300); display: flex; align-items: center; gap: 5px; }
    .shop small.closed { color: #f3a48f; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
    .nav a { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 12px; font-weight: 600; font-size: 14.5px; color: rgba(255,255,255,.72); transition: background-color .15s, color .15s; }
    .nav a:hover { background: rgba(255,255,255,.06); color: var(--white); }
    .nav a.active { background: var(--lime-400); color: var(--forest-950); }
    .nav a span:first-of-type { flex: 1; }
    .count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px; background: #e8603f; color: var(--white); font-size: 11px; font-weight: 800; display: grid; place-items: center; }
    .side-foot { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.08); }
    .store-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; font-weight: 600; font-size: 14px; color: var(--lime-300); }
    .store-link:hover { background: rgba(255,255,255,.06); }
    .me { display: flex; align-items: center; gap: 10px; padding: 6px; }
    .me div { flex: 1; display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
    .me strong { color: var(--white); font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .me small { font-size: 12px; opacity: .6; }
    .me .icon-btn { background: rgba(255,255,255,.08); color: var(--white); border: 0; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--forest-700); color: var(--lime-300); display: grid; place-items: center; font-weight: 800; font-size: 13px; }
    .content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .mobile-top { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; background: rgba(246,241,230,.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
    .mobile-top strong { font-size: 15px; }
    .bell { position: relative; }
    .bell .count { position: absolute; top: -4px; right: -4px; }
    .main { padding: 18px 14px 40px; max-width: 1320px; width: 100%; margin: 0 auto; }
    @media (min-width: 1024px) {
      .sidebar { transform: none; }
      .close, .scrim { display: none; }
      .content { margin-left: 268px; }
      .mobile-top { display: none; }
      .main { padding: 28px 32px 48px; }
    }
  `,
})
export class AdminShellComponent implements OnDestroy {
  protected auth = inject(AdminAuth);
  protected state = inject(AdminState);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected admin = this.auth.admin;
  readonly drawer = signal(false);

  readonly nav = computed<NavItem[]>(() =>
    this.auth.isSuperAdmin()
      ? [{ label: 'Shops', icon: 'building-2', link: '/admin/platform', exact: true }]
      : [
          { label: 'Dashboard', icon: 'layout-dashboard', link: '/admin', exact: true },
          { label: 'Orders', icon: 'shopping-bag', link: '/admin/orders', badge: () => this.state.pendingOrders() },
          { label: 'Products', icon: 'package', link: '/admin/products' },
          { label: 'Inventory', icon: 'boxes', link: '/admin/inventory' },
          { label: 'Customers', icon: 'users', link: '/admin/customers' },
          { label: 'Settings', icon: 'settings', link: '/admin/settings' },
        ],
  );
  readonly initials = computed(() => (this.admin()?.fullName ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(''));

  constructor() {
    if (!this.auth.isSuperAdmin()) void this.state.start();
  }

  async logout() {
    await this.state.stop();
    await this.auth.logout();
    this.toast.success('Signed out');
    this.router.navigateByUrl('/admin/login');
  }

  ngOnDestroy() { void this.state.stop(); }
}
