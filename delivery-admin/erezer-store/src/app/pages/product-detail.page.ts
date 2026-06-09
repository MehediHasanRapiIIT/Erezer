import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import {
  ApiActiveDiscount,
  ApiProduct,
  ApiProductImage,
  ApiRatingSummary,
  ApiReview,
  ApiStockStatus,
  ApiStoreSettings,
  ApiVariant,
} from '../core/api.models';
import { EcommerceStore } from '../core/store/ecommerce.store';
import { AuthService } from '../core/auth.service';
import { ProductCardComponent } from '../components/shared/product-card.component';
import { RecentlyViewedComponent } from '../components/shared/recently-viewed.component';
import { RecentlyViewedService } from '../core/recently-viewed.service';
import { baseProductPrice, effectiveUnitPrice } from '../core/discount-pricing';
import { PixelService } from '../core/pixel.service';
import { SeoService } from '../core/seo.service';
import { RevealDirective } from '../core/reveal.directive';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, ProductCardComponent, RecentlyViewedComponent, RevealDirective],
  template: `
    @if (loading()) {
      <!-- Skeleton -->
      <div class="grid gap-10 lg:grid-cols-2">
        <div class="aspect-[3/4] w-full animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800"></div>
        <div class="space-y-4 pt-4">
          <div class="h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
          <div class="h-8 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
          <div class="h-5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
          <div class="h-24 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
          <div class="h-12 w-full animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800"></div>
        </div>
      </div>
    } @else if (product(); as p) {
      <div class="space-y-16 lg:pb-0">

        <!-- ── Breadcrumb ────────────────────────────────────────────────── -->
        <nav class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <a routerLink="/" class="transition hover:text-neutral-900 dark:hover:text-neutral-100">Home</a>
          <span class="text-neutral-300 dark:text-neutral-600">/</span>
          <a routerLink="/shop" class="transition hover:text-neutral-900 dark:hover:text-neutral-100">Shop</a>
          <span class="text-neutral-300 dark:text-neutral-600">/</span>
          <span class="truncate text-neutral-700 dark:text-neutral-300">{{ p.name }}</span>
        </nav>

        <!-- ── Product hero ──────────────────────────────────────────────── -->
        <div class="grid gap-8 lg:grid-cols-2 lg:gap-12">

          <!-- Gallery -->
          <div class="flex flex-col gap-3 lg:flex-row-reverse lg:items-start">
            <!-- Main image -->
            <div class="group relative aspect-[3/4] flex-1 overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900">
              @for (url of [activeImageUrl(p)]; track url) {
                <img [src]="url" [alt]="p.name"
                  class="fade-img absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
              }

              <!-- badges -->
              <div class="absolute left-4 top-4 flex flex-col gap-2">
                @if (hasAutoDiscount(p) || (p.discountPrice < p.price && !selectedVariant()?.priceOverride)) {
                  <span class="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white dark:bg-white dark:text-black">Sale</span>
                }
                @if (effectiveStockStatus() === 'OUT_OF_STOCK') {
                  <span class="rounded-full bg-red-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">Sold out</span>
                }
              </div>

              <!-- arrows -->
              @if (images().length > 1) {
                <button type="button" (click)="prevImage()" aria-label="Previous image"
                  class="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-900 opacity-0 shadow-md backdrop-blur transition group-hover:opacity-100 hover:scale-110 dark:bg-neutral-900/80 dark:text-white">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <button type="button" (click)="nextImage()" aria-label="Next image"
                  class="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-900 opacity-0 shadow-md backdrop-blur transition group-hover:opacity-100 hover:scale-110 dark:bg-neutral-900/80 dark:text-white">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
                <span class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                  {{ currentImageIndex() + 1 }} / {{ images().length }}
                </span>
              }

              <!-- wishlist -->
              <button type="button" (click)="store.toggleWishlist(toStr(p.id))"
                [attr.aria-label]="store.isWishlisted(toStr(p.id)) ? 'Remove from wishlist' : 'Add to wishlist'"
                class="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-sm backdrop-blur transition hover:scale-110 dark:bg-neutral-900/80 dark:text-white">
                <svg class="h-5 w-5" viewBox="0 0 24 24" [attr.fill]="store.isWishlisted(toStr(p.id)) ? '#f43f5e' : 'none'"
                  [attr.stroke]="store.isWishlisted(toStr(p.id)) ? '#f43f5e' : 'currentColor'" stroke-width="1.6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            </div>

            <!-- Thumbnails -->
            @if (images().length > 1) {
              <div class="no-scrollbar flex gap-2.5 overflow-x-auto lg:w-20 lg:flex-col lg:overflow-y-auto">
                @for (img of images(); track img.id) {
                  <button type="button" (click)="selectedImageId.set(img.id)"
                    class="aspect-[3/4] h-20 flex-shrink-0 overflow-hidden rounded-xl border-2 transition lg:h-auto lg:w-full"
                    [class.border-neutral-900]="selectedImageId() === img.id"
                    [class.dark:border-white]="selectedImageId() === img.id"
                    [class.border-transparent]="selectedImageId() !== img.id"
                    [class.opacity-60]="selectedImageId() !== img.id">
                    <img [src]="img.url" [alt]="img.altText ?? p.name" class="h-full w-full object-cover" />
                  </button>
                }
              </div>
            }
          </div>

          <!-- Info column (sticky on desktop) -->
          <div class="lg:sticky lg:top-24 lg:self-start">
            <div class="space-y-6">

              <!-- title block -->
              <div class="space-y-3">
                @if (p.brand) {
                  <p class="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">{{ p.brand }}</p>
                }
                <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">{{ p.name }}</h1>

                <!-- rating -->
                @if (ratingSummary(); as rs) {
                  <button type="button" (click)="scrollTo('reviews')" class="group flex items-center gap-2">
                    <span class="flex text-amber-400">
                      @for (star of [1,2,3,4,5]; track star) {
                        <span class="text-lg">{{ star <= rs.avgRating ? '★' : (star - 0.5 <= rs.avgRating ? '⯨' : '☆') }}</span>
                      }
                    </span>
                    <span class="text-sm font-medium">{{ rs.avgRating.toFixed(1) }}</span>
                    <span class="text-sm text-neutral-500 underline-offset-4 group-hover:underline dark:text-neutral-400">({{ rs.totalReviews }} reviews)</span>
                  </button>
                } @else {
                  <div class="flex items-center gap-2 text-neutral-300">
                    <span class="flex text-lg">★★★★★</span>
                    <span class="text-sm text-neutral-500 dark:text-neutral-400">No ratings yet</span>
                  </div>
                }
              </div>

              <!-- price -->
              <div class="flex flex-wrap items-baseline gap-3">
                <p class="text-2xl font-semibold tracking-tight">{{ effectivePrice(p) | currency:'BDT':'৳' }}</p>
                @if (hasAutoDiscount(p)) {
                  <p class="text-base text-neutral-400 line-through">{{ basePrice(p) | currency:'BDT':'৳' }}</p>
                  <span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                    Save {{ (basePrice(p) - effectivePrice(p)) | currency:'BDT':'৳' }}
                  </span>
                } @else if (p.discountPrice < p.price && !selectedVariant()?.priceOverride) {
                  <p class="text-base text-neutral-400 line-through">{{ p.price | currency:'BDT':'৳' }}</p>
                }
              </div>

              <p class="leading-relaxed text-neutral-600 dark:text-neutral-300">{{ p.description }}</p>

              <div class="border-t border-neutral-200 dark:border-neutral-800"></div>

              <!-- size picker -->
              @if (availableSizes().length > 0) {
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <p class="text-sm font-medium">
                      Size<span class="ml-1 text-neutral-500 dark:text-neutral-400">{{ selectedSize() ? '· ' + selectedSize() : '' }}</span>
                    </p>
                    @if (settings()?.sizeChart && settings()!.sizeChart!.rows.length > 0) {
                      <button type="button" (click)="openSizeGuide()" class="text-xs font-medium underline underline-offset-4 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">Size guide</button>
                    }
                  </div>
                  <div class="flex flex-wrap gap-2">
                    @for (s of availableSizes(); track s) {
                      <button type="button" (click)="selectSize(s)" [disabled]="!isSizeAvailable(s)"
                        class="min-w-12 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
                        [class.border-neutral-900]="selectedSize() === s"
                        [class.bg-neutral-900]="selectedSize() === s"
                        [class.text-white]="selectedSize() === s"
                        [class.dark:border-white]="selectedSize() === s"
                        [class.dark:bg-white]="selectedSize() === s"
                        [class.dark:text-black]="selectedSize() === s"
                        [class.border-neutral-200]="selectedSize() !== s"
                        [class.dark:border-neutral-700]="selectedSize() !== s"
                        [class.hover:border-neutral-400]="selectedSize() !== s && isSizeAvailable(s)"
                        [class.opacity-40]="!isSizeAvailable(s)"
                        [class.line-through]="!isSizeAvailable(s)">{{ s }}</button>
                    }
                  </div>
                </div>
              }

              <!-- stock -->
              @if (effectiveStockStatus(); as status) {
                <span class="inline-flex items-center gap-2 text-sm font-medium"
                  [class.text-emerald-600]="status === 'IN_STOCK'"
                  [class.text-amber-600]="status === 'LOW_STOCK'"
                  [class.text-red-600]="status === 'OUT_OF_STOCK'">
                  <span class="relative flex h-2 w-2">
                    <span class="absolute inline-flex h-full w-full rounded-full opacity-60"
                      [class.bg-emerald-500]="status === 'IN_STOCK'" [class.animate-ping]="status === 'IN_STOCK'"
                      [class.bg-amber-500]="status === 'LOW_STOCK'"
                      [class.bg-red-500]="status === 'OUT_OF_STOCK'"></span>
                    <span class="relative inline-flex h-2 w-2 rounded-full"
                      [class.bg-emerald-500]="status === 'IN_STOCK'"
                      [class.bg-amber-500]="status === 'LOW_STOCK'"
                      [class.bg-red-500]="status === 'OUT_OF_STOCK'"></span>
                  </span>
                  {{ status === 'IN_STOCK' ? 'In stock' : status === 'LOW_STOCK' ? 'Only a few left' : 'Out of stock' }}
                </span>
              }

              <!-- quantity + actions -->
              <div class="flex flex-wrap items-center gap-3">
                <div class="inline-flex items-center rounded-full border border-neutral-300 dark:border-neutral-700">
                  <button type="button" (click)="decreaseQty()" aria-label="Decrease quantity"
                    class="flex h-11 w-11 items-center justify-center text-lg transition hover:bg-neutral-100 rounded-l-full dark:hover:bg-neutral-800">−</button>
                  <span class="min-w-10 text-center text-sm font-medium tabular-nums">{{ quantity() }}</span>
                  <button type="button" (click)="increaseQty()" aria-label="Increase quantity"
                    class="flex h-11 w-11 items-center justify-center text-lg transition hover:bg-neutral-100 rounded-r-full dark:hover:bg-neutral-800">+</button>
                </div>
                <button class="btn-primary h-11 flex-1 !rounded-full" [disabled]="!canAddToCart()" (click)="addToCart(p)">
                  {{ addToCartLabel() }}
                </button>
              </div>

              @if (cartMessage()) {
                <p class="text-sm" [class.text-emerald-600]="!cartMessageError()" [class.text-red-600]="cartMessageError()">{{ cartMessage() }}</p>
              }

              <!-- trust row -->
              <div class="grid grid-cols-3 gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                @for (t of trust; track t.title) {
                  <div class="flex flex-col items-center gap-1.5 text-center">
                    <span class="text-neutral-700 dark:text-neutral-300">
                      @switch (t.icon) {
                        @case ('truck') { <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.66-.84H14.25M16.5 18.75h-6V5.25A1.125 1.125 0 009.375 4.125H4.5"/></svg> }
                        @case ('refresh') { <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992V4.356M3.985 19.644v-4.992h4.992m-9.336-2.298A8.25 8.25 0 016.34 4.34m-2.32 8.32A8.25 8.25 0 0017.66 19.66M19.98 11.34A8.25 8.25 0 006.34 4.34"/></svg> }
                        @default { <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 5.25-3.6 8.25-8.4 9.6a1.2 1.2 0 01-.6 0C7.2 20.25 3.6 17.25 3.6 12V6.3a1.2 1.2 0 01.75-1.11l7.2-2.7a1.2 1.2 0 01.9 0l7.2 2.7A1.2 1.2 0 0121 6.3z"/></svg> }
                      }
                    </span>
                    <p class="text-xs font-semibold leading-tight">{{ t.title }}</p>
                    <p class="text-[11px] leading-tight app-muted">{{ t.sub }}</p>
                  </div>
                }
              </div>

              <!-- accordions -->
              <div id="product-details" class="border-t border-neutral-200 dark:border-neutral-800">

                @if (p.material || p.careInstructions) {
                  <div class="border-b border-neutral-200 dark:border-neutral-800">
                    <button type="button" (click)="toggleSection('details')" class="acc-trigger">
                      Details &amp; care
                      <svg class="acc-chevron" [class.rotate-180]="openSection() === 'details'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    @if (openSection() === 'details') {
                      <div class="acc-panel space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                        @if (p.material) { <p><span class="text-neutral-500">Material:</span> {{ p.material }}</p> }
                        @if (p.careInstructions) { <p class="whitespace-pre-line">{{ p.careInstructions }}</p> }
                      </div>
                    }
                  </div>
                }

                @if (settings(); as s) {
                  @if (s.returnPolicyText) {
                    <div class="border-b border-neutral-200 dark:border-neutral-800">
                      <button type="button" (click)="toggleSection('returns')" class="acc-trigger">
                        Returns &amp; exchanges
                        <svg class="acc-chevron" [class.rotate-180]="openSection() === 'returns'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                      </button>
                      @if (openSection() === 'returns') {
                        <div class="acc-panel text-sm text-neutral-600 dark:text-neutral-300">
                          <p class="whitespace-pre-line">{{ s.returnPolicyText }}</p>
                          <p class="mt-3">
                            Need help? Call
                            @if (s.supportPhone) { <a class="underline underline-offset-2" [href]="'tel:' + s.supportPhone">{{ s.supportPhone }}</a> }
                            @if (s.supportEmail) { or email <a class="underline underline-offset-2" [href]="'mailto:' + s.supportEmail">{{ s.supportEmail }}</a> }@if (s.supportHours) { <span class="text-neutral-400"> · {{ s.supportHours }}</span> }.
                          </p>
                        </div>
                      }
                    </div>
                  }

                  @if (s.sizeChart && s.sizeChart.rows.length > 0) {
                    <div class="border-b border-neutral-200 dark:border-neutral-800">
                      <button type="button" (click)="toggleSection('sizechart')" class="acc-trigger">
                        Size chart
                        <svg class="acc-chevron" [class.rotate-180]="openSection() === 'sizechart'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                      </button>
                      @if (openSection() === 'sizechart') {
                        <div class="acc-panel">
                          <div class="mb-3 inline-flex rounded-full border border-neutral-200 p-0.5 dark:border-neutral-700">
                            <button type="button" (click)="sizeUnit.set('cm')" class="rounded-full px-3 py-1 text-xs font-medium transition"
                              [class.bg-neutral-900]="sizeUnit() === 'cm'" [class.text-white]="sizeUnit() === 'cm'"
                              [class.dark:bg-white]="sizeUnit() === 'cm'" [class.dark:text-black]="sizeUnit() === 'cm'">cm</button>
                            <button type="button" (click)="sizeUnit.set('inch')" class="rounded-full px-3 py-1 text-xs font-medium transition"
                              [class.bg-neutral-900]="sizeUnit() === 'inch'" [class.text-white]="sizeUnit() === 'inch'"
                              [class.dark:bg-white]="sizeUnit() === 'inch'" [class.dark:text-black]="sizeUnit() === 'inch'">inch</button>
                          </div>
                          <div class="overflow-x-auto">
                            <table class="w-full border-collapse text-sm">
                              <thead>
                                <tr class="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-700">
                                  <th class="py-2 pr-4 font-medium">Size</th>
                                  @for (col of s.sizeChart.columns; track $index) { <th class="py-2 pr-4 font-medium">{{ col }}</th> }
                                </tr>
                              </thead>
                              <tbody>
                                @for (row of s.sizeChart.rows; track $index) {
                                  <tr class="border-b border-neutral-100 dark:border-neutral-800">
                                    <td class="py-2 pr-4 font-semibold">{{ row.size }}</td>
                                    @for (cell of row.cells; track $index) {
                                      <td class="py-2 pr-4 text-neutral-600 dark:text-neutral-300">{{ (sizeUnit() === 'cm' ? cell.cm : cell.inch) ?? '—' }}</td>
                                    }
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        </div>

        <!-- ── Related products ──────────────────────────────────────────── -->
        @if (related().length > 0) {
          <section>
            <div class="mb-6 flex items-end justify-between" appReveal>
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">More to explore</p>
                <h2 class="app-section-title mt-2 text-2xl">You may also like</h2>
              </div>
              <a routerLink="/shop" class="text-sm font-medium underline underline-offset-4">Browse all</a>
            </div>
            <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              @for (rel of related(); track rel.id; let i = $index) {
                <app-product-card [product]="store.toStoreProduct(rel)" [appReveal]="i" />
              }
            </div>
          </section>
        }

        <!-- ── Recently viewed ───────────────────────────────────────────── -->
        <app-recently-viewed [excludeId]="p.id" [limit]="6" />

        <!-- ── Reviews ───────────────────────────────────────────────────── -->
        <section id="reviews" class="scroll-mt-24">
          <div class="mb-6" appReveal>
            <p class="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">Reviews</p>
            <h2 class="app-section-title mt-2 text-2xl">Customer reviews</h2>
          </div>

          <div class="grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:items-start">

            <!-- Left: rating summary + write a review -->
            <div class="space-y-6 lg:sticky lg:top-24">

              <!-- Rating summary -->
              <article class="app-card p-6">
                @if (ratingSummary() && ratingSummary()!.totalReviews > 0) {
                  <div class="flex items-center gap-6">
                    <div class="text-center">
                      <p class="text-5xl font-semibold leading-none tracking-tight">{{ ratingSummary()!.avgRating.toFixed(1) }}</p>
                      <div class="mt-2 flex justify-center text-amber-400">
                        @for (star of [1,2,3,4,5]; track star) {
                          <span class="text-base">{{ star <= ratingSummary()!.avgRating ? '★' : (star - 0.5 <= ratingSummary()!.avgRating ? '⯨' : '☆') }}</span>
                        }
                      </div>
                    </div>
                    <div class="h-14 w-px bg-neutral-200 dark:bg-neutral-800"></div>
                    <div>
                      <p class="text-sm font-medium">Based on {{ ratingSummary()!.totalReviews }} review{{ ratingSummary()!.totalReviews === 1 ? '' : 's' }}</p>
                      <p class="mt-0.5 text-xs app-muted">Ratings from verified shoppers</p>
                    </div>
                  </div>
                } @else {
                  <div class="flex flex-col items-center gap-2 py-2 text-center">
                    <div class="flex text-lg text-neutral-300 dark:text-neutral-600">★★★★★</div>
                    <p class="text-sm font-medium">No reviews yet</p>
                    <p class="text-xs app-muted">Be the first to share your thoughts on this piece.</p>
                  </div>
                }
              </article>

              <!-- Write a review -->
              <article class="app-card p-6">
                <h3 class="text-base font-semibold">{{ editingReviewId() ? 'Edit your review' : 'Write a review' }}</h3>

                @if (!auth.isAuthenticated()) {
                  <div class="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-5 py-8 text-center dark:border-neutral-700">
                    <span class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                    </span>
                    <div>
                      <p class="font-medium">Share your experience</p>
                      <p class="mt-1 text-sm app-muted">Sign in to write a review for this product.</p>
                    </div>
                    <a routerLink="/account" class="btn-primary">Sign in to review</a>
                  </div>
                } @else {
                  <div class="mt-4 space-y-4">
                    <label class="block">
                      <span class="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Your rating</span>
                      <div class="flex gap-1">
                        @for (star of [1,2,3,4,5]; track star) {
                          <button type="button" (click)="reviewRating.set(star)" class="text-3xl leading-none transition hover:scale-110"
                            [class.text-amber-400]="star <= reviewRating()" [class.text-neutral-300]="star > reviewRating()"
                            [class.dark:text-neutral-600]="star > reviewRating()"
                            [attr.aria-label]="star + ' star'">★</button>
                        }
                      </div>
                    </label>
                    <input [(ngModel)]="reviewOrderId" [ngModelOptions]="{ standalone: true }" placeholder="Order ID (required)"
                      class="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900" />
                    <textarea [(ngModel)]="reviewComment" [ngModelOptions]="{ standalone: true }" rows="4" placeholder="Share your thoughts… (optional)"
                      class="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"></textarea>
                    @if (reviewError()) { <p class="text-sm text-red-500">{{ reviewError() }}</p> }
                    <div class="flex gap-2">
                      <button type="button" class="btn-primary flex-1" [disabled]="reviewSubmitting()" (click)="submitReview(p.id)">
                        {{ reviewSubmitting() ? 'Saving…' : (editingReviewId() ? 'Update review' : 'Submit review') }}
                      </button>
                      @if (editingReviewId()) { <button type="button" class="btn-secondary" (click)="cancelEdit()">Cancel</button> }
                    </div>
                    @if (reviewSuccess()) { <p class="text-sm text-emerald-600">{{ reviewSuccess() }}</p> }
                  </div>
                }
              </article>
            </div>

            <!-- Right: reviews list -->
            <article class="app-card p-6">
              <h3 class="mb-4 text-base font-semibold">
                {{ (ratingSummary()?.totalReviews ?? 0) }} review{{ (ratingSummary()?.totalReviews ?? 0) === 1 ? '' : 's' }}
              </h3>

              @if (reviewsLoading()) {
                <div class="space-y-4">
                  @for (s of [0,1,2]; track s) {
                    <div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                      <div class="mb-3 flex items-center gap-3">
                        <div class="h-9 w-9 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800"></div>
                        <div class="space-y-1.5">
                          <div class="h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
                          <div class="h-2.5 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
                        </div>
                      </div>
                      <div class="h-3 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
                    </div>
                  }
                </div>
              } @else {
                <div class="space-y-4">
                  @for (review of reviews(); track review.reviewId) {
                    <div class="rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600">
                      <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div class="flex items-center gap-3">
                          <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                            {{ (review.userName || '?').charAt(0).toUpperCase() }}
                          </span>
                          <div>
                            <p class="font-medium">{{ review.userName }}</p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ review.createdAt | date: 'mediumDate' }}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium text-amber-500">{{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}</span>
                          @if (auth.userId() === review.userId) {
                            <button (click)="startEdit(review)" class="text-xs text-neutral-500 underline dark:text-neutral-400">Edit</button>
                            <button (click)="deleteReview(p.id, review.reviewId)" class="text-xs text-red-500 underline">Delete</button>
                          }
                        </div>
                      </div>
                      @if (review.comment) { <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ review.comment }}</p> }
                    </div>
                  } @empty {
                    <div class="flex flex-col items-center gap-3 py-12 text-center">
                      <span class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
                      </span>
                      <p class="font-medium">No reviews yet</p>
                      <p class="max-w-xs text-sm app-muted">Be the first to review this product and help other shoppers.</p>
                      @if (!auth.isAuthenticated()) {
                        <a routerLink="/account" class="btn-secondary mt-1">Sign in to review</a>
                      }
                    </div>
                  }
                </div>

                @if (totalPages() > 1) {
                  <div class="mt-5 flex items-center justify-between text-sm">
                    <button class="btn-secondary !px-3 !py-1.5 text-xs" [disabled]="currentPage() === 0" (click)="loadReviews(p.id, currentPage() - 1)">Previous</button>
                    <span class="text-neutral-500 dark:text-neutral-400">Page {{ currentPage() + 1 }} of {{ totalPages() }}</span>
                    <button class="btn-secondary !px-3 !py-1.5 text-xs" [disabled]="currentPage() >= totalPages() - 1" (click)="loadReviews(p.id, currentPage() + 1)">Next</button>
                  </div>
                }
              }
            </article>
          </div>
        </section>

        <!-- spacer so the mobile buy-bar never covers content -->
        <div class="h-20 lg:hidden"></div>
      </div>

      <!-- ── Mobile sticky buy bar ──────────────────────────────────────── -->
      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        <div class="mx-auto flex max-w-7xl items-center gap-3">
          <div class="min-w-0">
            <p class="truncate text-xs app-muted">{{ p.name }}</p>
            <p class="font-semibold">{{ effectivePrice(p) | currency:'BDT':'৳' }}</p>
          </div>
          <button class="btn-primary ml-auto min-w-[55%] !rounded-full" [disabled]="!canAddToCart()" (click)="addToCart(p)">
            {{ addToCartLabel() }}
          </button>
        </div>
      </div>
    } @else {
      <p class="app-muted">Product not found.</p>
    }
  `,
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    @keyframes fadeImg { from { opacity: .35; } to { opacity: 1; } }
    .fade-img { animation: fadeImg .45s ease; }

    .acc-trigger {
      display: flex; width: 100%; align-items: center; justify-content: space-between;
      padding: 1rem 0; font-weight: 600; font-size: 0.9rem; text-align: left;
      transition: color .15s ease;
    }
    .acc-chevron { height: 1.05rem; width: 1.05rem; flex-shrink: 0; color: rgb(115 115 115); transition: transform .3s ease; }
    @keyframes accIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .acc-panel { padding-bottom: 1.1rem; animation: accIn .3s ease both; }
  `]
})
export class ProductDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(EcommerceStore);
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly recents = inject(RecentlyViewedService);
  private readonly pixel = inject(PixelService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  // ── product / stock ────────────────────────────────────────────────────────
  protected readonly loading     = signal(true);
  protected readonly product     = signal<ApiProduct | null>(null);
  protected readonly stockStatus = signal<ApiStockStatus | null>(null);
  protected readonly quantity    = signal(1);
  protected readonly cartMessage = signal('');
  protected readonly cartMessageError = signal(false);

  // ── images ────────────────────────────────────────────────────────────────
  protected readonly images          = signal<ApiProductImage[]>([]);
  protected readonly selectedImageId = signal<number | null>(null);

  // ── variants ──────────────────────────────────────────────────────────────
  protected readonly variants      = signal<ApiVariant[]>([]);
  protected readonly selectedSize  = signal<string | null>(null);

  // ── related ───────────────────────────────────────────────────────────────
  protected readonly related = signal<ApiProduct[]>([]);

  // ── store settings + automatic discounts (Phase 9) ─────────────────────────
  protected readonly settings        = signal<ApiStoreSettings | null>(null);
  protected readonly activeDiscounts  = signal<ApiActiveDiscount[]>([]);
  protected readonly sizeUnit         = signal<'cm' | 'inch'>('cm');

  // ── rating summary / reviews ──────────────────────────────────────────────
  protected readonly ratingSummary  = signal<ApiRatingSummary | null>(null);
  protected readonly reviews        = signal<ApiReview[]>([]);
  protected readonly reviewsLoading = signal(false);
  protected readonly currentPage    = signal(0);
  protected readonly totalPages     = signal(0);

  // ── review form ───────────────────────────────────────────────────────────
  protected readonly reviewRating     = signal(5);
  protected readonly reviewSubmitting = signal(false);
  protected readonly reviewError      = signal('');
  protected readonly reviewSuccess    = signal('');
  protected readonly editingReviewId  = signal<string | null>(null);
  protected reviewOrderId = '';
  protected reviewComment = '';

  // ── PDP UI state ────────────────────────────────────────────────────────────
  protected readonly openSection = signal<string | null>('details');
  protected toggleSection(name: string): void {
    this.openSection.update((cur) => (cur === name ? null : name));
  }

  protected readonly trust = [
    { icon: 'truck',   title: 'Nationwide delivery', sub: 'Fast, reliable shipping' },
    { icon: 'refresh', title: 'Easy exchanges',      sub: '3-day, hassle-free' },
    { icon: 'shield',  title: 'Secure checkout',     sub: 'Protected payments' },
  ];

  // ── computed: variant state ────────────────────────────────────────────────

  protected readonly availableSizes = computed(() => {
    const set = new Set<string>();
    for (const v of this.variants()) {
      if (v.size) set.add(v.size);
    }
    // Conventional clothing size order; unknown values append alphabetically.
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    return Array.from(set).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
  });

  protected readonly selectedVariant = computed<ApiVariant | null>(() => {
    if (this.variants().length === 0) return null;
    const size = this.selectedSize();
    return this.variants().find((v) => (v.size ?? null) === size) ?? null;
  });

  /** Index of the currently shown image (for the counter / nav). */
  protected readonly currentImageIndex = computed(() => {
    const id = this.selectedImageId();
    const idx = this.images().findIndex((i) => i.id === id);
    return idx >= 0 ? idx : 0;
  });

  /** Stock status text driven by variant if one is selected, else by product. */
  protected readonly effectiveStockStatus = computed<'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | null>(() => {
    const variant = this.selectedVariant();
    if (variant) {
      const qty = variant.stockQuantity ?? 0;
      if (qty <= 0) return 'OUT_OF_STOCK';
      if (qty <= 3) return 'LOW_STOCK';
      return 'IN_STOCK';
    }
    const s = this.stockStatus();
    if (!s) return null;
    if (s.stockStatus === 'IN_STOCK' || s.stockStatus === 'LOW_STOCK' || s.stockStatus === 'OUT_OF_STOCK') {
      return s.stockStatus;
    }
    return s.isAvailable === false ? 'OUT_OF_STOCK' : 'IN_STOCK';
  });

  protected readonly canAddToCart = computed(() => {
    const hasVariants = this.variants().length > 0;
    if (hasVariants && !this.selectedVariant()) return false;
    const status = this.effectiveStockStatus();
    return status !== 'OUT_OF_STOCK';
  });

  protected readonly addToCartLabel = computed(() => {
    if (this.variants().length > 0 && !this.selectedVariant()) {
      if (this.availableSizes().length > 0 && !this.selectedSize()) return 'Select a size';
      return 'Select options';
    }
    if (this.effectiveStockStatus() === 'OUT_OF_STOCK') return 'Out of stock';
    return 'Add to cart';
  });

  // ── gallery nav ─────────────────────────────────────────────────────────────

  protected prevImage(): void {
    const imgs = this.images();
    if (imgs.length < 2) return;
    const prev = (this.currentImageIndex() - 1 + imgs.length) % imgs.length;
    this.selectedImageId.set(imgs[prev].id);
  }

  protected nextImage(): void {
    const imgs = this.images();
    if (imgs.length < 2) return;
    const next = (this.currentImageIndex() + 1) % imgs.length;
    this.selectedImageId.set(imgs[next].id);
  }

  protected scrollTo(id: string): void {
    if (typeof document === 'undefined') return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected openSizeGuide(): void {
    this.openSection.set('sizechart');
    this.scrollTo('product-details');
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Store settings + active discounts are product-independent — load once.
    this.api.getStoreSettings().pipe(catchError(() => of(null)))
      .subscribe((s) => this.settings.set(s));
    this.api.getActiveDiscounts().pipe(catchError(() => of([] as ApiActiveDiscount[])))
      .subscribe((d) => this.activeDiscounts.set(d));

    // Re-load whenever the :id changes. Clicking a related / recently-viewed
    // product navigates to a new id while this component is REUSED, so we must
    // react to paramMap rather than read the snapshot once (otherwise the page
    // URL changes but the content never updates).
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const idParam = params.get('id');
      const id = idParam ? Number(idParam) : NaN;
      if (isNaN(id)) { this.loading.set(false); return; }
      this.loadProduct(id);
    });
  }

  /** Loads one product, resetting all per-product state first. */
  private loadProduct(id: number): void {
    // Clear the previous product so its data can't bleed through on reuse.
    this.loading.set(true);
    this.product.set(null);
    this.images.set([]);
    this.selectedImageId.set(null);
    this.variants.set([]);
    this.selectedSize.set(null);
    this.related.set([]);
    this.reviews.set([]);
    this.ratingSummary.set(null);
    this.stockStatus.set(null);
    this.quantity.set(1);
    this.cartMessage.set('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });

    // Record the visit immediately so the carousel updates even if the
    // product fetch later fails.
    this.recents.track(id);

    this.api.getProductById(id).pipe(catchError(() => of(null))).subscribe((p) => {
      this.product.set(p);
      this.loading.set(false);
      if (p) {
        this.loadStock(p.id);
        this.loadReviews(p.id, 0);
        this.loadRatingSummary(p.id);
        this.loadImages(p.id);
        this.loadVariants(p.id);
        this.loadRelated(p.id);
        this.pixel.viewContent(p.id, p.name, this.effectivePrice(p));
        this.applySeo(p);
      }
    });
  }

  // ── images ────────────────────────────────────────────────────────────────

  private loadImages(productId: number): void {
    this.api.getProductImages(productId)
      .pipe(catchError(() => of([] as ApiProductImage[])))
      .subscribe((imgs) => {
        this.images.set(imgs);
        const primary = imgs.find((i) => i.isPrimary) ?? imgs[0];
        if (primary) {
          this.selectedImageId.set(primary.id);
        }
      });
  }

  protected activeImageUrl(p: ApiProduct): string {
    const id = this.selectedImageId();
    if (id != null) {
      const found = this.images().find((i) => i.id === id);
      if (found) return found.url;
    }
    const primary = this.images().find((i) => i.isPrimary);
    if (primary) return primary.url;
    return p.imageUrl;
  }

  // ── variants ──────────────────────────────────────────────────────────────

  private loadVariants(productId: number): void {
    this.api.getProductVariants(productId)
      .pipe(catchError(() => of([] as ApiVariant[])))
      .subscribe((vs) => {
        this.variants.set(vs);
        // Auto-select the first in-stock size for a smoother UX.
        const firstSize = this.availableSizes().find((s) => this.isSizeAvailable(s));
        if (firstSize) this.selectedSize.set(firstSize);
      });
  }

  protected selectSize(s: string): void {
    this.selectedSize.set(s);
  }

  protected isSizeAvailable(size: string): boolean {
    return this.variants().some((v) =>
      v.size === size &&
      (v.stockQuantity == null || v.stockQuantity > 0)
    );
  }

  // ── related ───────────────────────────────────────────────────────────────

  private loadRelated(productId: number): void {
    this.api.getRelatedProducts(productId, 8)
      .pipe(catchError(() => of([] as ApiProduct[])))
      .subscribe((items) => this.related.set(items));
  }

  // ── stock / rating ────────────────────────────────────────────────────────

  private loadStock(id: number): void {
    this.api.getProductStockStatus(id).pipe(catchError(() => of(null))).subscribe((s) => {
      this.stockStatus.set(s);
    });
  }

  private loadRatingSummary(productId: number): void {
    this.api.getRatingSummary(productId).pipe(catchError(() => of(null))).subscribe((rs) => {
      this.ratingSummary.set(rs);
    });
  }

  /** Base unit price before automatic discounts (variant override or product sale price). */
  protected basePrice(p: ApiProduct): number {
    const v = this.selectedVariant();
    if (v?.priceOverride != null) return v.priceOverride;
    return baseProductPrice(p.price, p.discountPrice);
  }

  /** Unit price after automatic product/category/global discounts. */
  protected effectivePrice(p: ApiProduct): number {
    return effectiveUnitPrice(this.basePrice(p), p.id, p.categoryId, this.activeDiscounts());
  }

  /** True when an automatic discount further reduces the base price. */
  protected hasAutoDiscount(p: ApiProduct): boolean {
    return this.effectivePrice(p) < this.basePrice(p) - 0.001;
  }

  // Variant-agnostic pricing for the "you may also like" cards — these are OTHER
  // products, so they must not inherit the main product's selected variant.
  protected listBasePrice(p: ApiProduct): number {
    return baseProductPrice(p.price, p.discountPrice);
  }
  protected listEffectivePrice(p: ApiProduct): number {
    return effectiveUnitPrice(this.listBasePrice(p), p.id, p.categoryId, this.activeDiscounts());
  }
  protected listHasDiscount(p: ApiProduct): boolean {
    return this.listEffectivePrice(p) < this.listBasePrice(p) - 0.001;
  }

  /** Sets per-product title/OG/Twitter meta + Product JSON-LD for SEO/sharing. */
  private applySeo(p: ApiProduct): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = origin ? `${origin}/product/${p.id}` : undefined;
    const description = (p.description ?? '').slice(0, 200) || `${p.name} — shop now at Erezer.`;
    this.seo.update({
      title: p.name,
      description,
      image: p.imageUrl,
      url,
      type: 'product',
    });
    this.seo.setProductJsonLd({
      name: p.name,
      description,
      image: p.imageUrl,
      brand: p.brand ?? undefined,
      price: this.effectivePrice(p),
      currency: 'BDT',
      availability: p.isAvailable === false ? 'OutOfStock' : 'InStock',
      url,
    });
  }

  // ── reviews (unchanged from earlier phase) ────────────────────────────────

  protected loadReviews(productId: number, page: number): void {
    this.reviewsLoading.set(true);
    this.api.getReviews(productId, page).pipe(catchError(() => of(null))).subscribe((data) => {
      if (data) {
        this.reviews.set(data.content);
        this.currentPage.set(data.pageable.pageNumber);
        this.totalPages.set(data.totalPages);
      }
      this.reviewsLoading.set(false);
    });
  }

  protected submitReview(productId: number): void {
    const userId = this.auth.userId();
    if (!userId) return;

    const rating = this.reviewRating();
    const editId = this.editingReviewId();

    if (editId) {
      this.reviewSubmitting.set(true);
      this.reviewError.set('');
      this.api.updateReview(productId, editId, { userId, rating, comment: this.reviewComment })
        .pipe(catchError((err) => {
          this.reviewError.set(err?.error?.message ?? 'Failed to update review.');
          this.reviewSubmitting.set(false);
          return of(null);
        }))
        .subscribe((updated) => {
          this.reviewSubmitting.set(false);
          if (!updated) return;
          this.reviews.update((list) => list.map((r) => r.reviewId === editId ? updated : r));
          this.cancelEdit();
          this.showReviewSuccess('Review updated.');
          this.loadRatingSummary(productId);
        });
    } else {
      if (!this.reviewOrderId.trim()) {
        this.reviewError.set('Order ID is required to submit a review.');
        return;
      }
      this.reviewSubmitting.set(true);
      this.reviewError.set('');
      this.api.submitReview(productId, {
        userId,
        orderId: this.reviewOrderId.trim(),
        rating,
        comment: this.reviewComment
      }).pipe(catchError((err) => {
        this.reviewError.set(err?.error?.message ?? 'Failed to submit review.');
        this.reviewSubmitting.set(false);
        return of(null);
      })).subscribe((created) => {
        this.reviewSubmitting.set(false);
        if (!created) return;
        this.reviews.update((list) => [created, ...list]);
        this.resetForm();
        this.showReviewSuccess('Review submitted!');
        this.loadRatingSummary(productId);
      });
    }
  }

  protected startEdit(review: ApiReview): void {
    this.editingReviewId.set(review.reviewId);
    this.reviewRating.set(review.rating);
    this.reviewComment = review.comment ?? '';
    this.reviewOrderId = '';
    this.reviewError.set('');
    this.reviewSuccess.set('');
  }

  protected cancelEdit(): void {
    this.editingReviewId.set(null);
    this.resetForm();
  }

  protected deleteReview(productId: number, reviewId: string): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.api.deleteReview(productId, reviewId, userId)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.reviews.update((list) => list.filter((r) => r.reviewId !== reviewId));
        this.loadRatingSummary(productId);
      });
  }

  private resetForm(): void {
    this.reviewRating.set(5);
    this.reviewComment = '';
    this.reviewOrderId = '';
    this.reviewError.set('');
  }

  private showReviewSuccess(msg: string): void {
    this.reviewSuccess.set(msg);
    setTimeout(() => this.reviewSuccess.set(''), 3000);
  }

  // ── cart ──────────────────────────────────────────────────────────────────

  protected increaseQty(): void {
    const variant = this.selectedVariant();
    const variantMax = variant?.stockQuantity ?? Infinity;
    const productMax = this.stockStatus()?.stockQuantity ?? 99;
    const max = Math.min(variantMax, productMax);
    this.quantity.update((v) => Math.min(max, v + 1));
  }

  protected decreaseQty(): void {
    this.quantity.update((v) => Math.max(1, v - 1));
  }

  protected addToCart(p: ApiProduct): void {
    const variant = this.selectedVariant();
    const userId = this.auth.userId();
    const variantId = variant?.id ?? null;
    // Variants are size-only — label by the chosen size, never the (legacy) variant name/colour.
    const variantLabel = this.selectedSize() ?? variant?.size ?? 'One Size';

    this.pixel.addToCart(p.id, p.name, this.effectivePrice(p), this.quantity());

    if (!userId) {
      const unitPrice = this.effectivePrice(p);
      this.store.addToCart(String(p.id), variantLabel, this.quantity(), {
        variantId,
        unitPrice,
        name: variant ? `${p.name} — ${variantLabel}` : p.name,
        image: p.imageUrl,
      });
      this.showCartMessage('Added to cart');
      return;
    }
    this.api.addToCart(userId, {
      userId,
      productId: String(p.id),
      variantId,
      quantity: this.quantity(),
      deliveryInstructions: null
    }).subscribe({
      next: (item) => {
        this.store.syncApiCartItem(item);
        this.showCartMessage('Added to cart');
      },
      error: (err) => {
        this.showCartMessage(this.extractError(err), true);
      }
    });
  }

  private extractError(err: unknown): string {
    const message = (err as { error?: { message?: string } })?.error?.message;
    return message?.trim() ? message : 'Could not add to cart. Please try again.';
  }

  private showCartMessage(msg: string, isError = false): void {
    this.cartMessageError.set(isError);
    this.cartMessage.set(msg);
    setTimeout(() => this.cartMessage.set(''), 2500);
  }

  /** Template helper — converts number to string */
  protected toStr(id: number | string): string { return String(id); }
}
