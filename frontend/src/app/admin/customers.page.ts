import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { AdminApi, toApiError } from '../core/api';
import { AdminCustomer } from '../core/models';
import { ToastService } from '../core/toast.service';
import { InrPipe, TimeAgoPipe } from '../shared/pipes';
import { EmptyStateComponent } from '../shared/ui.components';

@Component({
  selector: 'app-customers',
  imports: [DatePipe, FormsModule, LucideAngularModule, InrPipe, TimeAgoPipe, EmptyStateComponent],
  template: `
    <header class="page-header">
      <div>
        <h1 class="display">Customers</h1>
        <p>People who have ordered from your shop.</p>
      </div>
    </header>

    <section class="summary">
      <div class="card sum"><small>Customers</small><strong class="display tabular">{{ customers().length }}</strong></div>
      <div class="card sum"><small>Repeat customers</small><strong class="display tabular">{{ repeat() }}</strong></div>
      <div class="card sum"><small>Avg. spend</small><strong class="display tabular">{{ avg() | inr }}</strong></div>
    </section>

    <div class="toolbar">
      <label class="search-box">
        <lucide-icon name="search" [size]="17" />
        <input class="input" type="search" placeholder="Search by name or phone" [ngModel]="search" (ngModelChange)="onSearch($event)" />
      </label>
    </div>

    @if (loading()) {
      <div class="card">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton sk"></div> }</div>
    } @else if (!customers().length) {
      <div class="card"><app-empty-state icon="users" title="No customers yet" [message]="search ? 'No one matches that search.' : 'Customers appear here after their first order.'" /></div>
    } @else {
      <div class="card table-wrap only-desktop">
        <table class="table">
          <thead><tr><th>Customer</th><th>Phone</th><th>City</th><th class="text-right">Orders</th><th class="text-right">Total spent</th><th>Last order</th><th>Joined</th></tr></thead>
          <tbody>
            @for (c of customers(); track c.id) {
              <tr>
                <td><span class="cell-main"><span class="avatar">{{ initials(c.name) }}</span><div><strong>{{ c.name }}</strong>@if (c.email) { <small>{{ c.email }}</small> }</div></span></td>
                <td><a class="tabular link" [href]="'tel:+91' + c.phone">+91 {{ c.phone }}</a></td>
                <td>{{ c.city || '—' }}</td>
                <td class="text-right tabular">{{ c.orders }} @if (c.orders > 1) { <span class="badge green">Repeat</span> }</td>
                <td class="text-right tabular"><strong>{{ c.totalSpent | inr }}</strong></td>
                <td class="muted">{{ c.lastOrderAt ? (c.lastOrderAt | timeAgo) : '—' }}</td>
                <td class="muted">{{ c.joinedAt | date: 'd MMM y' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <ul class="m-list only-mobile">
        @for (c of customers(); track c.id) {
          <li class="card m-card">
            <span class="avatar">{{ initials(c.name) }}</span>
            <div class="m-info"><strong>{{ c.name }}</strong><a class="tabular link" [href]="'tel:+91' + c.phone">+91 {{ c.phone }}</a><small class="muted">{{ c.orders }} orders · last {{ c.lastOrderAt ? (c.lastOrderAt | timeAgo) : '—' }}</small></div>
            <strong class="tabular">{{ c.totalSpent | inr }}</strong>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .sum { padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
    .sum small { font-size: 12px; color: var(--muted); font-weight: 600; }
    .sum strong { font-size: 24px; }
    .sk { height: 56px; margin: 10px 16px; }
    .avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--leaf-100); color: var(--leaf-600); display: grid; place-items: center; font-weight: 800; font-size: 13px; flex-shrink: 0; }
    .link { color: var(--leaf-600); font-weight: 600; }
    .badge { margin-left: 6px; }
    .m-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .m-card { display: flex; align-items: center; gap: 12px; padding: 14px; }
    .m-info { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.35; font-size: 14px; }
    .m-info small { font-size: 12px; }
    @media (max-width: 480px) { .sum strong { font-size: 19px; } .sum { padding: 12px; } }
  `,
})
export class CustomersPage {
  private api = inject(AdminApi);
  private toast = inject(ToastService);
  readonly customers = signal<AdminCustomer[]>([]);
  readonly loading = signal(true);
  search = '';
  private search$ = new Subject<string>();

  readonly repeat = computed(() => this.customers().filter((c) => c.orders > 1).length);
  readonly avg = computed(() => {
    const list = this.customers().filter((c) => c.orders > 0);
    return list.length ? Math.round(list.reduce((t, c) => t + c.totalSpent, 0) / list.length) : 0;
  });

  constructor() {
    this.search$.pipe(debounceTime(350), takeUntilDestroyed(inject(DestroyRef))).subscribe(() => void this.load());
    void this.load();
  }

  initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(''); }

  onSearch(v: string) {
    this.search = v;
    this.search$.next(v);
  }

  async load() {
    this.loading.set(true);
    try {
      this.customers.set(await firstValueFrom(this.api.customers(this.search.trim() || undefined)));
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.loading.set(false);
    }
  }
}
