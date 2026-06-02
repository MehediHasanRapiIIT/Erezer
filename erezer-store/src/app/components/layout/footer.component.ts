import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div class="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 text-sm text-neutral-600 dark:text-neutral-400 sm:px-6 lg:px-8 md:grid-cols-4">
        <div class="space-y-2 md:col-span-2">
          <p class="text-base font-semibold tracking-[0.2em] text-neutral-900 dark:text-neutral-100">EREZER</p>
          <p class="max-w-md">Minimal essentials for a modern wardrobe. Thoughtful design, premium comfort, timeless style.</p>
        </div>
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">Company</p>
          <p>About</p>
          <p>Journal</p>
          <p>Careers</p>
        </div>
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">Support</p>
          <p>Shipping & Returns</p>
          <p>Help Center</p>
          <p>care@erezer.com</p>
        </div>
      </div>
      <div class="border-t border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-neutral-500 dark:text-neutral-400 sm:px-6 lg:px-8">
          <p>© 2026 EREZER. All rights reserved.</p>
          <p>Secure payments • Global shipping</p>
        </div>
      </div>
    </footer>
  `
})
export class FooterComponent {}
