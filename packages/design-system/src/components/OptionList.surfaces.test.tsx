import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePopover } from '../hooks/usePopover.js';
import { BottomSheet } from './BottomSheet.js';
import { OptionList } from './OptionList.js';
import { Popover } from './Popover.js';

afterEach(cleanup);

const ITEMS = Array.from({ length: 40 }, (_, i) => `Fruit ${i + 1}`);

// The surface scrolls 1600px of options in 200px, each option 40px tall.
let restore: () => void = () => {};
beforeEach(() => {
  const isBox = (el: Element) => el.getAttribute('data-box') === '';
  const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return isBox(this) ? 1600 : 0;
  });
  const client = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return isBox(this) ? 200 : 0;
  });
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (isBox(this)) return new DOMRect(0, 0, 300, 200);
    if (this.getAttribute('role') === 'option') {
      return new DOMRect(0, [...this.parentElement!.children].indexOf(this) * 40 - (this.closest('[data-box]')?.scrollTop ?? 0), 300, 40);
    }
    return new DOMRect(0, 0, 0, 0);
  });
  restore = () => {
    height.mockRestore();
    client.mockRestore();
    rect.mockRestore();
  };
});
afterEach(() => restore());

function List({ items }: { items: string[] }) {
  return (
    <OptionList.Root value={null} onValueChange={() => undefined} activeValue="Fruit 30" aria-label="Fruit">
      {items.map((item) => (
        <OptionList.Option key={item} value={item}>
          {item}
        </OptionList.Option>
      ))}
    </OptionList.Root>
  );
}

function InPopover({ open, items, children }: { open: boolean; items: string[]; children?: ReactNode }) {
  const popover = usePopover({ open, onOpenChange: () => {} });
  return (
    <>
      <button type="button" {...popover.getTriggerProps()}>
        Fruit
      </button>
      <Popover.Root {...popover.getPopoverProps()} arrows={false} data-box="" style={{ overflowY: 'auto' }}>
        {children ?? <List items={items} />}
      </Popover.Root>
    </>
  );
}

const box = () => document.querySelector<HTMLElement>('[data-box]')!;

describe('OptionList in a surface, with its requested option arriving after the first open', { timeout: 30000 }, () => {
  it('Popover.Root: reveals the late option', () => {
    const { rerender } = render(<InPopover open={false} items={[]} />);
    rerender(<InPopover open items={[]} />);
    rerender(<InPopover open items={ITEMS} />);
    expect(box().scrollTop).toBeGreaterThan(0);
  });

  it('Popover.Root under StrictMode: reveals the late option', () => {
    const { rerender } = render(
      <StrictMode>
        <InPopover open={false} items={[]} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <InPopover open items={[]} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <InPopover open items={ITEMS} />
      </StrictMode>,
    );
    expect(box().scrollTop).toBeGreaterThan(0);
  });

  it('BottomSheet: reveals the late option', async () => {
    function Sheet({ open, items }: { open: boolean; items: string[] }) {
      return (
        <BottomSheet.Root open={open} onOpenChange={() => {}} aria-label="Fruit">
          <BottomSheet.Body data-box="" style={{ overflowY: 'auto' }}>
            <List items={items} />
          </BottomSheet.Body>
        </BottomSheet.Root>
      );
    }
    const { rerender } = render(<Sheet open={false} items={[]} />);
    rerender(<Sheet open items={[]} />);
    await act(async () => {});
    rerender(<Sheet open items={ITEMS} />);
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(box().scrollTop).toBeGreaterThan(0);
  });

  it('a list the owner mounts only while open, reopened inside the exit fade: reveals the late option', async () => {
    // The owner renders the list only while open, as `{open && <List />}`.
    function Owned({ open, items }: { open: boolean; items: string[] }) {
      return <InPopover open={open} items={items}>{open ? <List items={items} /> : <span />}</InPopover>;
    }
    // jsdom reads no stylesheet: give the popover the exit fade the browser would.
    const real = window.getComputedStyle.bind(window);
    const style = vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
      const computed = real(el, pseudo);
      if (!(el as HTMLElement).hasAttribute?.('popover')) return computed;
      const over: Record<string, string> = { transitionProperty: 'opacity', transitionDuration: '0.2s', transitionDelay: '0s' };
      return new Proxy(computed, {
        get: (target, prop) => (typeof prop === 'string' && prop in over ? over[prop] : Reflect.get(target, prop, target)),
      });
    });
    try {
      const { rerender } = render(<Owned open items={ITEMS} />);
      // Entered, as two frames on, so the close fades.
      box().setAttribute('data-entered', '');
      rerender(<Owned open={false} items={ITEMS} />);
      expect(box().hasAttribute('data-todae-exiting')).toBe(true);
      // Still shown, fading out, when it opens again with the options still loading.
      rerender(<Owned open items={[]} />);
      box().scrollTop = 0;
      rerender(<Owned open items={ITEMS} />);
      expect(box().scrollTop).toBeGreaterThan(0);
    } finally {
      style.mockRestore();
    }
  });
});
