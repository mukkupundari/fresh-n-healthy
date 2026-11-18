import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CustomerApi, toApiError } from '../core/api';
import { OrderSummary } from '../core/models';
import { InrPipe } from '../shared/pipes';
import { EmptyStateComponent, StatusBadgeComponent } from '../shared/ui.components';

@Component({
  selector: 'app-orders',
  imports: [DatePipe, RouterLink, LucideAngularModule, InrPipe, StatusBadgeComponent, EmptyStateComponent],
  template: `
    <div class="container narrow page-enter">
      <header class="head">
        <h1 class="display">My orders</h1>
        <div class="segmented">
          <button type="button" [class.active]="tab() === 'active'" (click)="tab.set('active')">Active</button>
          <button type="button" [class.active]="tab() === 'past'" (click)="tab.set('past')">Past</button>
        </div>
      </header>

      @if (loading()) {
        @for (i of [1, 2, 3]; track i) { <div class="skeleton sk"></div> }
      } @else if (error()) {
        <app-empty-state icon="circle-alert" title="Couldn't load orders" [message]="error()">
          <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
        </app-empty-state>
      } @else if (!visible().length) {
        <app-empty-state icon="receipt-text" [title]="tab() === 'active' ? 'No active orders' : 'No past orders yet'"
          message="Fresh vegetables are just a few taps away.">
          <a class="btn btn-primary" routerLink="/">Start shopping</a>
        </app-empty-state>
      } @else {
        <ul class="list">
          @for (o of visible(); track o.id) {
            <li>
              <a class="card order" [routerLink]="['/orders', o.orderNumber]">
                <div class="top">
                  <div class="who"><strong>{{ o.shopName }}</strong><small class="muted tabular">{{ o.orderNumber }} · {{ o.createdAt | date: 'd MMM, h:mm a' }}</small></div>
                  <app-status-badge [status]="o.status" />
                </div>
                <div class="bottom">
                  <span class="thumbs">
                    @for (t of o.thumbnails.slice(0, 4); track $index) { <img [src]="t" alt="" /> }
                    @if (o.itemCount > 4) { <span class="more">+{{ o.itemCount - 4 }}</span> }
                  </span>
                  <span class="sum"><small class="muted">{{ o.itemCount }} items · {{ o.paymentMethod === 'Upi' ? 'UPI' : 'COD' }}</small><strong class="tabular">{{ o.total | inr }}</strong></span>
                  <lucide-icon name="chevron-right" [size]="18" class="chev" />
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 720px; padding-top: 16px; padding-bottom: 32px; display: flex; flex-direction: column; gap: 12px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .head h1 { font-size: 26px; }
    .sk { height: 128px; border-radius: var(--r-lg); }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .order { display: flex; flex-direction: column; gap: 14px; padding: 16px; transition: transform .2s var(--ease-out), box-shadow .2s; }
    .order:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
    .who { display: flex; flex-direction: column; line-height: 1.35; }
    .who small { font-size: 12.5px; }
    .bottom { display: flex; align-items: center; gap: 12px; }
    .thumbs { display: flex; flex: 1; align-items: center; }
    .thumbs img, .more { width: 42px; height: 42px; border-radius: 12px; object-fit: cover; border: 2px solid var(--white); }
    .thumbs > * + * { margin-left: -8px; }
    .more { display: grid; place-items: center; background: var(--cream-200); font-size: 12px; font-weight: 700; color: var(--ink-2); }
    .sum { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.3; }
    .sum small { font-size: 12px; }
    .sum strong { font-size: 16px; }
    .chev { color: var(--muted); }
  `,
})
export class OrdersPage {
  private api = inject(CustomerApi);
  readonly orders = signal<OrderSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tab = signal<'active' | 'past'>('active');
  readonly visible = computed(() => {
    const done = (o: OrderSummary) => o.status === 'Completed' || o.status === 'Cancelled';
    return this.orders().filter((o) => (this.tab() === 'past' ? done(o) : !done(o)));
  });

  constructor() { void this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await firstValueFrom(this.api.orders());
      this.orders.set(list);
      if (!list.some((o) => o.status !== 'Completed' && o.status !== 'Cancelled') && list.length) this.tab.set('past');
    } catch (e) {
      this.error.set(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }
}
