import { APP_INITIALIZER, ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import * as Sentry from '@sentry/angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { initSentry, sentryProviders } from './core/sentry';

// Eagerly init Sentry before Angular bootstraps so early errors are captured.
initSentry();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    ...sentryProviders(),
    // TraceService needs to be instantiated for router-level tracing to wire up;
    // Angular won't construct it otherwise.
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => () => inject(Sentry.TraceService),
    },
  ]
};
