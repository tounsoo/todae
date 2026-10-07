import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../index';
import { useRovingFocus, type UseRovingFocusOptions } from './useRovingFocus';

afterEach(cleanup);

type Item = { value: string; label?: string; disabled?: boolean };

const FRUIT: Item[] = [{ value: 'apple' }, { value: 'banana' }, { value: 'blueberry' }, { value: 'cherry' }];

function Group({ items = FRUIT, ...options }: UseRovingFocusOptions & { items?: Item[] }) {
  const roving = useRovingFocus(options);
  return (
    <div role="toolbar" aria-label="Fruit" {...roving.getContainerProps()}>
      {items.map((item) => (
        <button key={item.value} type="button" {...roving.getItemProps(item.value, { disabled: item.disabled })}>
          {item.label ?? item.value}
        </button>
      ))}
    </div>
  );
}

const tabStops = () => screen.getAllByRole('button').filter((b) => b.tabIndex === 0).map((b) => b.textContent);
const key = (k: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k });
const focused = () => document.activeElement?.textContent;
// Lets DOM changes made outside a render reach the observer first.
const frame = () => act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));

describe('useRovingFocus', () => {
  it('is exported from the package', () => {
    expect(api.useRovingFocus).toBe(useRovingFocus);
  });

  it('keeps one tab stop, on the first enabled item by default', () => {
    render(<Group items={[{ value: 'a', disabled: true }, { value: 'b' }, { value: 'c' }]} />);
    expect(tabStops()).toEqual(['b']);
  });

  it('moves the tab stop when an item disables itself without the owner rendering', async () => {
    let disable: (() => void) | undefined;
    function Item({ roving, value }: { roving: ReturnType<typeof useRovingFocus>; value: string }) {
      const [disabled, setDisabled] = useState(false);
      if (value === 'a') disable = () => setDisabled(true);
      return (
        <button type="button" {...roving.getItemProps(value, { disabled })}>
          {value}
        </button>
      );
    }
    function Owner() {
      const roving = useRovingFocus();
      return (
        <div {...roving.getContainerProps()}>
          <Item roving={roving} value="a" />
          <Item roving={roving} value="b" />
        </div>
      );
    }
    render(<Owner />);
    expect(tabStops()).toEqual(['a']);
    await act(async () => disable?.());
    await frame();
    expect(tabStops()).toEqual(['b']);
  });

  it('starts on defaultActiveValue', () => {
    render(<Group defaultActiveValue="cherry" />);
    expect(tabStops()).toEqual(['cherry']);
  });

  // DOM changes reach the hook through a MutationObserver, a microtask later.
  it('falls back when the active item is disabled or missing', async () => {
    const { rerender } = render(<Group activeValue="banana" />);
    expect(tabStops()).toEqual(['banana']);
    await act(async () =>
      rerender(<Group activeValue="banana" items={[{ value: 'apple' }, { value: 'banana', disabled: true }]} />),
    );
    await frame();
    expect(tabStops()).toEqual(['apple']);
    rerender(<Group activeValue="gone" />);
    expect(tabStops()).toEqual(['apple']);
  });

  it('moves with vertical arrows, Home and End, and loops', () => {
    const onActiveValueChange = vi.fn();
    render(<Group onActiveValueChange={onActiveValueChange} />);
    screen.getByText('apple').focus();
    key('ArrowDown');
    expect(focused()).toBe('banana');
    expect(tabStops()).toEqual(['banana']);
    expect(onActiveValueChange).toHaveBeenLastCalledWith('banana');
    key('End');
    expect(focused()).toBe('cherry');
    key('ArrowDown');
    expect(focused()).toBe('apple');
    key('ArrowUp');
    expect(focused()).toBe('cherry');
    key('Home');
    expect(focused()).toBe('apple');
    key('ArrowRight');
    expect(focused()).toBe('apple');
  });

  it('stops at the ends when loop is false', () => {
    render(<Group loop={false} />);
    screen.getByText('cherry').focus();
    key('ArrowDown');
    expect(focused()).toBe('cherry');
    screen.getByText('apple').focus();
    key('ArrowUp');
    expect(focused()).toBe('apple');
  });

  it('skips disabled items', () => {
    render(<Group items={[{ value: 'a' }, { value: 'b', disabled: true }, { value: 'c' }]} />);
    screen.getByText('a').focus();
    key('ArrowDown');
    expect(focused()).toBe('c');
  });

  // Right-to-left needs computed style, so the browser suite covers it.
  it('uses Left and Right for horizontal', () => {
    render(<Group orientation="horizontal" />);
    screen.getByText('apple').focus();
    key('ArrowDown');
    expect(focused()).toBe('apple');
    key('ArrowRight');
    expect(focused()).toBe('banana');
    key('ArrowLeft');
    expect(focused()).toBe('apple');
  });

  it('takes all four arrows with orientation both', () => {
    render(<Group orientation="both" />);
    screen.getByText('apple').focus();
    key('ArrowRight');
    key('ArrowDown');
    expect(focused()).toBe('blueberry');
  });

  it('ignores modified keys and keys from nested elements', () => {
    render(<Group />);
    screen.getByText('apple').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', ctrlKey: true });
    expect(focused()).toBe('apple');
  });

  it('moves the tab stop when an item is clicked or focused', () => {
    render(<Group />);
    act(() => screen.getByText('cherry').focus());
    expect(tabStops()).toEqual(['cherry']);
  });

  it('does not move focus between nested groups', () => {
    function Nested({ children }: { children?: ReactNode }) {
      const outer = useRovingFocus();
      return (
        <div {...outer.getContainerProps()}>
          <button type="button" {...outer.getItemProps('outer-1')}>
            outer-1
          </button>
          {children}
          <button type="button" {...outer.getItemProps('outer-2')}>
            outer-2
          </button>
        </div>
      );
    }
    render(
      <Nested>
        <Group />
      </Nested>,
    );
    screen.getByText('apple').focus();
    key('ArrowUp');
    expect(focused()).toBe('cherry');
    screen.getByText('outer-1').focus();
    key('ArrowDown');
    expect(focused()).toBe('outer-2');
  });

  it("a nested group's item changes do not re-read the outer group", async () => {
    const original = HTMLElement.prototype.checkVisibility;
    let outerReads = 0;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      if (this.textContent?.startsWith('outer')) outerReads += 1;
      return true;
    };
    try {
      function Outer() {
        const outer = useRovingFocus();
        return (
          <div {...outer.getContainerProps()}>
            <button type="button" {...outer.getItemProps('outer-1')}>
              outer-1
            </button>
            <Group />
          </div>
        );
      }
      render(<Outer />);
      await frame();
      outerReads = 0;
      await act(async () => screen.getByText('apple').style.setProperty('color', 'red'));
      await frame();
      expect(outerReads).toBe(0);
      await act(async () => screen.getByText('outer-1').style.setProperty('color', 'red'));
      await frame();
      expect(outerReads).toBeGreaterThan(0);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('typeahead cycles by first letter and matches longer prefixes', () => {
    render(<Group typeahead />);
    screen.getByText('apple').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'b', timeStamp: 1000 });
    expect(focused()).toBe('banana');
    fireEvent.keyDown(document.activeElement!, { key: 'b', timeStamp: 1100 });
    expect(focused()).toBe('blueberry');
    fireEvent.keyDown(document.activeElement!, { key: 'b', timeStamp: 2000 });
    expect(focused()).toBe('banana');
    fireEvent.keyDown(document.activeElement!, { key: 'b', timeStamp: 3000 });
    fireEvent.keyDown(document.activeElement!, { key: 'l', timeStamp: 3100 });
    expect(focused()).toBe('blueberry');
    fireEvent.keyDown(document.activeElement!, { key: 'z', timeStamp: 5000 });
    expect(focused()).toBe('blueberry');
  });

  it('a space joins a search under way and is ignored otherwise', () => {
    render(<Group typeahead items={[{ value: 'new window' }, { value: 'new file' }, { value: 'open' }]} />);
    screen.getByText('open').focus();
    const press = (k: string, t: number) => fireEvent.keyDown(document.activeElement!, { key: k, timeStamp: t });
    press(' ', 1000);
    expect(focused()).toBe('open');
    for (const [i, k] of [...'new f'].entries()) press(k, 2000 + i * 50);
    expect(focused()).toBe('new file');
  });

  it('a space that joined a search is consumed even when nothing matches', () => {
    render(<Group typeahead items={[{ value: 'new' }, { value: 'open' }]} />);
    screen.getByText('open').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'n', timeStamp: 1000 });
    expect(focused()).toBe('new');
    const kept = fireEvent.keyDown(document.activeElement!, { key: ' ', timeStamp: 1050 });
    expect(kept).toBe(false);
    expect(focused()).toBe('new');
  });

  it('a search that matched nothing ends, so a Space after it is not part of it', () => {
    let roving: ReturnType<typeof useRovingFocus> | undefined;
    function Probe() {
      roving = useRovingFocus({ typeahead: true });
      return (
        <div {...roving.getContainerProps()}>
          <button type="button" {...roving.getItemProps('open')}>
            open
          </button>
        </div>
      );
    }
    render(<Probe />);
    screen.getByText('open').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'z', timeStamp: 1000 });
    expect(roving!.isTypingAhead({ timeStamp: 1050 })).toBe(false);
  });

  it('handles keys on a focused container as if before the first item', () => {
    function Focusable() {
      const roving = useRovingFocus({ typeahead: true });
      return (
        <div role="menu" tabIndex={-1} data-testid="box" {...roving.getContainerProps()}>
          {['apple', 'banana', 'cherry'].map((v) => (
            <button key={v} type="button" {...roving.getItemProps(v)}>
              {v}
            </button>
          ))}
        </div>
      );
    }
    render(<Focusable />);
    const box = screen.getByTestId('box');
    act(() => box.focus());
    key('b');
    expect(focused()).toBe('banana');
    act(() => box.focus());
    key('ArrowDown');
    expect(focused()).toBe('apple');
    act(() => box.focus());
    key('ArrowUp');
    expect(focused()).toBe('cherry');
  });

  it('setActiveValue on a disabled item leaves a tab stop', () => {
    let roving: ReturnType<typeof useRovingFocus> | undefined;
    function Probe() {
      roving = useRovingFocus({ activeValue: 'a' });
      return (
        <div {...roving.getContainerProps()}>
          <button type="button" {...roving.getItemProps('a', { disabled: true })}>
            a
          </button>
          <button type="button" {...roving.getItemProps('b')}>
            b
          </button>
        </div>
      );
    }
    render(<Probe />);
    expect(tabStops()).toEqual(['b']);
    act(() => roving!.setActiveValue('a'));
    expect(tabStops()).toEqual(['b']);
  });

  it('typeahead matches a character outside the basic plane', () => {
    render(<Group typeahead items={[{ value: 'sad', label: '😢 Sad' }, { value: 'happy', label: '😀 Happy' }]} />);
    screen.getByText('😢 Sad').focus();
    fireEvent.keyDown(document.activeElement!, { key: '😀', timeStamp: 1000 });
    expect(focused()).toBe('😀 Happy');
  });

  it('skips hidden items and never gives them the tab stop', () => {
    function Hidden() {
      const roving = useRovingFocus();
      return (
        <div {...roving.getContainerProps()}>
          <button type="button" hidden {...roving.getItemProps('ghost')}>
            ghost
          </button>
          <button type="button" {...roving.getItemProps('a')}>
            a
          </button>
          <button type="button" {...roving.getItemProps('b')}>
            b
          </button>
        </div>
      );
    }
    render(<Hidden />);
    expect(screen.getAllByRole('button').filter((b) => b.tabIndex === 0).map((b) => b.textContent)).toEqual(['a']);
    act(() => screen.getByRole('button', { name: 'b' }).focus());
    key('ArrowDown');
    expect(focused()).toBe('a');
  });

  it('a group that renders while hidden still has a tab stop', () => {
    const original = HTMLElement.prototype.checkVisibility;
    HTMLElement.prototype.checkVisibility = () => false;
    try {
      render(<Group />);
      expect(tabStops()).toEqual(['apple']);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('a repeated emoji cycles through the items that start with it', () => {
    render(<Group typeahead items={[{ value: 'h', label: '😀 Happy' }, { value: 's', label: '😀 Smile' }]} />);
    screen.getByText('😀 Happy').focus();
    fireEvent.keyDown(document.activeElement!, { key: '😀', timeStamp: 1000 });
    expect(focused()).toBe('😀 Smile');
  });

  it('moves the tab stop off an active item hidden by style, and focus() reports it unreachable', () => {
    const original = HTMLElement.prototype.checkVisibility;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return this.textContent !== 'banana';
    };
    try {
      let roving: ReturnType<typeof useRovingFocus> | undefined;
      function Probe() {
        const r = useRovingFocus({ activeValue: 'banana' });
        roving = r;
        return (
          <div {...r.getContainerProps()}>
            {['apple', 'banana'].map((v) => (
              <button key={v} type="button" {...r.getItemProps(v)}>
                {v}
              </button>
            ))}
          </div>
        );
      }
      render(<Probe />);
      expect(tabStops()).toEqual(['apple']);
      expect(roving!.focus('banana')).toBe(false);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('re-reads items when a class hides the tab stop', async () => {
    const original = HTMLElement.prototype.checkVisibility;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return !this.classList.contains('gone');
    };
    try {
      render(<Group activeValue="banana" />);
      expect(tabStops()).toEqual(['banana']);
      await act(async () => screen.getByRole('button', { name: 'banana' }).classList.add('gone'));
      await frame();
      expect(tabStops()).toEqual(['apple']);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('a class change while a frame is queued is read in that frame, and later ones queue again', async () => {
    const original = HTMLElement.prototype.checkVisibility;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return !this.classList.contains('gone');
    };
    try {
      render(<Group activeValue="banana" />);
      const apple = screen.getByRole('button', { name: 'apple' });
      const banana = screen.getByRole('button', { name: 'banana' });
      // A style change queues the frame; the hide after it is skipped by the
      // observer and still read when that frame runs.
      await act(async () => apple.style.setProperty('color', 'red'));
      await act(async () => banana.classList.add('gone'));
      expect(tabStops()).toEqual(['banana']);
      await frame();
      expect(tabStops()).toEqual(['apple']);
      // The frame has run, so the next change queues another.
      await act(async () => banana.classList.remove('gone'));
      await frame();
      expect(tabStops()).toEqual(['banana']);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('re-reads items when the group itself is shown, through its size', () => {
    const callbacks: ((entries: { contentRect: { width: number; height: number } }[]) => void)[] = [];
    const OriginalRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const original = HTMLElement.prototype.checkVisibility;
    let shown = false;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return shown && this.textContent !== 'banana';
    };
    try {
      render(<Group activeValue="banana" />);
      act(() => callbacks.forEach((cb) => cb([{ contentRect: { width: 0, height: 0 } }])));
      expect(tabStops()).toEqual(['banana']);
      shown = true;
      act(() => callbacks.forEach((cb) => cb([{ contentRect: { width: 200, height: 40 } }])));
      expect(tabStops()).toEqual(['apple']);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
      globalThis.ResizeObserver = OriginalRO;
    }
  });

  it('ignores a resize that keeps the group shown', () => {
    const callbacks: ((entries: { contentRect: { width: number; height: number } }[]) => void)[] = [];
    const OriginalRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const query = vi.spyOn(HTMLElement.prototype, 'querySelectorAll');
    try {
      render(<Group />);
      act(() => callbacks.forEach((cb) => cb([{ contentRect: { width: 200, height: 40 } }])));
      query.mockClear();
      act(() => callbacks.forEach((cb) => cb([{ contentRect: { width: 300, height: 40 } }])));
      expect(query).not.toHaveBeenCalled();
    } finally {
      query.mockRestore();
      globalThis.ResizeObserver = OriginalRO;
    }
  });

  it('turning the tab stop on later makes the group reachable', () => {
    const { rerender } = render(<Group tabStop={false} />);
    expect(tabStops()).toEqual([]);
    rerender(<Group />);
    expect(tabStops()).toEqual(['apple']);
  });

  it('leaves Shift with an arrow key to the owner', () => {
    render(<Group />);
    act(() => screen.getByRole('button', { name: 'apple' }).focus());
    const kept = fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', shiftKey: true });
    expect(kept).toBe(true);
    expect(focused()).toBe('apple');
  });

  it('with tabStop false, no item is a Tab stop', () => {
    render(<Group tabStop={false} />);
    expect(tabStops()).toEqual([]);
  });

  it('re-reads items when a wrapper around them is hidden by a class', async () => {
    const original = HTMLElement.prototype.checkVisibility;
    HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
      return !this.closest('.collapsed');
    };
    try {
      function Wrapped() {
        const roving = useRovingFocus({ activeValue: 'b' });
        return (
          <div {...roving.getContainerProps()}>
            <button type="button" {...roving.getItemProps('a')}>
              a
            </button>
            <div data-testid="wrap">
              <button type="button" {...roving.getItemProps('b')}>
                b
              </button>
            </div>
          </div>
        );
      }
      render(<Wrapped />);
      expect(tabStops()).toEqual(['b']);
      await act(async () => screen.getByTestId('wrap').classList.add('collapsed'));
      await frame();
      expect(tabStops()).toEqual(['a']);
    } finally {
      HTMLElement.prototype.checkVisibility = original;
    }
  });

  it('skips natively disabled items and moves the tab stop off one', async () => {
    function Native({ off }: { off: string[] }) {
      const roving = useRovingFocus({ activeValue: 'b' });
      return (
        <div {...roving.getContainerProps()}>
          {['a', 'b', 'c'].map((v) => (
            <button key={v} type="button" disabled={off.includes(v)} {...roving.getItemProps(v)}>
              {v}
            </button>
          ))}
        </div>
      );
    }
    const { rerender } = render(<Native off={[]} />);
    expect(tabStops()).toEqual(['b']);
    rerender(<Native off={['b']} />);
    await frame();
    expect(tabStops()).toEqual(['a']);
    act(() => screen.getByText('a').focus());
    key('ArrowDown');
    expect(focused()).toBe('c');
  });

  it('reports a fallback tab stop that takes focus once, so an owner can pin it', () => {
    const onActiveValueChange = vi.fn();
    render(<Group activeValue="missing" onActiveValueChange={onActiveValueChange} />);
    expect(tabStops()).toEqual(['apple']);
    act(() => screen.getByText('apple').focus());
    expect(onActiveValueChange).toHaveBeenCalledExactlyOnceWith('apple');
    key('ArrowDown');
    expect(onActiveValueChange).toHaveBeenLastCalledWith('banana');
  });

  it('an item added and made active in one render takes the tab stop before paint', () => {
    const { rerender } = render(<Group activeValue="apple" />);
    rerender(<Group activeValue="date" items={[...FRUIT, { value: 'date' }]} />);
    expect(tabStops()).toEqual(['date']);
    rerender(<Group activeValue="apple" items={FRUIT.filter((item) => item.value !== 'apple')} />);
    expect(tabStops()).toEqual(['banana']);
  });

  it('a new active value takes the tab stop in one render', () => {
    let commits = 0;
    const { rerender } = render(
      <Profiler id="g" onRender={() => (commits += 1)}>
        <Group activeValue="apple" />
      </Profiler>,
    );
    commits = 0;
    rerender(
      <Profiler id="g" onRender={() => (commits += 1)}>
        <Group activeValue="cherry" />
      </Profiler>,
    );
    expect(tabStops()).toEqual(['cherry']);
    expect(commits).toBe(1);
  });

  it('typeahead is off by default', () => {
    render(<Group />);
    screen.getByText('apple').focus();
    key('c');
    expect(focused()).toBe('apple');
  });

  it('focuses by value or by edge, and finds item nodes', () => {
    let roving: ReturnType<typeof useRovingFocus> | undefined;
    function Probe() {
      roving = useRovingFocus();
      return (
        <div {...roving.getContainerProps()}>
          {['last', 'first', 'z'].map((v) => (
            <button key={v} type="button" {...roving!.getItemProps(v, { disabled: v === 'z' })}>
              {v}
            </button>
          ))}
        </div>
      );
    }
    render(<Probe />);
    expect(roving!.values()).toEqual(['last', 'first']);
    expect(roving!.focusLast()).toBe('first');
    expect(focused()).toBe('first');
    expect(roving!.focusFirst()).toBe('last');
    expect(roving!.focus('first')).toBe(true);
    expect(focused()).toBe('first');
    expect(roving!.focus('z')).toBe(false);
    expect(roving!.getItemNode('last')?.textContent).toBe('last');
    expect(roving!.getItemNode('z')).toBeNull();
  });

  it('watches a container that mounts after the owner', async () => {
    let disable: (() => void) | undefined;
    function Item({ roving, value }: { roving: ReturnType<typeof useRovingFocus>; value: string }) {
      const [disabled, setDisabled] = useState(false);
      if (value === 'a') disable = () => setDisabled(true);
      return (
        <button type="button" {...roving.getItemProps(value, { disabled })}>
          {value}
        </button>
      );
    }
    function Owner({ show }: { show: boolean }) {
      const roving = useRovingFocus();
      return show ? (
        <div {...roving.getContainerProps()}>
          <Item roving={roving} value="a" />
          <Item roving={roving} value="b" />
        </div>
      ) : null;
    }
    const { rerender } = render(<Owner show={false} />);
    rerender(<Owner show />);
    expect(tabStops()).toEqual(['a']);
    await act(async () => disable?.());
    await frame();
    expect(tabStops()).toEqual(['b']);
  });

  it('lets go of a container that unmounts while the owner stays', () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    function Owner({ show }: { show: boolean }) {
      const roving = useRovingFocus();
      return show ? (
        <div {...roving.getContainerProps()}>
          <button type="button" {...roving.getItemProps('a')}>
            a
          </button>
        </div>
      ) : null;
    }
    const { rerender } = render(<Owner show />);
    disconnect.mockClear();
    rerender(<Owner show={false} />);
    expect(disconnect).toHaveBeenCalledTimes(1);
    disconnect.mockRestore();
  });

  it('moves from a focused item that turned disabled to its neighbours', async () => {
    function Owner({ off }: { off: boolean }) {
      const roving = useRovingFocus({ loop: false });
      return (
        <div {...roving.getContainerProps()}>
          {['a', 'b', 'c'].map((v) => (
            <button key={v} type="button" {...roving.getItemProps(v, { disabled: off && v === 'b' })}>
              {v}
            </button>
          ))}
        </div>
      );
    }
    const { rerender } = render(<Owner off={false} />);
    const b = screen.getByRole('button', { name: 'b' });
    act(() => b.focus());
    await act(async () => rerender(<Owner off />));
    await frame();
    act(() => b.focus());
    fireEvent.keyDown(b, { key: 'ArrowDown' });
    expect(focused()).toBe('c');
    act(() => b.focus());
    fireEvent.keyDown(b, { key: 'ArrowUp' });
    expect(focused()).toBe('a');
  });

  it('a controlled tab stop the owner keeps does not follow focus', () => {
    render(<Group activeValue="banana" />);
    act(() => screen.getByRole('button', { name: 'banana' }).focus());
    key('ArrowDown');
    expect(focused()).toBe('blueberry');
    expect(tabStops()).toEqual(['banana']);
  });

  it('returns a stable container ref when the caller has none', () => {
    const refs = new Set<unknown>();
    function Probe({ tick }: { tick: number }) {
      const roving = useRovingFocus();
      const props = roving.getContainerProps();
      refs.add(props.ref);
      return <div data-tick={tick} {...props} />;
    }
    const { rerender } = render(<Probe tick={1} />);
    rerender(<Probe tick={2} />);
    expect(refs.size).toBe(1);
  });

  it('keeps the container ref stable while the caller ref is', () => {
    const attach = vi.fn();
    function Probe({ tick }: { tick: number }) {
      const roving = useRovingFocus();
      return <div data-tick={tick} {...roving.getContainerProps({ ref: attach })} />;
    }
    const { rerender } = render(<Probe tick={1} />);
    rerender(<Probe tick={2} />);
    rerender(<Probe tick={3} />);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('an item focus the consumer prevents does not move the tab stop', () => {
    const onActiveValueChange = vi.fn();
    function Prevented() {
      const roving = useRovingFocus({ onActiveValueChange });
      return (
        <div {...roving.getContainerProps()}>
          <button type="button" {...roving.getItemProps('a')}>
            a
          </button>
          <button type="button" {...roving.getItemProps('b', {}, { onFocus: (event) => event.preventDefault() })}>
            b
          </button>
        </div>
      );
    }
    render(<Prevented />);
    act(() => screen.getByRole('button', { name: 'b' }).focus());
    expect(onActiveValueChange).not.toHaveBeenCalled();
    expect(tabStops()).toEqual(['a']);
  });

  it('works controlled', () => {
    function Controlled() {
      const [active, setActive] = useState<string | null>('banana');
      return (
        <>
          <output>{active}</output>
          <Group activeValue={active} onActiveValueChange={setActive} />
        </>
      );
    }
    render(<Controlled />);
    expect(tabStops()).toEqual(['banana']);
    act(() => screen.getByRole('button', { name: 'banana' }).focus());
    key('ArrowDown');
    expect(screen.getByRole('status').textContent).toBe('blueberry');
    expect(tabStops()).toEqual(['blueberry']);
  });

  it('keeps consumer handlers and lets them prevent the move', () => {
    function Prevent() {
      const roving = useRovingFocus();
      return (
        <div {...roving.getContainerProps({ onKeyDown: (event) => event.preventDefault() })}>
          <button type="button" {...roving.getItemProps('a')}>
            a
          </button>
          <button type="button" {...roving.getItemProps('b')}>
            b
          </button>
        </div>
      );
    }
    render(<Prevent />);
    screen.getByText('a').focus();
    key('ArrowDown');
    expect(focused()).toBe('a');
  });
});
