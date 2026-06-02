import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ApiProduct } from '../../core/api.models';
import { RecentlyViewedService } from '../../core/recently-viewed.service';

/**
 * Shows the customer's last few visited products. Renders nothing when the
 * list is empty (so it's safe to drop on any page). Pass the current product
 * id on the PDP to exclude it from the carousel.
 */
@Component({
  selector: 'app-recently-viewed',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    @if (products().length > 0) {
      <section>
        <h2 class="app-section-title mb-4">{{ title() }}</h2>
        <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          @for (p of products(); track p.id) {
            <a [routerLink]="['/product', p.id]" class="app-card overflow-hidden transition hover:-translate-y-0.5">
              <img [src]="p.imageUrl" [alt]="p.name" class="h-40 w-full object-cover" />
              <div class="p-3">
                <p class="truncate text-sm font-medium">{{ p.name }}</p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ p.discountPrice | currency }}</p>
              </div>
            </a>
          }
        </div>
      </section>
    }
  `,
})
export class RecentlyViewedComponent implements OnInit {
  /** PDP excludes the product currently being viewed. */
  readonly excludeId = input<number | string | null>(null);
  readonly limit     = input<number>(6);
  readonly title     = input<string>('Recently viewed');

  private readonly recents = inject(RecentlyViewedService);
  private readonly api     = inject(ApiService);

  protected readonly products = signal<ApiProduct[]>([]);

  /** Recompute the id list (excluding the current PDP) whenever inputs change. */
  protected readonly idsToFetch = computed(() =>
    this.recents.others(this.excludeId(), this.limit())
  );

  ngOnInit(): void {
    const ids = this.idsToFetch();
    if (ids.length === 0) {
      this.products.set([]);
      return;
    }
    // Fetch in parallel; tolerate per-product failures (the product may have
    // been deleted since the user viewed it).
    forkJoin(ids.map((id) =>
      this.api.getProductById(id).pipe(catchError(() => of(null))),
    )).subscribe((results) => {
      const ordered: ApiProduct[] = [];
      for (let i = 0; i < ids.length; i++) {
        const product = results[i];
        if (product) ordered.push(product);
      }
      this.products.set(ordered);
    });
  }
}
