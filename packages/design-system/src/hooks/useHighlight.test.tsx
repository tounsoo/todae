import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('matches text hidden by CSS but not the text of script and style elements', () => {
    function Partly() {
      const highlight = useHighlight({ name: 'search', query: 'tea' });
      return (
        <div ref={highlight.ref}>
          <p>tea</p>
          <p hidden>tea</p>
          <p style={{ display: 'none' }}>tea</p>
          <script type="text/plain">tea</script>
          <style>{'.tea {}'}</style>
        </div>
      );
    }
    render(<Partly />);
    expect(painted('search')).toEqual(['tea', 'tea', 'tea']);
  });

  it('searches once where MutationObserver is missing', () => {
    const original = globalThis.MutationObserver;
    delete (globalThis as { MutationObserver?: unknown }).MutationObserver;
    try {
      render(<Search query="apple" />);
      expect(count()).toBe('2');
    } finally {
      globalThis.MutationObserver = original;
    }
  });

  it('searches again when the text under ref changes', async () => {
    render(<Search query="pear" text="apple" />);
    expect(count()).toBe('0');
    expect(painted('search')).toEqual([]);
    await act(async () => {
      screen.getByTestId('body').append(' and pear');
    });
    expect(count()).toBe('1');
    expect(painted('search')).toEqual(['pear']);
  });

  it('clears the highlight when the query is emptied and removes the name on unmount', () => {
    const { rerender, unmount } = render(<Search query="apple" />);
    rerender(<Search query="" />);
    expect(count()).toBe('0');
    expect(painted('search')).toEqual([]);
    unmount();
    expect(highlights.has('search')).toBe(false);
  });

  it('paints extra ranges without a ref', () => {
    const text = document.createTextNode('extra');
    document.body.append(text);
    const range = document.createRange();
    range.selectNodeContents(text);
    function Extra() {
      const highlight = useHighlight({ name: 'current', ranges: [range] });
      return <output>{highlight.matches.length}</output>;
    }
    render(<Extra />);
    expect(painted('current')).toEqual(['extra']);
    text.remove();
  });

  it('sets priority and type, and resets them to the defaults when they are dropped', () => {
    const { rerender } = render(<Search query="apple" priority={2} type="spelling-error" />);
    const highlight = highlights.get('search')!;
    expect(highlight.priority).toBe(2);
    expect(highlight.type).toBe('spelling-error');
    rerender(<Search query="apple" />);
    expect(highlight.priority).toBe(0);
    expect(highlight.type).toBe('highlight');
  });

  it('keeps one Highlight, with its priority, while its ranges change', () => {
    const text = document.createTextNode('one two');
    document.body.append(text);
    const first = document.createRange();
    first.setStart(text, 0);
    first.setEnd(text, 3);
    const second = document.createRange();
    second.setStart(text, 4);
    second.setEnd(text, 7);
    function Current({ range }: { range?: Range }) {
      useHighlight({ name: 'current', ranges: range ? [range] : undefined, priority: 1 });
      return null;
    }
    const { rerender } = render(<Current range={first} />);
    const highlight = highlights.get('current')!;
    rerender(<Current />);
    rerender(<Current range={second} />);
    expect(highlights.get('current')).toBe(highlight);
    expect(highlight.priority).toBe(1);
    expect(painted('current')).toEqual(['two']);
    text.remove();
  });

  it('leaves the name to a later hook when an earlier one with that name unmounts', () => {
    function Two({ first }: { first: boolean }) {
      return (
        <>
          {first ? <Search query="apple" /> : null}
          <Search query="pie" />
        </>
      );
    }
    const { rerender } = render(<Two first />);
    const later = highlights.get('search');
    rerender(<Two first={false} />);
    expect(highlights.get('search')).toBe(later);
    expect(painted('search')).toEqual(['pie']);
  });

  it('registers again when page code clears the registry', () => {
    const { rerender } = render(<Search query="apple" />);
    highlights.clear();
    rerender(<Search query="pie" />);
    expect(painted('search')).toEqual(['pie']);
  });

  it('does not repaint a new array holding the same ranges', () => {
    const range = document.createRange();
    function Inline({ tick }: { tick: number }) {
      useHighlight({ name: 'current', ranges: [range] });
      return <output>{tick}</output>;
    }
    const { rerender } = render(<Inline tick={0} />);
    const highlight = highlights.get('current')!;
    const add = vi.spyOn(highlight, 'add');
    const clear = vi.spyOn(highlight, 'clear');
    rerender(<Inline tick={1} />);
    expect(add).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('skips the text inside a textarea', () => {
    function Form() {
      const highlight = useHighlight({ name: 'search', query: 'tea' });
      return (
        <div ref={highlight.ref}>
          <p>tea</p>
          <textarea defaultValue="tea" />
        </div>
      );
    }
    render(<Form />);
    expect(painted('search')).toEqual(['tea']);
  });

  it('moves the same Highlight, with its priority, when the name changes', () => {
    const { rerender } = render(<Search query="apple" priority={3} />);
    const highlight = highlights.get('search');
    rerender(<Search query="apple" priority={3} name="other" />);
    expect(highlights.has('search')).toBe(false);
    expect(highlights.get('other')).toBe(highlight);
    expect(highlights.get('other')!.priority).toBe(3);
    expect(painted('other')).toEqual(['Apple', 'apple']);
  });

  it('still reports matches where the API is missing', () => {
    delete (globalThis.CSS as { highlights?: unknown }).highlights;
    render(<Search query="apple" />);
    expect(count()).toBe('2');
  });
});
