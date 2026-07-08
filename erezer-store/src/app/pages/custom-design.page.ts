import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CustomDesignCanvasService } from '../core/custom-design-canvas.service';
import type {
  CustomDesignColor,
  CustomDesignDraft,
  CustomDesignItem,
  CustomDesignLogo,
  CustomDesignView,
  CustomOrderRequest,
} from '../core/api.models';

interface ViewTab { id: CustomDesignView; label: string; }

@Component({
  standalone: true,
  imports: [FormsModule],
  providers: [CustomDesignCanvasService],
  template: `
    <section class="mx-auto max-w-7xl px-3 py-6">
      <header class="mb-5 rounded-2xl bg-amber-100 px-6 py-5 text-center dark:bg-amber-950/40">
        <h1 class="text-lg font-bold tracking-wide sm:text-xl">DESIGN YOUR OWN CLOTHING IN JUST MINUTES</h1>
        <p class="app-muted mt-1 text-sm">No minimum order — even a single piece. Design t-shirts, hoodies and more, then submit for a price.</p>
      </header>

      @if (loading()) {
        <p class="app-muted py-2 text-center text-sm">Loading the design studio…</p>
      }
      @if (error()) {
        <p class="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">{{ error() }}</p>
      }
      <!-- The grid (and canvas) must stay VISIBLE in the DOM: fabric initialised on a
           display:none canvas can't measure it and paints nothing. We dim it while
           loading instead of hiding it. -->
      <div class="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_220px]" [class.opacity-50]="loading()">

          <!-- ── Left: tools ─────────────────────────────────────────────── -->
          <aside class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <label class="app-card flex cursor-pointer flex-col items-center gap-1 p-4 text-center text-xs font-semibold">
                <input type="file" accept="image/*" class="hidden" (change)="onFileSelected($event)" [disabled]="uploading()" />
                <span class="text-lg">🖼️</span>
                {{ uploading() ? 'UPLOADING…' : 'ADD DESIGN' }}
              </label>
              <button type="button" (click)="focusText()" class="app-card flex flex-col items-center gap-1 p-4 text-center text-xs font-semibold">
                <span class="text-lg">T</span>
                ADD TEXT
              </button>
            </div>

            <!-- Add text row -->
            <div class="app-card space-y-2 p-3">
              <input #textInput [(ngModel)]="newText" name="newText" placeholder="Type text…" maxlength="120"
                class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
              <div class="flex items-center gap-2">
                <input type="color" value="#111111" [(ngModel)]="textColor" name="textColor" (change)="applyTextColor()" class="h-8 w-10 cursor-pointer rounded" />
                <button type="button" (click)="addText()" class="btn-secondary flex-1 py-1.5 text-sm" [disabled]="!newText.trim()">Add text</button>
              </div>
            </div>

            <!-- Selectors -->
            <div class="app-card space-y-3 p-3">
              <label class="block text-xs font-semibold uppercase tracking-wide">
                Item
                <select [ngModel]="selectedItemName()" (ngModelChange)="onItemChange($event)" name="item"
                  class="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                  @for (it of items(); track it.name) { <option [value]="it.name">{{ it.name }}</option> }
                </select>
              </label>

              <div>
                <span class="text-xs font-semibold uppercase tracking-wide">Colour</span>
                <div class="mt-1 flex flex-wrap gap-2">
                  @for (c of selectedItem()?.colors ?? []; track c.name) {
                    <button type="button" (click)="onColorChange(c.name)" [title]="c.name"
                      class="h-7 w-7 rounded-full border-2 transition"
                      [style.background-color]="c.hex"
                      [class.border-black]="selectedColorName() === c.name"
                      [class.dark:border-white]="selectedColorName() === c.name"
                      [class.border-neutral-300]="selectedColorName() !== c.name"></button>
                  }
                </div>
              </div>

              <label class="block text-xs font-semibold uppercase tracking-wide">
                Size
                <select [(ngModel)]="selectedSize" name="size"
                  class="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                  @for (s of selectedItem()?.sizes ?? []; track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </label>

              <label class="block text-xs font-semibold uppercase tracking-wide">
                Print technique
                <select [(ngModel)]="selectedTechnique" name="tech"
                  class="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                  @for (t of selectedItem()?.printTechniques ?? []; track t) { <option [value]="t">{{ t }}</option> }
                </select>
              </label>
            </div>

            <!-- Logo library -->
            @if (logos().length) {
              <div class="app-card p-3">
                <span class="text-xs font-semibold uppercase tracking-wide">Logo library</span>
                <div class="mt-2 grid grid-cols-3 gap-2">
                  @for (logo of logos(); track logo.url) {
                    <button type="button" (click)="addLogo(logo.url)" [title]="logo.name"
                      class="aspect-square overflow-hidden rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
                      <img [src]="logo.url" [alt]="logo.name" class="h-full w-full object-contain" />
                    </button>
                  }
                </div>
              </div>
            }
          </aside>

          <!-- ── Center: canvas ───────────────────────────────────────────── -->
          <div class="space-y-3">
            <div class="flex items-center justify-center gap-1 rounded-full bg-neutral-900 px-3 py-2 text-white">
              <button type="button" (click)="canvas.setZoom(canvas.zoom() + 0.1)" title="Zoom in" class="rounded-full p-2 hover:bg-white/10">＋</button>
              <button type="button" (click)="canvas.setZoom(canvas.zoom() - 0.1)" title="Zoom out" class="rounded-full p-2 hover:bg-white/10">－</button>
              <button type="button" (click)="canvas.duplicateActive()" [disabled]="!canvas.hasSelection()" title="Duplicate" class="rounded-full p-2 hover:bg-white/10 disabled:opacity-40">⧉</button>
              <button type="button" (click)="canvas.undo()" [disabled]="!canvas.canUndo()" title="Undo" class="rounded-full p-2 hover:bg-white/10 disabled:opacity-40">↶</button>
              <button type="button" (click)="canvas.redo()" [disabled]="!canvas.canRedo()" title="Redo" class="rounded-full p-2 hover:bg-white/10 disabled:opacity-40">↷</button>
              <button type="button" (click)="canvas.deleteActive()" [disabled]="!canvas.hasSelection()" title="Delete" class="rounded-full bg-red-500 p-2 hover:bg-red-600 disabled:opacity-40">🗑</button>
            </div>
            <div class="flex justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <!-- IMPORTANT: no background/class styling on the canvas element itself.
                   Fabric copies the element's className + inline style onto the
                   transparent "upper canvas" it overlays for selection — any
                   background here becomes an opaque layer hiding everything drawn. -->
              <canvas #canvasEl></canvas>
            </div>
          </div>

          <!-- ── Right: views + actions ───────────────────────────────────── -->
          <aside class="space-y-3">
            <div class="grid grid-cols-2 gap-2">
              @for (tab of viewTabs; track tab.id) {
                <button type="button" (click)="selectView(tab.id)"
                  class="rounded-xl border p-2 text-center text-xs font-medium transition"
                  [class.border-black]="view() === tab.id"
                  [class.dark:border-white]="view() === tab.id"
                  [class.border-neutral-200]="view() !== tab.id"
                  [class.dark:border-neutral-700]="view() !== tab.id">
                  {{ tab.label }}
                  @if (!canvas.isViewEmpty(tab.id)) { <span class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span> }
                </button>
              }
            </div>

            <div class="grid grid-cols-3 gap-2">
              <button type="button" (click)="saveDraft()" [disabled]="savingDraft()" class="app-card p-2 text-center text-[11px] font-semibold">💾<br>{{ draftId() ? 'update' : 'save' }}</button>
              <button type="button" (click)="toggleDrafts()" class="app-card p-2 text-center text-[11px] font-semibold">📁<br>drafts</button>
              <button type="button" (click)="share()" [disabled]="!draftId()" class="app-card p-2 text-center text-[11px] font-semibold disabled:opacity-40">🔗<br>share</button>
            </div>

            @if (shareUrl()) {
              <div class="app-card space-y-1 p-3 text-xs">
                <span class="app-muted">Share link</span>
                <input readonly [value]="shareUrl()" class="w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900" />
              </div>
            }

            @if (showDrafts()) {
              <div class="app-card max-h-64 space-y-2 overflow-auto p-3">
                <span class="text-xs font-semibold uppercase tracking-wide">Saved designs</span>
                @if (!auth.isAuthenticated()) {
                  <p class="app-muted text-xs">Sign in to save and reload designs.</p>
                } @else if (!drafts().length) {
                  <p class="app-muted text-xs">No saved designs yet.</p>
                } @else {
                  @for (d of drafts(); track d.id) {
                    <button type="button" (click)="openDraft(d)" class="flex w-full items-center gap-2 rounded-lg border border-neutral-200 p-2 text-left text-xs dark:border-neutral-700">
                      @if (d.thumbnailUrl) { <img [src]="d.thumbnailUrl" class="h-8 w-8 rounded object-cover" alt="" /> }
                      <span class="truncate">{{ d.name }}</span>
                    </button>
                  }
                }
              </div>
            }

            <button type="button" (click)="openSubmit()" class="btn-primary w-full py-3 text-sm font-bold">SUBMIT FOR PRICE</button>
          </aside>
      </div>
    </section>

    <!-- ── Submit for price modal ───────────────────────────────────────────── -->
    @if (showSubmit()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="closeSubmit()">
        <div class="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 dark:bg-neutral-900" (click)="$event.stopPropagation()">
          @if (submittedRef()) {
            <div class="space-y-4 py-8 text-center">
              <h2 class="text-xl font-bold">Request sent 🎉</h2>
              <p class="app-muted text-sm">Your reference is <strong>{{ submittedRef() }}</strong>. Our team will email you a price shortly.</p>
              <button type="button" (click)="closeSubmit()" class="btn-primary">Done</button>
            </div>
          } @else {
            <h2 class="mb-4 text-center text-xl font-bold">Submit Custom Design Request</h2>
            <div class="grid gap-3 sm:grid-cols-2">
              <input [(ngModel)]="form.firstName" placeholder="First Name *" class="cd-input" />
              <input [(ngModel)]="form.lastName" placeholder="Last Name *" class="cd-input" />
              <input [(ngModel)]="form.phone" placeholder="Phone *" class="cd-input" />
              <input [(ngModel)]="form.email" type="email" placeholder="Email *" class="cd-input" />
              <input [(ngModel)]="form.shippingAddress" placeholder="Shipping Address *" class="cd-input sm:col-span-2" />
              <input [(ngModel)]="form.apartment" placeholder="Apartment, suite, etc. (Optional)" class="cd-input" />
              <input [(ngModel)]="form.city" placeholder="City *" class="cd-input" />
              <input [(ngModel)]="form.zipCode" placeholder="Zip Code" class="cd-input" />
              <input [(ngModel)]="form.country" placeholder="Country *" class="cd-input" />
            </div>

            <div class="mt-4">
              <span class="text-xs font-semibold uppercase tracking-wide">Order details / notes *</span>
              <textarea [(ngModel)]="form.notes" rows="5"
                placeholder="Required information:&#10;1. Size wise quantity: M: 1&#10;2. Print/Embroidery technique"
                class="cd-input mt-1 w-full"></textarea>
              <p class="app-muted mt-1 text-xs">Required: size-wise quantity and print/embroidery technique.</p>
            </div>

            @if (submitError()) {
              <p class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">{{ submitError() }}</p>
            }

            <div class="mt-5 flex gap-3">
              <button type="button" (click)="closeSubmit()" class="btn-secondary flex-1">Cancel</button>
              <button type="button" (click)="submit()" [disabled]="submitting()" class="btn-primary flex-1">{{ submitting() ? 'Sending…' : 'Send' }}</button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .cd-input {
      border-radius: 0.75rem;
      border: 1px solid rgb(212 212 212);
      padding: 0.6rem 0.9rem;
      font-size: 0.875rem;
      background: #fafafa;
    }
    :host-context(.dark) .cd-input { background: rgb(23 23 23); border-color: rgb(64 64 64); }
  `],
})
export class CustomDesignPage implements AfterViewInit, OnDestroy {
  protected readonly canvas = inject(CustomDesignCanvasService);
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('canvasEl') private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('textInput') private textInputRef?: ElementRef<HTMLInputElement>;

  protected readonly viewTabs: ViewTab[] = [
    { id: 'front', label: 'Front' },
    { id: 'back', label: 'Back' },
    { id: 'leftSleeve', label: 'Left sleeve' },
    { id: 'rightSleeve', label: 'Right sleeve' },
  ];

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly items = signal<CustomDesignItem[]>([]);
  protected readonly logos = signal<CustomDesignLogo[]>([]);
  protected readonly uploading = signal(false);

  protected readonly selectedItemName = signal('');
  protected readonly selectedColorName = signal('');
  protected selectedSize = '';
  protected selectedTechnique = '';
  protected readonly view = signal<CustomDesignView>('front');

  protected newText = '';
  protected textColor = '#111111';

  protected readonly selectedItem = computed(() => this.items().find((i) => i.name === this.selectedItemName()) ?? null);
  protected readonly selectedColor = computed<CustomDesignColor | null>(
    () => this.selectedItem()?.colors.find((c) => c.name === this.selectedColorName()) ?? null,
  );

  // Drafts / share
  protected readonly draftId = signal<string | null>(null);
  protected readonly savingDraft = signal(false);
  protected readonly showDrafts = signal(false);
  protected readonly drafts = signal<CustomDesignDraft[]>([]);
  protected readonly shareUrl = signal<string | null>(null);

  // Submit modal
  protected readonly showSubmit = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly submittedRef = signal<string | null>(null);
  protected form = { firstName: '', lastName: '', phone: '', email: '', shippingAddress: '', apartment: '', city: '', zipCode: '', country: '', notes: '' };

  private canvasReady = false;

  ngAfterViewInit(): void {
    // The grid is always visible now, so the canvas is laid out here → fabric can
    // measure it and will actually paint.
    this.canvas.init(this.canvasRef.nativeElement, 460, 560);
    this.canvasReady = true;
    this.loadAssets();
  }

  ngOnDestroy(): void {
    this.canvas.dispose();
  }

  private loadAssets(): void {
    this.api.getCustomDesignAssets().pipe(
      catchError((err) => {
        this.error.set(err?.error?.message ?? 'Could not load the design studio.');
        this.loading.set(false);
        return of(null);
      }),
    ).subscribe((assets) => {
      if (!assets) return;
      this.items.set(assets.items ?? []);
      this.logos.set(assets.logos ?? []);
      this.loading.set(false);
      const first = assets.items?.[0];
      if (first) {
        this.selectedItemName.set(first.name);
        this.selectedSize = first.sizes[0] ?? '';
        this.selectedTechnique = first.printTechniques[0] ?? '';
        this.selectedColorName.set(first.colors[0]?.name ?? '');
        this.applyBackgrounds();
      }
      this.maybeLoadShared();
    });
  }

  /** If the URL carries ?shared=<token>, load that public design onto the canvas. */
  private maybeLoadShared(): void {
    const token = this.route.snapshot.queryParamMap.get('shared');
    if (!token) return;
    this.api.getSharedDesign(token).pipe(catchError(() => of(null))).subscribe((draft) => {
      if (!draft) return;
      if (draft.itemName && this.items().some((i) => i.name === draft.itemName)) this.onItemChange(draft.itemName);
      if (draft.colorName) this.onColorChange(draft.colorName);
      if (draft.designJson) void this.canvas.load(draft.designJson);
    });
  }

  protected onItemChange(name: string): void {
    this.selectedItemName.set(name);
    const it = this.selectedItem();
    this.selectedColorName.set(it?.colors[0]?.name ?? '');
    this.selectedSize = it?.sizes[0] ?? '';
    this.selectedTechnique = it?.printTechniques[0] ?? '';
    this.applyBackgrounds();
  }

  protected onColorChange(name: string): void {
    this.selectedColorName.set(name);
    this.applyBackgrounds();
  }

  private applyBackgrounds(): void {
    const c = this.selectedColor();
    if (this.canvasReady && c) void this.canvas.setBackgrounds(c.images);
  }

  protected selectView(v: CustomDesignView): void {
    this.view.set(v);
    void this.canvas.setView(v);
  }

  protected focusText(): void {
    this.textInputRef?.nativeElement.focus();
  }

  protected addText(): void {
    this.canvas.addText(this.newText);
    this.newText = '';
  }

  protected applyTextColor(): void {
    this.canvas.setActiveTextColor(this.textColor);
  }

  protected addLogo(url: string): void {
    void this.canvas.addImage(url);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadCustomArtwork(file).pipe(
      catchError(() => {
        this.uploading.set(false);
        return of(null);
      }),
    ).subscribe((res) => {
      this.uploading.set(false);
      input.value = '';
      if (res?.url) void this.canvas.addImage(res.url);
    });
  }

  // ── Drafts ────────────────────────────────────────────────────────────────

  protected saveDraft(): void {
    const userId = this.auth.userId();
    if (!userId) { this.showDrafts.set(true); return; }
    this.savingDraft.set(true);
    const payload = {
      name: this.selectedItem()?.name ? `${this.selectedItem()!.name} design` : 'My design',
      itemName: this.selectedItemName(),
      colorName: this.selectedColorName(),
      thumbnailUrl: this.canvas.thumbnailDataUrl() ?? undefined,
      designJson: this.canvas.serialize(),
    };
    const id = this.draftId();
    const req = id
      ? this.api.updateCustomDesignDraft(userId, id, payload)
      : this.api.saveCustomDesignDraft(userId, payload);
    req.pipe(catchError(() => { this.savingDraft.set(false); return of(null); }))
      .subscribe((draft) => {
        this.savingDraft.set(false);
        if (draft) this.draftId.set(draft.id);
      });
  }

  protected toggleDrafts(): void {
    const open = !this.showDrafts();
    this.showDrafts.set(open);
    const userId = this.auth.userId();
    if (open && userId) {
      this.api.listCustomDesignDrafts(userId).pipe(catchError(() => of([])))
        .subscribe((list) => this.drafts.set(list));
    }
  }

  protected openDraft(d: CustomDesignDraft): void {
    this.draftId.set(d.id);
    this.showDrafts.set(false);
    if (d.itemName && this.items().some((i) => i.name === d.itemName)) this.onItemChange(d.itemName);
    if (d.colorName) this.onColorChange(d.colorName);
    if (d.designJson) void this.canvas.load(d.designJson);
  }

  protected share(): void {
    const userId = this.auth.userId();
    const id = this.draftId();
    if (!userId || !id) return;
    this.api.shareCustomDesignDraft(userId, id).pipe(catchError(() => of(null)))
      .subscribe((draft) => {
        if (draft?.shareToken) {
          this.shareUrl.set(`${location.origin}/custom-design?shared=${draft.shareToken}`);
        }
      });
  }

  // ── Submit for price ──────────────────────────────────────────────────────

  protected openSubmit(): void {
    this.form.firstName ||= this.auth.firstName() ?? '';
    this.form.lastName ||= this.auth.lastName() ?? '';
    this.form.email ||= this.auth.email() ?? '';
    this.submitError.set('');
    this.showSubmit.set(true);
  }

  protected closeSubmit(): void {
    this.showSubmit.set(false);
    this.submittedRef.set(null);
  }

  protected submit(): void {
    const f = this.form;
    if (!f.firstName.trim() || !f.lastName.trim() || !f.phone.trim() || !f.email.trim()
      || !f.shippingAddress.trim() || !f.city.trim() || !f.country.trim() || !f.notes.trim()) {
      this.submitError.set('Please fill in all required (*) fields, including the order details.');
      return;
    }
    const anyContent = this.viewTabs.some((t) => !this.canvas.isViewEmpty(t.id));
    if (!anyContent) {
      this.submitError.set('Add your design to the garment first.');
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');
    this.canvas.exportPreviews().then((previews) => {
      if (!previews.length) {
        this.submitting.set(false);
        this.submitError.set('Could not render your design preview. If this persists, the mockup images may need CORS enabled.');
        return;
      }
      const payload: CustomOrderRequest = {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        shippingAddress: f.shippingAddress.trim(),
        apartment: f.apartment.trim() || undefined,
        city: f.city.trim(),
        zipCode: f.zipCode.trim() || undefined,
        country: f.country.trim(),
        notes: f.notes.trim(),
        itemName: this.selectedItemName() || undefined,
        colorName: this.selectedColorName() || undefined,
        size: this.selectedSize || undefined,
        printTechnique: this.selectedTechnique || undefined,
        designJson: this.canvas.serialize(),
      };
      this.api.submitCustomDesignRequest(payload, previews).pipe(
        catchError((err) => {
          this.submitting.set(false);
          this.submitError.set(err?.error?.message ?? 'Could not submit your request. Please try again.');
          return of(null);
        }),
      ).subscribe((res) => {
        this.submitting.set(false);
        if (res) this.submittedRef.set(res.reference);
      });
    });
  }
}
