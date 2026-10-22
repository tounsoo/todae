import { describe, expect, it } from 'vitest';
import { applyEdit, cleanCode, editOf, type OneTimeCodeCharacters } from './oneTimeCode.js';

describe('cleanCode', () => {
  it.each([
    ['Your code: 482-913', 'digits', 6, '482913'],
    ['12345678', 'digits', 6, '123456'],
    ['A-b_3 ?', 'alphanumeric', 6, 'Ab3'],
    ['１２３', 'digits', 6, '123'],
    ['ＡｂＣ１', 'alphanumeric', 6, 'AbC1'],
    ['ㅎ하', 'alphanumeric', 6, ''],
    ['abc', 'digits', 6, ''],
    ['1234567', 'digits', Infinity, '1234567'],
    ['０９ＡＺａｚ', 'alphanumeric', 6, '09AZaz'],
    // Only full-width digits and letters count as ASCII, not every character that has a compatibility form.
    ['½①²٣', 'digits', 6, ''],
    ['ﬁ™', 'alphanumeric', 6, ''],
    ['１½', 'digits', 6, '1'],
  ] as const)('keeps %j as %s cut to %d: %j', (text, characters, length, expected) => {
    expect(cleanCode(text, characters, length)).toBe(expected);
  });
});

describe('editOf', () => {
  // The value after the edit, or null when nothing lands.
  function result(value: string, [start, end]: [number, number], text: string, length = 6, characters: OneTimeCodeCharacters = 'digits') {
    const edit = editOf(value, { start, end }, text, { characters, length });
    return edit && applyEdit(value, edit);
  }

  it.each([
    // A partial code: the insert pushes the rest right, as typing does.
    ['types into an empty code', '', [0, 0], '7', '7'],
    ['types at the end of a partial code', '12', [2, 2], '3', '123'],
    ['types in the middle of a partial code', '1234', [1, 1], '9', '19234'],
    ['types over a selected range', '1234', [1, 3], '9', '194'],
    ['pastes two at the end of a partial code', '12', [2, 2], '34', '1234'],
    ['writes over what follows when a paste needs room', '12345', [1, 1], '78', '178345'],
    ['writes over what follows a range when a paste needs room', '12345', [1, 2], '789', '178945'],
    ['cuts what does not fit at the end of a partial code', '12345', [5, 5], '78', '123457'],
    // A full code: typing at a box replaces it, and nothing lands after it.
    ['types over the box at the caret of a full code', '123456', [2, 2], '9', '129456'],
    ['types over the first box of a full code', '123456', [0, 0], '9', '923456'],
    ['types over the last box of a full code', '123456', [5, 5], '9', '123459'],
    ['refuses typing after a full code', '123456', [6, 6], '9', null],
    ['pastes two over a full code from the caret', '123456', [2, 2], '78', '127856'],
    ['pastes two over a selected box of a full code', '123456', [2, 3], '78', '127856'],
    ['cuts a paste at the last box of a full code', '123456', [5, 5], '78', '123457'],
    ['refuses a short paste after a full code', '123456', [6, 6], '78', null],
    // A whole code replaces the value, wherever the caret is.
    ['replaces a partial code with a whole one', '12', [2, 2], '123456', '123456'],
    ['replaces a full code with a whole one after it', '123456', [6, 6], '654321', '654321'],
    ['keeps the first whole code of a longer text', '', [0, 0], 'Your code: 482-913 0', '482913'],
    // Text the code doesn't allow.
    ['refuses text with no allowed character', '1234', [1, 3], 'abc', null],
    ['refuses an empty text', '123', [1, 1], '', null],
    ['keeps the allowed characters of a mixed text', '19', [1, 1], '2 3', '1239'],
    ['takes a full-width digit as its ASCII one', '123456', [1, 1], '１', '113456'],
    ['takes a full-width whole code', '12', [2, 2], '１２３４５６', '123456'],
    // A selection past the value lands after it.
    ['lands a caret past a partial code after it', '1234', [5, 5], '9', '12349'],
  ] as const)('%s', (_name, value, selection, text, expected) => {
    expect(result(value, [...selection], text)).toBe(expected);
  });

  it.each([
    ['', [0, 0], '5', '5'],
    ['3', [0, 0], '5', '5'],
    ['3', [1, 1], '5', '5'],
    ['3', [0, 1], 'x', null],
  ] as const)('with length 1, %j at %j with %j gives %j', (value, selection, text, expected) => {
    expect(result(value, [...selection], text, 1)).toBe(expected);
  });

  it('refuses Hangul in an alphanumeric code and takes an allowed letter', () => {
    expect(result('ABC123', [1, 1], 'ㅎ', 6, 'alphanumeric')).toBe(null);
    expect(result('ABC123', [1, 1], 'x', 6, 'alphanumeric')).toBe('AxC123');
    expect(result('ABC123', [1, 1], 'ab', 6, 'alphanumeric')).toBe('Aab123');
  });

  it('names the range it replaces and what goes in', () => {
    expect(editOf('123456', { start: 2, end: 2 }, '78', { characters: 'digits', length: 6 })).toEqual({ from: 2, to: 4, insert: '78' });
    expect(editOf('12', { start: 1, end: 1 }, '123456', { characters: 'digits', length: 6 })).toEqual({ from: 0, to: 2, insert: '123456' });
  });

  it('keeps every character it does not write over, and never makes the code longer than length', () => {
    const digits = '0123456789';
    for (let size = 0; size <= 6; size++) {
      const value = digits.slice(0, size);
      for (let start = 0; start <= size; start++) {
        for (let end = start; end <= size; end++) {
          for (const text of ['a', 'b', 'ab', 'abc', 'abcde']) {
            // Letters, so what was there and what went in can be told apart.
            const edit = editOf(value, { start, end }, text, { characters: 'alphanumeric', length: 6 });
            if (!edit) continue;
            const next = applyEdit(value, edit);
            expect(next.length).toBeLessThanOrEqual(6);
            expect(edit.from).toBe(start);
            expect(edit.to).toBeGreaterThanOrEqual(end);
            expect(next.startsWith(value.slice(0, start))).toBe(true);
            expect(next.endsWith(value.slice(edit.to))).toBe(true);
          }
        }
      }
    }
  });
});
