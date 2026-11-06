// Tabs and their scroll arrows under a ResizeObserver that acts as a
// browser's: a new observation reports once, after that only a size that
// changed reports, and nothing reports until a frame. The observers are
// shared by every part that watches a list (internal/sharedObservers.ts), so
// these cover the cases where one part starts, stops or needs a report while
// another still watches.
import { act, cleanup, render } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '../index.js';

type Size = { w: number; h: number };
const sizes = new WeakMap<Element, Size>();
const observers = new Set<BrowserRO>();
class BrowserRO {
  last = new Map<Element, string>();
  constructor(public cb: ResizeObserverCallback) {
    observers.add(this);
  }
  observe(t: Element) {
    if (!this.last.has(t)) this.last.set(t, 'new');
  }
  unobserve(t: Element) {
    this.last.delete(t);
  }
  disconnect() {
    this.last.clear();
  }
}
const sizeOf = (el: Element): Size => {
  const s = sizes.get(el);
  if (s) return s;
  if (el.getAttribute('role') === 'tablist') return (el as HTMLElement).hidden ? { w: 0, h: 0 } : { w: LIST_CONTENT, h: 40 };
  if (el.getAttribute('role') === 'tab') return { w: 100, h: 40 };
  return { w: 0, h: 0 };
};
async function frame() {
  await act(async () => {
    for (const ro of [...observers]) {
      const entries: unknown[] = [];
      for (const [t, was] of ro.last) {
        const s = sizeOf(t);
        const key = `${s.w}x${s.h}`;
        if (key === was) continue;
        ro.last.set(t, key);
        entries.push({ target: t, contentRect: { width: s.w, height: s.h }, contentBoxSize: [{ inlineSize: s.w, blockSize: s.h }] });
      }
      if (entries.length) ro.cb(entries as ResizeObserverEntry[], ro as unknown as ResizeObserver);
    }
    await Promise.resolve();
  });
}
const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

// Every tab list's content box, which clientWidth rounds. Tabs are 100px each.
let LIST_CONTENT = 300.4;
const scroll = new WeakMap<Element, number>();
const saved: [object, string, PropertyDescriptor][] = [];
function patch(proto: object, name: string, get: (this: HTMLElement, orig: () => unknown) => unknown, set?: (this: HTMLElement, v: number) => void) {
  const d = Object.getOwnPropertyDescriptor(proto, name)!;
  saved.push([proto, name, d]);
  Object.defineProperty(proto, name, {
    configurable: true,
    get(this: HTMLElement) {
      return get.call(this, () => d.get!.call(this));
    },
    set(this: HTMLElement, v: number) {
      if (set) set.call(this, v);
      else d.set?.call(this, v);
    },
  });
}
const isList = (el: Element) => el.getAttribute('role') === 'tablist';
const tabsOf = (el: Element) => [...el.querySelectorAll('[role="tab"]')];
beforeAll(() => {
  patch(Element.prototype, 'clientWidth', function (o) {
    return isList(this) ? (this.hidden ? 0 : Math.round(LIST_CONTENT)) : o();
  });
  patch(Element.prototype, 'clientHeight', function (o) {
    return isList(this) ? 40 : o();
  });
  patch(Element.prototype, 'scrollWidth', function (o) {
    return isList(this) ? Math.max(Math.round(LIST_CONTENT), tabsOf(this).length * 100) : o();
  });
  patch(
    Element.prototype,
    'scrollLeft',
    function (o) {
      return isList(this) ? (scroll.get(this) ?? 0) : o();
    },
    function (v) {
      if (isList(this)) {
        const max = Math.max(Math.round(LIST_CONTENT), tabsOf(this).length * 100) - Math.round(LIST_CONTENT);
        scroll.set(this, Math.max(0, Math.min(max, v)));
      }
    },
  );
  patch(HTMLElement.prototype, 'offsetParent', function (o) {
    return this.getAttribute('role') === 'tab' ? this.closest('[role="tablist"]') : o();
  });
  patch(HTMLElement.prototype, 'offsetLeft', function (o) {
    if (this.getAttribute('role') !== 'tab') return o();
    const list = this.closest('[role="tablist"]')!;
    return tabsOf(list).indexOf(this) * 100;
  });
  patch(HTMLElement.prototype, 'offsetWidth', function (o) {
    return this.getAttribute('role') === 'tab' ? 100 : o();
  });
});
afterAll(() => {
  for (const [proto, name, d] of saved) Object.defineProperty(proto, name, d);
});
beforeEach(() => {
  observers.clear();
  vi.stubGlobal('ResizeObserver', BrowserRO);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const VALUES = 'abcdefghij'.split('');
function Many({ value, arrows = true }: { value: string; arrows?: boolean }) {
  return (
    <div>
      <Tabs.Root value={value} onValueChange={() => {}}>
        <Tabs.List aria-label="Many" arrows={arrows}>
          {VALUES.map((v) => (
            <Tabs.Tab key={v} value={v}>
              {v}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.Root>
    </div>
  );
}

describe('Tabs arrows that start on a list already watched', () => {
  it('sizes the rail from the fractional content box when arrows turn on after a selection change', async () => {
    LIST_CONTENT = 300.4;
    const r = render(<Many value="a" arrows={false} />);
    await settle();
    await frame();
    await settle();
    r.rerender(<Many value="b" arrows={false} />);
    await settle();
    await frame();
    await settle();
    r.rerender(<Many value="b" arrows />);
    await settle();
    await frame();
    await settle();
    await frame();
    await settle();
    const rail = r.container.querySelector<HTMLElement>('[data-todae-scroll-edges]')!;
    expect(rail.style.getPropertyValue('--_port-inline')).toBe('300.4px');
  });
});

describe('Tabs arrows in WebKit right-to-left', () => {
  it('drops the rail shift once the list is left-to-right again', async () => {
    LIST_CONTENT = 300;
    const gcs = window.getComputedStyle;
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      const style = gcs.call(window, el, pseudo);
      const dir = (el as Element).closest?.('[dir]')?.getAttribute('dir') ?? 'ltr';
      Object.defineProperty(style, 'direction', { configurable: true, value: dir });
      return style;
    });
    const gbcr = Element.prototype.getBoundingClientRect;
    // Sticky not holding the rail, as in WebKit: it sits 50px right of where it should.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.getAttribute('role') === 'tablist') return { right: 300, left: 0 } as DOMRect;
      if (this.hasAttribute('data-todae-scroll-edges')) {
        const t = Number.parseFloat((this as HTMLElement).style.translate) || 0;
        return { right: 350 + t, left: 350 + t } as DOMRect;
      }
      return gbcr.call(this);
    };
    try {
      const r = render(
        <div dir="rtl">
          <Many value="a" />
        </div>,
      );
      await settle();
      await frame();
      await settle();
      const rail = r.container.querySelector<HTMLElement>('[data-todae-scroll-edges]')!;
      r.container.querySelector('[dir]')!.setAttribute('dir', 'ltr');
      // The list resizes, so the arrows measure again.
      LIST_CONTENT = 320;
      await frame();
      await settle();
      expect(rail.style.translate).toBe('');
    } finally {
      spy.mockRestore();
      Element.prototype.getBoundingClientRect = gbcr;
    }
  });
});

describe('Tabs under StrictMode', () => {
  it('shows the end arrow and reveals the selected tab under StrictMode', async () => {
    LIST_CONTENT = 300;
    const r = render(
      <StrictMode>
        <Many value="e" />
      </StrictMode>,
    );
    const list = r.container.querySelector<HTMLElement>('[role="tablist"]')!;
    await settle();
    await frame();
    await settle();
    const shown = [...list.querySelectorAll('[data-edge][data-shown]')].map((n) => n.getAttribute('data-edge'));
    expect(list.scrollLeft).toBeGreaterThan(0);
    expect(shown.sort()).toEqual(['inline-end', 'inline-start']);
  });
});

function Late({ count, value, hidden }: { count: number; value: string; hidden?: boolean }) {
  return (
    <Tabs.Root value={value} onValueChange={() => {}}>
      <Tabs.List aria-label="Late" hidden={hidden}>
        {VALUES.slice(0, count).map((v) => (
          <Tabs.Tab key={v} value={v}>
            {v}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
describe('Tabs that arrive late', () => {
  it('reveals a selected tab that arrives late, and keeps the end arrow right', async () => {
    LIST_CONTENT = 300;
    const r = render(<Late count={2} value="h" />);
    const list = r.container.querySelector<HTMLElement>('[role="tablist"]')!;
    await settle();
    await frame();
    await settle();
    r.rerender(<Late count={10} value="h" />);
    await settle();
    await frame();
    await settle();
    const shown = [...list.querySelectorAll('[data-edge][data-shown]')].map((n) => n.getAttribute('data-edge'));
    expect(list.scrollLeft).toBe(500);
    expect(shown.sort()).toEqual(['inline-end', 'inline-start']);
  });
});

describe('a hidden tab list', () => {
  it('reveals the selected tab once a hidden list shows', async () => {
    LIST_CONTENT = 300;
    const r = render(<Late count={10} value="h" hidden />);
    const list = r.container.querySelector<HTMLElement>('[role="tablist"]')!;
    await settle();
    await frame();
    await settle();
    r.rerender(<Late count={10} value="h" />);
    await settle();
    await frame();
    await settle();
    expect(list.scrollLeft).toBe(500);
  });
});

function Closable() {
  const [tabs, setTabs] = useState(VALUES.slice(0, 5));
  return (
    <Tabs.Root defaultValue="a">
      <Tabs.List aria-label="Files">
        {tabs.map((v) => (
          <Tabs.Tab key={v} value={v}>
            {v}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <button type="button" onClick={() => setTabs((all) => all.slice(0, 2))}>
        close
      </button>
    </Tabs.Root>
  );
}
describe('closing tabs', () => {
  it('hides the end arrow once nothing is left to scroll, though nothing resized', async () => {
    LIST_CONTENT = 300;
    const r = render(<Closable />);
    const list = r.container.querySelector<HTMLElement>('[role="tablist"]')!;
    const end = () => list.querySelector('[data-todae-scroll-edges] [data-edge="inline-end"]')!.hasAttribute('data-shown');
    await settle();
    await frame();
    await settle();
    expect(end()).toBe(true);
    await act(async () => r.getByText('close').click());
    await settle();
    await frame();
    await settle();
    expect(end()).toBe(false);
  });
});

describe('a ResizeObserver stand-in with no unobserve', () => {
  it('lets one of two tab lists unmount', async () => {
    // The shape Splitter.test.tsx stubs.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    function Two() {
      const [both, setBoth] = useState(true);
      return (
        <>
          <Many value="a" />
          {both && <Many value="b" />}
          <button type="button" onClick={() => setBoth(false)}>
            drop
          </button>
        </>
      );
    }
    const r = render(<Two />);
    await settle();
    await act(async () => r.getByText('drop').click());
    expect(r.getAllByRole('tablist')).toHaveLength(1);
  });
});
