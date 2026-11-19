import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ServerStatus } from './core/wake';
import { ToastsComponent } from './shared/ui.components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastsComponent],
  template: `
    <router-outlet /><app-toasts />
    @if (server.waking()) {
      <div class="waking" role="status"><span class="spin"></span>Waking up the store — this can take up to a minute…</div>
    }
  `,
  styles: `
    .waking {
      position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); z-index: 200;
      display: flex; align-items: center; gap: 10px; width: max-content; max-width: calc(100vw - 24px);
      padding: 10px 16px; border-radius: 99px; background: var(--forest-900); color: var(--white);
      font-size: 13px; font-weight: 600; box-shadow: var(--shadow-md, 0 8px 24px rgba(0,0,0,.18));
    }
    .spin { width: 14px; height: 14px; flex-shrink: 0; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: var(--lime-400); animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class AppComponent {
  protected server = inject(ServerStatus);

  constructor() {
    this.server.ping();
  }
}
