import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as api from '../index';
import { useHighlight, type UseHighlightOptions } from './useHighlight';

// jsdom has no Custom Highlight API; this stands in for CSS.highlights and Highlight.
class FakeHighlight extends Set<AbstractRange> {
  priority = 0;
  type: HighlightType = 'highlight';
}

let highlights: Map<string, FakeHighlight>;

beforeEach(() => {
  highlights = new Map();
  Object.assign(globalThis.CSS, { highlights });
  Object.assign(globalThis, { Highlight: FakeHighlight });
});

afterEach(() => {
  cleanup();
  delete (globalThis.CSS as { highlights?: unknown }).highlights;
  delete (globalThis as { Highlight?: unknown }).Highlight;
});

const painted = (name: string) => [...(highlights.get(name) ?? [])].map((range) => range.toString());

function Search({ text = 'Apple pie and apple tart', ...options }: Partial<UseHighlightOptions> & { text?: string }) {
  const highlight = useHighlight({ name: 'search', ...options });
  return (
    <div>
      <p ref={highlight.ref} data-testid="body">
        {text}
      </p>
      <output data-testid="count">{highlight.matches.length}</output>
    </div>
  );
}

const count = () => screen.getByTestId('count').textContent;

describe('useHighlight', () => {
  it('is exported from the package', () => {
    expect(api.useHighlight).toBe(useHighlight);
  });

  it('paints every match under the name, ignoring case by default', () => {
    render(<Search query="apple" />);
    expect(count()).toBe('2');
    expect(painted('search')).toEqual(['Apple', 'apple']);
  });

  it('matches case exactly when caseSensitive is set', () => {
    render(<Search query="apple" caseSensitive />);
    expect(painted('search')).toEqual(['apple']);
  });

  it('finds every term of a list, longest first, and skips empty strings', () => {
    render(<Search text="foobar foo" query={['', 'foo', 'foobar']} />);
    expect(painted('search')).toEqual(['foobar', 'foo']);
  });

  it('treats the query as plain text, not a pattern', () => {
    render(<Search text="a.b axb (c)" query={['a.b', '(c)']} />);
    expect(painted('search')).toEqual(['a.b', '(c)']);
  });

  it('finds matches inside nested elements, one text node at a time', () => {
    function Nested() {
      const highlight = useHighlight({ name: 'search', query: 'foo' });
      return (
        <p ref={highlight.ref}>
          foo <b>foo</b> fo<i>o</i>
        </p>
      );
    }
    render(<Nested />);
    expect(painted('search')).toEqual(['foo', 'foo']);
  });

  it('skips text the browser does not show', () => {
    const original = HTMLElement.prototype.checkVisibility;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return !this.hidden;
    };
    try {
      function Partly() {
        const highlight = useHighlight({ name: 'search', query: 'tea' });
        return (
          <div ref={highlight.ref}>
            <p>tea</p>
            <p hidden>tea</p>
          </div>
        );
      }
      render(<Partly />);
      expect(painted('search')).toEqual(['tea']);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('searches again when the text under ref changes', async () => {
    render(<Search query="pear" text="apple" />);
    expect(count()).toBe('0');
    expect(highlights.has('search')).toBe(false);
    await act(async () => {
      screen.getByTestId('body').append(' and pear');
    });
    expect(count()).toBe('1');
    expect(painted('search')).toEqual(['pear']);
  });

  it('clears the highlight when the query is emptied', () => {
    const { rerender } = render(<Search query="apple" />);
    rerender(<Search query="" />);
    expect(count()).toBe('0');
    expect(highlights.has('search')).toBe(false);
  });

  it('lets hooks that share a name paint into one highlight', () => {
    function Two() {
      const [showSecond, setShowSecond] = useState(true);
      const a = useHighlight({ name: 'search', query: 'one' });
      const b = useHighlight({ name: 'search', query: 'two' });
      return (
        <>
          <p ref={a.ref}>one</p>
          {showSecond ? <p ref={b.ref}>two</p> : null}
          <button type="button" onClick={() => setShowSecond(false)}>
            Hide
          </button>
        </>
      );
    }
    const { unmount } = render(<Two />);
    expect(painted('search')).toEqual(['one', 'two']);
    act(() => screen.getByRole('button').click());
    expect(painted('search')).toEqual(['one']);
    unmount();
    expect(highlights.has('search')).toBe(false);
  });

  it('paints extra ranges without a ref and keeps a range two hooks share until both let go', () => {
    const range = document.createRange();
    const text = document.createTextNode('shared');
    document.body.append(text);
    range.selectNodeContents(text);
    function Extra({ second }: { second: boolean }) {
      const a = useHighlight({ name: 'current', ranges: [range] });
      const b = useHighlight({ name: 'current', ranges: second ? [range] : undefined });
      return <output>{a.matches.length + b.matches.length}</output>;
    }
    const { rerender, unmount } = render(<Extra second />);
    expect(painted('current')).toEqual(['shared']);
    rerender(<Extra second={false} />);
    expect(painted('current')).toEqual(['shared']);
    unmount();
    expect(highlights.has('current')).toBe(false);
    text.remove();
  });

  it('sets priority and type on the highlight', () => {
    render(<Search query="apple" priority={2} type="spelling-error" />);
    const highlight = highlights.get('search')!;
    expect(highlight.priority).toBe(2);
    expect(highlight.type).toBe('spelling-error');
  });

  it('moves its ranges when the name changes', () => {
    const { rerender } = render(<Search query="apple" />);
    rerender(<Search query="apple" name="other" />);
    expect(highlights.has('search')).toBe(false);
    expect(painted('other')).toEqual(['Apple', 'apple']);
  });

  it('still reports matches where the API is missing', () => {
    delete (globalThis.CSS as { highlights?: unknown }).highlights;
    render(<Search query="apple" />);
    expect(count()).toBe('2');
  });
});
