import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Coachmark } from '../components/Coachmark.js';
import { Menu } from '../components/Menu.js';
import { Popover } from '../components/Popover.js';
import { ScrollArea } from '../components/ScrollArea.js';
import { usePopover } from '../hooks/usePopover.js';

// jsdom has no ResizeObserver; this one keeps what each live observer
// watches, as a browser would, so a test can see what a closed overlay keeps
// running.
const alive = new Map<FakeResizeObserver, Set<Element>>();
class FakeResizeObserver {
  observe(target: Element) {
    const watched = alive.get(this) ?? new Set();
    watched.add(target);
    alive.set(this, watched);
  }
  unobserve() {}
  disconnect() {
    alive.delete(this);
  }
}

/** Live observers watching a scroller that holds scroll arrows. */
const arrowObservers = () =>
  [...alive.values()].filter((watched) =>
    [...watched].some((el) => el.querySelector(':scope > [data-todae-scroll-edges]')),
  ).length;

beforeEach(() => {
  alive.clear();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const rails = () => document.querySelectorAll('[data-todae-scroll-edges]');

/** Counts the layout reads made while `run` runs. */
function layoutReads(run: () => void) {
  const style = vi.spyOn(window, 'getComputedStyle');
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  run();
  const reads = style.mock.calls.length + rect.mock.calls.length;
  style.mockRestore();
  rect.mockRestore();
  return reads;
}

function PopoverHarness() {
  const popover = usePopover();
  return (
    <>
      <button type="button" {...popover.getTriggerProps()}>
        Filters
      </button>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters">
        <p>Body</p>
      </Popover.Root>
    </>
  );
}

function MenuHarness() {
  return (
    <Menu.Root>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.Content>
        <Menu.Item>Rename</Menu.Item>
        <Menu.Submenu>
          <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
          <Menu.SubmenuContent>
            <Menu.Item>Archive</Menu.Item>
          </Menu.SubmenuContent>
        </Menu.Submenu>
      </Menu.Content>
    </Menu.Root>
  );
}

function CoachmarkHarness() {
  const target = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={target} type="button" onClick={() => setOpen(true)}>
        Start tour
      </button>
      <Coachmark.Root targetRef={target} open={open} onOpenChange={setOpen}>
        <Coachmark.Title>New filters</Coachmark.Title>
      </Coachmark.Root>
    </>
  );
}

describe('A closed overlay does no open-state work', () => {
  it('mounts closed popovers with no scroll arrows, observers or layout reads', () => {
    const reads = layoutReads(() => {
      render(
        <>
          {Array.from({ length: 5 }, (_, i) => (
            <PopoverHarness key={i} />
          ))}
        </>,
      );
    });
    expect(rails()).toHaveLength(0);
    expect(arrowObservers()).toBe(0);
    expect(reads).toBe(0);
  });

  it('mounts a closed menu and its submenu with no scroll arrows or layout reads', () => {
    const reads = layoutReads(() => {
      render(<MenuHarness />);
    });
    expect(rails()).toHaveLength(0);
    expect(arrowObservers()).toBe(0);
    expect(reads).toBe(0);
  });

  it('mounts a closed coachmark with no scroll arrows or observers', () => {
    render(<CoachmarkHarness />);
    expect(rails()).toHaveLength(0);
    expect(arrowObservers()).toBe(0);
  });

  it('starts the arrows as a popover opens and stops them as it closes, keeping them for the exit', () => {
    render(<PopoverHarness />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    act(() => fireEvent.click(trigger));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog.querySelector('[data-todae-scroll-edges]')).not.toBeNull();
    expect(arrowObservers()).toBe(1);

    act(() => fireEvent.click(trigger));
    // The rail stays, so the arrows fade out with the popover as they were.
    expect(dialog.querySelector('[data-todae-scroll-edges]')).not.toBeNull();
    expect(arrowObservers()).toBe(0);

    act(() => fireEvent.click(trigger));
    expect(arrowObservers()).toBe(1);
  });

  it('starts a submenu’s arrows only when the submenu opens', () => {
    render(<MenuHarness />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Actions' })));
    const menus = () => screen.getAllByRole('menu', { hidden: true });
    expect(menus()[0]!.querySelector('[data-todae-scroll-edges]')).not.toBeNull();
    expect(arrowObservers()).toBe(1);

    const subTrigger = screen.getByRole('menuitem', { name: 'Move to', hidden: true });
    act(() => fireEvent.click(subTrigger));
    expect(menus()[1]!.querySelector('[data-todae-scroll-edges]')).not.toBeNull();
    expect(arrowObservers()).toBe(2);
  });

  it('keeps a plain ScrollArea’s arrows running from mount', () => {
    render(
      <ScrollArea.Root arrows aria-label="Log">
        <p>Line</p>
      </ScrollArea.Root>,
    );
    expect(rails()).toHaveLength(1);
    expect(arrowObservers()).toBeGreaterThan(0);
  });
});
