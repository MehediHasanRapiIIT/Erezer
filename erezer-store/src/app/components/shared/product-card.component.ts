import { CurrencyPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../core/models';
import { EcommerceStore } from '../../core/store/ecommerce.store';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, CurrencyPipe],
  template: `
    <article class="app-card group overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/30">
      <a [routerLink]="['/product', product().slug]" class="relative block">
        <img
          [src]="product().image"
          [alt]="product().name"
          class="h-80 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        @if (product().isFeatured) {
          <span class="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">Featured</span>
        }
      </a>
      <div class="space-y-3 p-5">
        <p class="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {{ product().category }}
        </p>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold tracking-tight">{{ product().name }}</h3>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ store.getAverageRating(product()).toFixed(1) }} / 5
              ({{ store.getReviewCount(product().id) }} reviews)
            </p>
          </div>
          <span class="text-base font-semibold">{{ product().price | currency }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-primary !px-3 !py-2 text-xs" (click)="quickAddToCart()">
            Quick add
          </button>
          <button type="button" class="btn-secondary !px-3 !py-2 text-xs" (click)="store.toggleWishlist(product().id)">
            {{ store.isWishlisted(product().id) ? 'Wishlisted' : 'Wishlist' }}
          </button>
          <a [routerLink]="['/product', product().slug]" class="ml-auto inline-flex text-sm font-medium text-neutral-900 underline underline-offset-4 dark:text-neutral-100">
            View
          </a>
        </div>
      </div>
    </article>
  `
})
export class ProductCardComponent {
  protected readonly store = inject(EcommerceStore);
  readonly product = input.required<Product>();

  protected quickAddToCart(): void {
    const selected = this.product();
    this.store.addToCart(selected.id, selected.sizes[0], 1);
  }
}
