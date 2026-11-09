// Counts the Tree parts each commit renders, through a stand-in for the
// React DevTools hook, the way apps/bench counts components: a part
// counts when React ran it, whether its props, its state or a context it
// reads changed.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { memo, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tree, type TreeRootProps } from './Tree.js';

type Fiber = {
  tag: number;
  type: unknown;
  flags: number;
  memoizedProps: Record<string, unknown> | null;
  child: Fiber | null;
  sibling: Fiber | null;
  return: Fiber | null;
  alternate: Fiber | null;
};

// React reuses a commit's fibers for a later commit, so each one is read as
// it commits.
const hook = vi.hoisted(() => {
  const hook = { onCommit: (_root: Fiber) => {} };
  (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject: () => 1,
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id: number, root: { current: Fiber }) {
      hook.onCommit(root.current);
    },
  };
  return hook;
});

const PERFORMED_WORK = 1;
const parts = new Map<unknown, string>([
  [Tree.Item, 'Item'],
  [Tree.Label, 'Label'],
  [Tree.Group, 'Group'],
]);

let out: string[] = [];
const itemOf = (fiber: Fiber) => {
  for (let node: Fiber | null = fiber; node; node = node.return) {
    if (node.type === Tree.Item) return String(node.memoizedProps?.value);
  }
  return '?';
};
const walk = (fiber: Fiber | null) => {
  for (let node = fiber; node; node = node.sibling) {
    const before = node.alternate;
    const part = parts.get(node.type);
    if (part && (!before || node.flags & PERFORMED_WORK)) out.push(`${part} ${itemOf(node)}`);
    if (!before || node.child !== before.child) walk(node.child);
  }
};
hook.onCommit = (root) => walk(root.child);

/** The parts that rendered in the commits since the last call, as "Part value". */
function rendered(): string[] {
  const parts = [...new Set(out)].sort();
  out = [];
  return parts;
}

const item = (name: string) => screen.getByRole('treeitem', { name });
const key = (k: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k });

beforeEach(() => void rendered());
afterEach(cleanup);

// Item rows the owner doesn't render again, as when it passes them in as
// children or memoizes them.
const Rows = memo(function Rows() {
  return (
    <>
      <Tree.Item value="docs">
        <Tree.Label>docs</Tree.Label>
        <Tree.Group>
          <Tree.Item value="docs/intro.md">
            <Tree.Label>intro.md</Tree.Label>
          </Tree.Item>
        </Tree.Group>
      </Tree.Item>
      {['a', 'b', 'c'].map((value) => (
        <Tree.Item key={value} value={value}>
          <Tree.Label>{value}</Tree.Label>
        </Tree.Item>
      ))}
    </>
  );
});

function Files(props: Omit<TreeRootProps, 'children'>) {
  return (
    <Tree.Root aria-label="Files" {...props}>
      <Rows />
    </Tree.Root>
  );
}

// Each item reads the tree state, so it renders once per change; what
// these tests count is everything else.
const content = () => rendered().filter((part) => !part.startsWith('Item '));

describe('Tree renders', () => {
  it('renders no label or group as a click moves the selection', () => {
    render(<Files defaultValue="a" />);
    rendered();
    fireEvent.click(screen.getByText('c'));
    expect(item('c').getAttribute('aria-selected')).toBe('true');
    expect(item('a').getAttribute('aria-selected')).toBe('false');
    expect(item('c').tabIndex).toBe(0);
    expect(item('a').tabIndex).toBe(-1);
    expect(content()).toEqual([]);
  });

  it('renders only the group of the item that opens or closes, and no label', () => {
    render(<Files />);
    rendered();
    fireEvent.click(screen.getByText('docs'));
    expect(item('docs').getAttribute('aria-expanded')).toBe('true');
    expect(content()).toEqual(['Group docs']);
    fireEvent.click(screen.getByText('docs'));
    expect(item('docs').getAttribute('aria-expanded')).toBe('false');
    expect(content()).toEqual(['Group docs']);
  });

  it('renders no label or group as the tab stop moves with focus', () => {
    render(<Files />);
    act(() => item('a').focus());
    rendered();
    key('ArrowDown');
    expect(document.activeElement).toBe(item('b'));
    expect(item('b').tabIndex).toBe(0);
    expect(item('a').tabIndex).toBe(-1);
    expect(content()).toEqual([]);
  });

  it('renders no label or group of a nested item as its parent opens', () => {
    render(
      <Tree.Root aria-label="Files" defaultExpanded={['a1']}>
        <Tree.Item value="a">
          <Tree.Label>a</Tree.Label>
          <Tree.Group>
            <Tree.Item value="a1">
              <Tree.Label>a1</Tree.Label>
              <Tree.Group>
                <Tree.Item value="a1x">
                  <Tree.Label>a1x</Tree.Label>
                </Tree.Item>
              </Tree.Group>
            </Tree.Item>
          </Tree.Group>
        </Tree.Item>
      </Tree.Root>,
    );
    rendered();
    fireEvent.click(screen.getByText('a'));
    expect(item('a').getAttribute('aria-expanded')).toBe('true');
    expect(content()).toEqual(['Group a']);
  });

  it('renders each item once as a click moves the selection', () => {
    render(<Files defaultValue="a" />);
    rendered();
    fireEvent.click(screen.getByText('c'));
    expect(rendered()).toEqual(['Item a', 'Item b', 'Item c', 'Item docs', 'Item docs/intro.md']);
  });

  it('renders every part again when the owner renders its items', () => {
    let select!: (value: string) => void;
    function Owner() {
      const [value, setValue] = useState('a');
      select = setValue;
      return (
        <Tree.Root aria-label="Files" value={value} onValueChange={setValue}>
          {(['a', 'b'] as const).map((v): ReactNode => (
            <Tree.Item key={v} value={v}>
              <Tree.Label>{v}</Tree.Label>
            </Tree.Item>
          ))}
        </Tree.Root>
      );
    }
    render(<Owner />);
    rendered();
    act(() => select('b'));
    expect(item('b').getAttribute('aria-selected')).toBe('true');
    expect(rendered()).toEqual(['Item a', 'Item b', 'Label a', 'Label b']);
  });
});
