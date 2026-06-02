import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { CouponValidateResponse } from '../core/api.models';
import { EcommerceStore } from '../core/store/ecommerce.store';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink, FormsModule],
  template: `
    <section class="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div class="space-y-4">
        <h1 class="app-section-title">Your Cart</h1>

        @if (loading()) {
          <p class="app-muted">Loading cart…</p>
        } @else {
          @for (item of store.cartItemsDetailed(); track item.product.id + item.size) {
            <article class="app-card flex gap-4 p-4">
              <img [src]="item.product.image" [alt]="item.product.name" class="h-28 w-24 rounded-lg object-cover" />
              <div class="flex-1 space-y-2">
                <div class="flex justify-between">
                  <h2 class="font-medium">{{ item.product.name }}</h2>
                  <p>{{ item.subtotal | currency }}</p>
                </div>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">Size: {{ item.size }}</p>
                <div class="flex items-center gap-2">
                  <button
                    (click)="decreaseQty(item.product.id, item.variantId, item.size, item.quantity)"
                    class="rounded border border-neutral-300 px-2"
                  >-</button>
                  <span>{{ item.quantity }}</span>
                  <button
                    (click)="increaseQty(item.product.id, item.variantId, item.size, item.quantity)"
                    class="rounded border border-neutral-300 px-2"
                  >+</button>
                  <button
                    (click)="removeItem(item.product.id, item.variantId, item.size)"
                    class="ml-3 text-sm text-neutral-500 underline dark:text-neutral-400"
                  >Remove</button>
                </div>
              </div>
            </article>
          } @empty {
            <p class="app-muted">Your cart is empty.</p>
          }
        }

        @if (stockWarning()) {
          <p class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {{ stockWarning() }}
          </p>
        }
      </div>

      <!-- ── Order summary ─────────────────────────────────────────────────── -->
      <aside class="app-card h-fit p-5">
        <h2 class="mb-4 text-lg font-semibold">Order summary</h2>

        <div class="mb-4 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">Promo code</p>
          <div class="flex gap-2">
            <input
              [ngModel]="codeInput()"
              (ngModelChange)="codeInput.set($event)"
              placeholder="e.g. WELCOME10"
              [disabled]="couponLocked()"
              class="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
            />
            @if (couponLocked()) {
              <button type="button" class="btn-secondary !px-3 !py-2 text-xs" (click)="removeCoupon()">Remove</button>
            } @else {
              <button type="button" class="btn-secondary !px-3 !py-2 text-xs"
                (click)="applyCoupon()" [disabled]="applying() || !codeInput().trim()">
                {{ applying() ? '…' : 'Apply' }}
              </button>
            }
          </div>
          @if (appliedCoupon(); as c) {
            @if (c.valid) {
              <p class="text-xs text-green-600">
                Coupon <strong>{{ c.code }}</strong> applied
                @if (c.removesShipping) { · free shipping }
              </p>
            } @else if (c.reason) {
              <p class="text-xs text-red-500">{{ c.reason }}</p>
            }
          }
        </div>

        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span>Subtotal</span><span>{{ store.cartSubtotal() | currency }}</span></div>
          <div class="flex justify-between"><span>Shipping</span><span>{{ effectiveShipping() | currency }}</span></div>
          <div class="flex justify-between"><span>Discount</span><span>-{{ effectiveDiscount() | currency }}</span></div>
        </div>
        <div class="my-4 border-t border-neutral-200 dark:border-neutral-700"></div>
        <div class="flex justify-between font-medium"><span>Estimated total</span><span>{{ estimatedTotal() | currency }}</span></div>
        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Final shipping is calculated at checkout based on your delivery address.
        </p>
        @if (auth.isAuthenticated()) {
          <a routerLink="/checkout" class="btn-primary mt-5 w-full">Continue to checkout</a>
        } @else {
          <a routerLink="/account" [queryParams]="{ redirect: '/checkout' }" class="btn-primary mt-5 w-full">Sign in to checkout</a>
        }
      </aside>
    </section>
  `
})
export class CartPage implements OnInit {
  protected readonly store = inject(EcommerceStore);
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);

  protected readonly loading      = signal(false);
  protected readonly stockWarning = signal('');
  protected readonly codeInput    = signal('');
  protected readonly applying     = signal(false);
  protected readonly appliedCoupon = signal<CouponValidateResponse | null>(null);

  protected readonly couponLocked = computed(() => !!this.appliedCoupon()?.valid);

  protected readonly effectiveDiscount = computed(() => {
    const c = this.appliedCoupon();
    return c?.valid ? c.discountAmount : 0;
  });

  protected readonly effectiveShipping = computed(() => {
    const c = this.appliedCoupon();
    if (c?.valid && c.removesShipping) return 0;
    return this.store.shippingFee();
  });

  protected readonly estimatedTotal = computed(() =>
    Math.max(0, this.store.cartSubtotal() - this.effectiveDiscount() + this.effectiveShipping())
  );

  // map productId+'|'+variantId → API cart item id (needed for PATCH/DELETE)
  private readonly apiCartMap = signal<Map<string, string>>(new Map());

  private cartItemId(productId: string, variantId: number | null): string | undefined {
    return this.apiCartMap().get(productId + '|' + (variantId ?? ''));
  }

  ngOnInit(): void {
    // Rehydrate previously-applied promo code so the customer doesn't lose state on refresh.
    const saved = this.store.promoCode();
    if (saved) {
      this.codeInput.set(saved);
      this.applyCoupon();
    }
    const userId = this.auth.userId();
    if (userId) {
      this.loadApiCart(userId);
    }
  }

  protected applyCoupon(): void {
    const code = this.codeInput().trim();
    if (!code) return;
    this.applying.set(true);
    this.api.validateCoupon({
      code,
      cartSubtotal: this.store.cartSubtotal(),
      userId: this.auth.userId() ?? undefined,
    }).pipe(catchError((err) => {
      this.applying.set(false);
      this.appliedCoupon.set({
        valid: false, code, discountType: null, discountAmount: 0,
        removesShipping: false, reason: err?.error?.message ?? 'Could not validate coupon.'
      });
      return of(null);
    })).subscribe((result) => {
      this.applying.set(false);
      if (!result) return;
      this.appliedCoupon.set(result);
      if (result.valid) {
        this.store.setPromoCode(code);
      }
    });
  }

  protected removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.codeInput.set('');
    this.store.clearPromoCode();
  }

  private loadApiCart(userId: string): void {
    this.loading.set(true);
    this.api.getCart(userId).pipe(catchError(() => of([]))).subscribe((items) => {
      this.store.loadApiCart(items);
      const map = new Map<string, string>();
      items.forEach((i) => map.set(String(i.productId) + '|' + (i.variantId ?? ''), i.cartItemId));
      this.apiCartMap.set(map);
      this.loading.set(false);
      this.validateStock(userId);
    });
  }

  private validateStock(userId: string): void {
    this.api.validateCartStock(userId).pipe(catchError(() => of(null))).subscribe((result) => {
      if (result && !result.valid) {
        this.stockWarning.set('Some items in your cart are out of stock or have insufficient quantity.');
      }
    });
  }

  protected increaseQty(productId: string, variantId: number | null, size: string, current: number): void {
    this.store.updateCartQuantity(productId, size, current + 1);
    const userId = this.auth.userId();
    const id = this.cartItemId(productId, variantId);
    if (userId && id) {
      this.api.incrementCartItem(userId, id).pipe(catchError(() => of(null))).subscribe();
    }
  }

  protected decreaseQty(productId: string, variantId: number | null, size: string, current: number): void {
    if (current <= 1) {
      this.removeItem(productId, variantId, size);
      return;
    }
    this.store.updateCartQuantity(productId, size, current - 1);
    const userId = this.auth.userId();
    const id = this.cartItemId(productId, variantId);
    if (userId && id) {
      this.api.decrementCartItem(userId, id).pipe(catchError(() => of(null))).subscribe();
    }
  }

  protected removeItem(productId: string, variantId: number | null, size: string): void {
    this.store.removeFromCart(productId, size);
    const userId = this.auth.userId();
    const id = this.cartItemId(productId, variantId);
    if (userId && id) {
      this.api.removeCartItem(userId, id).pipe(catchError(() => of(null))).subscribe();
    }
  }
}
