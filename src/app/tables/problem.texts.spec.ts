import { problemText } from './problem.texts';

describe('problemText', () => {
  it('tells a refusal a player meets in their own language, in all six', () => {
    const words = ['en', 'de', 'es', 'fr', 'cn', 'ar'].map((lang) =>
      problemText(lang, 'table_not_your_turn', 'It is not your turn.'),
    );
    expect(new Set(words).size).toBe(6);
    expect(problemText('zh-CN', 'room_kept', 'x')).toBe(problemText('cn', 'room_kept', 'y'));
  });

  it('keeps the server words for a rule refusal or a code it does not know', () => {
    expect(problemText('de', 'table_illegal_move', 'Roll the die first.')).toBe(
      'Roll the die first.',
    );
    expect(problemText('de', undefined, 'Detail')).toBe('Detail');
  });
});
