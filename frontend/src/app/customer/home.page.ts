import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ShopStore } from '../core/shop.store';
import { ProductCardComponent } from '../shared/product-card.component';
import { EmptyStateComponent } from '../shared/ui.components';

@Component({
  selector: 'app-home',
  imports: [RouterLink, LucideAngularModule, ProductCardComponent, EmptyStateComponent],
  template: `
    <section class="hero container">
      <div class="slider" role="region" aria-roledescription="carousel" aria-label="Fresh vegetables"
        (touchstart)="touchStart($event)" (touchend)="touchEnd($event)" (mouseenter)="paused = true" (mouseleave)="paused = false">
        @for (s of slides; track s.src; let i = $index) {
          @if (i < loaded()) {
            <img class="slide" [class.active]="i === active()" [src]="s.src" [alt]="s.alt" [attr.aria-hidden]="i !== active()"
              [attr.fetchpriority]="i === 0 ? 'high' : null" />
          }
        }
        <div class="scrim"></div>
        <div class="copy">
          @for (s of slides; track s.src; let i = $index) {
            @if (i === active()) {
              <span class="eyebrow" aria-live="polite"><lucide-icon name="leaf" [size]="14" [strokeWidth]="2.5" /> {{ s.tag }}</span>
            }
          }
          <h1 class="display">Fresh from the Farm <span>to Your Home</span></h1>
          <p>Hand-picked vegetables from local growers, delivered to your door in {{ shop()?.deliveryEta ?? '30-45 min' }}.</p>
          <button class="btn btn-lime btn-lg explore" type="button" (click)="explore()">
            Explore Vegetables <lucide-icon name="arrow-right" [size]="18" [strokeWidth]="2.5" />
          </button>
        </div>
      </div>

      <ul class="perks">
        <li><span class="ic"><lucide-icon name="bike" [size]="18" /></span><div><strong>{{ shop()?.deliveryEta ?? '30-45 min' }}</strong><small>Doorstep delivery</small></div></li>
        <li><span class="ic"><lucide-icon name="leaf" [size]="18" /></span><div><strong>Farm fresh</strong><small>Restocked daily</small></div></li>
        <li><span class="ic"><lucide-icon name="wallet" [size]="18" /></span><div><strong>UPI or cash</strong><small>Pay your way</small></div></li>
      </ul>
    </section>

    @if (shop() && !shop()!.isOpen) {
      <div class="container">
        <div class="closed card">
          <lucide-icon name="clock" [size]="20" />
          <div><strong>{{ shop()!.name }} is closed right now.</strong><p>You can browse and fill your basket — ordering resumes when the store reopens.</p></div>
        </div>
      </div>
    }

    <section class="catalog" #catalog id="vegetables">
      <div class="tools">
        <div class="container tools-inner">
          <label class="search">
            <lucide-icon name="search" [size]="18" />
            <input type="search" placeholder="Search tomatoes, spinach, carrots…" [value]="query()" (input)="query.set($any($event.target).value)" aria-label="Search vegetables" />
            @if (query()) { <button type="button" class="clear" (click)="query.set('')" aria-label="Clear search"><lucide-icon name="x" [size]="16" /></button> }
          </label>
          <div class="chips no-scrollbar" role="tablist" aria-label="Categories">
            <button class="chip" role="tab" [class.active]="category() === 'all'" (click)="category.set('all')">All Vegetables</button>
            @for (c of store.categories(); track c.id) {
              <button class="chip" role="tab" [class.active]="category() === c.slug" (click)="category.set(c.slug)">{{ c.name }}</button>
            }
          </div>
        </div>
      </div>

      <div class="container">
        <div class="section-head">
          <div>
            <h2 class="display">{{ heading() }}</h2>
            <p class="muted">{{ store.loading() ? 'Loading fresh stock…' : filtered().length + ' vegetables · prices per unit, updated live' }}</p>
          </div>
          @if (soldOutCount() > 0) { <span class="badge">{{ soldOutCount() }} sold out today</span> }
        </div>

        @if (store.error()) {
          <app-empty-state icon="circle-alert" title="We couldn't load the store" [message]="store.error()">
            <button class="btn btn-dark" (click)="retry()"><lucide-icon name="refresh-cw" [size]="16" /> Try again</button>
          </app-empty-state>
        } @else if (store.loading()) {
          <div class="grid">
            @for (i of skeletons; track i) {
              <div class="sk card"><div class="skeleton img"></div><div class="skeleton l1"></div><div class="skeleton l2"></div><div class="skeleton l3"></div></div>
            }
          </div>
        } @else if (store.products().length === 0) {
          <app-empty-state icon="store" title="No vegetables yet" message="This store is still setting up. Check back soon or pick another store nearby.">
            <a class="btn btn-outline" routerLink="/stores">Browse stores</a>
          </app-empty-state>
        } @else if (filtered().length === 0) {
          <app-empty-state icon="search" title="No vegetables found" [message]="query() ? 'Nothing matches “' + query() + '”. Try another name.' : 'This category is empty right now.'">
            <button class="btn btn-outline" (click)="query.set(''); category.set('all')">Show all vegetables</button>
          </app-empty-state>
        } @else {
          <div class="grid">
            @for (p of filtered(); track p.id; let i = $index) {
              <app-product-card class="cell" [product]="p" [style.animation-delay.ms]="i < 12 ? i * 35 : 0" />
            }
          </div>
        }

        @if (store.shops().length > 1) {
          <a routerLink="/stores" class="other-stores card">
            <span class="ic"><lucide-icon name="store" [size]="20" /></span>
            <span><strong>{{ store.shops().length }} stores near you</strong><small>Compare prices and stock across local shops</small></span>
            <lucide-icon name="chevron-right" [size]="18" />
          </a>
        }
      </div>
    </section>
  `,
  styles: `
    .hero { padding-top: 12px; }
    .slider { position: relative; overflow: hidden; border-radius: var(--r-xl); background: var(--forest-900); height: clamp(400px, 60svh, 580px); animation: fade-up 0.6s var(--ease-out) backwards; touch-action: pan-y; }
    .slide { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.08); transition: opacity 1s ease, transform 6s ease-out; }
    .slide.active { opacity: 1; transform: scale(1); }
    .scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,33,22,0) 30%, rgba(12,33,22,.55) 62%, rgba(12,33,22,.88) 100%); }
    .copy { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 20px 46px; color: var(--white); display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
    .eyebrow { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border-radius: 99px; background: rgba(255,255,255,.16); backdrop-filter: blur(8px); font-size: 12px; font-weight: 700; letter-spacing: .02em; border: 1px solid rgba(255,255,255,.22); animation: fade-up .4s var(--ease-out) backwards; }
    @media (prefers-reduced-motion: reduce) { .slide { transition: opacity .3s; transform: none; } .slide.active { transform: none; } }
    .copy h1 { color: var(--white); font-size: clamp(32px, 9vw, 58px); line-height: 1.02; letter-spacing: -0.03em; }
    .copy h1 span { display: block; color: var(--lime-300); font-style: italic; font-weight: 500; }
    .copy p { font-size: 14.5px; color: rgba(255,255,255,.86); max-width: 420px; }
    .explore { margin-top: 6px; box-shadow: 0 10px 26px rgba(0,0,0,.25); }

    .perks { list-style: none; margin: 14px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .perks li { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 18px; background: var(--white); border: 1px solid var(--line-2); }
    .perks .ic { width: 34px; height: 34px; border-radius: 11px; background: var(--leaf-100); color: var(--leaf-600); display: grid; place-items: center; }
    .perks div { display: flex; flex-direction: column; line-height: 1.25; }
    .perks strong { font-size: 13px; color: var(--forest-900); }
    .perks small { font-size: 11.5px; color: var(--muted); }

    .closed { margin-top: 16px; display: flex; gap: 12px; padding: 14px 16px; background: var(--amber-50); border-color: #f2dcb3; color: #7a4f08; }
    .closed p { font-size: 13px; margin-top: 2px; }

    .catalog { margin-top: 18px; scroll-margin-top: 0; }
    .tools { position: sticky; top: 64px; z-index: 40; padding: 10px 0 10px; background: rgba(251,248,241,.92); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    .tools-inner { display: flex; flex-direction: column; gap: 10px; }
    .search { display: flex; align-items: center; gap: 10px; height: 50px; padding: 0 14px; border-radius: 16px; background: var(--white); border: 1.5px solid var(--line); color: var(--muted); transition: border-color .2s, box-shadow .2s; }
    .search:focus-within { border-color: var(--leaf-600); box-shadow: 0 0 0 4px rgba(46,125,62,.12); }
    .search input { flex: 1; border: 0; outline: 0; background: transparent; font-size: 15px; color: var(--ink); min-width: 0; }
    .search input::-webkit-search-cancel-button { display: none; }
    .clear { border: 0; background: var(--cream-200); width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: var(--ink-2); }
    .chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px; padding: 0 16px; scroll-snap-type: x proximity; }
    .chips .chip { scroll-snap-align: start; }

    .section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin: 10px 0 14px; }
    .section-head h2 { font-size: 26px; }
    .section-head p { font-size: 13px; margin-top: 2px; }

    .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cell { animation: fade-up 0.45s var(--ease-out) backwards; }
    .sk { padding: 8px; display: flex; flex-direction: column; gap: 10px; border-radius: 22px; }
    .sk .img { aspect-ratio: 1 / 0.86; border-radius: 16px; }
    .sk .l1 { height: 16px; width: 70%; } .sk .l2 { height: 20px; width: 45%; } .sk .l3 { height: 42px; border-radius: 99px; margin-top: 8px; }

    .other-stores { margin-top: 28px; display: flex; align-items: center; gap: 14px; padding: 16px 18px; }
    .other-stores .ic { width: 44px; height: 44px; border-radius: 14px; background: var(--forest-900); color: var(--lime-400); display: grid; place-items: center; flex-shrink: 0; }
    .other-stores span:nth-child(2) { flex: 1; display: flex; flex-direction: column; }
    .other-stores small { color: var(--muted); font-size: 13px; }
    @media (min-width: 640px) {
      .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    }
    @media (min-width: 768px) {
      .hero { padding-top: 20px; }
      .slider { height: clamp(440px, 64vh, 600px); }
      .copy { padding: 40px 40px 60px; gap: 14px; }
      .copy p { font-size: 16px; }
      .perks { grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
      .perks li { flex-direction: row; align-items: center; padding: 16px 18px; }
      .perks strong { font-size: 14.5px; } .perks small { font-size: 12.5px; }
      .tools-inner { flex-direction: row; align-items: center; }
      .search { flex: 0 0 340px; }
      .chips { margin: 0; padding: 0; flex: 1; }
      .section-head h2 { font-size: 32px; }
    }
    @media (min-width: 900px) { .tools { top: 72px; } }
    @media (min-width: 1024px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; } }
    @media (min-width: 1280px) { .grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
  `,
})
export class HomePage {
  protected store = inject(ShopStore);
  protected shop = this.store.shop;
  private catalog = viewChild<ElementRef<HTMLElement>>('catalog');

  /** Each slide stays up for this long; the timer pauses while hovered and never runs under reduced motion. */
  readonly interval = 3500;
  readonly slides = [
    { src: 'hero/hero-main.jpg', tag: 'Harvested this morning', alt: 'A wooden crate of freshly harvested tomatoes, peppers, chillies and brinjals in a farm field' },
    { src: 'hero/hero-tomato-chilli.jpg', tag: 'Picked ripe, packed fresh', alt: 'A basket of ripe tomatoes, green chillies, brinjals and capsicum' },
    { src: 'hero/hero-greens.jpg', tag: 'Leafy greens, picked at dawn', alt: 'Bunches of fresh leafy greens at a market' },
    { src: 'hero/hero-market-baskets.jpg', tag: 'Straight from the mandi', alt: 'Baskets of tomatoes, beans, chillies and spring onions at a vegetable market' },
    { src: 'hero/hero-peppers.jpg', tag: 'Crisp, colourful capsicum', alt: 'A heap of red, yellow and green bell peppers' },
    { src: 'hero/hero-tomato.jpg', tag: 'Vine-ripened & juicy', alt: 'Dew-covered ripe tomatoes on the vine' },
    { src: 'hero/hero-market-bowls.jpg', tag: 'Your local market, online', alt: 'Bowls of carrots, potatoes, chillies and beans at a market stall' },
    { src: 'hero/hero-spinach.jpg', tag: 'Tender spinach & palak', alt: 'Close-up of fresh dark green spinach leaves' },
    { src: 'hero/hero-market-top.jpg', tag: 'Grown by local farmers', alt: 'Tomatoes, carrots, beans, brinjals and greens laid out at a vegetable market' },
    { src: 'hero/hero-harvest-basket.jpg', tag: 'Seasonal harvest, every day', alt: 'A wicker basket of carrots, corn, pumpkin and greens' },
  ];
  readonly active = signal(0);
  /** Slides are mounted one ahead of the active one so the other images only download when they're about to show. */
  readonly loaded = signal(2);
  paused = false;
  private changedAt = Date.now();
  private touchX: number | null = null;

  constructor() {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (!this.paused && !document.hidden && Date.now() - this.changedAt >= this.interval) this.next();
    }, 250);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly query = signal('');
  readonly category = signal('all');
  readonly skeletons = Array.from({ length: 8 }, (_, i) => i);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.store.products().filter(
      (p) => (cat === 'all' || p.categorySlug === cat) && (!q || p.name.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q)),
    );
  });

  readonly soldOutCount = computed(() => this.store.products().filter((p) => p.stockQuantity < p.minOrderQuantity).length);

  readonly heading = computed(() => {
    if (this.query()) return 'Search results';
    const cat = this.store.categories().find((c) => c.slug === this.category());
    return cat ? cat.name : 'Fresh today';
  });

  go(i: number) {
    const n = (i + this.slides.length) % this.slides.length;
    this.active.set(n);
    this.loaded.update((l) => Math.min(this.slides.length, Math.max(l, n + 2)));
    this.changedAt = Date.now();
  }
  next() { this.go(this.active() + 1); }

  touchStart(e: TouchEvent) { this.touchX = e.touches[0]?.clientX ?? null; }
  touchEnd(e: TouchEvent) {
    const end = e.changedTouches[0]?.clientX;
    if (this.touchX === null || end === undefined) return;
    const dx = end - this.touchX;
    this.touchX = null;
    if (Math.abs(dx) > 40) this.go(this.active() + (dx < 0 ? 1 : -1));
  }

  explore() {
    this.catalog()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  retry() {
    void this.store.init();
  }
}
