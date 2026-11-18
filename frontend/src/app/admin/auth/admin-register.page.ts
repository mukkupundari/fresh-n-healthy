import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, fieldErrors, toApiError } from '../../core/api';
import { ShopPaymentSetup, ShopRegistrationDetails } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AuthLayoutComponent } from './auth-layout.component';

const SHOP_FIELDS: (keyof ShopRegistrationDetails)[] = ['shopName', 'ownerName', 'email', 'phone', 'licenseNumber', 'gstNumber', 'addressLine', 'city', 'pincode'];
const PAYMENT_FIELDS: (keyof ShopPaymentSetup)[] = ['acceptsUpi', 'upiId', 'upiPayeeName', 'upiQrUrl', 'acceptsCod'];

@Component({
  selector: 'app-admin-register',
  imports: [FormsModule, RouterLink, LucideAngularModule, AuthLayoutComponent],
  template: `
    <app-auth-layout headline="Bring your vegetable shop online in two minutes." [wide]="true">
      @if (step() !== 4) {
        <div class="head">
          <span class="kicker">Register your shop</span>
          <h1 class="display">{{ copy[step() - 1].title }}</h1>
          <p class="muted">{{ copy[step() - 1].text }}</p>
        </div>
        <ol class="steps">
          @for (label of stepLabels; track label; let i = $index) {
            @if (i > 0) { <li class="bar" [class.done]="step() > i"></li> }
            <li [class.active]="step() === i + 1" [class.done]="step() > i + 1">
              <span>@if (step() > i + 1) { <lucide-icon name="check" [size]="13" [strokeWidth]="3" /> } @else { {{ i + 1 }} }</span> <em>{{ label }}</em>
            </li>
          }
        </ol>
      }

      @switch (step()) {
        @case (1) {
          <form class="form page-enter" (ngSubmit)="next()" novalidate>
            <div class="form-grid">
              <div class="field span-2">
                <label class="label" for="shopName">Shop name</label>
                <input id="shopName" class="input" name="shopName" autocomplete="organization" placeholder="e.g. Sri Lakshmi Vegetables" [class.invalid]="err('shopName')" [(ngModel)]="shop.shopName" />
                @if (err('shopName')) { <span class="error-text">{{ err('shopName') }}</span> }
              </div>
              <div class="field">
                <label class="label" for="ownerName">Owner's full name</label>
                <input id="ownerName" class="input" name="ownerName" autocomplete="name" [class.invalid]="err('ownerName')" [(ngModel)]="shop.ownerName" />
                @if (err('ownerName')) { <span class="error-text">{{ err('ownerName') }}</span> }
              </div>
              <div class="field">
                <label class="label" for="phone">Mobile number</label>
                <div class="input-group">
                  <span class="prefix">+91</span>
                  <input id="phone" class="input has-prefix" name="phone" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" [class.invalid]="err('phone')" [(ngModel)]="shop.phone" />
                </div>
                @if (err('phone')) { <span class="error-text">{{ err('phone') }}</span> }
              </div>
              <div class="field span-2">
                <label class="label" for="email">Business email</label>
                <input id="email" class="input" name="email" type="email" autocomplete="email" placeholder="owner@yourshop.in" [class.invalid]="err('email')" [(ngModel)]="shop.email" />
                @if (err('email')) { <span class="error-text">{{ err('email') }}</span> }
              </div>
              <div class="field">
                <label class="label" for="license">Trade / FSSAI licence no. <span class="muted">(optional)</span></label>
                <input id="license" class="input upper" name="licenseNumber" placeholder="e.g. FSSAI-23624010001234" [class.invalid]="err('licenseNumber')" [(ngModel)]="shop.licenseNumber" />
                @if (err('licenseNumber')) { <span class="error-text">{{ err('licenseNumber') }}</span> } @else { <span class="hint">Shown on invoices. You can add it later in Settings.</span> }
              </div>
              <div class="field">
                <label class="label" for="gst">GSTIN <span class="muted">(optional)</span></label>
                <input id="gst" class="input upper" name="gstNumber" maxlength="15" placeholder="36ABCDE1234F1Z5" [class.invalid]="err('gstNumber')" [(ngModel)]="shop.gstNumber" />
                @if (err('gstNumber')) { <span class="error-text">{{ err('gstNumber') }}</span> }
              </div>
              <div class="field span-2">
                <label class="label" for="address">Shop address</label>
                <input id="address" class="input" name="addressLine" autocomplete="street-address" placeholder="Shop no., street, area" [class.invalid]="err('addressLine')" [(ngModel)]="shop.addressLine" />
                @if (err('addressLine')) { <span class="error-text">{{ err('addressLine') }}</span> }
              </div>
              <div class="field">
                <label class="label" for="city">City</label>
                <input id="city" class="input" name="city" autocomplete="address-level2" [class.invalid]="err('city')" [(ngModel)]="shop.city" />
                @if (err('city')) { <span class="error-text">{{ err('city') }}</span> }
              </div>
              <div class="field">
                <label class="label" for="pincode">Pincode</label>
                <input id="pincode" class="input" name="pincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" [class.invalid]="err('pincode')" [(ngModel)]="shop.pincode" />
                @if (err('pincode')) { <span class="error-text">{{ err('pincode') }}</span> }
              </div>
            </div>
            <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy()">
              @if (busy()) { <span class="spinner"></span> } Continue <lucide-icon name="arrow-right" [size]="18" />
            </button>
            <p class="foot muted">Already registered? <a routerLink="/admin/login" class="link">Sign in</a></p>
          </form>
        }

        @case (2) {
          <form class="form page-enter" (ngSubmit)="nextPayment()" novalidate>
            <div class="method" [class.on]="pay.acceptsUpi">
              <label class="switch m-head">
                <input type="checkbox" name="acceptsUpi" [(ngModel)]="pay.acceptsUpi" />
                <span class="track"></span>
                <span class="m-title"><lucide-icon name="qr-code" [size]="18" /> <strong>Accept UPI</strong> <small class="muted">Customers scan your QR and pay</small></span>
              </label>
              @if (pay.acceptsUpi) {
                <div class="m-body">
                  <div class="qr-up" [class.invalid]="err('upiQrUrl')">
                    <div class="qr-box">
                      @if (qrUrl(); as url) { <img [src]="url" alt="Your UPI QR code" /> }
                      @else if (qrUploading()) { <span class="spinner"></span> }
                      @else { <lucide-icon name="qr-code" [size]="34" /> }
                    </div>
                    <div class="qr-text">
                      <strong>Your shop's UPI QR code</strong>
                      <small class="muted">Take a screenshot or download it from GPay, PhonePe, Paytm or your bank's merchant app. JPG, PNG or WebP up to 5 MB.</small>
                      <div class="qr-btns">
                        <label class="btn btn-sm btn-dark" [class.disabled]="qrUploading()">
                          <lucide-icon name="upload" [size]="15" /> {{ qrUrl() ? 'Change QR' : 'Upload QR' }}
                          <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="onQr($event)" [disabled]="qrUploading()" />
                        </label>
                        @if (qrUrl()) { <button type="button" class="btn btn-sm btn-ghost" (click)="qrUrl.set(null)">Remove</button> }
                      </div>
                    </div>
                  </div>
                  @if (err('upiQrUrl')) { <span class="error-text">{{ err('upiQrUrl') }}</span> }
                  <div class="form-grid">
                    <div class="field">
                      <label class="label" for="upiId">UPI ID</label>
                      <input id="upiId" class="input" name="upiId" autocapitalize="none" spellcheck="false" placeholder="yourshop@okaxis" [class.invalid]="err('upiId')" [(ngModel)]="pay.upiId" />
                      @if (err('upiId')) { <span class="error-text">{{ err('upiId') }}</span> } @else { <span class="hint">Printed under the QR code.</span> }
                    </div>
                    <div class="field">
                      <label class="label" for="payee">Name on UPI <span class="muted">(optional)</span></label>
                      <input id="payee" class="input" name="upiPayeeName" [placeholder]="shop.shopName" [(ngModel)]="pay.upiPayeeName" />
                    </div>
                  </div>
                </div>
              }
            </div>

            <div class="method" [class.on]="pay.acceptsCod">
              <label class="switch m-head">
                <input type="checkbox" name="acceptsCod" [(ngModel)]="pay.acceptsCod" />
                <span class="track"></span>
                <span class="m-title"><lucide-icon name="banknote" [size]="18" /> <strong>Cash on delivery</strong> <small class="muted">Pay on delivery or at pickup</small></span>
              </label>
            </div>
            @if (err('acceptsCod')) { <span class="error-text">{{ err('acceptsCod') }}</span> }

            <div class="row">
              <button class="btn btn-outline btn-lg" type="button" (click)="step.set(1)"><lucide-icon name="arrow-left" [size]="18" /> Back</button>
              <button class="btn btn-primary btn-lg grow" type="submit" [disabled]="qrUploading()">Continue <lucide-icon name="arrow-right" [size]="18" /></button>
            </div>
          </form>
        }

        @case (3) {
          <form class="form page-enter" (ngSubmit)="register()" novalidate>
            <div class="shop-sum">
              <span class="ini">{{ shop.shopName[0] }}</span>
              <div><strong>{{ shop.shopName }}</strong><small class="muted">{{ shop.ownerName }}@if (shop.licenseNumber?.trim()) { · Licence {{ shop.licenseNumber?.trim()?.toUpperCase() }} }</small></div>
              <button type="button" class="btn btn-sm btn-ghost" (click)="step.set(1)"><lucide-icon name="pencil" [size]="14" /> Edit</button>
            </div>

            <div class="field">
              <label class="label" for="username">Username</label>
              <div class="input-group">
                <input id="username" class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="30"
                  [class.invalid]="err('username') || usernameState() === 'taken' || usernameState() === 'invalid'" [(ngModel)]="username" (ngModelChange)="onUsername($event)" />
                <span class="suffix status">
                  @switch (usernameState()) {
                    @case ('checking') { <span class="spinner sm"></span> }
                    @case ('ok') { <lucide-icon name="check-circle-2" [size]="18" class="ok-ic" /> }
                    @case ('taken') { <lucide-icon name="circle-alert" [size]="18" class="bad-ic" /> }
                  }
                </span>
              </div>
              @if (err('username')) { <span class="error-text">{{ err('username') }}</span> }
              @else if (usernameState() === 'taken') { <span class="error-text">This username is taken. Try another.</span> }
              @else if (usernameState() === 'invalid') { <span class="error-text">4–30 letters, numbers, dots or underscores.</span> }
              @else if (usernameState() === 'ok') { <span class="hint good">Available</span> }
              @else { <span class="hint">4–30 letters, numbers, dots or underscores.</span> }
            </div>

            <div class="field">
              <label class="label" for="password">Password</label>
              <div class="input-group">
                <input id="password" class="input pw" name="password" [type]="show() ? 'text' : 'password'" autocomplete="new-password" [class.invalid]="err('password')" [(ngModel)]="password" (ngModelChange)="pw.set($event)" />
                <button type="button" class="suffix eye" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'"><lucide-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" /></button>
              </div>
              <div class="meter"><span [style.width.%]="strength() * 25" [class]="'lvl' + strength()"></span></div>
              <ul class="rules">
                @for (r of rules(); track r.label) {
                  <li [class.met]="r.met"><lucide-icon [name]="r.met ? 'check' : 'minus'" [size]="13" [strokeWidth]="3" /> {{ r.label }}</li>
                }
              </ul>
              @if (err('password')) { <span class="error-text">{{ err('password') }}</span> }
            </div>

            <div class="field">
              <label class="label" for="confirm">Confirm password</label>
              <input id="confirm" class="input" name="confirm" [type]="show() ? 'text' : 'password'" autocomplete="new-password" [class.invalid]="confirm && confirm !== password" [(ngModel)]="confirm" />
              @if (confirm && confirm !== password) { <span class="error-text">Passwords don't match.</span> }
            </div>

            <div class="row">
              <button class="btn btn-outline btn-lg" type="button" (click)="step.set(2)"><lucide-icon name="arrow-left" [size]="18" /> Back</button>
              <button class="btn btn-primary btn-lg grow" type="submit" [disabled]="busy() || !canSubmit()">
                @if (busy()) { <span class="spinner"></span> } Create shop account
              </button>
            </div>
          </form>
        }

        @case (4) {
          <div class="done page-enter">
            <div class="badge-ic"><lucide-icon name="badge-check" [size]="36" /></div>
            <h1 class="display">{{ shop.shopName }} is ready!</h1>
            <p class="muted">Your shop account has been created. Sign in with <strong>&#64;{{ username }}</strong> to add your vegetables, set prices and start taking orders.</p>
            <ol class="next">
              <li><span>1</span> Add your vegetables — your shop appears in the customer store list once it has at least one</li>
              <li><span>2</span> Check delivery charges and timings in Settings</li>
              <li><span>3</span> Share your storefront link with customers</li>
            </ol>
            <a class="btn btn-primary btn-lg btn-block" routerLink="/admin/login" [queryParams]="{ username: username, registered: 1 }">Sign in now <lucide-icon name="arrow-right" [size]="18" /></a>
          </div>
        }
      }
    </app-auth-layout>
  `,
  styles: `
    .head { margin-bottom: 18px; }
    .kicker { display: inline-block; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--leaf-600); margin-bottom: 8px; }
    h1 { font-size: 30px; margin-bottom: 6px; line-height: 1.15; }
    .steps { list-style: none; margin: 0 0 22px; padding: 0; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: var(--muted); }
    .steps li { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
    .steps li span { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--cream-200); color: var(--ink-2); font-size: 12px; }
    .steps li.active { color: var(--forest-900); }
    .steps li.active span { background: var(--forest-900); color: var(--white); }
    .steps li.done span { background: var(--leaf-600); color: var(--white); }
    .steps .bar { flex: 1; height: 2px; background: var(--line); border-radius: 2px; }
    .steps .bar.done { background: var(--leaf-600); }
    .steps em { font-style: normal; }
    @media (max-width: 520px) { .steps li:not(.active) em { display: none; } }
    .method { border: 1.5px solid var(--line); border-radius: 18px; background: var(--white); transition: border-color .2s; }
    .method.on { border-color: var(--leaf-500, var(--leaf-600)); }
    .m-head { display: flex; width: 100%; padding: 14px 16px; }
    .m-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14.5px; }
    .m-title small { font-size: 12.5px; flex-basis: 100%; margin-left: 26px; margin-top: -4px; }
    .m-body { display: flex; flex-direction: column; gap: 14px; padding: 0 16px 16px; }
    .qr-up { display: flex; gap: 14px; align-items: center; padding: 12px; border-radius: 14px; background: var(--cream-50); border: 1.5px dashed var(--line); }
    .qr-up.invalid { border-color: var(--danger); background: var(--danger-50); }
    .qr-box { width: 104px; height: 104px; border-radius: 12px; background: var(--white); border: 1px solid var(--line-2); display: grid; place-items: center; color: var(--muted); flex-shrink: 0; overflow: hidden; }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .qr-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .qr-text strong { font-size: 14px; }
    .qr-text small { font-size: 12px; line-height: 1.4; }
    .qr-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .qr-btns .disabled { opacity: .6; pointer-events: none; }
    .form { display: flex; flex-direction: column; gap: 20px; }
    .upper { text-transform: uppercase; }
    .upper::placeholder { text-transform: none; }
    .foot { text-align: center; font-size: 14px; }
    .link { color: var(--leaf-600); font-weight: 700; }
    .shop-sum { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: var(--white); border: 1px solid var(--line-2); }
    .shop-sum div { flex: 1; display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
    .shop-sum small { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ini { width: 42px; height: 42px; border-radius: 12px; background: var(--forest-900); color: var(--lime-300); display: grid; place-items: center; font-weight: 800; font-size: 18px; text-transform: uppercase; }
    .status { display: grid; place-items: center; width: 34px; height: 34px; }
    .spinner.sm { width: 16px; height: 16px; border-width: 2px; color: var(--muted); }
    .ok-ic { color: var(--leaf-600); } .bad-ic { color: var(--danger); }
    .hint.good { color: var(--leaf-600); font-weight: 700; }
    .pw { padding-right: 50px; }
    .eye { border: 0; background: none; width: 38px; height: 38px; display: grid; place-items: center; color: var(--muted); border-radius: 10px; }
    .meter { height: 6px; border-radius: 6px; background: var(--cream-200); overflow: hidden; }
    .meter span { display: block; height: 100%; border-radius: 6px; transition: width .3s var(--ease-out), background-color .3s; }
    .lvl1 { background: var(--danger); } .lvl2 { background: var(--amber); } .lvl3 { background: var(--lime-400); } .lvl4 { background: var(--leaf-600); }
    .rules { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; font-size: 12.5px; color: var(--muted); }
    .rules li { display: flex; align-items: center; gap: 6px; }
    .rules li.met { color: var(--leaf-600); font-weight: 600; }
    .row { display: flex; gap: 10px; } .grow { flex: 1; }
    .done { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .badge-ic { width: 76px; height: 76px; border-radius: 24px; background: var(--leaf-100); color: var(--leaf-600); display: grid; place-items: center; animation: pop .5s var(--ease-spring) both; }
    .next { list-style: none; margin: 8px 0 12px; padding: 16px; width: 100%; display: flex; flex-direction: column; gap: 12px; text-align: left; border-radius: 16px; background: var(--white); border: 1px solid var(--line-2); font-size: 14px; }
    .next li { display: flex; align-items: center; gap: 12px; }
    .next span { width: 26px; height: 26px; border-radius: 50%; background: var(--lime-400); color: var(--forest-950); display: grid; place-items: center; font-weight: 800; font-size: 12px; flex-shrink: 0; }
    @media (max-width: 480px) { .rules { grid-template-columns: 1fr; } }
  `,
})
export class AdminRegisterPage {
  private api = inject(AdminApi);
  private toast = inject(ToastService);

  readonly step = signal<1 | 2 | 3 | 4>(1);
  readonly stepLabels = ['Shop & owner', 'Payments', 'Login'];
  readonly copy = [
    { title: 'Tell us about your shop', text: 'These details verify your business and appear on invoices.' },
    { title: 'How will customers pay?', text: 'Upload the UPI QR you already use. Customers see it at checkout.' },
    { title: 'Create your login', text: 'You will use these credentials to sign in to the shop console.' },
  ];
  readonly qrUrl = signal<string | null>(null);
  readonly qrUploading = signal(false);
  pay = { acceptsUpi: true, upiId: '', upiPayeeName: '', acceptsCod: true };
  readonly busy = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly show = signal(false);
  readonly usernameState = signal<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  readonly pw = signal('');
  private uname = signal('');
  private checkTimer?: ReturnType<typeof setTimeout>;

  shop: ShopRegistrationDetails = { shopName: '', ownerName: '', email: '', phone: '', licenseNumber: '', gstNumber: '', addressLine: '', city: '', pincode: '' };
  username = '';
  password = '';
  confirm = '';

  readonly rules = computed(() => {
    const p = this.pw();
    const u = this.uname().toLowerCase();
    return [
      { label: 'At least 8 characters', met: p.length >= 8 },
      { label: 'An uppercase letter', met: /[A-Z]/.test(p) },
      { label: 'A lowercase letter', met: /[a-z]/.test(p) },
      { label: 'A number', met: /\d/.test(p) },
      { label: 'Does not contain username', met: !!p && (!u || !p.toLowerCase().includes(u)) },
    ];
  });
  readonly strength = computed(() => {
    const met = this.rules().filter((r) => r.met).length;
    return this.pw() ? Math.max(1, Math.min(4, met - 1)) : 0;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.checkTimer));
  }

  err(key: string) { return this.errors()[key]; }

  canSubmit() {
    return this.usernameState() === 'ok' && this.rules().every((r) => r.met) && this.password === this.confirm;
  }

  private validateShop(): Record<string, string> {
    const s = this.shop;
    const e: Record<string, string> = {};
    if (s.shopName.trim().length < 3) e['shopName'] = 'Enter your shop name.';
    if (s.ownerName.trim().length < 2) e['ownerName'] = "Enter the owner's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) e['email'] = 'Enter a valid email address.';
    if (!/^[6-9]\d{9}$/.test(s.phone.trim())) e['phone'] = 'Enter a valid 10-digit mobile number.';
    if (s.licenseNumber?.trim() && !/^[A-Za-z0-9\-/ ]{5,40}$/.test(s.licenseNumber.trim())) e['licenseNumber'] = "Licence number should be 5–40 letters, digits, '-' or '/'.";
    if (s.gstNumber?.trim() && !/^[0-9A-Za-z]{15}$/.test(s.gstNumber.trim())) e['gstNumber'] = 'GSTIN should be 15 letters or digits.';
    if (s.addressLine.trim().length < 5) e['addressLine'] = 'Enter the shop address.';
    if (s.city.trim().length < 2) e['city'] = 'Enter the city.';
    if (!/^\d{6}$/.test(s.pincode.trim())) e['pincode'] = 'Enter a valid 6-digit pincode.';
    return e;
  }

  private payload(): ShopRegistrationDetails {
    const s = this.shop;
    return {
      shopName: s.shopName.trim(), ownerName: s.ownerName.trim(), email: s.email.trim(), phone: s.phone.trim(),
      licenseNumber: s.licenseNumber?.trim() ? s.licenseNumber.trim().toUpperCase() : null, gstNumber: s.gstNumber?.trim() ? s.gstNumber.trim().toUpperCase() : null,
      addressLine: s.addressLine.trim(), city: s.city.trim(), pincode: s.pincode.trim(),
    };
  }

  /** Server errors may be keyed "shop.email" for nested fields; the form only needs the last segment. */
  private normalise(errors: Record<string, string>) {
    return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k.split('.').pop()!.replace(/^\w/, (c) => c.toLowerCase()), v]));
  }

  async next() {
    const e = this.validateShop();
    this.errors.set(e);
    if (Object.keys(e).length) return;
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.api.checkRegistration(this.payload()));
      if (!res.ok) { this.errors.set(this.normalise(res.errors)); return; }
      this.step.set(2);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const apiErr = toApiError(err);
      this.errors.set(this.normalise(fieldErrors(apiErr)));
      if (!Object.keys(this.errors()).length) this.toast.error(apiErr.title);
    } finally {
      this.busy.set(false);
    }
  }

  async onQr(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { this.toast.error('Please choose a JPG, PNG or WebP image of your QR code.'); return; }
    if (file.size > 5 * 1024 * 1024) { this.toast.error('That image is larger than 5 MB.'); return; }
    this.qrUploading.set(true);
    try {
      const res = await firstValueFrom(this.api.uploadRegistrationQr(file));
      this.qrUrl.set(res.url);
      const { upiQrUrl: _, ...rest } = this.errors();
      this.errors.set(rest);
    } catch (err) {
      this.toast.error(toApiError(err).title);
    } finally {
      this.qrUploading.set(false);
    }
  }

  private validatePayment(): Record<string, string> {
    const e: Record<string, string> = {};
    if (this.pay.acceptsUpi) {
      if (!this.qrUrl()) e['upiQrUrl'] = 'Upload your UPI QR code so customers can scan and pay.';
      if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(this.pay.upiId.trim())) e['upiId'] = 'Enter a valid UPI ID, e.g. shopname@okaxis.';
    }
    if (!this.pay.acceptsUpi && !this.pay.acceptsCod) e['acceptsCod'] = 'Turn on at least one way to get paid.';
    return e;
  }

  private paymentPayload(): ShopPaymentSetup {
    const upi = this.pay.acceptsUpi;
    return {
      acceptsUpi: upi,
      upiId: upi ? this.pay.upiId.trim() : null,
      upiPayeeName: upi && this.pay.upiPayeeName.trim() ? this.pay.upiPayeeName.trim() : null,
      upiQrUrl: upi ? this.qrUrl() : null,
      acceptsCod: this.pay.acceptsCod,
    };
  }

  nextPayment() {
    const e = this.validatePayment();
    this.errors.set(e);
    if (Object.keys(e).length) return;
    this.step.set(3);
    if (!this.username) {
      this.username = this.shop.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
      this.onUsername(this.username);
    }
    window.scrollTo({ top: 0 });
  }

  onUsername(value: string) {
    this.uname.set(value);
    const { username: _, ...rest } = this.errors();
    this.errors.set(rest);
    clearTimeout(this.checkTimer);
    const v = value.trim();
    if (!v) { this.usernameState.set('idle'); return; }
    if (!/^[a-zA-Z0-9_.]{4,30}$/.test(v)) { this.usernameState.set('invalid'); return; }
    this.usernameState.set('checking');
    this.checkTimer = setTimeout(async () => {
      try {
        const res = await firstValueFrom(this.api.usernameAvailable(v));
        if (this.username.trim() === v) this.usernameState.set(res.available ? 'ok' : 'taken');
      } catch {
        this.usernameState.set('idle');
      }
    }, 400);
  }

  async register() {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.register(this.payload(), this.paymentPayload(), this.username.trim(), this.password));
      this.password = this.confirm = '';
      this.step.set(4);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const apiErr = toApiError(err);
      const errors = this.normalise(fieldErrors(apiErr));
      this.errors.set(errors);
      if (SHOP_FIELDS.some((f) => errors[f])) this.step.set(1);
      else if (PAYMENT_FIELDS.some((f) => errors[f])) this.step.set(2);
      if (errors['username']) this.usernameState.set('taken');
      this.toast.error(apiErr.title);
    } finally {
      this.busy.set(false);
    }
  }
}
