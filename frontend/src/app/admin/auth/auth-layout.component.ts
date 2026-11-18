import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** Split-screen frame shared by the shop console's sign-in and registration screens. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink, LucideAngularModule],
  template: `
    <div class="auth">
      <aside class="visual">
        <img src="hero/auth-bg.jpg" alt="" />
        <div class="scrim"></div>
        <div class="v-top">
          <span class="logo"><lucide-icon name="leaf" [size]="18" [strokeWidth]="2.5" /></span>
          <strong>Fresh n Healthy</strong>
          <span class="tag">Shop console</span>
        </div>
        <div class="v-copy">
          <h2 class="display">{{ headline() }}</h2>
          <ul>
            <li><lucide-icon name="check-circle-2" [size]="18" /> Update prices and stock in seconds</li>
            <li><lucide-icon name="check-circle-2" [size]="18" /> Orders arrive live — no refresh needed</li>
            <li><lucide-icon name="check-circle-2" [size]="18" /> Accept UPI and cash on delivery</li>
          </ul>
        </div>
      </aside>
      <main class="panel">
        <a routerLink="/" class="back"><lucide-icon name="arrow-left" [size]="16" /> Storefront</a>
        <div class="inner" [class.wide]="wide()"><ng-content /></div>
      </main>
    </div>
  `,
  styles: `
    .auth { min-height: 100svh; display: flex; background: var(--cream-50); }
    .visual { display: none; position: relative; flex: 1; overflow: hidden; color: var(--white); }
    .visual img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .scrim { position: absolute; inset: 0; background: linear-gradient(160deg, rgba(12,33,22,.35), rgba(12,33,22,.88)); }
    .v-top { position: absolute; top: 32px; left: 40px; display: flex; align-items: center; gap: 10px; }
    .v-top strong { font-family: var(--font-display); font-size: 19px; }
    .logo { width: 38px; height: 38px; border-radius: 12px; background: var(--lime-400); color: var(--forest-950); display: grid; place-items: center; }
    .tag { font-size: 12px; padding: 4px 10px; border-radius: 99px; background: rgba(255,255,255,.14); }
    .v-copy { position: absolute; left: 40px; right: 40px; bottom: 48px; }
    .v-copy h2 { color: var(--white); font-size: 40px; line-height: 1.1; max-width: 520px; margin-bottom: 20px; }
    .v-copy ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; font-size: 15px; opacity: .92; }
    .v-copy li { display: flex; align-items: center; gap: 10px; }
    .v-copy lucide-icon { color: var(--lime-400); }
    .panel { flex: 1; display: flex; flex-direction: column; padding: 20px; position: relative; }
    .back { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; color: var(--muted); }
    .inner { width: 100%; max-width: 420px; margin: auto; padding: 28px 0; }
    .inner.wide { max-width: 560px; }
    @media (min-width: 1000px) {
      .visual { display: block; }
      .panel { flex: 0 0 min(640px, 48vw); padding: 28px 48px; }
    }
  `,
})
export class AuthLayoutComponent {
  readonly headline = input('Run your vegetable shop from your phone.');
  readonly wide = input(false);
}
