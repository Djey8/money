export interface DocTopic {
  id: string;
  icon: string;
  route: string;
  /**
   * Plain-text override for title/desc, bypassing the `Docs.topics.<id>.*`
   * i18n lookup. Required for any Pro-only topic: `assets/i18n/*.json` is
   * copied wholesale into every edition's build (angular.json's `assets`
   * array has no per-configuration split, unlike fileReplacements for
   * TS-imported modules) — a translation key would ship Pro marketing copy
   * inside the Firebase build's static assets even though the topic list
   * itself is correctly edition-gated. See docs/adr/0004.
   */
  title?: string;
  desc?: string;
}

// Topics shared by both editions. Never a fileReplacements target itself —
// docs.topics.ts (Firebase) and docs.topics.selfhosted.ts both import from
// here. See docs/adr/0004-edition-separation-mechanism.md.
export const baseDocTopics: DocTopic[] = [
  { id: 'selfhosted', icon: '🖥️', route: '/docs/selfhosted' },
];
