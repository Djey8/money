import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { join } from 'node:path';
import { buildServer } from '../../src/index';
import { loadExplainTopics } from '../../src/tools/explain';
import { buildTeachPrompt, resolveLanguage, resolveStyle, TEACH_PROMPT } from '../../src/prompts';

const docs = join(__dirname, '..', '..', '..', '..', 'docs', 'domain');

describe('resolveLanguage', () => {
  it('knows the six languages by code, by name and by their own word', () => {
    expect(resolveLanguage('German').manualCode).toBe('de');
    expect(resolveLanguage('deutsch').manualCode).toBe('de');
    expect(resolveLanguage('Español').manualCode).toBe('es');
    expect(resolveLanguage('français').manualCode).toBe('fr');
    expect(resolveLanguage('中文').manualCode).toBe('cn');
    expect(resolveLanguage('العربية').manualCode).toBe('ar');
    expect(resolveLanguage(undefined)).toEqual({ manualCode: 'en', name: 'English', other: false });
  });

  it('teaches in any other language from the English manual', () => {
    expect(resolveLanguage('Italian')).toEqual({ manualCode: 'en', name: 'Italian', other: true });
  });
});

describe('resolveStyle', () => {
  it('maps the three styles from short wishes in several languages', () => {
    expect(resolveStyle('30 seconds').kind).toBe('thirty-seconds');
    expect(resolveStyle('in 30 Sekunden').kind).toBe('thirty-seconds');
    expect(resolveStyle('rules and strategy').kind).toBe('rules-and-strategy');
    expect(resolveStyle('Regeln und Strategie').kind).toBe('rules-and-strategy');
    expect(resolveStyle('the full playbook').kind).toBe('full-playbook');
    expect(resolveStyle(undefined).kind).toBe('rules-and-strategy');
  });

  it('keeps an own wish as written', () => {
    expect(resolveStyle('like a pirate, one example').kind).toBe('custom');
  });
});

describe('buildTeachPrompt', () => {
  it('says who plays, the style and the language, and what to read first', () => {
    const { messages } = buildTeachPrompt({
      group: 'three friends who never played',
      style: '30 seconds',
      language: 'German',
    });
    const text = messages[0].content.text;
    expect(text).toContain('three friends who never played');
    expect(text).toContain('30 seconds');
    expect(text).toContain('German');
    expect(text).toContain('cashflow_teaching_guide');
    expect(text).toContain('cashflow_manual_de');
  });

  it('asks for the ear when the answer will be read aloud', () => {
    const spoken = buildTeachPrompt({ delivery: 'spoken' }).messages[0].content.text;
    expect(spoken).toContain('read aloud');
    expect(buildTeachPrompt({}).messages[0].content.text).toContain('written');
  });

  it('names only topics that exist', () => {
    const topics = loadExplainTopics(docs);
    for (const language of [
      'English',
      'German',
      'Spanish',
      'French',
      'Chinese',
      'Arabic',
      'Italian',
    ]) {
      const text = buildTeachPrompt({ language }).messages[0].content.text;
      for (const [, topic] of text.matchAll(/`(cashflow_[a-z_]+)`/g)) {
        expect(topics[topic]).toBeDefined();
      }
    }
  });
});

describe('the teaching topics', () => {
  it('serve the guide and the manual of every language through explain_concept', () => {
    const topics = loadExplainTopics(docs);
    expect(topics['cashflow_teaching_guide'].content).toContain('30 seconds');
    for (const code of ['en', 'de', 'es', 'fr', 'cn', 'ar']) {
      expect(topics[`cashflow_manual_${code}`]).toBeDefined();
    }
  });
});

describe('the server', () => {
  it('lists teach_cashflow and returns its message', async () => {
    const server = buildServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const listed = await client.listPrompts();
    expect(listed.prompts.map((prompt) => prompt.name)).toEqual([TEACH_PROMPT.name]);
    expect(listed.prompts[0].arguments?.map((argument) => argument.name)).toEqual([
      'group',
      'style',
      'language',
      'delivery',
    ]);

    const got = await client.getPrompt({
      name: 'teach_cashflow',
      arguments: { language: 'Spanish', style: 'full playbook' },
    });
    const first = got.messages[0].content;
    expect(first.type === 'text' && first.text).toContain('cashflow_manual_es');
  });
});
