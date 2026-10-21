import { describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS } from '../providers/strings.js';
import { describeValidity, focusTargetFor, reachTarget, registerValueInput, type ValidityCarrier } from './validity.js';

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

describe('a bound', () => {
  it('is worded in the field\'s format when a value input registered one, and the raw bound otherwise', () => {
    const el = control({ rangeUnderflow: true }, { type: 'number', min: '3' });
    expect(describeValidity(el, DEFAULT_STRINGS)?.message).toBe('Enter 3 or more');
    registerValueInput(el, {}, { owner: () => null, bound: { min: 'three' } });
    expect(describeValidity(el, DEFAULT_STRINGS)?.message).toBe('Enter three or more');
  });

  it.each(['date', 'time', 'datetime-local'])('reads "or later" and "or earlier" for a %s', (type) => {
    expect(describeValidity(control({ rangeUnderflow: true }, { type, min: 'A' }), DEFAULT_STRINGS)?.message).toBe('Enter A or later');
    expect(describeValidity(control({ rangeOverflow: true }, { type, max: 'B' }), DEFAULT_STRINGS)?.message).toBe('Enter B or earlier');
  });

  it('reads "or more" and "or less" for a number', () => {
    expect(describeValidity(control({ rangeUnderflow: true }, { type: 'number', min: '1' }), DEFAULT_STRINGS)?.message).toBe('Enter 1 or more');
    expect(describeValidity(control({ rangeOverflow: true }, { type: 'number', max: '9' }), DEFAULT_STRINGS)?.message).toBe('Enter 9 or less');
  });
});

describe('focusTargetFor', () => {
  it('is the control itself, or for a value input its field\'s control as it is now', () => {
    const el = document.createElement('input');
    expect(focusTargetFor(el)).toBe(el);
    let owner: HTMLElement | null = null;
    registerValueInput(el, {}, { owner: () => owner, bound: {} });
    expect(focusTargetFor(el)).toBe(el);
    owner = document.createElement('button');
    expect(focusTargetFor(el)).toBe(owner);
  });
});

describe('reachTarget', () => {
  it('is disabled when the value input or the control it speaks for is', () => {
    const el = document.createElement('input');
    const button = document.createElement('button');
    registerValueInput(el, {}, { owner: () => button, bound: {} });
    expect(reachTarget(el)).toEqual({ target: button, disabled: false });
    button.disabled = true;
    expect(reachTarget(el).disabled).toBe(true);
  });
});
