import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler, startTransition, Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlyphsProvider } from '../providers/GlyphsProvider.js';
import { Tree, type TreeRootProps } from './Tree.js';

afterEach(cleanup);

function Files(props: Omit<TreeRootProps, 'children'>) {
  return (
    <Tree.Root aria-label="Files" {...props}>
      <Tree.Item value="src">
        <Tree.Label>src</Tree.Label>
        <Tree.Group>
          <Tree.Item value="src/components">
            <Tree.Label>components</Tree.Label>
            <Tree.Group>
              <Tree.Item value="src/components/Button.tsx">
                <Tree.Label>Button.tsx</Tree.Label>
              </Tree.Item>
            </Tree.Group>
          </Tree.Item>
          <Tree.Item value="src/index.ts">
            <Tree.Label>index.ts</Tree.Label>
          </Tree.Item>
        </Tree.Group>
      </Tree.Item>
      <Tree.Item value="README.md">
        <Tree.Label>README.md</Tree.Label>
      </Tree.Item>
    </Tree.Root>
  );
}

const item = (name: string) => screen.getByRole('treeitem', { name });
const key = (k: string, init: object = {}) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k, ...init });
const focused = () => document.activeElement?.getAttribute('aria-labelledby')
  ? document.getElementById(document.activeElement.getAttribute('aria-labelledby')!)?.textContent
  : null;
const tabStops = () =>
  screen
    .getAllByRole('treeitem', { hidden: true })
    .filter((node) => node.tabIndex === 0)
    .map((node) => document.getElementById(node.getAttribute('aria-labelledby')!)?.textContent);

describe('Tree', () => {
  it('renders a named tree of items named by their labels', () => {
    render(<Files defaultExpanded={['src']} />);
    expect(screen.getByRole('tree', { name: 'Files' })).toBeTruthy();
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(item('index.ts').hasAttribute('aria-expanded')).toBe(false);
    expect(item('components').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  it('hides a closed item’s group', () => {
    render(<Files />);
    const groups = document.querySelectorAll('[role="group"]');
    expect([...groups].every((group) => group.hasAttribute('hidden'))).toBe(true);
    expect(screen.queryByRole('treeitem', { name: 'index.ts' })).toBeNull();
  });

  it('marks a branch before hydration, from a direct Tree.Group child', () => {
    const html = renderToString(<Files defaultExpanded={['src']} />);
    expect(html).toMatch(/role="treeitem"[^>]*aria-expanded="true"/);
    expect(html).toMatch(/role="treeitem"[^>]*aria-expanded="false"/);
  });

  it('treats an item whose group is wrapped as a branch once the group registers', () => {
    function Wrapped({ children }: { children: ReactNode }) {
      return <Tree.Group>{children}</Tree.Group>;
    }
    render(
      <Tree.Root aria-label="Files">
        <Tree.Item value="a">
          <Tree.Label>a</Tree.Label>
          <Wrapped>
            <Tree.Item value="b">
              <Tree.Label>b</Tree.Label>
            </Tree.Item>
          </Wrapped>
        </Tree.Item>
      </Tree.Root>,
    );
    expect(item('a').getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps one tab stop, on the first item by default and on the selected item when there is one', () => {
    const { unmount } = render(<Files />);
    expect(tabStops()).toEqual(['src']);
    unmount();
    render(<Files defaultValue="README.md" />);
    expect(tabStops()).toEqual(['README.md']);
  });

  it('moves with Up and Down through the items shown, without wrapping', () => {
    render(<Files defaultExpanded={['src']} />);
    act(() => item('src').focus());
    key('ArrowDown');
    expect(focused()).toBe('components');
    key('ArrowDown');
    // components is closed, so Button.tsx is skipped.
    expect(focused()).toBe('index.ts');
    key('ArrowDown');
    expect(focused()).toBe('README.md');
    key('ArrowDown');
    expect(focused()).toBe('README.md');
    key('ArrowUp');
    expect(focused()).toBe('index.ts');
    key('Home');
    expect(focused()).toBe('src');
    key('ArrowUp');
    expect(focused()).toBe('src');
    key('End');
    expect(focused()).toBe('README.md');
  });

  it('opens with Right, then moves into the item; Left moves out, then closes', () => {
    const onExpandedChange = vi.fn();
    render(<Files onExpandedChange={onExpandedChange} />);
    act(() => item('src').focus());
    key('ArrowRight');
    expect(onExpandedChange).toHaveBeenLastCalledWith(['src']);
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(focused()).toBe('src');
    key('ArrowRight');
    expect(focused()).toBe('components');
    key('ArrowRight');
    expect(item('components').getAttribute('aria-expanded')).toBe('true');
    key('ArrowRight');
    expect(focused()).toBe('Button.tsx');
    // A leaf does nothing on Right.
    key('ArrowRight');
    expect(focused()).toBe('Button.tsx');
    key('ArrowLeft');
    expect(focused()).toBe('components');
    key('ArrowLeft');
    expect(item('components').getAttribute('aria-expanded')).toBe('false');
    key('ArrowLeft');
    expect(focused()).toBe('src');
    key('ArrowLeft');
    expect(onExpandedChange).toHaveBeenLastCalledWith([]);
    // A closed item at the top does nothing on Left.
    key('ArrowLeft');
    expect(focused()).toBe('src');
  });

  it('swaps Left and Right in a right-to-left tree', () => {
    render(<Files style={{ direction: 'rtl' }} />);
    act(() => item('src').focus());
    key('ArrowLeft');
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    key('ArrowRight');
    expect(item('src').getAttribute('aria-expanded')).toBe('false');
  });

  it('selects with a click, Enter or Space, which also open or close a branch', () => {
    const onValueChange = vi.fn();
    render(<Files onValueChange={onValueChange} />);
    fireEvent.click(screen.getByText('src'));
    expect(onValueChange).toHaveBeenLastCalledWith('src');
    expect(item('src').getAttribute('aria-selected')).toBe('true');
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(item('README.md').getAttribute('aria-selected')).toBe('false');
    act(() => item('README.md').focus());
    key('Enter');
    expect(onValueChange).toHaveBeenLastCalledWith('README.md');
    act(() => item('index.ts').focus());
    key(' ');
    expect(onValueChange).toHaveBeenLastCalledWith('src/index.ts');
    act(() => item('src').focus());
    key('Enter');
    expect(item('src').getAttribute('aria-expanded')).toBe('false');
    key(' ');
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
  });

  it('a click on a nested item selects only that item', () => {
    const onValueChange = vi.fn();
    render(<Files defaultExpanded={['src']} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByText('index.ts'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('src/index.ts');
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
  });

  it('has no selection without value, defaultValue or onValueChange', () => {
    render(<Files />);
    expect(item('src').hasAttribute('aria-selected')).toBe(false);
    fireEvent.click(screen.getByText('src'));
    expect(item('src').hasAttribute('aria-selected')).toBe(false);
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a disabled item focusable but unselectable', () => {
    const onValueChange = vi.fn();
    render(
      <Tree.Root aria-label="Files" onValueChange={onValueChange}>
        <Tree.Item value="a" disabled>
          <Tree.Label>a</Tree.Label>
        </Tree.Item>
        <Tree.Item value="b">
          <Tree.Label>b</Tree.Label>
        </Tree.Item>
      </Tree.Root>,
    );
    expect(item('a').getAttribute('aria-disabled')).toBe('true');
    expect(tabStops()).toEqual(['a']);
    fireEvent.click(screen.getByText('a'));
    act(() => item('a').focus());
    key('Enter');
    expect(onValueChange).not.toHaveBeenCalled();
    key('ArrowDown');
    expect(focused()).toBe('b');
  });

  it('follows controlled expanded and value', () => {
    function Controlled() {
      const [expanded, setExpanded] = useState<string[]>([]);
      const [value, setValue] = useState<string | null>(null);
      return (
        <>
          <Files expanded={expanded} onExpandedChange={setExpanded} value={value} onValueChange={setValue} />
          <output data-testid="state">{`${expanded.join(',')}|${value}`}</output>
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByText('src'));
    expect(screen.getByTestId('state').textContent).toBe('src|src');
    fireEvent.click(screen.getByText('components'));
    expect(screen.getByTestId('state').textContent).toBe('src,src/components|src/components');
  });

  it('moves focus to an item that closes while focus is inside it', () => {
    function Outside() {
      const [expanded, setExpanded] = useState(['src']);
      return (
        <>
          <button type="button" onClick={() => setExpanded([])}>
            close
          </button>
          <Files expanded={expanded} onExpandedChange={setExpanded} />
        </>
      );
    }
    render(<Outside />);
    act(() => item('index.ts').focus());
    // Close from outside the tree's own keys, keeping focus where it is.
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(focused()).toBe('src');
  });

  it('finds items shown by typing their first letters', () => {
    render(<Files defaultExpanded={['src']} />);
    act(() => item('src').focus());
    // Button.tsx is inside a closed item, so typing skips it.
    key('b');
    expect(focused()).toBe('src');
  });

  it('moves to an item by typing', () => {
    render(<Files defaultExpanded={['src']} />);
    act(() => item('src').focus());
    key('i');
    expect(focused()).toBe('index.ts');
  });

  it('matches typing against an item’s own label, not its children’s', () => {
    render(
      <Tree.Root aria-label="Letters" defaultExpanded={['a']}>
        <Tree.Item value="a">
          <Tree.Label>a</Tree.Label>
          <Tree.Group>
            <Tree.Item value="b">
              <Tree.Label>b</Tree.Label>
            </Tree.Item>
          </Tree.Group>
        </Tree.Item>
        <Tree.Item value="ab">
          <Tree.Label>ab</Tree.Label>
        </Tree.Item>
      </Tree.Root>,
    );
    act(() => item('ab').focus());
    key('a');
    expect(focused()).toBe('a');
    key('b');
    expect(focused()).toBe('ab');
  });

  it('draws its own chevron, or the one GlyphsProvider sets', () => {
    const { unmount } = render(<Files />);
    expect(item('src').querySelector('[data-todae-glyph] svg')).toBeTruthy();
    unmount();
    render(
      <GlyphsProvider glyphs={{ chevron: <i data-testid="chevron" /> }}>
        <Files />
      </GlyphsProvider>,
    );
    expect(screen.getAllByTestId('chevron').length).toBeGreaterThan(0);
  });

  it('throws when a part renders outside its root or item', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Tree.Item value="a" />)).toThrow('Tree.Item must render inside Tree.Root');
    expect(() =>
      render(
        <Tree.Root aria-label="x">
          <Tree.Label>a</Tree.Label>
        </Tree.Root>,
      ),
    ).toThrow('Tree.Label must render inside Tree.Item');
    vi.restoreAllMocks();
  });
});

describe('Tree read-only value', () => {
  it('does not render again on a click when value has no onValueChange', () => {
    let commits = 0;
    render(
      <Profiler id="tree" onRender={() => void (commits += 1)}>
        <Tree.Root aria-label="Files" value="a">
          <Tree.Item value="a">
            <Tree.Label>a</Tree.Label>
          </Tree.Item>
          <Tree.Item value="b">
            <Tree.Label>b</Tree.Label>
          </Tree.Item>
        </Tree.Root>
      </Profiler>,
    );
    const before = commits;
    fireEvent.click(screen.getByText('b'));
    expect(commits).toBe(before);
    expect(document.querySelector('[aria-selected="true"]')?.textContent).toBe('a');
  });
});

describe('Tree writes', () => {
  it('keeps two opens before a render, as both build on the latest write', () => {
    const onExpandedChange = vi.fn();
    render(
      <Tree.Root aria-label="Files" onExpandedChange={onExpandedChange}>
        {['x', 'y'].map((value) => (
          <Tree.Item key={value} value={value}>
            <Tree.Label>{value}</Tree.Label>
            <Tree.Group>
              <Tree.Item value={`${value}/file`}>
                <Tree.Label>file</Tree.Label>
              </Tree.Item>
            </Tree.Group>
          </Tree.Item>
        ))}
      </Tree.Root>,
    );
    act(() => {
      screen.getByText('x').click();
      screen.getByText('y').click();
    });
    expect(onExpandedChange).toHaveBeenLastCalledWith(['x', 'y']);
    expect(item('x').getAttribute('aria-expanded')).toBe('true');
    expect(item('y').getAttribute('aria-expanded')).toBe('true');
  });

  it('opens or closes as the item showed at the click, even when the select renders it first', () => {
    function Owner() {
      const [value, setValue] = useState<string | null>(null);
      const [expanded, setExpanded] = useState<string[]>([]);
      return (
        <Tree.Root
          aria-label="Files"
          value={value}
          // Selecting a folder opens it, in a render before the click goes on.
          onValueChange={(next) =>
            flushSync(() => {
              setValue(next);
              setExpanded((list) => (list.includes(next) ? list : [...list, next]));
            })
          }
          expanded={expanded}
          onExpandedChange={setExpanded}
        >
          <Tree.Item value="docs">
            <Tree.Label>docs</Tree.Label>
            <Tree.Group>
              <Tree.Item value="docs/intro.md">
                <Tree.Label>intro.md</Tree.Label>
              </Tree.Item>
            </Tree.Group>
          </Tree.Item>
        </Tree.Root>
      );
    }
    render(<Owner />);
    fireEvent.click(screen.getByText('docs'));
    expect(item('docs').getAttribute('aria-expanded')).toBe('true');
  });

  it('opens once for two clicks on one label before a render, as Enter does', () => {
    const onExpandedChange = vi.fn();
    render(<Files onExpandedChange={onExpandedChange} />);
    act(() => {
      screen.getByText('src').click();
      screen.getByText('src').click();
    });
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(onExpandedChange).toHaveBeenLastCalledWith(['src']);
  });

  it.each(['onClick'] as const)(
    'opens as the item showed at the click when a label %s handler opens it first',
    (handler) => {
      function Owner() {
        const [expanded, setExpanded] = useState<string[]>([]);
        const open = () => flushSync(() => setExpanded((list) => (list.includes('docs') ? list : [...list, 'docs'])));
        return (
          <Tree.Root aria-label="Files" expanded={expanded} onExpandedChange={setExpanded}>
            <Tree.Item value="docs">
              <Tree.Label {...{ [handler]: open }}>docs</Tree.Label>
              <Tree.Group>
                <Tree.Item value="docs/intro.md">
                  <Tree.Label>intro.md</Tree.Label>
                </Tree.Item>
              </Tree.Group>
            </Tree.Item>
          </Tree.Root>
        );
      }
      render(<Owner />);
      fireEvent.click(screen.getByText('docs'));
      expect(item('docs').getAttribute('aria-expanded')).toBe('true');
    },
  );

  it('opens and closes from a label rendered through a portal', () => {
    const host = document.body.appendChild(document.createElement('div'));
    render(
      <Tree.Root aria-label="Files">
        <Tree.Item value="docs" data-testid="docs">
          {createPortal(<Tree.Label>docs</Tree.Label>, host)}
          <Tree.Group>
            <Tree.Item value="docs/intro.md">
              <Tree.Label>intro.md</Tree.Label>
            </Tree.Item>
          </Tree.Group>
        </Tree.Item>
      </Tree.Root>,
    );
    const docs = screen.getByTestId('docs');
    fireEvent.click(screen.getByText('docs'));
    expect(docs.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByText('docs'));
    expect(docs.getAttribute('aria-expanded')).toBe('false');
    host.remove();
  });
});

describe('Tree commits', () => {
  it('carries a new controlled value into the commit that passes it', () => {
    const seen: (string | null)[] = [];
    function App() {
      const [value, setValue] = useState('a');
      // A layout effect of the owner, such as one that scrolls to the selected
      // item, reads the item the value names.
      useLayoutEffect(() => {
        seen.push(document.querySelector('[aria-selected="true"]')?.textContent ?? null);
      }, [value]);
      return (
        <>
          <button type="button" onClick={() => setValue('b')}>
            Pick b
          </button>
          <Tree.Root aria-label="Files" value={value} onValueChange={setValue}>
            <Tree.Item value="a">
              <Tree.Label>a</Tree.Label>
            </Tree.Item>
            <Tree.Item value="b">
              <Tree.Label>b</Tree.Label>
            </Tree.Item>
          </Tree.Root>
        </>
      );
    }
    render(<App />);
    fireEvent.click(screen.getByText('Pick b'));
    expect(seen).toEqual(['a', 'b']);
    expect(item('b').tabIndex).toBe(0);
  });

  it('selects an item in the commit that mounts it', () => {
    let seen: string | null | undefined;
    function Probe() {
      useLayoutEffect(() => {
        seen = document.querySelector('[data-value="c"]')?.getAttribute('aria-selected');
      });
      return null;
    }
    function App({ values, value }: { values: string[]; value: string }) {
      return (
        <Tree.Root aria-label="Files" value={value} onValueChange={() => {}}>
          {values.map((v) => (
            <Tree.Item key={v} value={v} data-value={v}>
              <Tree.Label>{v}</Tree.Label>
            </Tree.Item>
          ))}
          <Probe />
        </Tree.Root>
      );
    }
    const { rerender } = render(<App values={['a', 'b']} value="a" />);
    rerender(<App values={['a', 'b', 'c']} value="c" />);
    expect(seen).toBe('true');
  });

  it('moves the tab stop off an item its owner hides, in the same update', () => {
    function Owner() {
      const [expanded, setExpanded] = useState<string[]>(['docs']);
      const [value, setValue] = useState<string | null>('docs/intro.md');
      return (
        <>
          <button type="button" onClick={() => setExpanded([])}>
            Close docs
          </button>
          <Tree.Root aria-label="Files" value={value} onValueChange={setValue} expanded={expanded} onExpandedChange={setExpanded}>
            <Tree.Item value="a">
              <Tree.Label>a</Tree.Label>
            </Tree.Item>
            <Tree.Item value="docs">
              <Tree.Label>docs</Tree.Label>
              <Tree.Group>
                <Tree.Item value="docs/intro.md">
                  <Tree.Label>intro.md</Tree.Label>
                </Tree.Item>
              </Tree.Group>
            </Tree.Item>
          </Tree.Root>
        </>
      );
    }
    render(<Owner />);
    fireEvent.click(screen.getByText('Close docs'));
    expect(document.querySelector('[role="treeitem"][tabindex="0"]')?.getAttribute('data-todae-roving-value')).toBe('a');
  });

  it('carries a new value to items the owner passes in as children, before its effects run', () => {
    const seen: string[] = [];
    const selected = () => document.querySelector('[aria-selected="true"]')?.textContent;
    function Owner({ children }: { children: ReactNode }) {
      const [value, setValue] = useState('a');
      useLayoutEffect(() => void seen.push(`layout ${selected()}`), [value]);
      useEffect(() => void seen.push(`passive ${selected()}`), [value]);
      return (
        <>
          <button type="button" onClick={() => setValue('b')}>
            Pick b
          </button>
          <Tree.Root aria-label="Files" value={value} onValueChange={setValue}>
            {children}
          </Tree.Root>
        </>
      );
    }
    render(
      <Owner>
        <Tree.Item value="a">
          <Tree.Label>a</Tree.Label>
        </Tree.Item>
        <Tree.Item value="b">
          <Tree.Label>b</Tree.Label>
        </Tree.Item>
      </Owner>,
    );
    seen.length = 0;
    fireEvent.click(screen.getByText('Pick b'));
    expect(seen).toEqual(['layout b', 'passive b']);
  });

  it('moves the tab stop off an item a click hides, in the same update', () => {
    render(
      <Tree.Root aria-label="Files" defaultValue="docs/intro.md" defaultExpanded={['docs']}>
        <Tree.Item value="a">
          <Tree.Label>a</Tree.Label>
        </Tree.Item>
        <Tree.Item value="docs" disabled>
          <Tree.Label>docs</Tree.Label>
          <Tree.Group>
            <Tree.Item value="docs/intro.md">
              <Tree.Label>intro.md</Tree.Label>
            </Tree.Item>
          </Tree.Group>
        </Tree.Item>
      </Tree.Root>,
    );
    expect(item('intro.md').tabIndex).toBe(0);
    fireEvent.click(screen.getByText('docs'));
    expect(item('docs').getAttribute('aria-expanded')).toBe('false');
    expect(tabStops()).toEqual(['a']);
  });

  it('shows no selection from a transition that has not committed', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => (resolve = done));
    let settled = false;
    function Wait({ on }: { on: boolean }) {
      if (on && !settled) throw pending;
      return null;
    }
    let bump!: () => void;
    // An item row with state of its own, so it renders without the root.
    function Row({ value }: { value: string }) {
      const [n, setN] = useState(0);
      if (value === 'b') bump = () => setN((count) => count + 1);
      return (
        <Tree.Item value={value} data-n={n}>
          <Tree.Label>{value}</Tree.Label>
        </Tree.Item>
      );
    }
    let pick!: (value: string) => void;
    function App() {
      const [value, setValue] = useState('a');
      pick = (next) => startTransition(() => setValue(next));
      return (
        <Suspense fallback={<p>loading</p>}>
          <Tree.Root aria-label="Files" value={value} onValueChange={setValue}>
            <Row value="a" />
            <Row value="b" />
          </Tree.Root>
          <Wait on={value === 'b'} />
        </Suspense>
      );
    }
    const selected = () => [...document.querySelectorAll('[aria-selected="true"]')].map((node) => node.textContent);
    render(<App />);
    await act(async () => pick('b'));
    expect(selected()).toEqual(['a']);
    act(() => bump());
    expect(selected()).toEqual(['a']);
    settled = true;
    await act(async () => resolve());
    expect(selected()).toEqual(['b']);
  });
});
