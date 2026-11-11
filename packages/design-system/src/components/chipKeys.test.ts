import { describe, expect, it } from 'vitest';
import { firstKeys, nextKeys } from './chipKeys.js';

describe('chip keys', () => {
  it('number twins so keys never collide', () => {
    expect(firstKeys(['a', 'a', '1:a', 'a'])).toEqual(['0:a', '1:a', '0:1:a', '2:a']);
  });

  it('drop the pressed twin of a run, else the first', () => {
    const known = { chips: ['x', 'b', 'b', 'y'], keys: ['0:x', '0:b', '1:b', '0:y'] };
    expect(nextKeys({ ...known, pressed: 2 }, ['x', 'b', 'y'])).toEqual(['0:x', '0:b', '0:y']);
    expect(nextKeys({ ...known, pressed: null }, ['x', 'b', 'y'])).toEqual(['0:x', '1:b', '0:y']);
  });

  it('keep a twin its key when an earlier twin is dropped', () => {
    const known = { chips: ['a', 'x', 'a', 'y'], keys: ['0:a', '0:x', '1:a', '0:y'], pressed: null };
    expect(nextKeys(known, ['x', 'a', 'y'])).toEqual(['0:x', '1:a', '0:y']);
  });

  it('give an added chip a new key and keep the rest', () => {
    const known = { chips: ['x', 'a'], keys: ['0:x', '0:a'], pressed: null };
    expect(nextKeys(known, ['a', 'x', 'a'])).toEqual(['1:a', '0:x', '0:a']);
  });

  it('match any other change by value, in order', () => {
    const known = { chips: ['a', 'b', 'a'], keys: ['0:a', '0:b', '1:a'], pressed: null };
    expect(nextKeys(known, ['b', 'a', 'c', 'a', 'a'])).toEqual(['0:b', '0:a', '0:c', '1:a', '2:a']);
  });

  it('stay unique and carry over through random single and bulk changes', () => {
    let seed = 1;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let run = 0; run < 500; run++) {
      let chips = Array.from({ length: rand(6) }, () => ['a', 'b', '1:a'][rand(3)]!);
      let keys = firstKeys(chips);
      for (let step = 0; step < 20; step++) {
        const op = rand(3);
        const next = [...chips];
        let out: string[];
        if (op === 0 && chips.length > 0) {
          const index = rand(chips.length);
          next.splice(index, 1);
          out = nextKeys({ chips, keys, pressed: index }, next);
          expect(out).toEqual(keys.filter((_, i) => i !== index));
        } else if (op === 1) {
          next.splice(rand(chips.length + 1), 0, ['a', 'b'][rand(2)]!);
          out = nextKeys({ chips, keys, pressed: null }, next);
          expect(out.filter((key) => keys.includes(key))).toEqual(keys);
        } else {
          next.reverse();
          if (rand(2)) next.push('a');
          out = nextKeys({ chips, keys, pressed: null }, next);
        }
        expect(new Set(out).size).toBe(next.length);
        expect(out).toHaveLength(next.length);
        chips = next;
        keys = out;
      }
    }
  });
});
