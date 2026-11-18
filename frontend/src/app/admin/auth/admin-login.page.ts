import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AdminApi, toApiError } from '../../core/api';
import { AdminAuth } from '../../core/auth';
import { ToastService } from '../../core/toast.service';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule, RouterLink, LucideAngularModule, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      <form class="form page-enter" (ngSubmit)="submit()" autocomplete="on">
        <div class="head">
          <span class="kicker">Shop console</span>
          <h1 class="display">Welcome back</h1>
          <p class="muted">Sign in to manage your products, stock and orders.</p>
        </div>

        @if (registered()) {
          <div class="ok"><lucide-icon name="badge-check" [size]="18" /> Your shop is registered. Sign in with your new credentials.</div>
        }

        <div class="field">
          <label class="label" for="username">Username</label>
          <input id="username" class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" [(ngModel)]="username" required />
        </div>
        <div class="field">
          <label class="label" for="password">Password</label>
          <div class="input-group">
            <input id="password" class="input pw" name="password" [type]="show() ? 'text' : 'password'" autocomplete="current-password" [(ngModel)]="password" required />
            <button type="button" class="suffix eye" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
              <lucide-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" />
            </button>
          </div>
        </div>

        @if (error()) { <div class="err"><lucide-icon name="circle-alert" [size]="16" /> {{ error() }}</div> }

        <button class="btn btn-primary btn-lg btn-block" type="submit" [disabled]="busy() || !username.trim() || !password">
          @if (busy()) { <span class="spinner"></span> } Sign in
        </button>

        <div class="register">
          <span class="muted">New shop on Fresh n Healthy?</span>
          <a routerLink="/admin/register" class="link">Register your shop <lucide-icon name="arrow-right" [size]="15" /></a>
        </div>
      </form>
    </app-auth-layout>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 18px; }
    .head { margin-bottom: 4px; }
    .kicker { display: inline-block; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--leaf-600); margin-bottom: 8px; }
    h1 { font-size: 34px; margin-bottom: 6px; }
    .pw { padding-right: 50px; }
    .eye { border: 0; background: none; width: 38px; height: 38px; display: grid; place-items: center; color: var(--muted); border-radius: 10px; }
    .ok { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--leaf-50); color: var(--leaf-600); font-weight: 600; font-size: 13.5px; }
    .err { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--danger-50); color: var(--danger); font-weight: 600; font-size: 13.5px; }
    .register { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding-top: 18px; border-top: 1px solid var(--line-2); font-size: 14px; }
    .link { color: var(--leaf-600); font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
  `,
})
export class AdminLoginPage implements OnInit {
  readonly returnUrl = input<string | undefined>();
  readonly prefill = input<string | undefined>(undefined, { alias: 'username' });
  readonly registeredFlag = input<string | undefined>(undefined, { alias: 'registered' });
  private api = inject(AdminApi);
  private auth = inject(AdminAuth);
  private router = inject(Router);
  private toast = inject(ToastService);

  username = '';
  password = '';
  readonly show = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly registered = signal(false);

  ngOnInit() {
    this.username = this.prefill() ?? '';
    this.registered.set(this.registeredFlag() === '1');
  }

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.login(this.username.trim(), this.password));
      this.auth.set(res);
      this.toast.success(`Welcome, ${res.admin.fullName.split(' ')[0]}`);
      const back = this.returnUrl() ?? '';
      const target = res.admin.role === 'SuperAdmin' ? '/admin/platform'
        : back.startsWith('/admin') && !back.startsWith('/admin/login') && !back.startsWith('/admin/platform') ? back : '/admin';
      this.router.navigateByUrl(target);
    } catch (e) {
      this.error.set(toApiError(e).title);
      this.password = '';
    } finally {
      this.busy.set(false);
    }
  }
}
