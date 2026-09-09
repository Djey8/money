import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExplainTool, ExplainTopic } from './registry.js';

// apps/mcp/dist/tools/explain.js (compiled) -> up to apps/mcp/dist -> apps/mcp -> apps -> repo root.
const DOMAIN_DOCS_DIR = join(__dirname, '..', '..', '..', '..', 'docs', 'domain');

function titleFromContent(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : fallback;
}

function slugify(filename: string): string {
  return filename.replace(/\.md$/i, '').toLowerCase();
}

/**
 * Loads every docs/domain/*.md file once at startup (per docs/adr/0008's
 * "loaded at startup, not re-fetched per call" rule) into the explain_concept
 * tool's topic list. A missing/empty docs/domain directory yields a tool
 * with zero topics rather than failing the whole server to start.
 */
export function loadExplainTopics(dir: string = DOMAIN_DOCS_DIR): Record<string, ExplainTopic> {
  const topics: Record<string, ExplainTopic> = {};
  let filenames: string[];
  try {
    filenames = readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.md'));
  } catch {
    return topics;
  }
  for (const filename of filenames) {
    const content = readFileSync(join(dir, filename), 'utf8');
    const key = slugify(filename);
    topics[key] = { title: titleFromContent(content, key), content };
  }
  return topics;
}

export function buildExplainTool(
  topics: Record<string, ExplainTopic> = loadExplainTopics(),
): ExplainTool {
  return {
    kind: 'explain',
    name: 'explain_concept',
    description:
      'Explains a Money Manager domain concept (a calculation formula or worked example) from docs/domain/. ' +
      'No API call, no scope required. Pass topic: one of ' +
      Object.keys(topics).join(', ') +
      '.',
    topics,
  };
}
