import { expect, it } from 'vitest';
import { pixels } from './cssLength.js';

it.each([
  ['12px', 0, 12],
  ['0px', 100, 0],
  ['25%', 400, 100],
  ['-4px', 0, -4],
  ['auto', 100, 0],
  ['', 100, 0],
  ['calc(10% + 4px)', 100, 0],
])('reads %s with a basis of %d as %d', (value, basis, expected) => {
  expect(pixels(value, basis)).toBe(expected);
});
