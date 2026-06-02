import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ApiOrder } from '../core/api.models';
import { AuthService } from '../core/auth.service';
import { EcommerceStore } from '../core/store/ecommerce.store';

@Component({
  standalone: true,
  imports: [DatePipe, CurrencyPipe, RouterLink],
  template: `
    <section class="space-y-6">
      <header>
        <h1 class="app-section-title">My Orders</h1>
        <p class="text-neutral-600 dark:text-neutral-300">Track payments and delivery from one place.</p>
      </header>

      @if (loading()) {
        <p class="app-muted">Loading orders…</p>
      } @else {
        <div class="space-y-3">
          <!-- API orders (authenticated) -->
          @for (order of apiOrders(); track order.id) {
            <article class="app-card p-5 transition hover:-translate-y-0.5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="font-medium">{{ order.id }}</p>
                  <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ order.createdAt | date: 'medium' }}</p>
                </div>
                <div class="text-right text-sm">
                  <p>Payment: {{ order.paymentMethod }}</p>
                  <p>
                    <span
                      class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                      [class]="badgeClass(order.orderStatus)"
                    >{{ statusLabel(order.orderStatus) }}</span>
                  </p>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-between">
                <p class="font-medium">{{ order.totalAmount | currency }}</p>
                <a [routerLink]="['/orders', order.id]" class="text-sm underline underline-offset-4">View details</a>
              </div>
            </article>
          }

          <!-- Local (guest) orders -->
          @for (order of store.orders(); track order.id) {
            <article class="app-card p-5 transition hover:-translate-y-0.5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="font-medium">{{ order.id }}</p>
                  <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ order.createdAt | date: 'medium' }}</p>
                </div>
                <div class="text-right text-sm">
                  <p>Payment: {{ order.payment.status }}</p>
                  <p>Delivery: {{ order.delivery.status }}</p>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-between">
                <p class="font-medium">{{ order.total | currency }}</p>
                <a [routerLink]="['/orders', order.id]" class="text-sm underline underline-offset-4">View details</a>
              </div>
            </article>
          }

          @if (apiOrders().length === 0 && store.orders().length === 0) {
            <p class="text-neutral-500 dark:text-neutral-400">No orders yet.</p>
          }
        </div>
      }
    </section>
  `
})
export class OrdersPage implements OnInit {
  protected readonly store = inject(EcommerceStore);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly loading   = signal(false);
  protected readonly apiOrders = signal<ApiOrder[]>([]);

  ngOnInit(): void {
    const userId = this.auth.userId();
    if (userId) {
      this.loading.set(true);
      this.api.getOrders(userId).pipe(catchError(() => of([]))).subscribe((orders) => {
        this.apiOrders.set(orders);
        this.loading.set(false);
      });
    }
  }

  protected statusLabel(status: string): string {
    switch (status) {
      case 'PLACED':           return 'Placed';
      case 'PENDING':          return 'Placed';
      case 'ACCEPTED':         return 'Accepted';
      case 'IN_PRODUCTION':    return 'In production';
      case 'PROCESSING':       return 'Processing';
      case 'SHIPPED':          return 'Shipped';
      case 'OUT_FOR_DELIVERY': return 'Out for delivery';
      case 'DELIVERED':        return 'Delivered';
      case 'CANCELLED':        return 'Cancelled';
      case 'RETURNED':         return 'Returned';
      default:                 return status;
    }
  }

  protected badgeClass(status: string): string {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'RETURNED':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
      case 'ACCEPTED':
      case 'IN_PRODUCTION':
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      default:
        return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    }
  }
}
