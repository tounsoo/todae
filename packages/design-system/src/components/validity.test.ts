import { describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../providers/strings.js';
import { describeValidity, type ValidityCarrier } from './validity.js';

type Flags = Partial<Record<keyof ValidityState, boolean>>;

/** A stand-in for a control: jsdom only computes some flags, and only for edited values. */
function control(flags: Flags, attrs: Record<string, unknown> = {}): ValidityCarrier {
  const validity = { valid: Object.values(flags).every((flag) => !flag), ...flags } as ValidityState;
  return { willValidate: true, validity, validationMessage: 'Browser words', type: 'text', ...attrs } as unknown as ValidityCarrier;
}

describe('describeValidity', () => {
  it('says nothing for a valid control', () => {
    expect(describeValidity(control({}), DEFAULT_STRINGS)).toBeNull();
  });

  it('says nothing for a control barred from validation, whatever its flags', () => {
    expect(describeValidity(control({ valueMissing: true }, { willValidate: false }), DEFAULT_STRINGS)).toBeNull();
  });

  it.each([
    ['valueMissing', {}, 'This field is required'],
    ['typeMismatch', { type: 'email' }, 'Enter an email address'],
    ['typeMismatch', { type: 'url' }, 'Enter a URL'],
    ['typeMismatch', { type: 'text' }, 'Enter a value in the right format'],
    ['badInput', {}, 'Enter a valid value'],
    ['patternMismatch', {}, 'Match the requested format'],
    ['tooShort', { minLength: 3 }, 'Use at least 3 characters'],
    ['tooLong', { maxLength: 5 }, 'Use at most 5 characters'],
    ['rangeUnderflow', { type: 'number', min: '10' }, 'Enter 10 or more'],
    ['rangeOverflow', { type: 'number', max: '20' }, 'Enter 20 or less'],
    ['stepMismatch', {}, 'Enter a value that fits the allowed steps'],
  ] as const)('describes %s from the control\'s own attributes (%j)', (flag, attrs, text) => {
    expect(describeValidity(control({ [flag]: true }, attrs), DEFAULT_STRINGS)).toEqual({ kind: flag, message: text });
  });

  it('keeps a custom error\'s text as the product wrote it, even under other strings', () => {
    const strings = { ...DEFAULT_STRINGS, valueMissing: 'Requis' };
    expect(describeValidity(control({ customError: true }, { validationMessage: 'Taken' }), strings)).toEqual({
      kind: 'customError',
      message: 'Taken',
    });
  });

  it('uses the strings it is given', () => {
    const strings = { ...DEFAULT_STRINGS, tooShort: (min: number) => `Au moins ${min}` };
    expect(describeValidity(control({ tooShort: true }, { minLength: 2 }), strings)?.message).toBe('Au moins 2');
  });

  it('picks the first failed flag in a fixed order', () => {
    const order = [
      'valueMissing',
      'typeMismatch',
      'badInput',
      'patternMismatch',
      'tooShort',
      'tooLong',
      'rangeUnderflow',
      'rangeOverflow',
      'stepMismatch',
      'customError',
    ] as const;
    for (let i = 0; i < order.length; i++) {
      const failed = Object.fromEntries(order.slice(i).map((flag) => [flag, true]));
      expect(describeValidity(control(failed), DEFAULT_STRINGS)?.kind).toBe(order[i]);
    }
  });

  it('falls back to the browser\'s text for an invalid control with no flag it knows', () => {
    expect(describeValidity(control({ valid: false }), DEFAULT_STRINGS)).toEqual({
      kind: 'customError',
      message: 'Browser words',
    });
  });

  it('reads a real control', () => {
    const input = document.createElement('input');
    input.required = true;
    expect(describeValidity(input, DEFAULT_STRINGS)).toEqual({ kind: 'valueMissing', message: 'This field is required' });
    input.value = 'x';
    expect(describeValidity(input, DEFAULT_STRINGS)).toBeNull();
    input.type = 'email';
    expect(describeValidity(input, DEFAULT_STRINGS)?.kind).toBe('typeMismatch');
  });
});
