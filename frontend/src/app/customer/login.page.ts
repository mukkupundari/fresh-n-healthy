import { Component, ElementRef, OnDestroy, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CustomerApi, toApiError } from '../core/api';
import { CustomerAuth } from '../core/auth';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="wrap">
      <div class="visual">
        <img src="hero/hero-greens.jpg" alt="" />
        <div class="scrim"></div>
        <a routerLink="/" class="close icon-btn" aria-label="Close"><lucide-icon name="x" [size]="18" /></a>
        <div class="visual-copy">
          <span class="logo"><lucide-icon name="leaf" [size]="20" [strokeWidth]="2.5" /></span>
          <h2 class="display">Fresh n Healthy</h2>
          <p>Farm-fresh vegetables from trusted local stores.</p>
        </div>
      </div>

      <div class="panel">
        @if (step() === 'phone') {
          <form class="form page-enter" (ngSubmit)="sendCode()">
            <h1 class="display">Sign in with your mobile</h1>
            <p class="muted">We'll send a 6-digit code to verify your number. No passwords to remember.</p>
            <div class="field">
              <label class="label" for="phone">Mobile number</label>
              <div class="input-group">
                <span class="prefix">+91</span>
                <input id="phone" class="input has-prefix phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10"
                  placeholder="98765 43210" [(ngModel)]="phone" [class.invalid]="phoneError()" autofocus />
              </div>
              @if (phoneError()) { <span class="error-text">{{ phoneError() }}</span> }
            </div>
            <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy()">
              @if (busy()) { <span class="spinner"></span> } Continue <lucide-icon name="arrow-right" [size]="18" />
            </button>
            <p class="fine muted"><lucide-icon name="shield-check" [size]="14" /> Your number is only shared with the store you order from.</p>          </form>
        } @else {
          <form class="form page-enter" (ngSubmit)="verify()">
            <button type="button" class="back" (click)="step.set('phone')"><lucide-icon name="arrow-left" [size]="16" /> Change number</button>
            <h1 class="display">Enter the code</h1>
            <p class="muted">Sent to <strong>+91 {{ phone }}</strong></p>

            @if (devCode()) {
              <div class="dev">
                <lucide-icon name="info" [size]="16" />
                <span>Development mode — your code is <strong>{{ devCode() }}</strong></span>
                <button type="button" class="btn btn-sm btn-outline" (click)="code = devCode()!">Use code</button>
              </div>
            }

            <div class="field">
              <label class="label" for="otp">6-digit code</label>
              <input #otp id="otp" class="input otp tabular" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
                placeholder="••••••" [(ngModel)]="code" />
            </div>

            @if (isNewUser()) {
              <div class="field">
                <label class="label" for="name">Your name</label>
                <input id="name" class="input" name="name" autocomplete="name" placeholder="e.g. Priya Sharma" [(ngModel)]="name" />
                <span class="hint">Looks like you're new here — welcome! We'll use this for your deliveries.</span>
              </div>
            }

            @if (error()) { <div class="error-box"><lucide-icon name="circle-alert" [size]="16" /> {{ error() }}</div> }

            <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy() || code.length !== 6">
              @if (busy()) { <span class="spinner"></span> } Verify &amp; continue
            </button>
            <button type="button" class="resend" [disabled]="countdown() > 0 || busy()" (click)="sendCode()">
              {{ countdown() > 0 ? 'Resend code in ' + countdown() + 's' : 'Resend code' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100svh; display: flex; flex-direction: column; background: var(--cream-50); }
    .visual { position: relative; height: 34svh; min-height: 220px; overflow: hidden; }
    .visual img { width: 100%; height: 100%; object-fit: cover; }
    .scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,33,22,.15), rgba(12,33,22,.75)); }
    .close { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); right: 14px; background: rgba(255,255,255,.9); border: 0; }
    .visual-copy { position: absolute; left: 22px; bottom: 44px; color: var(--white); }
    .logo { width: 42px; height: 42px; border-radius: 13px; background: var(--lime-400); color: var(--forest-950); display: grid; place-items: center; margin-bottom: 10px; }
    .visual-copy h2 { color: var(--white); font-size: 28px; }
    .visual-copy p { opacity: .85; font-size: 14px; }
    .panel { flex: 1; margin-top: -24px; position: relative; background: var(--cream-50); border-radius: 28px 28px 0 0; padding: 28px 20px 32px; }
    .form { display: flex; flex-direction: column; gap: 16px; max-width: 420px; margin: 0 auto; }
    h1 { font-size: 28px; }
    .phone { font-size: 18px; letter-spacing: .04em; font-weight: 600; height: 56px; }
    .otp { height: 64px; font-size: 30px; letter-spacing: .5em; text-align: center; font-weight: 700; padding-left: calc(14px + .25em); }
    .fine { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
    .back { align-self: flex-start; border: 0; background: none; display: inline-flex; align-items: center; gap: 6px; color: var(--leaf-600); font-weight: 700; padding: 0; }
    .dev { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; background: var(--sky-50); color: var(--sky); font-size: 13.5px; flex-wrap: wrap; }
    .dev span { flex: 1; }
    .error-box { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 14px; background: var(--danger-50); color: var(--danger); font-weight: 600; font-size: 13.5px; }
    .resend { border: 0; background: none; color: var(--leaf-600); font-weight: 700; padding: 6px; }
    .resend:disabled { color: var(--muted); cursor: default; }
    @media (min-width: 900px) {
      .wrap { flex-direction: row; }
      .visual { flex: 1; height: auto; }
      .visual-copy { left: 48px; bottom: 48px; } .visual-copy h2 { font-size: 44px; }
      .panel { flex: 0 0 520px; margin: 0; border-radius: 0; display: flex; align-items: center; padding: 48px; }
      .close { left: 20px; right: auto; }
    }
  `,
})
export class LoginPage implements OnDestroy {
  readonly returnUrl = input<string | undefined>();
  private api = inject(CustomerApi);
  private auth = inject(CustomerAuth);
  private router = inject(Router);
  private toast = inject(ToastService);
  private otpInput = viewChild<ElementRef<HTMLInputElement>>('otp');

  phone = '';
  code = '';
  name = '';
  readonly step = signal<'phone' | 'otp'>('phone');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly phoneError = signal<string | null>(null);
  readonly devCode = signal<string | null>(null);
  readonly isNewUser = signal(false);
  readonly countdown = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  readonly safeReturn = computed(() => {
    const url = this.returnUrl();
    return url?.startsWith('/') && !url.startsWith('//') ? url : '/';
  });

  async sendCode() {
    this.phone = this.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(this.phone)) { this.phoneError.set('Enter a valid 10-digit Indian mobile number.'); return; }
    this.phoneError.set(null);
    this.error.set(null);
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.api.requestOtp(this.phone));
      this.devCode.set(res.devCode);
      this.isNewUser.set(res.isNewUser);
      this.code = '';
      this.step.set('otp');
      this.startCountdown();
      setTimeout(() => this.otpInput()?.nativeElement.focus(), 50);
    } catch (e) {
      this.phoneError.set(toApiError(e).title);
    } finally {
      this.busy.set(false);
    }
  }

  async verify() {
    if (this.isNewUser() && this.name.trim().length < 2) { this.error.set('Please enter your name.'); return; }
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.verifyOtp(this.phone, this.code, this.name.trim() || null));
      this.auth.set(res);
      this.toast.success(`Welcome${this.isNewUser() ? '' : ' back'}, ${res.customer.name.split(' ')[0]}!`);
      this.router.navigateByUrl(this.safeReturn());
    } catch (e) {
      const err = toApiError(e);
      if (err.code === 'name_required') this.isNewUser.set(true);
      this.error.set(err.title);
    } finally {
      this.busy.set(false);
    }
  }

  private startCountdown() {
    clearInterval(this.timer);
    this.countdown.set(30);
    this.timer = setInterval(() => {
      this.countdown.update((n) => Math.max(0, n - 1));
      if (this.countdown() === 0) clearInterval(this.timer);
    }, 1000);
  }

  ngOnDestroy() { clearInterval(this.timer); }
}
