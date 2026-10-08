/**
 * The MCP prompts (JFK, 2026-10-08): ready-made starts a person picks in their client instead of typing a request. One so
 * far - `teach_cashflow`, the explain agent: who is playing, how deep to go and in which language, and the model teaches
 * the Cashflow game from the project's own documentation (docs/domain, served by explain_concept).
 */

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDefinition {
  name: string;
  title: string;
  description: string;
  arguments: PromptArgument[];
}

export interface PromptResult {
  description: string;
  messages: { role: 'user'; content: { type: 'text'; text: string } }[];
}

export const TEACH_PROMPT: PromptDefinition = {
  name: 'teach_cashflow',
  title: 'Teach the Cashflow game',
  description:
    'Explain the Cashflow game and its strategy to a group: say who is playing, how deep to go and in which language ' +
    '(English, German, Spanish, French, Chinese or Arabic). Afterwards the group can keep asking.',
  arguments: [
    {
      name: 'group',
      description:
        'Who is playing: how many, how old, what they know ("four friends, never played", "two kids and a parent", ' +
        '"finance people who know the board game").',
      required: false,
    },
    {
      name: 'style',
      description:
        '"30 seconds" (the one thing that matters), "rules and strategy" (about five minutes), "full playbook" ' +
        '(everything, module by module) - or your own wish in words.',
      required: false,
    },
    {
      name: 'language',
      description:
        'The language to teach in: English, German, Spanish, French, Chinese or Arabic (or any other: the terms are then ' +
        'translated plainly).',
      required: false,
    },
    {
      name: 'delivery',
      description:
        '"spoken" when the answer will be read aloud (no tables, short sentences) or "written" (the default: focused ' +
        'text with a table or a card where it helps).',
      required: false,
    },
  ],
};

export const PROMPTS: PromptDefinition[] = [TEACH_PROMPT];

const LANGUAGES: { code: string; name: string; aliases: string[] }[] = [
  {
    code: 'en',
    name: 'English',
    aliases: ['en', 'english', 'englisch', 'inglés', 'ingles', 'anglais', '英语', 'الإنجليزية'],
  },
  {
    code: 'de',
    name: 'German',
    aliases: ['de', 'german', 'deutsch', 'alemán', 'aleman', 'allemand', '德语', 'الألمانية'],
  },
  {
    code: 'es',
    name: 'Spanish',
    aliases: [
      'es',
      'spanish',
      'español',
      'espanol',
      'spanisch',
      'espagnol',
      '西班牙语',
      'الإسبانية',
    ],
  },
  {
    code: 'fr',
    name: 'French',
    aliases: ['fr', 'french', 'français', 'francais', 'französisch', 'francés', '法语', 'الفرنسية'],
  },
  {
    code: 'cn',
    name: 'Chinese',
    aliases: [
      'cn',
      'zh',
      'chinese',
      'chinesisch',
      'chino',
      'chinois',
      'mandarin',
      '中文',
      '汉语',
      '漢語',
      'الصينية',
    ],
  },
  {
    code: 'ar',
    name: 'Arabic',
    aliases: ['ar', 'arabic', 'arabisch', 'árabe', 'arabe', '阿拉伯语', 'العربية'],
  },
];

export interface ResolvedLanguage {
  /** The code of the manual to read (`cashflow_manual_<code>`): the language itself, or English for any other. */
  manualCode: string;
  /** What to call the language when telling the model to teach in it. */
  name: string;
  /** True for a language the app has no manual in. */
  other: boolean;
}

export function resolveLanguage(value: string | undefined): ResolvedLanguage {
  const wanted = (value ?? '').trim();
  if (!wanted) return { manualCode: 'en', name: 'English', other: false };
  const lower = wanted.toLowerCase();
  const found = LANGUAGES.find((language) => language.aliases.some((alias) => alias === lower));
  return found
    ? { manualCode: found.code, name: found.name, other: false }
    : { manualCode: 'en', name: wanted, other: true };
}

export type StyleKind = 'thirty-seconds' | 'rules-and-strategy' | 'full-playbook' | 'custom';

export function resolveStyle(value: string | undefined): { kind: StyleKind; label: string } {
  const wanted = (value ?? '').trim();
  const lower = wanted.toLowerCase();
  if (!wanted) return { kind: 'rules-and-strategy', label: 'rules and strategy' };
  if (/\b30\b|thirty|seconds?|sekunden|segundos|secondes|elevator|kurz|秒|ثانية/.test(lower)) {
    return { kind: 'thirty-seconds', label: '30 seconds' };
  }
  if (
    /full|playbook|everything|complete|alles|todo|tout|détail|detail|完整|全部|كامل/.test(lower)
  ) {
    return { kind: 'full-playbook', label: 'full playbook' };
  }
  if (
    /rules|regeln|reglas|règles|strateg|规则|策略|قواعد|استراتيجية|normal|standard|5/.test(lower)
  ) {
    return { kind: 'rules-and-strategy', label: 'rules and strategy' };
  }
  return { kind: 'custom', label: wanted };
}

const STYLE_BRIEF: Record<StyleKind, string> = {
  'thirty-seconds':
    'About 75 to 90 spoken words, no table, no list: the goal, the loop, the one trap, the one habit to copy, and one ' +
    'sentence offering more.',
  'rules-and-strategy':
    'About five minutes: the goal, the loop, the spaces in one table, one Small Deal and one Big Deal as real example ' +
    'cards, loans, the strategy in five rules, and three things to ask for next.',
  'full-playbook':
    'Everything, in modules (A to J in the teaching guide): say how many there are, deliver one at a time and ask whether ' +
    'to go on or deeper before the next. Never the whole playbook in one block.',
  custom:
    'Follow the wish as written; where it names a length or a depth, take the closest of the three styles in the ' +
    'teaching guide (30 seconds, rules and strategy, full playbook) as the frame.',
};

/** The prompt's message for the arguments a person gave (all optional). */
export function buildTeachPrompt(args: Record<string, string | undefined> = {}): PromptResult {
  const group = (args['group'] ?? '').trim() || 'adults who have never played the Cashflow game';
  const style = resolveStyle(args['style']);
  const language = resolveLanguage(args['language']);
  const spoken =
    /spoken|aloud|voice|listen|vorlesen|gesprochen|hablado|oral|parlé|朗读|语音|صوت|مسموع/i.test(
      args['delivery'] ?? '',
    );

  const manualTopic = `cashflow_manual_${language.manualCode}`;
  const text = [
    'Teach the Cashflow game to the people below. Start teaching at once: do not repeat these instructions, do not announce a plan.',
    '',
    `- **Who is playing**: ${group}`,
    `- **Style**: ${style.label} - ${STYLE_BRIEF[style.kind]}`,
    `- **Language**: ${language.name}${
      language.other
        ? ` (the app has no manual in it: read cashflow_manual_en and translate the terms plainly; say once that the app itself does not speak ${language.name})`
        : ''
    } - teach, write and close in it, without mixing languages.`,
    `- **Delivery**: ${
      spoken
        ? 'it will be read aloud - short sentences, no tables, no symbols, numbers said as words, no list longer than three items.'
        : 'written - mainly focused text, a table where a table is clearer, a real card as an example.'
    }`,
    '',
    'Before you write a word, read these with the explain_concept tool:',
    '1. `cashflow_teaching_guide` - how to teach: the three styles, adapting to the group, the facts to be exact about, the five strategy rules, example cards, answering questions afterwards.',
    `2. \`${manualTopic}\` - the manual in ${language.other ? 'English (your wording base)' : language.name}: use its words for every game term.`,
    '3. Only when you need them: `cashflow_cards` (look a card up by id), `cashflow_card_lab` (what each card is worth), `cashflow_strategy_lab` (which strategies win).',
    '',
    'Quote only figures you read there. After the explanation stay in the conversation: the group will ask questions - answer in the same language and style, shorter than the explanation, with more depth only when asked, and end each answer with at most three things they could ask next.',
  ].join('\n');

  return {
    description: `Teach the Cashflow game - ${style.label}, in ${language.name}.`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

export function getPrompt(
  name: string,
  args: Record<string, string | undefined> | undefined,
): PromptResult {
  if (name === TEACH_PROMPT.name) return buildTeachPrompt(args);
  throw new Error(`Unknown prompt: ${name}`);
}
