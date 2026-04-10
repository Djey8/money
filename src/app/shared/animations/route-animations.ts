import { trigger, transition, style, animate, query, group } from '@angular/animations';

export const routeFadeAnimation = trigger('routeAnimation', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(8px)' })
    ], { optional: true }),
    query(':leave', [
      animate('150ms ease-out', style({ opacity: 0, transform: 'translateY(-8px)' }))
    ], { optional: true }),
    query(':enter', [
      animate('200ms 50ms ease-in', style({ opacity: 1, transform: 'translateY(0)' }))
    ], { optional: true })
  ])
]);
