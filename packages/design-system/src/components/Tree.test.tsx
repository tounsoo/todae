import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlyphsProvider } from '../providers/GlyphsProvider';
import { Tree, type TreeRootProps } from './Tree';

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

  it('selects with a click, Enter or Space, and a click or Enter also opens or closes a branch', () => {
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
