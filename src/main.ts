import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

const browserWindow = window as Window & { global?: Window };
browserWindow.global = browserWindow;


platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
