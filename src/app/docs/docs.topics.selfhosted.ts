import { DocTopic, baseDocTopics } from './docs.topics.base';

export type { DocTopic };
export const docTopics: DocTopic[] = [
  ...baseDocTopics,
  // The Cashflow game manual - self-hosted only, like the game (cashflow-content.firebase.ts).
  { id: 'cashflowgame', icon: '🎲', route: '/docs/cashflow', requiresGame: true },
  {
    id: 'api',
    icon: '🔌',
    route: '/docs/api',
    // Inline, not a Docs.topics.api.* i18n key — see DocTopic.title's doc
    // comment for why a translation key would leak this into the Firebase
    // build's static assets.
    title: 'Pro API & AI Assistants',
    desc: 'Use the REST API and connect Claude to your own instance via MCP.',
  },
];
