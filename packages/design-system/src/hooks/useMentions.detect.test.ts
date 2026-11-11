import { describe, expect, it } from 'vitest';
import { findQuery, shiftIndex, shiftTokens, validTokens, type MentionToken } from './useMentions.detect.js';

const at = [{ char: '@' }, { char: '/', position: 'start' as const }];
const ada: MentionToken = { start: 4, end: 17, char: '@', value: 'ada', text: '@Ada Lovelace' };

describe('findQuery', () => {
  it('finds the word after a trigger at the start or after whitespace', () => {
    expect(findQuery('@ad', 3, at, [])).toEqual({ trigger: 0, start: 0, end: 3, query: 'ad' });
    expect(findQuery('hi @ad', 6, at, [])).toEqual({ trigger: 0, start: 3, end: 6, query: 'ad' });
    expect(findQuery('hi\n@', 4, at, [])).toEqual({ trigger: 0, start: 3, end: 4, query: '' });
  });

  it('takes the whole word when the caret is inside it', () => {
    expect(findQuery('hi @ada there', 5, at, [])).toEqual({ trigger: 0, start: 3, end: 7, query: 'ada' });
  });

  it('finds nothing after a word character, after whitespace in the word, or with the caret before the trigger', () => {
    expect(findQuery('ben@x', 5, at, [])).toBeNull();
    expect(findQuery('@ad a', 5, at, [])).toBeNull();
    expect(findQuery('hi @ad', 3, at, [])).toBeNull();
  });

  it('finds a start-only trigger only where whitespace alone comes before it', () => {
    expect(findQuery('/he', 3, at, [])).toEqual({ trigger: 1, start: 0, end: 3, query: 'he' });
    expect(findQuery('  /he', 5, at, [])).toEqual({ trigger: 1, start: 2, end: 5, query: 'he' });
    expect(findQuery('see /he', 7, at, [])).toBeNull();
  });

  it('keeps a trigger character that cannot start a word inside the word', () => {
    expect(findQuery('@src/in', 7, at, [])).toEqual({ trigger: 0, start: 0, end: 7, query: 'src/in' });
    expect(findQuery('hi ben@x', 8, at, [])).toBeNull();
  });

  it('finds nothing inside a token', () => {
    expect(findQuery('hey @Ada Lovelace ', 8, at, [ada])).toBeNull();
    expect(findQuery('hey @Ada Lovelace', 17, at, [ada])).toBeNull();
  });
});

describe('shiftTokens', () => {
  const text = 'hey @Ada Lovelace hi';

  it('keeps tokens before an edit and shifts tokens after it', () => {
    expect(shiftTokens(text, `${text}!`, [ada])).toEqual([ada]);
    expect(shiftTokens(text, `oh ${text}`, [ada])).toEqual([{ ...ada, start: 7, end: 20 }]);
  });

  it('drops a token an edit touches', () => {
    expect(shiftTokens(text, 'hey @Ada Lovelac hi', [ada])).toEqual([]);
    expect(shiftTokens(text, '', [ada])).toEqual([]);
  });

  it('places a typed character at the caret, so typing the token\'s first character before it keeps it', () => {
    const bob: MentionToken = { start: 3, end: 7, char: '@', value: 'bob', text: '@Bob' };
    expect(shiftTokens('hi @Bob', 'hi @@Bob', [bob], 4)).toEqual([{ ...bob, start: 4, end: 8 }]);
    expect(shiftTokens('hi @Bob', 'hi @@Bob', [bob])).toEqual([]);
  });

  it('keeps a token when text is typed right after it', () => {
    expect(shiftTokens(text, 'hey @Ada Lovelace, hi', [ada])).toEqual([ada]);
  });
});

describe('validTokens', () => {
  it('drops tokens whose range no longer holds their text, and overlaps', () => {
    expect(validTokens('hey @Ada', [ada])).toEqual([]);
    expect(validTokens('hey @Ada Lovelace', [ada, { ...ada, start: 5, end: 18 }])).toEqual([ada]);
  });
});

describe('shiftIndex', () => {
  it('moves an index through an edit, or loses it inside the change', () => {
    expect(shiftIndex('a @b', 'xa @b', 2)).toBe(3);
    expect(shiftIndex('a @b', 'a @bc', 2)).toBe(2);
    expect(shiftIndex('a @b c', 'a  c', 2)).toBeNull();
    expect(shiftIndex('ab @c', 'a @c', 3)).toBe(2);
    expect(shiftIndex('a @b', 'a xb', 2)).toBeNull();
  });
});
