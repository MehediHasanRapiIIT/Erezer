import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import {
  AdminNewsletterService,
  CampaignAudience,
  CampaignRequest,
  CampaignStatus,
  NewsletterCampaign,
  NewsletterSubscriber,
} from '../../core/services/newsletter.service';
import { parseApiError } from '../../core/utils/api-error.util';

type Tab = 'subscribers' | 'campaigns' | 'compose';

@Component({
  selector: 'app-newsletter',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, SidebarComponent],
  template: `
    <div class="flex h-screen bg-gray-50 overflow-hidden">
      <app-sidebar />

      <div class="flex-1 flex flex-col overflow-hidden">
        <header class="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
          <h1 class="text-lg font-bold text-gray-900">Newsletter</h1>
          @if (activeCount() !== null) {
            <p class="text-sm text-gray-500">{{ activeCount() | number }} active subscriber(s)</p>
          }
        </header>

        <nav class="bg-white border-b border-gray-200 px-6 flex gap-1">
          @for (t of tabs; track t.id) {
            <button
              (click)="setTab(t.id)"
              class="px-4 py-2 text-sm font-medium border-b-2 transition"
              [class.border-blue-500]="tab() === t.id"
              [class.text-blue-600]="tab() === t.id"
              [class.border-transparent]="tab() !== t.id"
              [class.text-gray-500]="tab() !== t.id"
              [class.hover:text-gray-800]="tab() !== t.id">
              {{ t.label }}
            </button>
          }
        </nav>

        <main class="flex-1 overflow-y-auto p-6">
          <div class="max-w-5xl mx-auto">

            @if (error()) {
              <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error() }}</p>
            }

            @switch (tab()) {

              <!-- ── Subscribers ─────────────────────────────────────────── -->
              @case ('subscribers') {
                <section class="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <header class="border-b border-gray-100 bg-gray-50 px-4 py-2 flex items-center justify-between text-xs uppercase text-gray-400">
                    <span>{{ subscribers().length }} row(s)</span>
                    <select [ngModel]="subFilter()" (ngModelChange)="setSubFilter($event)"
                      class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs uppercase text-gray-500">
                      <option value="ALL">All</option>
                      <option value="SUBSCRIBED">Subscribed</option>
                      <option value="UNSUBSCRIBED">Unsubscribed</option>
                    </select>
                  </header>
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-gray-100 text-xs uppercase text-gray-400">
                        <th class="px-4 py-2 text-left">Email</th>
                        <th class="px-4 py-2 text-left">Status</th>
                        <th class="px-4 py-2 text-left">Source</th>
                        <th class="px-4 py-2 text-left">Subscribed</th>
                        <th class="px-4 py-2 text-left">Unsubscribed</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                      @for (s of subscribers(); track s.id) {
                        <tr>
                          <td class="px-4 py-2">{{ s.email }}</td>
                          <td class="px-4 py-2">
                            <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                              [class]="s.status === 'SUBSCRIBED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'">
                              {{ s.status }}
                            </span>
                          </td>
                          <td class="px-4 py-2 text-xs text-gray-500">{{ s.source || '—' }}</td>
                          <td class="px-4 py-2 text-xs text-gray-500">{{ s.subscribedAt | date: 'mediumDate' }}</td>
                          <td class="px-4 py-2 text-xs text-gray-500">{{ s.unsubscribedAt | date: 'mediumDate' }}</td>
                        </tr>
                      } @empty {
                        <tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">No subscribers yet.</td></tr>
                      }
                    </tbody>
                  </table>
                </section>
              }

              <!-- ── Campaigns ──────────────────────────────────────────── -->
              @case ('campaigns') {
                <section class="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-400">
                        <th class="px-4 py-2 text-left">Subject</th>
                        <th class="px-4 py-2 text-left">Status</th>
                        <th class="px-4 py-2 text-left">Audience</th>
                        <th class="px-4 py-2 text-right">Sent</th>
                        <th class="px-4 py-2 text-right">Failed</th>
                        <th class="px-4 py-2 text-left">Sent at</th>
                        <th class="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                      @for (c of campaigns(); track c.id) {
                        <tr>
                          <td class="px-4 py-2 font-medium">{{ c.subject }}</td>
                          <td class="px-4 py-2">
                            <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                              [class]="badgeClass(c.status)">{{ c.status }}</span>
                          </td>
                          <td class="px-4 py-2 text-xs text-gray-500">{{ c.audience }}</td>
                          <td class="px-4 py-2 text-right">{{ c.sentCount }}</td>
                          <td class="px-4 py-2 text-right text-red-500">{{ c.failCount || '' }}</td>
                          <td class="px-4 py-2 text-xs text-gray-500">{{ c.sentAt | date: 'mediumDate' }}</td>
                          <td class="px-4 py-2 text-right">
                            @if (c.status === 'DRAFT' || c.status === 'FAILED') {
                              <button (click)="send(c)" [disabled]="acting()"
                                class="text-xs font-semibold text-blue-600 underline">Send</button>
                              <button (click)="loadIntoCompose(c)" class="ml-3 text-xs text-gray-600 underline">Edit</button>
                              <button (click)="remove(c)" [disabled]="acting()"
                                class="ml-3 text-xs text-red-500 underline">Delete</button>
                            }
                          </td>
                        </tr>
                      } @empty {
                        <tr><td colspan="7" class="px-4 py-6 text-center text-gray-400">No campaigns yet — compose one in the Compose tab.</td></tr>
                      }
                    </tbody>
                  </table>
                </section>
              }

              <!-- ── Compose ────────────────────────────────────────────── -->
              @case ('compose') {
                <section class="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                  <h2 class="font-bold text-gray-900">
                    {{ editingId() ? 'Edit draft' : 'New campaign' }}
                  </h2>
                  <label class="block text-xs font-medium text-gray-600">
                    Subject
                    <input [(ngModel)]="form.subject" maxlength="255"
                      class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </label>
                  <label class="block text-xs font-medium text-gray-600">
                    Audience
                    <select [(ngModel)]="form.audience"
                      class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                      <option value="ALL_SUBSCRIBERS">All newsletter subscribers</option>
                      <option value="REGISTERED_CUSTOMERS">Registered customers (excluding unsubscribed)</option>
                    </select>
                  </label>
                  <label class="block text-xs font-medium text-gray-600">
                    Body (HTML allowed)
                    <textarea [(ngModel)]="form.bodyHtml" rows="14"
                      class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"></textarea>
                  </label>
                  <div class="flex gap-2">
                    <button (click)="saveDraft()" [disabled]="acting() || !canSave()"
                      class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                      {{ editingId() ? 'Save changes' : 'Save draft' }}
                    </button>
                    @if (editingId()) {
                      <button (click)="cancelEdit()"
                        class="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                    }
                  </div>
                  <p class="text-xs text-gray-500">
                    Tip: write semantic HTML — &lt;p&gt;, &lt;strong&gt;, &lt;a href&gt;… The template wraps it in the
                    Erezer header/footer and adds the unsubscribe link automatically.
                  </p>
                </section>
              }
            }
          </div>
        </main>
      </div>
    </div>
  `,
})
export class NewsletterComponent implements OnInit {
  private readonly api = inject(AdminNewsletterService);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'subscribers', label: 'Subscribers' },
    { id: 'campaigns',   label: 'Campaigns' },
    { id: 'compose',     label: 'Compose' },
  ];

  readonly tab           = signal<Tab>('subscribers');
  readonly subscribers   = signal<NewsletterSubscriber[]>([]);
  readonly campaigns     = signal<NewsletterCampaign[]>([]);
  readonly activeCount   = signal<number | null>(null);
  readonly loading       = signal(false);
  readonly acting        = signal(false);
  readonly error         = signal<string>('');
  readonly subFilter     = signal<string>('ALL');
  readonly editingId     = signal<string | null>(null);

  protected form: CampaignRequest & { audience: CampaignAudience } = {
    subject: '',
    bodyHtml: "<p>Hello Erezer crew —</p>\n<p>What's new this season…</p>",
    audience: 'ALL_SUBSCRIBERS',
  };

  ngOnInit(): void {
    this.reload();
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    this.error.set('');
  }

  protected setSubFilter(status: string): void {
    this.subFilter.set(status);
    this.loadSubscribers();
  }

  private reload(): void {
    this.loadSubscribers();
    this.loadCampaigns();
    this.api.activeCount().pipe(catchError(() => of(null)))
      .subscribe((n) => { if (n !== null) this.activeCount.set(n); });
  }

  private loadSubscribers(): void {
    this.loading.set(true);
    this.api.listSubscribers(this.subFilter()).pipe(catchError(() => of(null)))
      .subscribe((page) => {
        this.loading.set(false);
        if (page) this.subscribers.set(page.content);
      });
  }

  private loadCampaigns(): void {
    this.api.listCampaigns().pipe(catchError(() => of(null)))
      .subscribe((page) => { if (page) this.campaigns.set(page.content); });
  }

  // ── compose / draft ──────────────────────────────────────────────────────

  protected canSave(): boolean {
    return this.form.subject.trim().length > 0 && this.form.bodyHtml.trim().length > 0;
  }

  protected saveDraft(): void {
    this.acting.set(true);
    this.error.set('');
    const payload: CampaignRequest = {
      subject:  this.form.subject.trim(),
      bodyHtml: this.form.bodyHtml,
      audience: this.form.audience,
    };
    const editId = this.editingId();
    const obs$ = editId ? this.api.updateCampaign(editId, payload) : this.api.createCampaign(payload);
    obs$.pipe(catchError((err) => {
      this.error.set(parseApiError(err));
      this.acting.set(false);
      return of(null);
    })).subscribe((saved) => {
      this.acting.set(false);
      if (saved) {
        this.loadCampaigns();
        this.cancelEdit();
        this.setTab('campaigns');
      }
    });
  }

  protected loadIntoCompose(c: NewsletterCampaign): void {
    this.editingId.set(c.id);
    this.form = {
      subject: c.subject,
      bodyHtml: c.bodyHtml,
      audience: c.audience,
    };
    this.setTab('compose');
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form = {
      subject: '',
      bodyHtml: "<p>Hello Erezer crew —</p>\n<p>What's new this season…</p>",
      audience: 'ALL_SUBSCRIBERS',
    };
  }

  // ── send / delete ────────────────────────────────────────────────────────

  protected send(c: NewsletterCampaign): void {
    if (!confirm(`Send "${c.subject}" to ${c.audience.replace('_', ' ').toLowerCase()}?`)) return;
    this.acting.set(true);
    this.error.set('');
    this.api.send(c.id).pipe(catchError((err) => {
      this.error.set(parseApiError(err));
      this.acting.set(false);
      return of(null);
    })).subscribe((updated) => {
      this.acting.set(false);
      if (updated) {
        // Updated row will be in SENDING; user can refresh later to see final count.
        this.campaigns.update((list) => list.map((x) => x.id === updated.id ? updated : x));
      }
    });
  }

  protected remove(c: NewsletterCampaign): void {
    if (!confirm(`Delete draft "${c.subject}"?`)) return;
    this.acting.set(true);
    this.api.delete(c.id).pipe(catchError((err) => {
      this.error.set(parseApiError(err));
      this.acting.set(false);
      return of(null);
    })).subscribe(() => {
      this.acting.set(false);
      this.campaigns.update((list) => list.filter((x) => x.id !== c.id));
    });
  }

  protected badgeClass(status: CampaignStatus): string {
    return status === 'SENT'    ? 'bg-emerald-100 text-emerald-700'
         : status === 'SENDING' ? 'bg-blue-100 text-blue-700'
         : status === 'FAILED'  ? 'bg-red-100 text-red-700'
         :                        'bg-gray-100 text-gray-600';
  }
}
