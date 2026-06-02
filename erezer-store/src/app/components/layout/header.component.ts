import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { EcommerceStore } from '../../core/store/ecommerce.store';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';
import { TranslateService } from '../../core/i18n/translate.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Lang } from '../../core/i18n/dictionaries';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <header
      class="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/90"
    >
      <div class="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a routerLink="/" class="shrink-0 text-lg font-semibold tracking-[0.22em]">EREZER</a>

        <nav class="hidden items-center gap-5 text-sm text-neutral-600 dark:text-neutral-300 md:flex">
          <a routerLink="/shop" routerLinkActive="text-black dark:!text-white" class="transition hover:text-black dark:hover:text-white">{{ 'header.shop' | t }}</a>
          <a routerLink="/wishlist" routerLinkActive="text-black dark:!text-white" class="transition hover:text-black dark:hover:text-white">{{ 'header.wishlist' | t }}</a>
          @if (auth.isAuthenticated()) {
            <a routerLink="/orders" routerLinkActive="text-black dark:!text-white" class="transition hover:text-black dark:hover:text-white">{{ 'header.orders' | t }}</a>
            <a routerLink="/account" routerLinkActive="text-black dark:!text-white" class="transition hover:text-black dark:hover:text-white">{{ 'header.account' | t }}</a>
          }
          <a routerLink="/contact" routerLinkActive="text-black dark:!text-white" class="transition hover:text-black dark:hover:text-white">{{ 'header.contact' | t }}</a>
          <a routerLink="/admin" routerLinkActive="text-black dark:!text-white" class="transition hover:text-black dark:hover:text-white">Admin</a>
          @if (auth.isAuthenticated()) {
            <button type="button" (click)="logout()" class="transition hover:text-black dark:hover:text-white">Log out</button>
          } @else {
            <a routerLink="/account" routerLinkActive="text-black dark:!text-white" class="transition hover:text-black dark:hover:text-white">Sign in</a>
          }
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <!-- Language switcher -->
          <div class="hidden items-center gap-1 sm:inline-flex">
            @for (l of translate.supported; track l.id) {
              <button
                type="button"
                (click)="setLang(l.id)"
                class="rounded-full border px-2.5 py-1 text-xs font-medium transition"
                [class.border-black]="translate.lang() === l.id"
                [class.dark:border-white]="translate.lang() === l.id"
                [class.bg-black]="translate.lang() === l.id"
                [class.text-white]="translate.lang() === l.id"
                [class.dark:bg-white]="translate.lang() === l.id"
                [class.dark:text-black]="translate.lang() === l.id"
                [class.border-neutral-300]="translate.lang() !== l.id"
                [class.dark:border-neutral-700]="translate.lang() !== l.id"
              >{{ l.native }}</button>
            }
          </div>

          <button
            type="button"
            (click)="themeService.toggleTheme()"
            class="btn-secondary hidden px-3 py-1.5 text-xs sm:inline-flex"
          >
            {{ themeService.theme() === 'dark' ? 'Light mode' : 'Dark mode' }}
          </button>
          <a
            routerLink="/cart"
            class="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            routerLinkActive="border-black dark:border-white"
          >
            <span>{{ 'header.cart' | t }}</span>
            <span class="inline-flex min-w-6 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-xs text-white dark:bg-white dark:text-black">
              {{ store.cartCount() }}
            </span>
          </a>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  protected readonly store = inject(EcommerceStore);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);
  protected readonly translate = inject(TranslateService);

  protected setLang(lang: Lang): void {
    this.translate.setLang(lang);
  }

  protected logout(): void {
    this.auth.signOut();
    this.store.cart.set([]);
    void this.router.navigateByUrl('/');
  }
}
