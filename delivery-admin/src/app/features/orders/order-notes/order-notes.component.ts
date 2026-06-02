import { Component, inject, input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { OrderNote, OrderNoteService } from '../../../core/services/order-note.service';
import { parseApiError } from '../../../core/utils/api-error.util';

@Component({
  selector: 'app-order-notes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <section class="bg-white rounded-xl border border-gray-200 p-5">
      <header class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="font-bold text-gray-900 text-sm">Internal notes</h2>
          <p class="text-xs text-gray-500">Visible to admins only. Never sent to the customer.</p>
        </div>
      </header>

      @if (error()) {
        <p class="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="text-sm text-gray-400">Loading notes…</p>
      } @else {
        <ul class="space-y-2">
          @for (n of notes(); track n.id) {
            <li class="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ n.body }}</p>
                <button (click)="remove(n)" class="text-xs text-red-500 underline">Delete</button>
              </div>
              <p class="mt-1 text-xs text-gray-400">
                {{ n.author || 'admin' }} &middot; {{ n.createdAt | date: 'medium' }}
              </p>
            </li>
          } @empty {
            <li class="text-xs text-gray-400">No internal notes yet.</li>
          }
        </ul>
      }

      <div class="mt-4 flex gap-2">
        <input
          [(ngModel)]="draft"
          placeholder="Add a note (Enter to save)"
          maxlength="4000"
          (keyup.enter)="add()"
          class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <button (click)="add()" [disabled]="adding() || !draft.trim()"
          class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
          {{ adding() ? 'Saving…' : 'Add note' }}
        </button>
      </div>
    </section>
  `,
})
export class OrderNotesComponent implements OnChanges {
  readonly orderId = input.required<string>();

  private readonly api = inject(OrderNoteService);

  readonly notes   = signal<OrderNote[]>([]);
  readonly loading = signal(false);
  readonly adding  = signal(false);
  readonly error   = signal<string>('');

  protected draft = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId']) this.reload();
  }

  reload(): void {
    const id = this.orderId();
    if (!id) return;
    this.loading.set(true);
    this.api.list(id).pipe(catchError(() => of([] as OrderNote[]))).subscribe((list) => {
      this.notes.set(list);
      this.loading.set(false);
    });
  }

  protected add(): void {
    const body = this.draft.trim();
    if (!body) return;
    this.adding.set(true);
    this.error.set('');
    this.api.create(this.orderId(), body)
      .pipe(catchError((err) => { this.error.set(parseApiError(err)); this.adding.set(false); return of(null); }))
      .subscribe((created) => {
        this.adding.set(false);
        if (created) {
          this.notes.update((list) => [created, ...list]);
          this.draft = '';
        }
      });
  }

  protected remove(n: OrderNote): void {
    if (!confirm('Delete this note?')) return;
    this.api.delete(this.orderId(), n.id)
      .pipe(catchError((err) => { this.error.set(parseApiError(err)); return of(null); }))
      .subscribe(() => {
        this.notes.update((list) => list.filter((x) => x.id !== n.id));
      });
  }
}
