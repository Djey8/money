import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Apply saved theme immediately to prevent flash of wrong theme
const savedTheme = localStorage.getItem('theme')
  || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));

import('@ionic/pwa-elements/loader').then(({ defineCustomElements }) =>
  defineCustomElements(window)
);