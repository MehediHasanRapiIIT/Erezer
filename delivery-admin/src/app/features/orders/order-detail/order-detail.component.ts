import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { OrderService } from '../../../core/services/order.service';
import {
  OrderItem,
  OrderResponse,
  OrderStatus,
  OrderStatusOption,
  OrderTrackingResponse,
} from '../../../core/models/api.models';
import { parseApiError } from '../../../core/utils/api-error.util';
import { OrderNotesComponent } from '../order-notes/order-notes.component';

// Display order for the lifecycle timeline (PENDING omitted — it's a legacy alias).
const TIMELINE: OrderStatus[] = [
  'PLACED',
  'ACCEPTED',
  'IN_PRODUCTION',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [FormsModule, SidebarComponent, OrderNotesComponent],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);

  readonly order = signal<OrderResponse | null>(null);
  readonly tracking = signal<OrderTrackingResponse | null>(null);
  readonly statusOptions = signal<OrderStatusOption[]>([]);

  readonly selectedStatus = signal<OrderStatus>('PLACED');
  readonly statusNote = signal('');
  readonly courierName = signal('');
  readonly trackingNumber = signal('');

  readonly isUpdating = signal(false);
  readonly updateError = signal('');
  readonly updateSuccess = signal(false);

  /** Current status drawn from the tracking endpoint when available, else order. */
  readonly currentStatus = computed<OrderStatus>(() => {
    const t = this.tracking();
    if (t) return t.currentStatus;
    const raw = this.order()?.orderStatus ?? 'PLACED';
    return (raw === 'PENDING' ? 'PLACED' : raw) as OrderStatus;
  });

  /** Statuses the admin is allowed to transition to right now. */
  readonly allowedNext = computed<OrderStatus[]>(() => {
    const current = this.currentStatus();
    const opt = this.statusOptions().find((s) => s.status === current);
    return opt ? opt.allowedNext : [];
  });

  readonly statusChanged = computed(() => this.selectedStatus() !== this.currentStatus());

  readonly shippingFieldsRequired = computed(() => this.selectedStatus() === 'SHIPPED');

  // ── lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Order passed via router state — read from history.state which persists after navigation
    const stateOrder = history.state?.order as OrderResponse | undefined;

    if (!stateOrder) {
      this.router.navigate(['/orders']);
      return;
    }

    this.order.set(stateOrder);
    this.selectedStatus.set(this.normalizeStatus(stateOrder.orderStatus));
    this.courierName.set(stateOrder.courierName ?? '');
    this.trackingNumber.set(stateOrder.trackingNumber ?? '');

    this.loadTracking(stateOrder.id);
    this.loadStatusOptions();
  }

  private loadTracking(orderId: string): void {
    this.orderService.getTracking(orderId)
      .pipe(catchError(() => of(null)))
      .subscribe((t) => {
        this.tracking.set(t);
        if (t) {
          // Default the dropdown to the first legal next state if any.
          const opt = this.statusOptions().find((s) => s.status === t.currentStatus);
          const first = opt?.allowedNext[0];
          if (first) {
            this.selectedStatus.set(first);
          } else {
            this.selectedStatus.set(t.currentStatus);
          }
        }
      });
  }

  private loadStatusOptions(): void {
    this.orderService.getStatusOptions()
      .pipe(catchError(() => of([] as OrderStatusOption[])))
      .subscribe((opts) => {
        this.statusOptions.set(opts);
        // Re-default selectedStatus once options arrive.
        const opt = opts.find((s) => s.status === this.currentStatus());
        const first = opt?.allowedNext[0];
        if (first && this.selectedStatus() === this.currentStatus()) {
          this.selectedStatus.set(first);
        }
      });
  }

  // ── nav helpers ────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/orders']);
  }

  printInvoice(): void {
    window.print();
  }

  scrollToStatus(): void {
    document.getElementById('status-update-panel')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── timeline ──────────────────────────────────────────────────────────────

  timeline(): { label: string; status: OrderStatus; done: boolean; time?: string }[] {
    const o = this.order();
    if (!o) return [];
    const current = this.currentStatus();
    if (current === 'CANCELLED' || current === 'RETURNED') {
      return [];
    }
    const currIdx = TIMELINE.indexOf(current);
    return TIMELINE.map((s, i) => ({
      label: this.statusLabel(s),
      status: s,
      done: currIdx >= 0 && i <= currIdx,
      time: i === 0 ? this.formatDate(o.createdAt) : undefined,
    }));
  }

  // ── status update ──────────────────────────────────────────────────────────

  onUpdateStatus(): void {
    const o = this.order();
    if (!o) return;

    if (this.shippingFieldsRequired() && (!this.courierName().trim() || !this.trackingNumber().trim())) {
      this.updateError.set('Courier and tracking number are required when marking as Shipped.');
      return;
    }

    this.isUpdating.set(true);
    this.updateError.set('');
    this.updateSuccess.set(false);

    this.orderService.updateOrderStatusFull(o.id, {
      status: this.selectedStatus(),
      note: this.statusNote().trim() || undefined,
      courierName: this.courierName().trim() || undefined,
      trackingNumber: this.trackingNumber().trim() || undefined,
    }).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.statusNote.set('');
        this.isUpdating.set(false);
        this.updateSuccess.set(true);
        this.loadTracking(updated.id);
        setTimeout(() => this.updateSuccess.set(false), 3000);
      },
      error: (err) => {
        this.updateError.set(parseApiError(err));
        this.isUpdating.set(false);
      },
    });
  }

  // ── formatting helpers ─────────────────────────────────────────────────────

  statusLabel(status: string): string {
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

  statusBadgeClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'PLACED':
      case 'PENDING':           return 'bg-yellow-100 text-yellow-700';
      case 'ACCEPTED':          return 'bg-blue-100 text-blue-700';
      case 'IN_PRODUCTION':     return 'bg-sky-100 text-sky-700';
      case 'PROCESSING':        return 'bg-orange-100 text-orange-700';
      case 'SHIPPED':           return 'bg-purple-100 text-purple-700';
      case 'OUT_FOR_DELIVERY':  return 'bg-indigo-100 text-indigo-700';
      case 'DELIVERED':         return 'bg-emerald-100 text-emerald-700';
      case 'CANCELLED':         return 'bg-red-100 text-red-600';
      case 'RETURNED':          return 'bg-amber-100 text-amber-700';
      default:                  return 'bg-gray-100 text-gray-600';
    }
  }

  private normalizeStatus(raw: string): OrderStatus {
    const upper = (raw || '').toUpperCase();
    return upper === 'PENDING' ? 'PLACED' : (upper as OrderStatus);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatAmount(amount: number | string): string {
    return Number(amount).toLocaleString('en-BD', { minimumFractionDigits: 2 });
  }

  shortId(id: string): string {
    return id ? '#' + id.slice(0, 8).toUpperCase() : '—';
  }

  /** "Size M · Charcoal" style label from an order line's snapshotted variant. */
  variantLabel(item: OrderItem): string {
    const parts: string[] = [];
    if (item.variantSize)  parts.push(`Size ${item.variantSize}`);
    if (item.variantColor) parts.push(item.variantColor);
    if (parts.length === 0 && item.variantName) parts.push(item.variantName);
    return parts.join(' · ');
  }

  subtotal(): number {
    const o = this.order();
    if (!o) return 0;
    return o.orderItems.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
  }

  grandTotal(): number {
    const o = this.order();
    if (!o) return 0;
    return this.subtotal() + Number(o.deliveryCharge ?? 0);
  }
}
