import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { EcommerceStore } from '../core/store/ecommerce.store';
import { ApiAddress, ApiProfile, AddressPayload, AddressType } from '../core/api.models';

type AuthTab = 'login' | 'register' | 'forgot';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyPipe, RouterLink],
  template: `
    <section class="grid gap-8 lg:grid-cols-[1.2fr_2fr]">

      <!-- ── Auth / Profile card ──────────────────────────────────────────── -->
      <article class="app-card space-y-4 p-6">
        <h1 class="app-section-title text-2xl">Account</h1>

        @if (!auth.isAuthenticated()) {
          <!-- Tab switcher -->
          <div class="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            <button
              (click)="setTab('login')"
              [class.bg-white]="tab() === 'login'"
              [class.dark:bg-neutral-700]="tab() === 'login'"
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition">
              Sign in
            </button>
            <button
              (click)="setTab('register')"
              [class.bg-white]="tab() === 'register'"
              [class.dark:bg-neutral-700]="tab() === 'register'"
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition">
              Register
            </button>
            <button
              (click)="setTab('forgot')"
              [class.bg-white]="tab() === 'forgot'"
              [class.dark:bg-neutral-700]="tab() === 'forgot'"
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition">
              Forgot
            </button>
          </div>

          <!-- Login tab -->
          @if (tab() === 'login') {
            <div class="space-y-3">
              <input
                [(ngModel)]="loginEmail"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
              <input
                [(ngModel)]="loginPassword"
                type="password"
                placeholder="Password"
                autocomplete="current-password"
                class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
              @if (auth.error()) {
                <p class="text-sm text-red-500">{{ auth.error() }}</p>
              }
              <button (click)="signIn()" [disabled]="auth.loading()" class="btn-primary w-full">
                {{ auth.loading() ? 'Signing in…' : 'Sign in' }}
              </button>
            </div>
          }

          <!-- Register tab -->
          @if (tab() === 'register') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <input
                  [(ngModel)]="regFirstName"
                  placeholder="First name"
                  autocomplete="given-name"
                  class="rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
                <input
                  [(ngModel)]="regLastName"
                  placeholder="Last name"
                  autocomplete="family-name"
                  class="rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
              </div>
              <input
                [(ngModel)]="regEmail"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
              <input
                [(ngModel)]="regPassword"
                type="password"
                placeholder="Password (min 8 characters)"
                autocomplete="new-password"
                class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
              @if (auth.error()) {
                <p class="text-sm text-red-500">{{ auth.error() }}</p>
              }
              <button (click)="register()" [disabled]="auth.loading()" class="btn-primary w-full">
                {{ auth.loading() ? 'Creating account…' : 'Create account' }}
              </button>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                We'll email you a link to verify your address.
              </p>
            </div>
          }

          <!-- Forgot password tab -->
          @if (tab() === 'forgot') {
            <div class="space-y-3">
              <p class="text-sm text-neutral-600 dark:text-neutral-300">
                Enter your email and we'll send a reset link.
              </p>
              <input
                [(ngModel)]="forgotEmail"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
              @if (forgotMsg()) {
                <p class="text-sm text-green-600">{{ forgotMsg() }}</p>
              }
              @if (auth.error()) {
                <p class="text-sm text-red-500">{{ auth.error() }}</p>
              }
              <button (click)="forgot()" [disabled]="auth.loading()" class="btn-primary w-full">
                {{ auth.loading() ? 'Sending…' : 'Send reset link' }}
              </button>
            </div>
          }

        } @else {
          <!-- Signed in -->
          @if (profile(); as p) {
            <div class="space-y-1">
              <p class="font-medium">{{ p.firstName }} {{ p.lastName }}</p>
              <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ p.email || auth.email() }}</p>
              @if (!auth.emailVerified()) {
                <p class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Your email isn't verified yet. Check your inbox for the verification link.
                </p>
              }
            </div>

            <!-- Edit profile -->
            @if (editingProfile()) {
              <div class="space-y-2">
                <input [(ngModel)]="editFirstName" placeholder="First name"
                  class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
                <input [(ngModel)]="editLastName" placeholder="Last name"
                  class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
                <input [(ngModel)]="editEmail" placeholder="Email"
                  class="w-full rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700" />
                <div class="flex gap-2">
                  <button (click)="saveProfile()" class="btn-primary flex-1">Save</button>
                  <button (click)="editingProfile.set(false)" class="btn-secondary flex-1">Cancel</button>
                </div>
                @if (profileSaveMsg()) {
                  <p class="text-sm text-green-600">{{ profileSaveMsg() }}</p>
                }
              </div>
            } @else {
              <button (click)="startEditProfile(p)" class="btn-secondary w-full">Edit profile</button>
            }
          } @else if (profileLoading()) {
            <p class="app-muted text-sm">Loading profile…</p>
          }

          <button (click)="signOut()" class="btn-secondary w-full">Sign out</button>
        }
      </article>

      <!-- ── Right column ──────────────────────────────────────────────────── -->
      <div class="space-y-6">

        <!-- Addresses (only when authenticated) -->
        @if (auth.isAuthenticated()) {
          <article class="app-card p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-semibold">Addresses</h2>
              @if (addresses().length < 3) {
                <button (click)="showAddressForm.set(true)" class="btn-secondary text-sm">+ Add</button>
              }
            </div>

            @if (showAddressForm()) {
              <div class="mb-4 space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <input [(ngModel)]="addrName" placeholder="Label (e.g. Home)"
                  class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700" />
                <input [(ngModel)]="addrStreet" placeholder="Street address"
                  class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700" />
                <input [(ngModel)]="addrHouse" placeholder="House number" type="number"
                  class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700" />
                <input [(ngModel)]="addrApartment" placeholder="Apartment / building name"
                  class="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700" />
                <select [(ngModel)]="addrType"
                  class="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="OTHER">Other</option>
                </select>
                @if (addrError()) {
                  <p class="text-sm text-red-500">{{ addrError() }}</p>
                }
                <div class="flex gap-2">
                  <button (click)="saveAddress()" class="btn-primary flex-1 text-sm">Save address</button>
                  <button (click)="showAddressForm.set(false)" class="btn-secondary flex-1 text-sm">Cancel</button>
                </div>
              </div>
            }

            <div class="space-y-3">
              @for (addr of addresses(); track addr.id) {
                <div class="flex items-start justify-between rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                  <div>
                    <p class="font-medium text-sm">{{ addr.name }} <span class="ml-1 text-xs text-neutral-400">({{ addr.addressType }})</span></p>
                    <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ addr.address }}</p>
                    @if (addr.apartmentName) {
                      <p class="text-xs text-neutral-500">{{ addr.apartmentName }}</p>
                    }
                  </div>
                  <button (click)="deleteAddress(addr.id)" class="text-xs text-red-500 underline">Remove</button>
                </div>
              } @empty {
                <p class="app-muted text-sm">No addresses saved yet.</p>
              }
            </div>
          </article>
        }

        <!-- Order history -->
        <article class="app-card p-6">
          <div class="mb-4 flex items-end justify-between gap-2">
            <h2 class="text-xl font-semibold">Order history</h2>
            <a routerLink="/orders" class="text-sm underline underline-offset-4">View all orders</a>
          </div>
          <div class="space-y-3">
            @for (order of apiOrders(); track order.id) {
              <div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="font-medium">{{ order.id }}</p>
                  <span class="text-sm text-neutral-500 dark:text-neutral-400">{{ order.createdAt | date: 'medium' }}</span>
                </div>
                <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                  Status: {{ order.orderStatus }} | Total: {{ order.totalAmount | currency }}
                </p>
              </div>
            } @empty {
              <p class="text-neutral-500 dark:text-neutral-400">No orders yet.</p>
            }
          </div>
        </article>
      </div>
    </section>
  `
})
export class AccountPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly store = inject(EcommerceStore);
  private readonly router = inject(Router);

  // ── auth flow ──────────────────────────────────────────────────────────────
  protected readonly tab = signal<AuthTab>('login');
  protected loginEmail    = '';
  protected loginPassword = '';
  protected regEmail      = '';
  protected regPassword   = '';
  protected regFirstName  = '';
  protected regLastName   = '';
  protected forgotEmail   = '';
  protected readonly forgotMsg = signal('');

  // ── profile ────────────────────────────────────────────────────────────────
  protected readonly profile        = signal<ApiProfile | null>(null);
  protected readonly profileLoading = signal(false);
  protected readonly editingProfile = signal(false);
  protected readonly profileSaveMsg = signal('');
  protected editFirstName = '';
  protected editLastName  = '';
  protected editEmail     = '';

  // ── addresses ──────────────────────────────────────────────────────────────
  protected readonly addresses      = signal<ApiAddress[]>([]);
  protected readonly showAddressForm = signal(false);
  protected readonly addrError      = signal('');
  protected addrName      = '';
  protected addrStreet    = '';
  protected addrHouse     = 0;
  protected addrApartment = '';
  protected addrType: AddressType = 'HOME';

  // ── orders ─────────────────────────────────────────────────────────────────
  protected readonly apiOrders = signal<Array<{ id: string; createdAt: string; orderStatus: string; totalAmount: number }>>([]);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.loadProfile();
      this.loadOrders();
    }
  }

  // ── auth ───────────────────────────────────────────────────────────────────

  protected setTab(t: AuthTab): void {
    this.tab.set(t);
    this.forgotMsg.set('');
  }

  protected async signIn(): Promise<void> {
    if (!this.loginEmail.trim() || !this.loginPassword) return;
    try {
      await this.auth.login({ email: this.loginEmail.trim(), password: this.loginPassword });
      this.loginPassword = '';
      this.afterAuth();
    } catch { /* error surfaced via auth.error() */ }
  }

  protected async register(): Promise<void> {
    if (!this.regEmail.trim() || !this.regPassword || !this.regFirstName.trim() || !this.regLastName.trim()) return;
    try {
      await this.auth.register({
        email:     this.regEmail.trim(),
        password:  this.regPassword,
        firstName: this.regFirstName.trim(),
        lastName:  this.regLastName.trim(),
      });
      this.regPassword = '';
      this.afterAuth();
    } catch { /* error surfaced via auth.error() */ }
  }

  /**
   * Post-login/registration: merge the local guest cart into the account, load
   * the server cart, then refresh profile/orders. If the user arrived here to
   * check out (?redirect=…), send them back once the cart is merged.
   */
  private afterAuth(): void {
    const userId = this.auth.userId();
    const guest = this.store.cart();
    const redirect = new URLSearchParams(window.location.search).get('redirect');

    const finish = () => {
      if (userId) {
        this.api.getCart(userId).pipe(catchError(() => of([]))).subscribe((items) => {
          this.store.loadApiCart(items);
          if (redirect) void this.router.navigateByUrl(redirect);
        });
      }
    };

    if (userId && guest.length) {
      // Replay each guest line through the (server-resolved) add-to-cart endpoint,
      // which dedups by product+variant, then reload the authoritative cart.
      forkJoin(
        guest.map((i) =>
          this.api.addToCart(userId, {
            userId,
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            deliveryInstructions: null,
          }).pipe(catchError(() => of(null)))
        )
      ).subscribe(() => finish());
    } else {
      finish();
    }

    this.loadProfile();
    this.loadOrders();
  }

  protected async forgot(): Promise<void> {
    if (!this.forgotEmail.trim()) return;
    try {
      await this.auth.forgotPassword(this.forgotEmail.trim());
      this.forgotMsg.set('If an account exists for this email, a reset link is on its way.');
    } catch { /* error surfaced via auth.error() */ }
  }

  protected signOut(): void {
    this.auth.signOut();
    this.profile.set(null);
    this.addresses.set([]);
    this.apiOrders.set([]);
    this.tab.set('login');
  }

  // ── profile ────────────────────────────────────────────────────────────────

  private loadProfile(): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.profileLoading.set(true);
    this.api.getProfile(userId).pipe(catchError(() => of(null))).subscribe((p) => {
      this.profile.set(p);
      this.profileLoading.set(false);
      if (p) this.addresses.set(p.addresses);
    });
  }

  protected startEditProfile(p: ApiProfile): void {
    this.editFirstName = p.firstName;
    this.editLastName  = p.lastName;
    this.editEmail     = p.email;
    this.editingProfile.set(true);
  }

  protected saveProfile(): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.api.updateProfile(userId, {
      firstName: this.editFirstName,
      lastName:  this.editLastName,
      email:     this.editEmail,
      latitude:  this.profile()?.latitude ?? null,
      longitude: this.profile()?.longitude ?? null
    }).pipe(catchError(() => of(null))).subscribe((p) => {
      if (p) {
        this.profile.set(p);
        this.profileSaveMsg.set('Profile updated.');
        setTimeout(() => this.profileSaveMsg.set(''), 2000);
      }
      this.editingProfile.set(false);
    });
  }

  // ── addresses ──────────────────────────────────────────────────────────────

  protected saveAddress(): void {
    const userId = this.auth.userId();
    if (!userId) return;
    if (!this.addrName.trim() || !this.addrStreet.trim()) {
      this.addrError.set('Name and address are required.');
      return;
    }
    const payload: AddressPayload = {
      name:          this.addrName.trim(),
      address:       this.addrStreet.trim(),
      latitude:      0,
      longitude:     0,
      houseNumber:   this.addrHouse || null,
      apartmentName: this.addrApartment.trim() || null,
      addressType:   this.addrType
    };
    this.api.addAddress(userId, payload).pipe(catchError((err) => {
      this.addrError.set(err?.error?.message ?? 'Failed to save address.');
      return of(null);
    })).subscribe((addr) => {
      if (addr) {
        this.addresses.update((list) => [...list, addr]);
        this.showAddressForm.set(false);
        this.resetAddressForm();
      }
    });
  }

  protected deleteAddress(addressId: number): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.api.deleteAddress(userId, addressId).pipe(catchError(() => of(null))).subscribe(() => {
      this.addresses.update((list) => list.filter((a) => a.id !== addressId));
    });
  }

  private resetAddressForm(): void {
    this.addrName = '';
    this.addrStreet = '';
    this.addrHouse = 0;
    this.addrApartment = '';
    this.addrType = 'HOME';
    this.addrError.set('');
  }

  // ── orders ─────────────────────────────────────────────────────────────────

  private loadOrders(): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.api.getOrders(userId).pipe(catchError(() => of([]))).subscribe((orders) => {
      this.apiOrders.set(orders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        orderStatus: o.orderStatus,
        totalAmount: o.totalAmount
      })));
    });
  }
}
