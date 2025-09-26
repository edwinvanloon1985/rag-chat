import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection,} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient} from '@angular/common/http';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {providePrimeNG} from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import {routes} from './app.routes';
import {MARKED_OPTIONS, provideMarkdown} from "ngx-markdown";

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideZoneChangeDetection({eventCoalescing: true}),
        provideHttpClient(),
        provideRouter(routes),
        provideAnimationsAsync(),
        provideMarkdown({
            markedOptions: {
                provide: MARKED_OPTIONS,
                useValue: {
                    gfm: true,
                    breaks: true, // single newline => <br>
                },
            },
        }),
        providePrimeNG({
            theme: {
                preset: Aura,
            },
            ripple: true,
        }),
    ],
};
