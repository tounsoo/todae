import { expect, it } from 'vitest';
import { layoutScale, pixels } from './cssLength.js';

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

it.each([
  [500, 1000, 0.5],
  [1000.6, 1000, 1],
  [1001, 1000, 1],
  [1002, 1000, 1.002],
  [10, 0, 1],
])('scales %d drawn over %d laid out by %d', (drawn, laid, expected) => {
  expect(layoutScale(drawn, laid)).toBe(expected);
});
