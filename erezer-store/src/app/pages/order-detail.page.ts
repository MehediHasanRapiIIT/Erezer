import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ApiOrder, ApiOrderItem, OrderStatus, OrderTracking, ReturnRequestResponse } from '../core/api.models';
import { AuthService } from '../core/auth.service';
import { EcommerceStore } from '../core/store/ecommerce.store';

/** Display order for the storefront timeline. */
const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PLACED',           label: 'Placed' },
  { status: 'ACCEPTED',         label: 'Accepted' },
  { status: 'IN_PRODUCTION',    label: 'In production' },
  { status: 'PROCESSING',       label: 'Processing' },
  { status: 'SHIPPED',          label: 'Shipped' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED',        label: 'Delivered' },
];

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, FormsModule],
  template: `
    @if (loading()) {
      <p class="app-muted">Loading order…</p>
    } @else if (apiOrder(); as o) {
      <!-- ── API order ──────────────────────────────────────────────────────── -->
      <section class="space-y-6">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <a routerLink="/orders" class="text-sm text-neutral-600 underline underline-offset-4 dark:text-neutral-300">
              Back to orders
            </a>
            <h1 class="app-section-title mt-2">{{ o.id }}</h1>
          </div>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ o.createdAt | date: 'medium' }}</p>
        </header>

        <div class="grid gap-4 md:grid-cols-3">
          <article class="app-card p-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Payment</p>
            <p class="font-medium">{{ o.paymentMethod }}</p>
            @if (o.paymentId) {
              <p class="text-xs text-neutral-500 dark:text-neutral-400">ID: {{ o.paymentId }}</p>
            }
          </article>
          <article class="app-card p-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Status</p>
            <p class="font-medium">{{ statusLabel(currentStatus()) }}</p>
            @if (o.trackingNumber) {
              <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {{ o.courierName }} &middot; {{ o.trackingNumber }}
              </p>
            }
          </article>
          <article class="app-card p-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Shipping address</p>
            <p class="font-medium">{{ o.deliveryAddress }}</p>
          </article>
        </div>

        <!-- Timeline -->
        <article class="app-card p-5">
          <h2 class="mb-4 text-xl font-semibold">Order timeline</h2>

          @if (isCancelled()) {
            <div class="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              This order was cancelled.
              @if (o.cancellationReason) { Reason: {{ o.cancellationReason }} }
            </div>
          } @else if (isReturned()) {
            <div class="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              This order has been returned.
            </div>
          } @else {
            <ol class="grid gap-2 md:grid-cols-7">
              @for (step of steps; track step.status) {
                <li
                  class="rounded-lg border border-neutral-200 p-2 text-center text-xs dark:border-neutral-700"
                  [class.bg-black]="isStepReached(step.status)"
                  [class.text-white]="isStepReached(step.status)"
                  [class.dark:bg-white]="isStepReached(step.status)"
                  [class.dark:text-black]="isStepReached(step.status)"
                >{{ step.label }}</li>
              }
            </ol>
          }

          @if (tracking(); as t) {
            @if (t.history.length > 0) {
              <details class="mt-6 text-sm">
                <summary class="cursor-pointer select-none text-neutral-600 dark:text-neutral-300">
                  History ({{ t.history.length }} updates)
                </summary>
                <ul class="mt-3 space-y-2 border-l border-neutral-200 pl-4 dark:border-neutral-700">
                  @for (h of t.history; track h.id) {
                    <li>
                      <p>
                        <span class="font-medium">{{ statusLabel(h.toStatus) }}</span>
                        <span class="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                          {{ h.createdAt | date: 'medium' }}
                        </span>
                      </p>
                      @if (h.note) {
                        <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ h.note }}</p>
                      }
                    </li>
                  }
                </ul>
              </details>
            }
          }
        </article>

        <!-- Returns / RMA panel -->
        @if (existingReturn(); as r) {
          <article class="app-card p-5">
            <h2 class="mb-2 text-lg font-semibold">Return request</h2>
            <p class="text-sm">
              <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                [class]="returnBadgeClass(r.status)">{{ returnStatusLabel(r.status) }}</span>
              <span class="ml-2 text-neutral-500 dark:text-neutral-400">
                Filed {{ r.requestedAt | date: 'medium' }}
              </span>
            </p>
            @if (r.refundAmount !== null) {
              <p class="mt-2 text-sm">Refund: <strong>{{ r.refundAmount | currency }}</strong></p>
            }
            @if (r.adminNotes) {
              <p class="mt-2 text-sm italic text-neutral-600 dark:text-neutral-300">
                "{{ r.adminNotes }}"
              </p>
            }
          </article>
        } @else if (canRequestReturn()) {
          <article class="app-card p-5">
            <h2 class="mb-2 text-lg font-semibold">Need to return something?</h2>
            <p class="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
              You can request a return within 14 days of delivery.
            </p>
            <a [routerLink]="['/orders', apiOrder()!.id, 'return']" class="btn-secondary text-sm">
              Request a return
            </a>
          </article>
        }

        <!-- Cancel action -->
        @if (canCancel()) {
          <article class="app-card p-5">
            <h2 class="mb-2 text-lg font-semibold">Need to cancel?</h2>
            <p class="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
              You can cancel this order while it's still being prepared. Tell us why (optional):
            </p>
            <textarea
              [(ngModel)]="cancelReason"
              rows="2"
              maxlength="500"
              placeholder="Changed mind, wrong size, etc."
              class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"></textarea>
            @if (cancelError()) {
              <p class="mt-2 text-sm text-red-500">{{ cancelError() }}</p>
            }
            <button
              (click)="cancelOrder()"
              [disabled]="cancelling()"
              class="btn-secondary mt-3 text-sm">
              {{ cancelling() ? 'Cancelling…' : 'Cancel order' }}
            </button>
          </article>
        }

        <article class="app-card p-5">
          <h2 class="mb-4 text-xl font-semibold">Items & totals</h2>
          <div class="space-y-2">
            @for (item of o.orderItems; track item.id) {
              <div class="flex justify-between text-sm">
                <span>
                  {{ item.productName }}
                  @if (variantText(item)) {
                    <span class="text-neutral-500">({{ variantText(item) }})</span>
                  }
                  × {{ item.quantity }}
                </span>
                <span>{{ (item.priceAtOrder * item.quantity) | currency }}</span>
              </div>
            }
          </div>
          <div class="mt-4 space-y-1 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
            <div class="flex justify-between"><span>Shipping</span><span>{{ o.deliveryCharge | currency }}</span></div>
            <div class="flex justify-between font-medium"><span>Total</span><span>{{ o.totalAmount | currency }}</span></div>
          </div>
        </article>
      </section>

    } @else if (localOrder(); as lo) {
      <!-- ── Local (legacy guest) order ─────────────────────────────────────── -->
      <section class="space-y-6">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <a routerLink="/orders" class="text-sm text-neutral-600 underline underline-offset-4 dark:text-neutral-300">
              Back to orders
            </a>
            <h1 class="app-section-title mt-2">{{ lo.id }}</h1>
          </div>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ lo.createdAt | date: 'medium' }}</p>
        </header>

        <div class="grid gap-4 md:grid-cols-3">
          <article class="app-card p-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Payment</p>
            <p class="font-medium">{{ lo.payment.method }}</p>
            <p class="text-sm">Status: {{ lo.payment.status }}</p>
          </article>
          <article class="app-card p-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Delivery</p>
            <p class="font-medium">{{ lo.delivery.status }}</p>
            <p class="text-sm">ETA: {{ lo.delivery.estimatedDate | date: 'mediumDate' }}</p>
          </article>
          <article class="app-card p-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Shipping address</p>
            <p class="font-medium">{{ lo.shippingAddress.name }}</p>
            <p class="text-sm">{{ lo.shippingAddress.address }}</p>
          </article>
        </div>

        <article class="app-card p-5">
          <h2 class="mb-4 text-xl font-semibold">Items & totals</h2>
          <div class="space-y-2">
            @for (item of lo.items; track item.productId + item.size) {
              <div class="flex justify-between text-sm">
                <span>{{ productName(item.productId) }} ({{ item.size }}) × {{ item.quantity }}</span>
              </div>
            }
          </div>
          <div class="mt-4 space-y-1 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
            <div class="flex justify-between"><span>Subtotal</span><span>{{ lo.subtotal | currency }}</span></div>
            <div class="flex justify-between"><span>Shipping</span><span>{{ lo.shippingFee | currency }}</span></div>
            <div class="flex justify-between"><span>Discount</span><span>-{{ lo.discount | currency }}</span></div>
            <div class="flex justify-between font-medium"><span>Total</span><span>{{ lo.total | currency }}</span></div>
          </div>
        </article>
      </section>

    } @else {
      <section class="app-card p-6">
        <p class="text-neutral-600 dark:text-neutral-300">Order not found.</p>
      </section>
    }
  `
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(EcommerceStore);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly steps = TIMELINE_STEPS;

  protected readonly loading   = signal(true);
  protected readonly apiOrder  = signal<ApiOrder | null>(null);
  protected readonly tracking  = signal<OrderTracking | null>(null);
  protected readonly cancelError = signal<string | null>(null);
  protected readonly cancelling  = signal(false);
  protected cancelReason = '';

  // ── Phase 5: returns ───────────────────────────────────────────────────────
  protected readonly existingReturn = signal<ReturnRequestResponse | null>(null);

  /** True when the order is DELIVERED, no existing return, and within 14 days. */
  protected readonly canRequestReturn = computed(() => {
    if (this.existingReturn()) return false;
    if (this.currentStatus() !== 'DELIVERED') return false;
    return true;
  });

  protected readonly currentStatus = computed<OrderStatus>(() => {
    const t = this.tracking();
    if (t) return t.currentStatus;
    const o = this.apiOrder();
    return (o?.orderStatus as OrderStatus) ?? 'PLACED';
  });

  protected readonly isCancelled = computed(() => this.currentStatus() === 'CANCELLED');
  protected readonly isReturned  = computed(() => this.currentStatus() === 'RETURNED');

  protected readonly canCancel = computed(() => {
    const t = this.tracking();
    return !!t && t.allowedCustomerNextStates.includes('CANCELLED');
  });

  protected readonly localOrder = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.store.getOrderById(id) : undefined;
  });

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    const userId  = this.auth.userId();

    if (!orderId || !userId) {
      this.loading.set(false);
      return;
    }

    this.api.getOrderById(userId, orderId)
      .pipe(catchError(() => of(null)))
      .subscribe((o) => {
        this.apiOrder.set(o);
        this.loading.set(false);
      });

    this.api.trackOrder(userId, orderId)
      .pipe(catchError(() => of(null)))
      .subscribe((t) => this.tracking.set(t));

    // Pull any existing return so we can show its status banner.
    this.api.listMyReturns(userId)
      .pipe(catchError(() => of([] as ReturnRequestResponse[])))
      .subscribe((list) => {
        const match = list.find((r) => r.orderId === orderId) ?? null;
        this.existingReturn.set(match);
      });
  }

  // ── return helpers ────────────────────────────────────────────────────────

  protected returnStatusLabel(status: string): string {
    switch (status) {
      case 'REQUESTED': return 'Requested';
      case 'APPROVED':  return 'Approved';
      case 'REJECTED':  return 'Rejected';
      case 'PICKED_UP': return 'Picked up';
      case 'REFUNDED':  return 'Refunded';
      default:          return status;
    }
  }

  protected returnBadgeClass(status: string): string {
    switch (status) {
      case 'REFUNDED':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'APPROVED':
      case 'PICKED_UP':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  protected statusLabel(status: string): string {
    const found = TIMELINE_STEPS.find((s) => s.status === status);
    if (found) return found.label;
    switch (status) {
      case 'PENDING':   return 'Placed';
      case 'CANCELLED': return 'Cancelled';
      case 'RETURNED':  return 'Returned';
      default:          return status;
    }
  }

  protected isStepReached(target: OrderStatus): boolean {
    const order = TIMELINE_STEPS.map((s) => s.status);
    const current = this.currentStatus();
    const normCurrent = current === 'PENDING' ? 'PLACED' : current;
    const currIdx   = order.indexOf(normCurrent as OrderStatus);
    const targetIdx = order.indexOf(target);
    return currIdx >= 0 && targetIdx >= 0 && currIdx >= targetIdx;
  }

  protected async cancelOrder(): Promise<void> {
    const userId  = this.auth.userId();
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!userId || !orderId) return;
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.api.cancelOrder(userId, orderId, { reason: this.cancelReason || undefined })
      .pipe(catchError((err) => {
        this.cancelError.set(err?.error?.message ?? 'Could not cancel this order.');
        this.cancelling.set(false);
        return of(null);
      }))
      .subscribe((updated) => {
        this.cancelling.set(false);
        if (updated) {
          this.apiOrder.set(updated);
          this.api.trackOrder(userId, orderId)
            .pipe(catchError(() => of(null)))
            .subscribe((t) => this.tracking.set(t));
        }
      });
  }

  protected productName(productId: string): string {
    return this.store.products().find((p) => p.id === productId)?.name ?? 'Unknown Product';
  }

  /** "M · Charcoal" from a snapshotted order-line variant; '' if none. */
  protected variantText(item: ApiOrderItem): string {
    return [item.variantSize, item.variantColor].filter((v) => !!v && v.trim()).join(' · ');
  }
}
