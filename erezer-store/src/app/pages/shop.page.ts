import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { ApiCategory, ApiProduct } from '../core/api.models';
import { EcommerceStore } from '../core/store/ecommerce.store';
import { ProductCardComponent } from '../components/shared/product-card.component';

@Component({
  standalone: true,
  imports: [FormsModule, ProductCardComponent, RouterLink],
  template: `
    <section class="mb-8 app-card flex flex-wrap items-end justify-between gap-5 p-6 md:p-7">
      <div class="space-y-1">
        <h1 class="app-section-title">Shop</h1>
        <p class="app-muted">Discover premium essentials for everyday style.</p>
      </div>
      <label class="w-full md:w-96">
        <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
          Search catalog
        </span>
        <input
          [ngModel]="searchQuery()"
          (ngModelChange)="onSearchChange($event)"
          placeholder="Search products, collections..."
          class="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
    </section>

    <!-- ── Filters ─────────────────────────────────────────────────────────── -->
    <section class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <!-- "All" button -->
        <button
          (click)="selectCategory(null)"
          class="rounded-full border px-4 py-2 text-sm font-medium transition"
          [class.bg-black]="selectedCategoryId() === null"
          [class.text-white]="selectedCategoryId() === null"
          [class.border-black]="selectedCategoryId() === null"
          [class.border-neutral-300]="selectedCategoryId() !== null"
          [class.dark:border-neutral-700]="selectedCategoryId() !== null"
        >All</button>

        @for (cat of categories(); track cat.id) {
          <button
            (click)="selectCategory(cat.id)"
            class="rounded-full border px-4 py-2 text-sm font-medium transition"
            [class.bg-black]="selectedCategoryId() === cat.id"
            [class.text-white]="selectedCategoryId() === cat.id"
            [class.border-black]="selectedCategoryId() === cat.id"
            [class.border-neutral-300]="selectedCategoryId() !== cat.id"
            [class.dark:border-neutral-700]="selectedCategoryId() !== cat.id"
          >{{ cat.name }}</button>
        }
      </div>

      <div class="flex items-center gap-3">
        <select
          [ngModel]="sortBy()"
          (ngModelChange)="sortBy.set($event)"
          class="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          @for (opt of sortOptions; track opt.value) {
            <option [ngValue]="opt.value">{{ opt.label }}</option>
          }
        </select>
        <a routerLink="/wishlist" class="text-sm underline underline-offset-4">
          Wishlist ({{ store.wishlistProducts().length }})
        </a>
      </div>
    </section>

    <!-- ── Product grid ────────────────────────────────────────────────────── -->
    @if (loading()) {
      <p class="app-muted">Loading products…</p>
    } @else {
      <section class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        @for (product of sortedProducts(); track product.id) {
          <app-product-card [product]="store.toStoreProduct(product)" />
        } @empty {
          <p class="app-muted col-span-full">No products match your filters.</p>
        }
      </section>
    }
  `
})
export class ShopPage implements OnInit {
  protected readonly store = inject(EcommerceStore);
  private readonly api = inject(ApiService);

  // ── state signals ──────────────────────────────────────────────────────────
  protected readonly loading           = signal(false);
  protected readonly categories        = signal<ApiCategory[]>([]);
  protected readonly allProducts       = signal<ApiProduct[]>([]);
  protected readonly searchQuery       = signal('');
  protected readonly selectedCategoryId = signal<number | null>(null);
  protected readonly sortBy            = signal<'featured' | 'price-asc' | 'price-desc'>('featured');

  // RxJS search subject → signal bridge
  private readonly search$ = new Subject<string>();

  protected readonly sortOptions = [
    { label: 'Sort: Featured',      value: 'featured'   },
    { label: 'Price: Low to High',  value: 'price-asc'  },
    { label: 'Price: High to Low',  value: 'price-desc' },
  ] as const;

  // ── derived ────────────────────────────────────────────────────────────────
  protected readonly sortedProducts = computed(() => {
    const products = this.allProducts();
    const sort = this.sortBy();
    if (sort === 'price-asc')  return [...products].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') return [...products].sort((a, b) => b.price - a.price);
    return products; // server order = featured
  });

  constructor() {
    // wire up debounced search using takeUntilDestroyed (no manual unsubscribe needed)
    this.search$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap((q) => {
        this.loading.set(true);
        if (q.trim().length === 0) {
          return this.fetchProducts();
        }
        return this.api.searchProducts(q).pipe(catchError(() => of([])));
      }),
      takeUntilDestroyed()
    ).subscribe((products) => {
      this.allProducts.set(products);
      this.loading.set(false);
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadAllProducts();
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  protected selectCategory(id: number | null): void {
    this.selectedCategoryId.set(id);
    this.loading.set(true);
    const source$ = id === null
      ? this.fetchProducts()
      : this.api.getProductsByCategory(id).pipe(catchError(() => of([])));

    source$.subscribe((products) => {
      this.allProducts.set(products);
      this.loading.set(false);
    });
  }

  private loadCategories(): void {
    this.api.getCategories().pipe(catchError(() => of([]))).subscribe((cats) => {
      this.categories.set(cats.filter((c) => c.isActive));
    });
  }

  private loadAllProducts(): void {
    this.loading.set(true);
    this.fetchProducts().subscribe((products) => {
      this.allProducts.set(products);
      this.store.seedApiProducts(products);
      this.loading.set(false);
    });
  }

  private fetchProducts() {
    return this.api.getProducts().pipe(catchError(() => of([])));
  }
}
