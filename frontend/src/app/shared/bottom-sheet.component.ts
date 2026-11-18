import { Component, HostListener, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** Mobile bottom sheet that becomes a centered dialog on larger screens. */
@Component({
  selector: 'app-bottom-sheet',
  imports: [LucideAngularModule],
  template: `
    @if (rendered()) {
      <div class="backdrop" [class.closing]="closing()" (click)="close.emit()"></div>
      <section class="sheet" [class.closing]="closing()" [class.wide]="wide()" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <div class="grabber" aria-hidden="true"></div>
        <header class="head">
          <div>
            <h2 class="display">{{ title() }}</h2>
            @if (subtitle()) { <p class="muted sub">{{ subtitle() }}</p> }
          </div>
          <button class="icon-btn" type="button" (click)="close.emit()" aria-label="Close"><lucide-icon name="x" [size]="18" /></button>
        </header>
        <div class="content"><ng-content /></div>
        <footer class="foot"><ng-content select="[sheet-footer]" /></footer>
      </section>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(12, 33, 22, 0.42); backdrop-filter: blur(2px); z-index: 90; animation: fade-in 0.25s ease both; }
    .backdrop.closing { animation: fade-in 0.2s ease reverse both; }
    .sheet {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 91; max-height: 88svh; display: flex; flex-direction: column;
      background: var(--cream-50); border-radius: 28px 28px 0 0; box-shadow: var(--shadow-lg);
      animation: sheet-in 0.42s var(--ease-out) both; padding-bottom: var(--safe-bottom);
    }
    .sheet.closing { animation: sheet-out 0.22s ease-in both; }
    @keyframes sheet-in { from { transform: translateY(100%); } to { transform: none; } }
    @keyframes sheet-out { to { transform: translateY(100%); } }
    .grabber { width: 42px; height: 5px; border-radius: 9px; background: var(--cream-300); margin: 10px auto 2px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 8px 20px 12px; }
    .head h2 { font-size: 22px; }
    .sub { font-size: 13px; margin-top: 2px; }
    .content { overflow-y: auto; padding: 0 20px; flex: 1; overscroll-behavior: contain; }
    .foot:not(:empty) { padding: 14px 20px 18px; border-top: 1px solid var(--line-2); background: var(--white); }
    @media (min-width: 768px) {
      .sheet { left: 50%; right: auto; bottom: auto; top: 50%; width: min(520px, calc(100vw - 48px)); max-height: 84vh; border-radius: 28px; transform: translate(-50%, -50%); animation: dialog-in 0.32s var(--ease-out) both; padding-bottom: 0; overflow: hidden; }
      .sheet.wide { width: min(640px, calc(100vw - 48px)); }
      .sheet.closing { animation: dialog-out 0.18s ease-in both; }
      .grabber { display: none; }
      .head { padding-top: 22px; }
      @keyframes dialog-in { from { opacity: 0; transform: translate(-50%, -46%) scale(0.98); } to { opacity: 1; transform: translate(-50%, -50%); } }
      @keyframes dialog-out { to { opacity: 0; transform: translate(-50%, -48%) scale(0.98); } }
    }
  `,
})
export class BottomSheetComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input<string | null>(null);
  readonly wide = input(false);
  readonly close = output<void>();

  readonly rendered = signal(false);
  readonly closing = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.closing.set(false);
        this.rendered.set(true);
        document.body.style.overflow = 'hidden';
      } else if (this.rendered()) {
        this.closing.set(true);
        document.body.style.overflow = '';
        setTimeout(() => { this.rendered.set(false); this.closing.set(false); }, 220);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.open()) this.close.emit(); }
}
