import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, fieldErrors, toApiError } from '../core/api';
import { AdminAuth } from '../core/auth';
import { upiLink } from '../core/format';
import { ShopSettings } from '../core/models';
import { ToastService } from '../core/toast.service';
import { UpiQrComponent, copyText } from '../shared/ui.components';
import { AdminState } from './admin-state';

type Folder = 'logos' | 'qr';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, LucideAngularModule, UpiQrComponent],
  template: `
    <header class="page-header">
      <div>
        <h1 class="display">Store settings</h1>
        <p>Everything customers see at checkout comes from here — nothing is hard-coded.</p>
      </div>
    </header>

    @if (!s) {
      <div class="skeleton" style="height: 140px; border-radius: 20px; margin-bottom: 16px"></div>
      <div class="skeleton" style="height: 420px; border-radius: 20px"></div>
    } @else {
      <form class="stack" (ngSubmit)="save()" novalidate>
        <section class="card card-pad open-card" [class.closed]="!s.isOpen">
          <div class="oc-text">
            <span class="oc-ic"><lucide-icon [name]="s.isOpen ? 'store' : 'clock'" [size]="20" /></span>
            <div><strong>{{ s.isOpen ? 'Accepting orders' : 'Store is closed' }}</strong><small>{{ s.isOpen ? 'Customers can place orders right now.' : 'Customers can browse, but checkout is paused.' }}</small></div>
          </div>
          <label class="switch">
            <input type="checkbox" name="isOpen" [(ngModel)]="s.isOpen" (ngModelChange)="touch()" />
            <span class="track"></span>
          </label>
        </section>

        <section class="card card-pad sec">
          <div class="sec-head"><h2>Shop profile</h2>
            <button type="button" class="btn btn-sm btn-ghost" (click)="copyLink()"><lucide-icon name="copy" [size]="14" /> Copy storefront link</button>
          </div>
          <div class="logo-row">
            <div class="logo-box">
              @if (s.logoUrl) { <img [src]="s.logoUrl" alt="Shop logo" /> } @else { <span>{{ s.name[0] }}</span> }
              @if (uploading() === 'logos') { <div class="up"><span class="spinner"></span></div> }
            </div>
            <div class="logo-actions">
              <label class="btn btn-sm btn-outline"><lucide-icon name="upload" [size]="14" /> {{ s.logoUrl ? 'Change logo' : 'Upload logo' }}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="upload($event, 'logos')" />
              </label>
              @if (s.logoUrl) { <button type="button" class="btn btn-sm btn-ghost" (click)="s.logoUrl = null; touch()">Remove</button> }
              <p class="hint">Square image, at least 200×200.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="label" for="sname">Shop name</label>
              <input id="sname" class="input" name="name" [class.invalid]="err('name')" [(ngModel)]="s.name" (ngModelChange)="touch()" />
              @if (err('name')) { <span class="error-text">{{ err('name') }}</span> }
            </div>
            <div class="field">
              <label class="label" for="stag">Tagline</label>
              <input id="stag" class="input" name="tagline" maxlength="160" placeholder="Fresh vegetables, delivered daily" [(ngModel)]="s.tagline" (ngModelChange)="touch()" />
            </div>
            <div class="field">
              <label class="label" for="sowner">Owner name</label>
              <input id="sowner" class="input" name="ownerName" [class.invalid]="err('ownerName')" [(ngModel)]="s.ownerName" (ngModelChange)="touch()" />
            </div>
            <div class="field">
              <label class="label" for="semail">Email</label>
              <input id="semail" class="input" name="email" type="email" [class.invalid]="err('email')" [(ngModel)]="s.email" (ngModelChange)="touch()" />
              @if (err('email')) { <span class="error-text">{{ err('email') }}</span> }
            </div>
            <div class="field">
              <label class="label" for="sphone">Owner mobile</label>
              <div class="input-group"><span class="prefix">+91</span>
                <input id="sphone" class="input has-prefix" name="phone" inputmode="numeric" maxlength="10" [class.invalid]="err('phone')" [(ngModel)]="s.phone" (ngModelChange)="touch()" />
              </div>
              @if (err('phone')) { <span class="error-text">{{ err('phone') }}</span> }
            </div>
            <div class="field">
              <label class="label" for="scontact">Customer helpline</label>
              <div class="input-group"><span class="prefix">+91</span>
                <input id="scontact" class="input has-prefix" name="contactPhone" inputmode="numeric" maxlength="10" [class.invalid]="err('contactPhone')" [(ngModel)]="s.contactPhone" (ngModelChange)="touch()" />
              </div>
              @if (err('contactPhone')) { <span class="error-text">{{ err('contactPhone') }}</span> } @else { <span class="hint">Shown to customers on orders and the success screen.</span> }
            </div>
            <div class="field span-2">
              <label class="label" for="saddr">Shop address</label>
              <input id="saddr" class="input" name="addressLine" [class.invalid]="err('addressLine')" [(ngModel)]="s.addressLine" (ngModelChange)="touch()" />
            </div>
            <div class="field">
              <label class="label" for="scity">City</label>
              <input id="scity" class="input" name="city" [(ngModel)]="s.city" (ngModelChange)="touch()" />
            </div>
            <div class="field">
              <label class="label" for="spin">Pincode</label>
              <input id="spin" class="input" name="pincode" inputmode="numeric" maxlength="6" [class.invalid]="err('pincode')" [(ngModel)]="s.pincode" (ngModelChange)="touch()" />
              @if (err('pincode')) { <span class="error-text">{{ err('pincode') }}</span> }
            </div>
            <div class="field">
              <label class="label" for="slic">Trade / FSSAI licence no. <span class="muted">(optional)</span></label>
              <input id="slic" class="input upper" name="licenseNumber" maxlength="40" [class.invalid]="err('licenseNumber')" [(ngModel)]="s.licenseNumber" (ngModelChange)="touch()" />
              @if (err('licenseNumber')) { <span class="error-text">{{ err('licenseNumber') }}</span> } @else { <span class="hint">Shown on invoices.</span> }
            </div>
            <div class="field">
              <label class="label" for="sgst">GSTIN <span class="muted">(optional)</span></label>
              <input id="sgst" class="input upper" name="gstNumber" maxlength="15" [class.invalid]="err('gstNumber')" [(ngModel)]="s.gstNumber" (ngModelChange)="touch()" />
              @if (err('gstNumber')) { <span class="error-text">{{ err('gstNumber') }}</span> }
            </div>
          </div>
        </section>

        <section class="card card-pad sec">
          <div class="sec-head"><h2>Payments</h2></div>
          @if (err('acceptsCod')) { <div class="err-box">{{ err('acceptsCod') }}</div> }
          <div class="method" [class.on]="s.acceptsUpi">
            <label class="switch m-head">
              <input type="checkbox" name="acceptsUpi" [(ngModel)]="s.acceptsUpi" (ngModelChange)="touch()" />
              <span class="track"></span>
              <span class="m-title"><lucide-icon name="qr-code" [size]="18" /> <strong>UPI</strong> <small class="muted">GPay, PhonePe, Paytm…</small></span>
            </label>
            @if (s.acceptsUpi) {
              <div class="upi-grid">
                <div class="upi-fields">
                  <div class="field">
                    <label class="label" for="supi">UPI ID</label>
                    <input id="supi" class="input tabular" name="upiId" placeholder="yourshop@okaxis" autocapitalize="none" [class.invalid]="err('upiId')" [(ngModel)]="s.upiId" (ngModelChange)="touch()" />
                    @if (err('upiId')) { <span class="error-text">{{ err('upiId') }}</span> }
                  </div>
                  <div class="field">
                    <label class="label" for="spayee">Payee name</label>
                    <input id="spayee" class="input" name="upiPayeeName" placeholder="As shown in UPI apps" [(ngModel)]="s.upiPayeeName" (ngModelChange)="touch()" />
                  </div>
                  <div class="qr-actions">
                    <label class="btn btn-sm btn-outline"><lucide-icon name="upload" [size]="14" /> {{ s.upiQrUrl ? 'Replace QR image' : 'Upload your QR' }}
                      <input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="upload($event, 'qr')" />
                    </label>
                    @if (s.upiQrUrl) { <button type="button" class="btn btn-sm btn-ghost" (click)="s.upiQrUrl = null; touch()">Use generated QR</button> }
                  </div>
                  <p class="hint">No QR image? We generate one from your UPI ID with the exact order amount.</p>
                </div>
                <div class="qr-preview">
                  @if (uploading() === 'qr') { <div class="qr-loading"><span class="spinner"></span></div> }
                  @else if (s.upiQrUrl || previewLink()) { <app-upi-qr [imageUrl]="s.upiQrUrl" [link]="previewLink()" /> }
                  @else { <div class="qr-empty"><lucide-icon name="qr-code" [size]="28" /><small>Enter a UPI ID to preview</small></div> }
                  <small class="muted">Customer preview</small>
                </div>
              </div>
            }
          </div>
          <div class="method" [class.on]="s.acceptsCod">
            <label class="switch m-head">
              <input type="checkbox" name="acceptsCod" [(ngModel)]="s.acceptsCod" (ngModelChange)="touch()" />
              <span class="track"></span>
              <span class="m-title"><lucide-icon name="banknote" [size]="18" /> <strong>Cash on delivery</strong> <small class="muted">Pay at store for pickups</small></span>
            </label>
          </div>
        </section>

        <section class="card card-pad sec">
          <div class="sec-head"><h2>Delivery &amp; orders</h2></div>
          @if (err('deliveryEnabled')) { <div class="err-box">{{ err('deliveryEnabled') }}</div> }
          <div class="toggles">
            <label class="switch"><input type="checkbox" name="deliveryEnabled" [(ngModel)]="s.deliveryEnabled" (ngModelChange)="touch()" /><span class="track"></span><span class="t"><lucide-icon name="bike" [size]="16" /> Home delivery</span></label>
            <label class="switch"><input type="checkbox" name="pickupEnabled" [(ngModel)]="s.pickupEnabled" (ngModelChange)="touch()" /><span class="track"></span><span class="t"><lucide-icon name="store" [size]="16" /> Store pickup</span></label>
          </div>
          <div class="form-grid three">
            <div class="field">
              <label class="label" for="sfee">Delivery fee</label>
              <div class="input-group"><span class="prefix">₹</span><input id="sfee" class="input has-prefix rs tabular" name="deliveryFee" type="number" min="0" [disabled]="!s.deliveryEnabled" [(ngModel)]="s.deliveryFee" (ngModelChange)="touch()" /></div>
            </div>
            <div class="field">
              <label class="label" for="sfree">Free delivery above</label>
              <div class="input-group"><span class="prefix">₹</span><input id="sfree" class="input has-prefix rs tabular" name="freeDeliveryAbove" type="number" min="0" placeholder="Never" [disabled]="!s.deliveryEnabled" [(ngModel)]="s.freeDeliveryAbove" (ngModelChange)="touch()" /></div>
            </div>
            <div class="field">
              <label class="label" for="seta">Delivery time</label>
              <input id="seta" class="input" name="deliveryEta" maxlength="60" placeholder="30–45 min" [(ngModel)]="s.deliveryEta" (ngModelChange)="touch()" />
            </div>
          </div>
        </section>

        <div class="savebar">
          <div class="savebar-inner">
            <span class="muted dirty">{{ dirty() ? 'You have unsaved changes' : 'All changes saved' }}</span>
            <button type="button" class="btn btn-outline" [disabled]="!dirty() || saving()" (click)="reset()">Discard</button>
            <button type="submit" class="btn btn-primary" [disabled]="!dirty() || saving() || !!uploading()">@if (saving()) { <span class="spinner"></span> } Save settings</button>
          </div>
        </div>
      </form>
    }
  `,
  styles: `
    .stack { display: flex; flex-direction: column; gap: 16px; padding-bottom: 90px; max-width: 980px; }
    .sec { display: flex; flex-direction: column; gap: 16px; }
    .sec-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    h2 { font-family: var(--font-ui); font-size: 16px; font-weight: 700; }
    .open-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: linear-gradient(135deg, var(--leaf-50), var(--white)); border-color: var(--leaf-200); }
    .open-card.closed { background: linear-gradient(135deg, var(--danger-50), var(--white)); border-color: #f2cfc6; }
    .oc-text { display: flex; align-items: center; gap: 14px; }
    .oc-text div { display: flex; flex-direction: column; line-height: 1.35; }
    .oc-text strong { font-size: 16px; }
    .oc-text small { font-size: 13px; color: var(--muted); }
    .oc-ic { width: 44px; height: 44px; border-radius: 14px; background: var(--leaf-600); color: var(--white); display: grid; place-items: center; }
    .closed .oc-ic { background: var(--danger); }
    .logo-row { display: flex; align-items: center; gap: 16px; }
    .logo-box { position: relative; width: 76px; height: 76px; border-radius: 20px; overflow: hidden; background: var(--forest-900); color: var(--lime-300); display: grid; place-items: center; font-weight: 800; font-size: 28px; text-transform: uppercase; flex-shrink: 0; }
    .logo-box img { width: 100%; height: 100%; object-fit: cover; }
    .up { position: absolute; inset: 0; background: rgba(255,255,255,.7); display: grid; place-items: center; color: var(--forest-900); }
    .logo-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .logo-actions .hint { width: 100%; }
    .upper { text-transform: uppercase; }
    .err-box { padding: 10px 14px; border-radius: 12px; background: var(--danger-50); color: var(--danger); font-weight: 600; font-size: 13.5px; }
    .method { border: 1.5px solid var(--line); border-radius: 18px; padding: 14px 16px; transition: border-color .2s, background-color .2s; }
    .method.on { border-color: var(--leaf-200); background: var(--leaf-50); }
    .m-head { width: 100%; }
    .m-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; }
    .m-title small { font-size: 12.5px; }
    .upi-grid { display: grid; gap: 16px; margin-top: 16px; }
    .upi-fields { display: flex; flex-direction: column; gap: 14px; }
    .upi-fields .input { background: var(--white); }
    .qr-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .qr-preview { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .qr-preview app-upi-qr { width: 180px; }
    .qr-empty, .qr-loading { width: 180px; aspect-ratio: 1; border-radius: 14px; border: 1.5px dashed var(--line); background: var(--white); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--muted); font-size: 12px; text-align: center; padding: 10px; }
    .toggles { display: flex; gap: 24px; flex-wrap: wrap; }
    .t { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; }
    .rs { padding-left: 32px !important; }
    .input-group .prefix { left: 14px; }
    .input:disabled { opacity: .55; }
    @media (min-width: 640px) { .form-grid.three { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 1000px) { .upi-grid { grid-template-columns: 1fr 220px; align-items: start; } }
    .savebar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: rgba(255,255,255,.94); backdrop-filter: blur(10px); border-top: 1px solid var(--line); padding: 12px 14px calc(12px + var(--safe-bottom)); }
    .savebar-inner { max-width: 1260px; margin: 0 auto; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
    .dirty { flex: 1; font-size: 13px; }
    @media (min-width: 1024px) { .savebar { left: 268px; } .savebar-inner { padding: 0 18px; } }
  `,
})
export class SettingsPage {
  private api = inject(AdminApi);
  private auth = inject(AdminAuth);
  private state = inject(AdminState);
  private toast = inject(ToastService);

  s: ShopSettings | null = null;
  private saved: ShopSettings | null = null;
  readonly errors = signal<Record<string, string>>({});
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal<Folder | null>(null);
  private version = signal(0);

  readonly previewLink = computed(() => {
    this.version();
    const s = this.s;
    return s?.upiId && /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(s.upiId.trim()) ? upiLink(s.upiId.trim(), s.upiPayeeName || s.name, 100, `Order at ${s.name}`) : '';
  });

  constructor() { void this.load(); }

  err(key: string) { return this.errors()[key]; }

  touch() {
    this.dirty.set(true);
    this.version.update((v) => v + 1);
  }

  private async load() {
    try {
      const settings = await firstValueFrom(this.api.settings());
      this.saved = settings;
      this.s = structuredClone(settings);
      this.version.update((v) => v + 1);
    } catch (e) {
      this.toast.error(toApiError(e).title);
    }
  }

  reset() {
    if (!this.saved) return;
    this.s = structuredClone(this.saved);
    this.errors.set({});
    this.dirty.set(false);
    this.version.update((v) => v + 1);
  }

  copyLink() {
    if (this.s) void copyText(`${location.origin}/?shop=${this.s.slug}`, this.toast, 'Storefront link copied');
  }

  async upload(event: Event, folder: Folder) {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file || !this.s) return;
    if (file.size > 5 * 1024 * 1024) { this.toast.error('Image must be 5 MB or smaller.'); return; }
    this.uploading.set(folder);
    try {
      const { url } = await firstValueFrom(this.api.upload(file, folder));
      if (folder === 'logos') this.s.logoUrl = url; else this.s.upiQrUrl = url;
      this.touch();
    } catch (e) {
      this.toast.error(toApiError(e).title);
    } finally {
      this.uploading.set(null);
    }
  }

  async save() {
    const s = this.s;
    if (!s) return;
    const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
    const { id, slug, ...rest } = s;
    const body = {
      ...rest,
      tagline: blank(s.tagline), licenseNumber: blank(s.licenseNumber)?.toUpperCase() ?? null, gstNumber: blank(s.gstNumber)?.toUpperCase() ?? null, upiId: blank(s.upiId), upiPayeeName: blank(s.upiPayeeName),
      deliveryFee: Number(s.deliveryFee) || 0, freeDeliveryAbove: s.freeDeliveryAbove ? Number(s.freeDeliveryAbove) : null, minOrderAmount: 0,
      deliveryEta: s.deliveryEta?.trim() || '30–45 min',
    };
    this.saving.set(true);
    this.errors.set({});
    try {
      const updated = await firstValueFrom(this.api.updateSettings(body));
      this.saved = updated;
      this.s = structuredClone(updated);
      this.dirty.set(false);
      this.version.update((v) => v + 1);
      this.state.storeOpen.set(updated.isOpen);
      const admin = this.auth.admin();
      if (admin) this.auth.admin.set({ ...admin, shopName: updated.name, shopLogoUrl: updated.logoUrl });
      this.toast.success('Settings saved — customers see the changes instantly');
    } catch (e) {
      const err = toApiError(e);
      this.errors.set(fieldErrors(err));
      this.toast.error(err.title);
    } finally {
      this.saving.set(false);
    }
  }
}
