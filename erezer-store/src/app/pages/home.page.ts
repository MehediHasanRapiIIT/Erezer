import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ApiBanner, ApiProduct } from '../core/api.models';
import { ProductCardComponent } from '../components/shared/product-card.component';
import { RecentlyViewedComponent } from '../components/shared/recently-viewed.component';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { EcommerceStore } from '../core/store/ecommerce.store';

@Component({
  standalone: true,
  imports: [RouterLink, ProductCardComponent, FormsModule, RecentlyViewedComponent, TranslatePipe],
  template: `
    <!-- ── Banner carousel ─────────────────────────────────────────────────── -->
    <section class="app-card mb-14 overflow-hidden rounded-3xl">
      <div
        class="flex transition-transform duration-700 ease-out"
        [style.transform]="'translateX(-' + activeBanner() * 100 + '%)'"
      >
        @for (banner of displayBanners(); track banner.id) {
          <article class="grid w-full shrink-0 gap-10 p-8 md:grid-cols-2 md:items-center md:p-12">
            <div class="space-y-5">
              <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                {{ banner.label }}
              </p>
              <h1 class="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                {{ banner.title }}
              </h1>
              <p class="max-w-md text-neutral-600 dark:text-neutral-300">{{ banner.description }}</p>
              <div class="flex flex-wrap items-center gap-3">
                <a routerLink="/shop" class="btn-primary">Shop collection</a>
                <a routerLink="/shop" class="btn-secondary">Explore new arrivals</a>
              </div>
            </div>
            <img
              [src]="banner.image"
              [alt]="banner.title"
              class="h-80 w-full rounded-2xl object-cover md:h-[28rem]"
            />
          </article>
        }
      </div>

      <!-- dots -->
      <div class="flex justify-center gap-2 pb-6">
        @for (banner of displayBanners(); track banner.id; let i = $index) {
          <button
            type="button"
            class="h-2.5 w-2.5 rounded-full transition-all"
            [class.w-8]="activeBanner() === i"
            [class.bg-black]="activeBanner() === i"
            [class.dark:bg-white]="activeBanner() === i"
            [class.bg-neutral-300]="activeBanner() !== i"
            [class.dark:bg-neutral-700]="activeBanner() !== i"
            (click)="activeBanner.set(i)"
            [attr.aria-label]="'Go to banner ' + (i + 1)"
          ></button>
        }
      </div>
    </section>

    <!-- ── Highlights ──────────────────────────────────────────────────────── -->
    <section class="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      @for (item of highlights; track item.title) {
        <article class="app-card p-5">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
            {{ item.title }}
          </p>
          <p class="mt-2 text-lg font-semibold tracking-tight">{{ item.value }}</p>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{{ item.description }}</p>
        </article>
      }
    </section>

    <!-- ── Featured products ───────────────────────────────────────────────── -->
    <section class="space-y-6">
      <div class="flex items-end justify-between">
        <h2 class="app-section-title text-2xl">Featured products</h2>
        <a routerLink="/shop" class="text-sm font-medium underline underline-offset-4">View all products</a>
      </div>

      @if (loading()) {
        <p class="app-muted">Loading products…</p>
      } @else {
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (product of featuredApiProducts(); track product.id) {
            <app-product-card [product]="toStoreProduct(product)" />
          } @empty {
            @for (product of store.featuredProducts(); track product.id) {
              <app-product-card [product]="product" />
            }
          }
        </div>
      }
    </section>

    <!-- ── Recently viewed (Phase 8) ───────────────────────────────────────── -->
    <section class="mt-14">
      <app-recently-viewed [limit]="6" />
    </section>

    <!-- ── Newsletter ──────────────────────────────────────────────────────── -->
    <section class="mt-14 app-card grid gap-6 p-8 md:grid-cols-2 md:items-center md:p-10">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">
          {{ 'home.newsletter.eyebrow' | t }}
        </p>
        <h2 class="mt-3 text-3xl font-semibold tracking-tight">{{ 'home.newsletter.headline' | t }}</h2>
        <p class="mt-3 max-w-xl text-neutral-600 dark:text-neutral-300">
          {{ 'home.newsletter.copy' | t }}
        </p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="email"
          [placeholder]="'home.newsletter.email_placeholder' | t"
          [(ngModel)]="newsletterEmail"
          [ngModelOptions]="{ standalone: true }"
          [disabled]="newsletterDone()"
          class="w-full rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-500"
        />
        <button
          type="button"
          class="btn-primary"
          [disabled]="newsletterSubmitting() || newsletterDone() || !newsletterEmail.trim()"
          (click)="subscribeNewsletter()">
          {{ newsletterDone() ? ('home.newsletter.cta_done' | t) : newsletterSubmitting() ? ('home.newsletter.cta_busy' | t) : ('home.newsletter.cta' | t) }}
        </button>
      </div>
      @if (newsletterMessage()) {
        <p class="md:col-span-2 text-sm" [class.text-green-600]="!newsletterError()" [class.text-red-500]="newsletterError()">
          {{ newsletterMessage() }}
        </p>
      }
    </section>
  `
})
export class HomePage implements OnInit, OnDestroy {
  protected readonly store = inject(EcommerceStore);
  private readonly api = inject(ApiService);

  protected readonly activeBanner = signal(0);
  protected readonly loading = signal(false);
  private sliderTimer: ReturnType<typeof setInterval> | null = null;
  protected toStoreProduct = this.store.toStoreProduct.bind(this.store);

  // ── Phase 6: newsletter signup ─────────────────────────────────────────────
  protected newsletterEmail = '';
  protected readonly newsletterSubmitting = signal(false);
  protected readonly newsletterDone       = signal(false);
  protected readonly newsletterError      = signal(false);
  protected readonly newsletterMessage    = signal<string>('');

  protected subscribeNewsletter(): void {
    const email = this.newsletterEmail.trim();
    if (!email) return;
    this.newsletterSubmitting.set(true);
    this.newsletterError.set(false);
    this.newsletterMessage.set('');
    this.api.subscribeNewsletter(email, 'STOREFRONT_HOME')
      .pipe(catchError((err) => {
        this.newsletterError.set(true);
        this.newsletterMessage.set(err?.error?.message ?? 'Could not subscribe. Please try again.');
        this.newsletterSubmitting.set(false);
        return of(null);
      }))
      .subscribe((response) => {
        this.newsletterSubmitting.set(false);
        if (response) {
          this.newsletterDone.set(true);
          this.newsletterMessage.set(response.message);
        }
      });
  }

  // API data signals
  private readonly homeData = signal<{ banners: ApiBanner[]; featuredItems: ApiProduct[] } | null>(null);

  // Normalised banners: prefer API data, fall back to static
  protected readonly displayBanners = computed(() => {
    const data = this.homeData();
    if (data && data.banners.length > 0) {
      return data.banners.map((b) => ({
        id: b.id,
        label: b.promotionTitle,
        title: b.promotionTitle,
        description: b.promotionDetails,
        image: b.imageUrl,
      }));
    }
    return this.staticBanners.map((b, i) => ({ id: String(i), ...b }));
  });

  protected readonly featuredApiProducts = computed(() => this.homeData()?.featuredItems ?? []);

  protected readonly highlights = [
    { title: 'Customer rating', value: '4.9 / 5',   description: 'Trusted by modern shoppers worldwide.' },
    { title: 'Fast shipping',   value: '2-4 Days',   description: 'Reliable delivery for every order.' },
    { title: 'Easy returns',    value: '30 Days',    description: 'Simple, hassle-free return policy.' },
    { title: 'Secure checkout', value: '256-bit SSL', description: 'Protected payments with top-grade security.' }
  ] as const;

  private readonly staticBanners = [
    {
      label: 'New season',
      title: 'Minimal clothing, made to last.',
      description: 'EREZER blends timeless silhouettes with premium materials for the modern wardrobe.',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
    },
    {
      label: 'Urban essentials',
      title: 'Built for everyday movement.',
      description: 'Elevated basics designed for comfort, confidence, and all-day versatility.',
      image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    },
    {
      label: 'Signature edit',
      title: 'Refined layers, clean silhouettes.',
      description: 'Discover curated pieces that transition seamlessly from workday to weekend.',
      image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&q=80',
    }
  ] as const;

  ngOnInit(): void {
    this.loadHomeData();
    this.sliderTimer = setInterval(() => {
      this.activeBanner.update((v) => (v + 1) % Math.max(1, this.displayBanners().length));
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.sliderTimer) clearInterval(this.sliderTimer);
  }

  private loadHomeData(): void {
    this.loading.set(true);
    this.api.getHomeData().pipe(
      catchError(() => of(null))
    ).subscribe((data) => {
      if (data) {
        this.homeData.set({ banners: data.banners, featuredItems: data.featuredItems });
        // also seed the store with all products from home data
        const all = [...data.popularItems, ...data.featuredItems];
        this.store.seedApiProducts(all);
      }
      this.loading.set(false);
    });
  }
}
