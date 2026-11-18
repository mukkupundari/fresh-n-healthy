import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CustomerApi, fieldErrors, toApiError } from '../core/api';
import { CustomerAuth } from '../core/auth';
import { Customer } from '../core/models';
import { ShopStore } from '../core/shop.store';
import { ToastService } from '../core/toast.service';
import { copyText } from '../shared/ui.components';

type Section = 'personal' | 'address';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="container narrow page-enter">
      @if (auth.customer(); as c) {
        <section class="hero">
          <span class="avatar">{{ initials(c.name) }}</span>
          <div><h1 class="display">{{ c.name }}</h1><p>+91 {{ c.phone }}</p></div>
        </section>

        <section class="group">
          <h2 class="group-title">Account</h2>
          <div class="card list">
            @if (editing() === 'personal') {
              <form class="edit" (ngSubmit)="save('personal')">
                <div class="edit-head"><lucide-icon name="user" [size]="18" /> <strong>Personal details</strong></div>
                <div class="form-grid">
                  <div class="field">
                    <label class="label" for="pname">Full name</label>
                    <input id="pname" class="input" name="name" autocomplete="name" [class.invalid]="errors()['name']" [(ngModel)]="form.name" />
                    @if (errors()['name']) { <span class="error-text">{{ errors()['name'] }}</span> }
                  </div>
                  <div class="field">
                    <label class="label" for="pemail">Email <span class="muted">(optional)</span></label>
                    <input id="pemail" class="input" name="email" type="email" autocomplete="email" [class.invalid]="errors()['email']" [(ngModel)]="form.email" />
                    @if (errors()['email']) { <span class="error-text">{{ errors()['email'] }}</span> }
                  </div>
                </div>
                <div class="edit-actions">
                  <button class="btn btn-ghost" type="button" (click)="cancel()">Cancel</button>
                  <button class="btn btn-primary" type="submit" [disabled]="saving()">@if (saving()) { <span class="spinner"></span> } Save</button>
                </div>
              </form>
            } @else {
              <button class="row" type="button" (click)="edit('personal')">
                <span class="ic"><lucide-icon name="user" [size]="18" /></span>
                <span class="txt"><strong>Personal details</strong><small>{{ c.name }}{{ c.email ? ' · ' + c.email : ' · Add email' }}</small></span>
                <span class="act">Edit</span>
              </button>
            }
            <div class="row static">
              <span class="ic"><lucide-icon name="phone" [size]="18" /></span>
              <span class="txt"><strong>Mobile number</strong><small>+91 {{ c.phone }}</small></span>
              <span class="badge"><lucide-icon name="badge-check" [size]="14" /> Verified</span>
            </div>
            @if (editing() === 'address') {
              <form class="edit" (ngSubmit)="save('address')">
                <div class="edit-head"><lucide-icon name="map-pin" [size]="18" /> <strong>Saved address</strong></div>
                <div class="form-grid">
                  <div class="field span-2">
                    <label class="label" for="paddr">House / flat, street, area</label>
                    <input id="paddr" class="input" name="addressLine" autocomplete="street-address" [(ngModel)]="form.addressLine" />
                  </div>
                  <div class="field">
                    <label class="label" for="pland">Landmark <span class="muted">(optional)</span></label>
                    <input id="pland" class="input" name="landmark" [(ngModel)]="form.landmark" />
                  </div>
                  <div class="row2">
                    <div class="field">
                      <label class="label" for="pcity">City</label>
                      <input id="pcity" class="input" name="city" autocomplete="address-level2" [(ngModel)]="form.city" />
                    </div>
                    <div class="field">
                      <label class="label" for="ppin">Pincode</label>
                      <input id="ppin" class="input" name="pincode" inputmode="numeric" maxlength="6" [class.invalid]="errors()['pincode']" [(ngModel)]="form.pincode" />
                    </div>
                  </div>
                  @if (errors()['pincode']) { <span class="error-text span-2">{{ errors()['pincode'] }}</span> }
                </div>
                <div class="edit-actions">
                  <button class="btn btn-ghost" type="button" (click)="cancel()">Cancel</button>
                  <button class="btn btn-primary" type="submit" [disabled]="saving()">@if (saving()) { <span class="spinner"></span> } Save</button>
                </div>
              </form>
            } @else {
              <button class="row" type="button" (click)="edit('address')">
                <span class="ic"><lucide-icon name="map-pin" [size]="18" /></span>
                @let addr = addressLine(c);
                <span class="txt"><strong>Saved address</strong><small [class.placeholder]="!addr">{{ addr || 'Add an address for faster checkout' }}</small></span>
                <span class="act">{{ addr ? 'Edit' : 'Add' }}</span>
              </button>
            }
          </div>
        </section>

        <section class="group">
          <h2 class="group-title">Shopping</h2>
          <div class="card list">
            <a class="row" routerLink="/orders">
              <span class="ic"><lucide-icon name="receipt-text" [size]="18" /></span>
              <span class="txt"><strong>My orders</strong><small>Track orders, invoices and payments</small></span>
              <lucide-icon class="chev" name="chevron-right" [size]="18" />
            </a>
            <a class="row" routerLink="/stores">
              <span class="ic"><lucide-icon name="store" [size]="18" /></span>
              <span class="txt"><strong>Change store</strong><small>{{ store.shop()?.name ? 'Shopping from ' + store.shop()?.name : 'Choose a store near you' }}</small></span>
              <lucide-icon class="chev" name="chevron-right" [size]="18" />
            </a>
            @if (store.shop(); as s) {
              <a class="row" [href]="'tel:+91' + s.contactPhone">
                <span class="ic"><lucide-icon name="headset" [size]="18" /></span>
                <span class="txt"><strong>Help with an order</strong><small>Call {{ s.name }} · +91 {{ s.contactPhone }}</small></span>
                <lucide-icon class="chev" name="chevron-right" [size]="18" />
              </a>
            }
            <button class="row" type="button" (click)="share()">
              <span class="ic"><lucide-icon name="share-2" [size]="18" /></span>
              <span class="txt"><strong>Share Fresh n Healthy</strong><small>Invite friends and family</small></span>
              <lucide-icon class="chev" name="chevron-right" [size]="18" />
            </button>
          </div>
        </section>

        <section class="group">
          <h2 class="group-title">For shop owners</h2>
          <div class="card list">
            <a class="row" routerLink="/admin/login">
              <span class="ic dark"><lucide-icon name="key-round" [size]="18" /></span>
              <span class="txt"><strong>Shop login</strong><small>Manage your vegetables, stock and orders</small></span>
              <lucide-icon class="chev" name="chevron-right" [size]="18" />
            </a>
            <a class="row" routerLink="/admin/register">
              <span class="ic dark"><lucide-icon name="store" [size]="18" /></span>
              <span class="txt"><strong>Register your shop</strong><small>Take orders online in two minutes</small></span>
              <lucide-icon class="chev" name="chevron-right" [size]="18" />
            </a>
          </div>
        </section>

        <div class="card list">
          <button class="row danger" type="button" (click)="logout()">
            <span class="ic"><lucide-icon name="log-out" [size]="18" /></span>
            <span class="txt"><strong>Sign out</strong></span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 720px; display: flex; flex-direction: column; gap: 18px; padding-top: 16px; padding-bottom: 32px; }
    .hero { display: flex; align-items: center; gap: 16px; padding: 22px; border-radius: var(--r-xl); background: linear-gradient(135deg, var(--forest-900), var(--forest-700)); color: var(--white); }
    .hero h1 { color: var(--white); font-size: 24px; }
    .hero p { opacity: .8; font-size: 14px; }
    .avatar { width: 60px; height: 60px; border-radius: 20px; background: var(--lime-400); color: var(--forest-950); display: grid; place-items: center; font-weight: 800; font-size: 22px; }
    .group { display: flex; flex-direction: column; gap: 8px; }
    .group-title { font-family: var(--font-ui); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding-left: 4px; }
    .list { padding: 0; overflow: hidden; }
    .list > * + * { border-top: 1px solid var(--line-2); }
    .row { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 16px; background: none; border: 0; text-align: left; color: inherit; font: inherit; cursor: pointer; transition: background-color .15s; }
    .row:not(.static):hover { background: var(--cream-50); }
    .row:focus-visible { outline: 3px solid var(--lime-400); outline-offset: -3px; }
    .row.static { cursor: default; }
    .ic { width: 36px; height: 36px; border-radius: 12px; background: var(--leaf-50, var(--cream-100)); color: var(--leaf-600); display: grid; place-items: center; flex-shrink: 0; }
    .ic.dark { background: var(--forest-900); color: var(--lime-400); }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .txt strong { font-size: 14.5px; color: var(--forest-900); }
    .txt small { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .txt small.placeholder { color: var(--leaf-600); }
    .act { font-size: 13px; font-weight: 700; color: var(--leaf-600); padding: 6px 10px; border-radius: 99px; background: var(--cream-50); }
    .chev { color: var(--muted); flex-shrink: 0; }
    .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--leaf-600); }
    .danger .ic { background: var(--danger-50); color: var(--danger); }
    .danger .txt strong { color: var(--danger); }
    .edit { display: flex; flex-direction: column; gap: 14px; padding: 16px; background: var(--cream-50); }
    .edit-head { display: flex; align-items: center; gap: 8px; color: var(--forest-900); }
    .edit-head lucide-icon { color: var(--leaf-600); }
    .edit .input { background: var(--white); }
    .edit-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .row2 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
  `,
})
export class ProfilePage {
  protected auth = inject(CustomerAuth);
  protected store = inject(ShopStore);
  private api = inject(CustomerApi);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly saving = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly editing = signal<Section | null>(null);
  form = { name: '', email: '', addressLine: '', landmark: '', city: '', pincode: '' };

  constructor() {
    this.reset();
  }

  initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  addressLine(c: Customer) {
    const place = [c.city, c.pincode].filter(Boolean).join(' ');
    return [c.addressLine, c.landmark, place].filter(Boolean).join(', ');
  }

  edit(section: Section) {
    this.reset();
    this.editing.set(section);
  }

  cancel() {
    this.reset();
    this.editing.set(null);
  }

  private reset() {
    const c = this.auth.customer();
    if (c) this.form = { name: c.name, email: c.email ?? '', addressLine: c.addressLine ?? '', landmark: c.landmark ?? '', city: c.city ?? '', pincode: c.pincode ?? '' };
    this.errors.set({});
  }

  async save(section: Section) {
    const e: Record<string, string> = {};
    if (this.form.name.trim().length < 2) e['name'] = 'Please enter your name.';
    if (this.form.pincode && !/^\d{6}$/.test(this.form.pincode.trim())) e['pincode'] = 'Enter a valid 6-digit pincode.';
    this.errors.set(e);
    if (Object.keys(e).length) return;

    this.saving.set(true);
    try {
      const blank = (v: string) => v.trim() || null;
      const updated = await firstValueFrom(this.api.updateMe({
        name: this.form.name.trim(), email: blank(this.form.email), addressLine: blank(this.form.addressLine),
        landmark: blank(this.form.landmark), city: blank(this.form.city), pincode: blank(this.form.pincode),
      }));
      this.auth.updateCustomer(updated);
      this.editing.set(null);
      this.toast.success(section === 'personal' ? 'Personal details saved' : 'Address saved');
    } catch (err) {
      const apiErr = toApiError(err);
      this.errors.set(fieldErrors(apiErr));
      this.toast.error(apiErr.title);
    } finally {
      this.saving.set(false);
    }
  }

  async share() {
    const data = { title: 'Fresh n Healthy', text: 'Farm-fresh vegetables delivered from local shops.', url: window.location.origin };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* dismissed */ }
      return;
    }
    await copyText(data.url, this.toast, 'Link copied');
  }

  async logout() {
    await this.auth.logout();
    this.toast.success('Signed out');
    this.router.navigateByUrl('/');
  }
}
