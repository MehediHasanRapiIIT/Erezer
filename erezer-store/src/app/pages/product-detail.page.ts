import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import {
  ApiProduct,
  ApiProductImage,
  ApiRatingSummary,
  ApiReview,
  ApiStockStatus,
  ApiVariant,
} from '../core/api.models';
import { EcommerceStore } from '../core/store/ecommerce.store';
import { AuthService } from '../core/auth.service';
import { RecentlyViewedComponent } from '../components/shared/recently-viewed.component';
import { RecentlyViewedService } from '../core/recently-viewed.service';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, RecentlyViewedComponent],
  template: `
    @if (loading()) {
      <p class="app-muted">Loading product…</p>
    } @else if (product(); as p) {
      <section class="space-y-12">

        <!-- ── Product info ──────────────────────────────────────────────── -->
        <div class="grid gap-10 lg:grid-cols-2">

          <!-- Image gallery -->
          <div class="space-y-3">
            <img
              [src]="activeImageUrl(p)"
              [alt]="p.name"
              class="h-[34rem] w-full rounded-2xl object-cover"
            />
            @if (images().length > 1) {
              <div class="flex gap-2 overflow-x-auto">
                @for (img of images(); track img.id) {
                  <button
                    type="button"
                    (click)="selectedImageId.set(img.id)"
                    class="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition"
                    [class.border-black]="selectedImageId() === img.id"
                    [class.dark:border-white]="selectedImageId() === img.id"
                    [class.border-transparent]="selectedImageId() !== img.id"
                  >
                    <img [src]="img.url" [alt]="img.altText ?? p.name" class="h-full w-full object-cover" />
                  </button>
                }
              </div>
            }
          </div>

          <div class="app-card space-y-5 p-6 md:p-8">
            <a routerLink="/shop" class="text-sm text-neutral-600 underline underline-offset-4 dark:text-neutral-300">
              Back to shop
            </a>
            <h1 class="text-3xl font-semibold">{{ p.name }}</h1>
            @if (p.brand) {
              <p class="text-sm uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{{ p.brand }}</p>
            }
            <p class="text-neutral-600 dark:text-neutral-300">{{ p.description }}</p>

            <!-- price -->
            <div class="flex items-baseline gap-3">
              <p class="text-xl font-medium">{{ effectivePrice(p) | currency }}</p>
              @if (p.discountPrice < p.price && !selectedVariant()?.priceOverride) {
                <p class="text-sm text-neutral-400 line-through">{{ p.price | currency }}</p>
              }
            </div>

            <!-- rating summary -->
            @if (ratingSummary(); as rs) {
              <div class="flex items-center gap-2">
                <div class="flex text-yellow-400">
                  @for (star of [1,2,3,4,5]; track star) {
                    <span class="text-xl">{{ star <= rs.avgRating ? '★' : (star - 0.5 <= rs.avgRating ? '⯨' : '☆') }}</span>
                  }
                </div>
                <span class="text-sm font-medium">{{ rs.avgRating.toFixed(1) }}</span>
                <span class="text-sm text-neutral-500 dark:text-neutral-400">({{ rs.totalReviews }} reviews)</span>
              </div>
            } @else {
              <div class="flex items-center gap-2">
                <div class="flex text-neutral-300">
                  @for (star of [1,2,3,4,5]; track star) {
                    <span class="text-xl">☆</span>
                  }
                </div>
                <span class="text-sm text-neutral-500 dark:text-neutral-400">No ratings yet</span>
              </div>
            }

            <!-- ── Variant picker ──────────────────────────────────────────── -->
            @if (availableColors().length > 0) {
              <div class="space-y-2">
                <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Colour: <span class="font-normal">{{ selectedColor() }}</span>
                </p>
                <div class="flex flex-wrap gap-2">
                  @for (c of availableColors(); track c.color) {
                    <button
                      type="button"
                      (click)="selectColor(c.color)"
                      class="h-9 w-9 rounded-full border-2 transition"
                      [class.border-black]="selectedColor() === c.color"
                      [class.dark:border-white]="selectedColor() === c.color"
                      [class.border-neutral-200]="selectedColor() !== c.color"
                      [style.background-color]="c.colorHex ?? '#d6d3d1'"
                      [attr.aria-label]="c.color"
                      [title]="c.color"
                    ></button>
                  }
                </div>
              </div>
            }

            @if (availableSizes().length > 0) {
              <div class="space-y-2">
                <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Size: <span class="font-normal">{{ selectedSize() ?? '—' }}</span>
                </p>
                <div class="flex flex-wrap gap-2">
                  @for (s of availableSizes(); track s) {
                    <button
                      type="button"
                      (click)="selectSize(s)"
                      [disabled]="!isSizeAvailable(s)"
                      class="rounded-lg border px-4 py-2 text-sm transition"
                      [class.border-black]="selectedSize() === s"
                      [class.dark:border-white]="selectedSize() === s"
                      [class.bg-black]="selectedSize() === s"
                      [class.text-white]="selectedSize() === s"
                      [class.dark:bg-white]="selectedSize() === s"
                      [class.dark:text-black]="selectedSize() === s"
                      [class.border-neutral-200]="selectedSize() !== s"
                      [class.opacity-40]="!isSizeAvailable(s)"
                      [class.line-through]="!isSizeAvailable(s)"
                    >{{ s }}</button>
                  }
                </div>
              </div>
            }

            <!-- stock (variant-aware when variant selected) -->
            @if (effectiveStockStatus(); as status) {
              <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide"
                [class.bg-green-100]="status === 'IN_STOCK'"
                [class.text-green-700]="status === 'IN_STOCK'"
                [class.bg-yellow-100]="status === 'LOW_STOCK'"
                [class.text-yellow-700]="status === 'LOW_STOCK'"
                [class.bg-red-100]="status === 'OUT_OF_STOCK'"
                [class.text-red-700]="status === 'OUT_OF_STOCK'">
                <span class="h-1.5 w-1.5 rounded-full"
                  [class.bg-green-500]="status === 'IN_STOCK'"
                  [class.bg-yellow-500]="status === 'LOW_STOCK'"
                  [class.bg-red-500]="status === 'OUT_OF_STOCK'"></span>
                {{ status === 'IN_STOCK' ? 'In stock' : status === 'LOW_STOCK' ? 'Low stock' : 'Out of stock' }}
              </span>
            }

            <!-- quantity -->
            <div class="space-y-2">
              <p class="text-sm text-neutral-500 dark:text-neutral-400">Quantity</p>
              <div class="flex items-center gap-2">
                <button type="button" (click)="decreaseQty()"
                  class="rounded border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">-</button>
                <span class="min-w-8 text-center">{{ quantity() }}</span>
                <button type="button" (click)="increaseQty()"
                  class="rounded border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">+</button>
              </div>
            </div>

            <!-- actions -->
            <div class="flex flex-wrap gap-2">
              <button
                class="btn-primary w-full sm:w-auto"
                [disabled]="!canAddToCart()"
                (click)="addToCart(p)"
              >{{ addToCartLabel() }}</button>
              <button type="button" class="btn-secondary"
                (click)="store.toggleWishlist(toStr(p.id))">
                {{ store.isWishlisted(toStr(p.id)) ? 'Remove from wishlist' : 'Add to wishlist' }}
              </button>
            </div>

            @if (cartMessage()) {
              <p class="text-sm" [class.text-green-600]="!cartMessageError()" [class.text-red-600]="cartMessageError()">{{ cartMessage() }}</p>
            }

            <!-- Material / care -->
            @if (p.material || p.careInstructions) {
              <details class="border-t border-neutral-200 pt-4 text-sm dark:border-neutral-700">
                <summary class="cursor-pointer font-medium">Details &amp; care</summary>
                @if (p.material) {
                  <p class="mt-2"><span class="text-neutral-500">Material:</span> {{ p.material }}</p>
                }
                @if (p.careInstructions) {
                  <p class="mt-2 whitespace-pre-line text-neutral-600 dark:text-neutral-300">{{ p.careInstructions }}</p>
                }
              </details>
            }
          </div>
        </div>

        <!-- ── Related products ──────────────────────────────────────────── -->
        @if (related().length > 0) {
          <section>
            <h2 class="app-section-title mb-4">You may also like</h2>
            <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              @for (rel of related(); track rel.id) {
                <a [routerLink]="['/product', rel.id]" class="app-card overflow-hidden transition hover:-translate-y-0.5">
                  <img [src]="rel.imageUrl" [alt]="rel.name" class="h-56 w-full object-cover" />
                  <div class="p-4">
                    <p class="font-medium">{{ rel.name }}</p>
                    <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ rel.discountPrice | currency }}</p>
                  </div>
                </a>
              }
            </div>
          </section>
        }

        <!-- ── Recently viewed (Phase 8) ─────────────────────────────────── -->
        <app-recently-viewed [excludeId]="p.id" [limit]="6" />

        <!-- ── Reviews section ───────────────────────────────────────────── -->
        <section class="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">

          <!-- Submit / Edit form -->
          <article class="app-card space-y-4 p-6">
            <h2 class="text-xl font-semibold">
              {{ editingReviewId() ? 'Edit your review' : 'Write a review' }}
            </h2>

            @if (!auth.isAuthenticated()) {
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                <a routerLink="/account" class="underline underline-offset-4">Sign in</a> to leave a review.
              </p>
            } @else {
              <input
                [(ngModel)]="reviewOrderId"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Order ID (required)"
                class="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />

              <div class="flex gap-1">
                @for (star of [1,2,3,4,5]; track star) {
                  <button type="button"
                    (click)="reviewRating.set(star)"
                    class="text-2xl transition"
                    [class.text-yellow-400]="star <= reviewRating()"
                    [class.text-neutral-300]="star > reviewRating()"
                    [attr.aria-label]="star + ' star'"
                  >★</button>
                }
              </div>

              <textarea
                [(ngModel)]="reviewComment"
                [ngModelOptions]="{ standalone: true }"
                rows="4"
                placeholder="Share your thoughts… (optional)"
                class="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              ></textarea>

              @if (reviewError()) {
                <p class="text-sm text-red-500">{{ reviewError() }}</p>
              }

              <div class="flex gap-2">
                <button type="button" class="btn-primary flex-1"
                  [disabled]="reviewSubmitting()"
                  (click)="submitReview(p.id)">
                  {{ reviewSubmitting() ? 'Saving…' : (editingReviewId() ? 'Update review' : 'Submit review') }}
                </button>
                @if (editingReviewId()) {
                  <button type="button" class="btn-secondary" (click)="cancelEdit()">Cancel</button>
                }
              </div>

              @if (reviewSuccess()) {
                <p class="text-sm text-green-600">{{ reviewSuccess() }}</p>
              }
            }
          </article>

          <!-- Review list -->
          <article class="app-card p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-semibold">Customer reviews</h2>
              @if (ratingSummary(); as rs) {
                <div class="text-right text-sm text-neutral-500 dark:text-neutral-400">
                  <div class="flex justify-end text-yellow-400">
                    @for (star of [1,2,3,4,5]; track star) {
                      <span>{{ star <= rs.avgRating ? '★' : '☆' }}</span>
                    }
                  </div>
                  <p>{{ rs.avgRating.toFixed(1) }} · {{ rs.totalReviews }} reviews</p>
                </div>
              }
            </div>

            @if (reviewsLoading()) {
              <p class="app-muted text-sm">Loading reviews…</p>
            } @else {
              <div class="space-y-4">
                @for (review of reviews(); track review.reviewId) {
                  <div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                    <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p class="font-medium">{{ review.userName }}</p>
                        <p class="text-xs text-neutral-500 dark:text-neutral-400">
                          {{ review.createdAt | date: 'mediumDate' }}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-yellow-500">
                          {{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}
                        </span>
                        @if (auth.userId() === review.userId) {
                          <button (click)="startEdit(review)"
                            class="text-xs text-neutral-500 underline dark:text-neutral-400">Edit</button>
                          <button (click)="deleteReview(p.id, review.reviewId)"
                            class="text-xs text-red-500 underline">Delete</button>
                        }
                      </div>
                    </div>
                    @if (review.comment) {
                      <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ review.comment }}</p>
                    }
                  </div>
                } @empty {
                  <p class="text-sm text-neutral-500 dark:text-neutral-400">No reviews yet. Be the first!</p>
                }
              </div>

              @if (totalPages() > 1) {
                <div class="mt-4 flex items-center justify-between text-sm">
                  <button class="btn-secondary !px-3 !py-1.5 text-xs"
                    [disabled]="currentPage() === 0"
                    (click)="loadReviews(p.id, currentPage() - 1)">Previous</button>
                  <span class="text-neutral-500 dark:text-neutral-400">
                    Page {{ currentPage() + 1 }} of {{ totalPages() }}
                  </span>
                  <button class="btn-secondary !px-3 !py-1.5 text-xs"
                    [disabled]="currentPage() >= totalPages() - 1"
                    (click)="loadReviews(p.id, currentPage() + 1)">Next</button>
                </div>
              }
            }
          </article>
        </section>
      </section>
    } @else {
      <p class="app-muted">Product not found.</p>
    }
  `
})
export class ProductDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(EcommerceStore);
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly recents = inject(RecentlyViewedService);

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
  protected readonly selectedColor = signal<string | null>(null);

  // ── related ───────────────────────────────────────────────────────────────
  protected readonly related = signal<ApiProduct[]>([]);

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

  // ── computed: variant state ────────────────────────────────────────────────

  protected readonly availableColors = computed(() => {
    const map = new Map<string, { color: string; colorHex: string | null }>();
    for (const v of this.variants()) {
      if (v.color && !map.has(v.color)) {
        map.set(v.color, { color: v.color, colorHex: v.colorHex });
      }
    }
    return Array.from(map.values());
  });

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
    const size  = this.selectedSize();
    const color = this.selectedColor();
    return this.variants().find((v) =>
      (v.size ?? null) === size && (v.color ?? null) === color
    ) ?? null;
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
      const sizesPresent = this.availableSizes().length > 0;
      const colorsPresent = this.availableColors().length > 0;
      if (sizesPresent && !this.selectedSize()) return 'Select a size';
      if (colorsPresent && !this.selectedColor()) return 'Select a colour';
      return 'Select options';
    }
    if (this.effectiveStockStatus() === 'OUT_OF_STOCK') return 'Out of stock';
    return 'Add to cart';
  });

  // ── lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    if (isNaN(id)) { this.loading.set(false); return; }

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
        // Auto-select the first available colour & size for a smoother UX.
        const firstColor = this.availableColors()[0];
        if (firstColor) this.selectedColor.set(firstColor.color);
        const firstSize = this.availableSizes().find((s) => this.isSizeAvailable(s));
        if (firstSize) this.selectedSize.set(firstSize);
      });
  }

  protected selectColor(c: string): void {
    this.selectedColor.set(c);
    // If the currently selected size is unavailable in this colour, clear it.
    const size = this.selectedSize();
    if (size && !this.isSizeAvailable(size)) {
      this.selectedSize.set(null);
    }
  }

  protected selectSize(s: string): void {
    this.selectedSize.set(s);
  }

  protected isSizeAvailable(size: string): boolean {
    const color = this.selectedColor();
    return this.variants().some((v) =>
      v.size === size &&
      (color == null || v.color === color) &&
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

  protected effectivePrice(p: ApiProduct): number {
    const v = this.selectedVariant();
    if (v?.priceOverride != null) return v.priceOverride;
    return p.discountPrice;
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
    const variantLabel = variant?.name ?? (this.selectedSize() ?? 'One Size');

    if (!userId) {
      const unitPrice = variant?.priceOverride ?? p.discountPrice ?? p.price;
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
