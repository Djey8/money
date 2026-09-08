import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadExplainTopics, buildExplainTool } from '../../src/tools/explain';
import { buildToolList, dispatchToolCall } from '../../src/tools/dispatch';
import { ApiClient } from '../../src/client';

function withTempDocsDir(files: Record<string, string>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'mm-mcp-explain-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf8');
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('loadExplainTopics', () => {
  it('slugifies filenames and extracts the first heading as the title', () => {
    const { dir, cleanup } = withTempDocsDir({
      'FIRE_COVERAGE_FORMULA.md': '# Fire coverage formula\n\nSome content.',
    });
    try {
      const topics = loadExplainTopics(dir);
      expect(Object.keys(topics)).toEqual(['fire_coverage_formula']);
      expect(topics.fire_coverage_formula.title).toBe('Fire coverage formula');
      expect(topics.fire_coverage_formula.content).toContain('Some content.');
    } finally {
      cleanup();
    }
  });

  it('falls back to the slug as the title when there is no heading', () => {
    const { dir, cleanup } = withTempDocsDir({ 'no_heading.md': 'Just text, no heading.' });
    try {
      const topics = loadExplainTopics(dir);
      expect(topics.no_heading.title).toBe('no_heading');
    } finally {
      cleanup();
    }
  });

  it('ignores non-markdown files and ignores a missing directory rather than throwing', () => {
    const { dir, cleanup } = withTempDocsDir({ 'notes.txt': 'not markdown' });
    try {
      expect(loadExplainTopics(dir)).toEqual({});
      expect(loadExplainTopics(join(dir, 'does-not-exist'))).toEqual({});
    } finally {
      cleanup();
    }
  });
});

describe('buildExplainTool + dispatch', () => {
  const topics = {
    kpi_formulas: { title: 'KPI formulas', content: '# KPI formulas\n\nDetails here.' },
  };
  const tool = buildExplainTool(topics);
  const fakeClient = new ApiClient('http://localhost:3000/api/v1', 'mmpat_test', jest.fn());

  it('lists an enum of topic keys in the tool schema', () => {
    const [listed] = buildToolList([tool]);
    expect(listed.inputSchema.properties?.topic).toMatchObject({ enum: ['kpi_formulas'] });
    expect(listed.inputSchema.required).toEqual(['topic']);
  });

  it('returns the topic content verbatim without calling the API client', async () => {
    const result = await dispatchToolCall([tool], fakeClient, 'explain_concept', {
      topic: 'kpi_formulas',
    });
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{ type: 'text', text: topics.kpi_formulas.content }]);
  });

  it('errors clearly on an unknown topic, listing valid ones', async () => {
    const result = await dispatchToolCall([tool], fakeClient, 'explain_concept', {
      topic: 'not_a_real_topic',
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('kpi_formulas');
  });

  it('errors when topic is missing entirely', async () => {
    const result = await dispatchToolCall([tool], fakeClient, 'explain_concept', {});
    expect(result.isError).toBe(true);
  });
});
