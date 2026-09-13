import { DocTopic, baseDocTopics } from './docs.topics.base';

// Firebase-edition topic list — no Pro topics. Swapped for
// docs.topics.selfhosted.ts via angular.json's fileReplacements, same
// mechanism as app.routes.ts, and for the same reason: a runtime/ternary
// check on environment.edition does not reliably keep Pro-only data (or
// the strings/components it references) out of the Firebase bundle. See
// docs/adr/0004-edition-separation-mechanism.md.
export type { DocTopic };
export const docTopics: DocTopic[] = baseDocTopics;
