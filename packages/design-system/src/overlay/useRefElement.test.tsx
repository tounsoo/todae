import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRefElement } from './useRefElement.js';

afterEach(cleanup);

describe('useRefElement', () => {
  it('follows the element the ref holds after each commit', () => {
    const seen: (string | null)[] = [];
    function Probe({ tag }: { tag: 'a' | 'b' | null }) {
      const ref = useRef<HTMLSpanElement>(null);
      const node = useRefElement(ref);
      seen.push(node?.id ?? null);
      return tag ? <span key={tag} id={tag} ref={ref} /> : null;
    }
    const { rerender } = render(<Probe tag={null} />);
    expect(seen.at(-1)).toBeNull();
    rerender(<Probe tag="a" />);
    expect(seen.at(-1)).toBe('a');
    rerender(<Probe tag="b" />);
    expect(seen.at(-1)).toBe('b');
    rerender(<Probe tag={null} />);
    expect(seen.at(-1)).toBeNull();
  });
});
