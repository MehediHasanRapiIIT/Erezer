import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EcommerceStore } from '../core/store/ecommerce.store';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import {
  CheckoutQuoteResponse,
  ShippingZone,
} from '../core/api.models';

type PaymentMethod = 'CASH' | 'BKASH' | 'CARD';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, RouterLink],
  template: `
    <section class="grid gap-8 lg:grid-cols-[2fr_1fr]">

      <form [formGroup]="checkoutForm" (ngSubmit)="placeOrder()" class="app-card space-y-5 p-6">
        <h1 class="app-section-title text-2xl">Checkout</h1>

        @if (!auth.isAuthenticated()) {
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            You are checking out as a guest. <a routerLink="/account" class="underline underline-offset-4">Sign in</a> to save your order history.
          </div>
        }

        <div class="grid gap-4 md:grid-cols-2">
          <input formControlName="firstName" placeholder="First name"
            class="rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900" />
          <input formControlName="lastName" placeholder="Last name"
            class="rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900" />
          <input formControlName="email" placeholder="Email address"
            class="rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900" />
          <input formControlName="phone" placeholder="Phone number"
            class="rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900" />
          <input formControlName="address" placeholder="Delivery address"
            class="rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900 md:col-span-2" />
        </div>

        <!-- Shipping zone picker -->
        <div class="space-y-2">
          <p class="text-sm font-medium">Shipping zone</p>
          <div class="flex flex-wrap gap-2">
            @for (zone of shippingZones(); track zone.id) {
              <button
                type="button"
                (click)="selectZone(zone.id)"
                class="rounded-full border px-3 py-1.5 text-sm transition"
                [class.border-black]="selectedZoneId() === zone.id"
                [class.bg-black]="selectedZoneId() === zone.id"
                [class.text-white]="selectedZoneId() === zone.id"
                [class.border-neutral-300]="selectedZoneId() !== zone.id"
                [class.dark:border-neutral-700]="selectedZoneId() !== zone.id"
              >
                {{ zone.displayName }}
                <span class="ml-1 text-xs opacity-70">{{ zone.flatFee | currency }}</span>
              </button>
            }
          </div>
        </div>

        @if (errorMessage()) {
          <p class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {{ errorMessage() }}
          </p>
        }

        <button
          type="submit"
          class="btn-primary w-full"
          [disabled]="checkoutForm.invalid || store.cartCount() === 0 || submitting()"
        >
          {{ submitting() ? 'Placing order…' : payButtonLabel() }}
        </button>

        @if (confirmation()) {
          <p class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
            Order placed! Confirmation: <strong>{{ confirmation() }}</strong>
          </p>
        }
      </form>

      <!-- ── Order summary ──────────────────────────────────────────────── -->
      <aside class="space-y-4">
        <div class="app-card h-fit p-5">
          <h2 class="mb-3 text-lg font-semibold">Payment method</h2>
          <div class="flex flex-wrap gap-2">
            @for (method of paymentMethods; track method) {
              <button
                type="button"
                (click)="paymentMethod.set(method)"
                class="rounded-full border px-3 py-1.5 text-sm transition"
                [class.border-black]="paymentMethod() === method"
                [class.bg-black]="paymentMethod() === method"
                [class.text-white]="paymentMethod() === method"
                [class.border-neutral-300]="paymentMethod() !== method"
                [class.dark:border-neutral-700]="paymentMethod() !== method"
              >{{ paymentLabel(method) }}</button>
            }
          </div>
        </div>

        <div class="app-card h-fit p-5">
          <h2 class="mb-3 text-lg font-semibold">Order summary</h2>

          <!-- cart items -->
          <div class="mb-3 space-y-2">
            @for (item of store.cartItemsDetailed(); track item.product.id + item.size) {
              <div class="flex justify-between text-sm">
                <span class="text-neutral-600 dark:text-neutral-300">
                  {{ item.product.name }} × {{ item.quantity }}
                </span>
                <span>{{ item.subtotal | currency }}</span>
              </div>
            }
          </div>

          <div class="space-y-2 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
            <div class="flex justify-between"><span>Subtotal</span><span>{{ summarySubtotal() | currency }}</span></div>
            <div class="flex justify-between">
              <span>Shipping
                @if (quote(); as q) {
                  @if (q.shippingZoneName) { · {{ q.shippingZoneName }} }
                }
              </span>
              <span>{{ summaryShipping() | currency }}</span>
            </div>
            @if (summaryTax() > 0) {
              <div class="flex justify-between"><span>Tax</span><span>{{ summaryTax() | currency }}</span></div>
            }
            @if (summaryDiscount() > 0) {
              <div class="flex justify-between text-green-600">
                <span>Discount
                  @if (quote(); as q) { @if (q.couponCode) { · {{ q.couponCode }} } }
                </span>
                <span>-{{ summaryDiscount() | currency }}</span>
              </div>
            }
          </div>
          <div class="my-3 border-t border-neutral-200 dark:border-neutral-700"></div>
          <div class="flex justify-between font-semibold">
            <span>Total</span><span>{{ summaryTotal() | currency }}</span>
          </div>
          @if (quote()?.couponMessage && !quote()?.couponApplied) {
            <p class="mt-2 text-xs text-amber-600">{{ quote()?.couponMessage }}</p>
          }
        </div>
      </aside>
    </section>
  `
})
export class CheckoutPage implements OnInit {
  private readonly fb     = inject(FormBuilder);
  protected readonly store = inject(EcommerceStore);
  protected readonly auth  = inject(AuthService);
  private readonly api    = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly submitting    = signal(false);
  protected readonly confirmation  = signal('');
  protected readonly errorMessage  = signal('');
  protected readonly paymentMethod = signal<PaymentMethod>('CASH');

  protected readonly paymentMethods: PaymentMethod[] = ['CASH', 'BKASH', 'CARD'];

  protected readonly shippingZones   = signal<ShippingZone[]>([]);
  protected readonly selectedZoneId  = signal<number | null>(null);
  protected readonly quote           = signal<CheckoutQuoteResponse | null>(null);

  protected readonly summarySubtotal = computed(() => this.quote()?.subtotal ?? this.store.cartSubtotal());
  protected readonly summaryShipping = computed(() => this.quote()?.shippingFee ?? this.store.shippingFee());
  protected readonly summaryTax      = computed(() => this.quote()?.taxAmount ?? 0);
  protected readonly summaryDiscount = computed(() => this.quote()?.discountAmount ?? this.store.discountAmount());
  protected readonly summaryTotal    = computed(() => this.quote()?.total ?? this.store.cartTotal());

  protected readonly payButtonLabel = computed(() => {
    if (this.paymentMethod() === 'BKASH') return 'Pay with bKash';
    return 'Place order';
  });

  protected readonly checkoutForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName:  ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    phone:     [''],
    address:   ['', Validators.required],
  });

  constructor() {
    // Re-fetch the quote whenever the inputs that affect it change.
    effect(() => {
      const items = this.store.cartItemsDetailed();
      const zoneId = this.selectedZoneId();
      const address = this.checkoutForm.controls.address.value;
      const code = this.store.promoCode();
      if (items.length === 0) {
        this.quote.set(null);
        return;
      }
      this.fetchQuote(zoneId, address, code);
    });
  }

  ngOnInit(): void {
    // Checkout requires an account — send guests to sign in, then back here.
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/account'], { queryParams: { redirect: '/checkout' } });
      return;
    }

    // Load shipping zones first so the picker is populated.
    this.api.getShippingZones().pipe(catchError(() => of([] as ShippingZone[])))
      .subscribe((zones) => {
        this.shippingZones.set(zones);
        if (this.selectedZoneId() == null) {
          const def = zones.find((z) => z.isDefault) ?? zones[0];
          if (def) this.selectedZoneId.set(def.id);
        }
      });

    // pre-fill from profile if authenticated
    const userId = this.auth.userId();
    if (userId) {
      this.api.getProfile(userId).pipe(catchError(() => of(null))).subscribe((p) => {
        if (!p) return;
        this.checkoutForm.patchValue({
          firstName: p.firstName,
          lastName:  p.lastName,
          email:     p.email,
          phone:     p.phoneNumber,
          address:   p.addresses[0]?.address ?? '',
        });
      });
    }
  }

  protected selectZone(zoneId: number): void {
    this.selectedZoneId.set(zoneId);
  }

  protected paymentLabel(m: PaymentMethod): string {
    return m === 'CASH' ? 'Cash on Delivery'
         : m === 'BKASH' ? 'bKash'
         : 'Card';
  }

  private fetchQuote(zoneId: number | null, address: string | null, code: string | null): void {
    const items = this.store.cartItemsDetailed();
    if (items.length === 0) return;
    this.api.getCheckoutQuote({
      items: items.map((i) => ({
        productId: Number(i.product.id),
        quantity:  i.quantity,
        variantId: i.variantId,
      })),
      shippingZoneId: zoneId ?? undefined,
      deliveryAddress: address ?? undefined,
      couponCode: code || undefined,
      userId: this.auth.userId() ?? undefined,
    }).pipe(catchError(() => of(null))).subscribe((q) => {
      if (q) this.quote.set(q);
    });
  }

  protected placeOrder(): void {
    if (this.checkoutForm.invalid || this.store.cartCount() === 0) return;

    const userId = this.auth.userId();
    const form   = this.checkoutForm.getRawValue();
    const items  = this.store.cartItemsDetailed();

    // Checkout requires an account (the page guard also redirects guests).
    if (!userId) {
      void this.router.navigate(['/account'], { queryParams: { redirect: '/checkout' } });
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');

    const payload = {
      deliveryAddress: form.address,
      paymentMethod:   this.paymentMethod(),
      shopId:          1,
      deliveryCharge:  this.summaryShipping(),
      latitude:        null,
      longitude:       null,
      items:           items.map((i) => ({
        productId: Number(i.product.id),
        quantity:  i.quantity,
        variantId: i.variantId
      })),
      couponCode:      this.store.promoCode() || undefined,
      shippingZoneId:  this.selectedZoneId() ?? undefined,
    };

    this.api.createOrder(userId, payload)
      .pipe(catchError((err) => {
        this.errorMessage.set(err?.error?.message ?? 'Failed to place order. Please try again.');
        this.submitting.set(false);
        return of(null);
      }))
      .subscribe((order) => {
        if (!order) return;

        // Clear cart after the order is persisted.
        this.store.cart.set([]);
        this.store.clearPromoCode();
        this.confirmation.set(order.id);

        if (this.paymentMethod() === 'BKASH') {
          // Initiate bKash payment, then redirect to the gateway's URL.
          this.api.bkashInit(order.id)
            .pipe(catchError((err) => {
              this.errorMessage.set(err?.error?.message ?? 'Could not start bKash payment.');
              this.submitting.set(false);
              return of(null);
            }))
            .subscribe((init) => {
              this.submitting.set(false);
              if (init?.bkashURL) {
                window.location.href = init.bkashURL;
              } else {
                this.router.navigateByUrl(`/orders/${order.id}`);
              }
            });
        } else {
          this.submitting.set(false);
          setTimeout(() => void this.router.navigateByUrl(`/orders/${order.id}`), 900);
        }
      });
  }
}
