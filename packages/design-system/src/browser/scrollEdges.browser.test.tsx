import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTabbables } from '../overlay/tabbables.js';
import { Button, Menu, Popover, ScrollArea, usePopover } from '../index.js';
import { emulateMedia } from '../test/media.js';

afterEach(async () => {
  vi.restoreAllMocks();
  await userEvent.unhover(document.body);
  await emulateMedia([]);
});

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <div key={i} style={{ blockSize: 20, inlineSize: 60, flex: 'none' }}>
      Row {i + 1}
    </div>
  ));

const edge = (scroller: HTMLElement, name: string) => scroller.querySelector<HTMLElement>(`[data-edge="${name}"]`)!;
const shownEdges = (scroller: HTMLElement) =>
  [...scroller.querySelectorAll<HTMLElement>('[data-edge]')].filter((node) => node.hasAttribute('data-shown')).map((node) => node.dataset.edge);
const frames = (n: number) => new Promise<void>((resolve) => {
  const next = (left: number) => (left ? requestAnimationFrame(() => next(left - 1)) : resolve());
  next(n);
});

/** The edge's box against the scroller's padding box, which is what scrolls. */
function offsets(node: HTMLElement, scroller: HTMLElement) {
  const box = node.getBoundingClientRect();
  const port = scroller.getBoundingClientRect();
  return {
    top: box.top - port.top - scroller.clientTop,
    left: box.left - port.left - scroller.clientLeft,
    bottom: port.top + scroller.clientTop + scroller.clientHeight - box.bottom,
    right: port.left + scroller.clientLeft + scroller.clientWidth - box.right,
  };
}

describe('scroll edge arrows', () => {
  it('stay off a plain ScrollArea unless asked for', () => {
    render(
      <ScrollArea.Root data-testid="area" aria-label="Rows" style={{ blockSize: 80 }}>
        {rows(12)}
      </ScrollArea.Root>,
    );
    expect(screen.getByTestId('area').querySelector('[data-edge]')).toBeNull();
  });

  it('show only toward the content cut off, and stay on the edges while it scrolls', async () => {
    render(
      <ScrollArea.Root arrows data-testid="area" aria-label="Rows" style={{ blockSize: 100, inlineSize: 200, padding: 10 }}>
        {rows(20)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-end']));
    const end = edge(area, 'block-end');
    for (const top of [0, 60, 200]) {
      area.scrollTop = top;
      await frames(2);
      const box = offsets(end, area);
      expect(box.bottom).toBeCloseTo(0, 0);
      expect(box.left).toBeCloseTo(0, 0);
      expect(box.right).toBeCloseTo(0, 0);
      const start = offsets(edge(area, 'block-start'), area);
      expect(start.top).toBeCloseTo(0, 0);
    }
    expect(shownEdges(area)).toEqual(['block-start', 'block-end']);
    area.scrollTop = area.scrollHeight;
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-start']));
  });

  it('show none while the content fits', async () => {
    render(
      <ScrollArea.Root arrows data-testid="area" aria-label="Rows" style={{ blockSize: 400 }}>
        {rows(3)}
      </ScrollArea.Root>,
    );
    await frames(2);
    expect(shownEdges(screen.getByTestId('area'))).toEqual([]);
  });

  it('scroll toward an edge while the pointer rests on its arrow, and stop when it leaves', async () => {
    render(
      <ScrollArea.Root arrows data-testid="area" aria-label="Rows" style={{ blockSize: 100 }}>
        {rows(60)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-end']));
    await userEvent.hover(edge(area, 'block-end'));
    await waitFor(() => expect(area.scrollTop).toBeGreaterThan(40));
    await userEvent.unhover(edge(area, 'block-end'));
    const left = area.scrollTop;
    await frames(10);
    expect(area.scrollTop).toBe(left);
  });

  it('speed up the longer the pointer rests, and keep one speed under reduced motion', async () => {
    const pace = async () => {
      const { unmount } = render(
        <ScrollArea.Root arrows data-testid="area" aria-label="Rows" style={{ blockSize: 100 }}>
          {rows(400)}
        </ScrollArea.Root>,
      );
      const area = screen.getByTestId('area');
      await waitFor(() => expect(shownEdges(area)).toEqual(['block-end']));
      await userEvent.hover(edge(area, 'block-end'));
      const marks: number[] = [];
      for (const wait of [300, 900]) {
        const from = area.scrollTop;
        const start = performance.now();
        await new Promise((resolve) => setTimeout(resolve, wait));
        marks.push((area.scrollTop - from) / (performance.now() - start));
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      await userEvent.unhover(edge(area, 'block-end'));
      unmount();
      return marks;
    };
    const [early, late] = await pace();
    expect(late!).toBeGreaterThan(early! * 1.5);
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const [even, still] = await pace();
    expect(still! / even!).toBeGreaterThan(0.8);
    expect(still! / even!).toBeLessThan(1.25);
  });

  it('keep their speed on a display that draws a frame every 2ms', async () => {
    render(
      <ScrollArea.Root arrows data-testid="area" aria-label="Rows" style={{ blockSize: 100 }}>
        {rows(400)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-end']));
    // A fake clock and frame queue, so each frame is 2ms apart.
    let now = 0;
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => queue.push(callback));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    edge(area, 'block-end').dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', movementY: 1 }));
    for (let i = 0; i < 500; i++) {
      now += 2;
      queue.splice(0).forEach((callback) => callback(now));
    }
    // One second at 0.08 px/ms rising toward 0.4 moves well over 100px.
    expect(area.scrollTop).toBeGreaterThan(100);
    edge(area, 'block-end').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  });

  it('run sideways, and from the right in a right-to-left scroller', async () => {
    render(
      <div dir="rtl">
        <ScrollArea.Root arrows axis="inline" data-testid="area" aria-label="Rows" style={{ inlineSize: 200 }}>
          <div style={{ display: 'flex', gap: 8 }}>{rows(20)}</div>
        </ScrollArea.Root>
      </div>,
    );
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['inline-end']));
    const end = offsets(edge(area, 'inline-end'), area);
    expect(end.left).toBeCloseTo(0, 0);
    expect(end.top).toBeCloseTo(0, 0);
    expect(end.bottom).toBeCloseTo(0, 0);
    await userEvent.hover(edge(area, 'inline-end'));
    await waitFor(() => expect(area.scrollLeft).toBeLessThan(-40));
    await userEvent.unhover(edge(area, 'inline-end'));
    await waitFor(() => expect(shownEdges(area)).toEqual(['inline-start', 'inline-end']));
    expect(offsets(edge(area, 'inline-start'), area).right).toBeCloseTo(0, 0);
  });

  it('leave the list where keys or a script put it when an arrow shows up under a still pointer', async () => {
    render(
      <ScrollArea.Root arrows data-testid="area" aria-label="Rows" style={{ blockSize: 120 }}>
        {rows(40)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await userEvent.hover(screen.getByText('Row 1'));
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-end']));
    // The start arrow appears under the pointer, which never moves.
    area.scrollTop = 300;
    await frames(2);
    const at = area.scrollTop;
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(shownEdges(area)).toContain('block-start');
    expect(area.scrollTop).toBe(at);
  });

  it('stay off a grid scroller, so its items keep their cells', async () => {
    function Grid() {
      const popover = usePopover({ defaultOpen: true });
      return (
        <>
          <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} data-testid="surface" role="dialog" aria-label="Filters" style={{ display: 'grid', gridTemplateColumns: '120px 120px', gap: 8 }}>
            {['A', 'B', 'C', 'D'].map((name) => (
              <button key={name} type="button">
                {name}
              </button>
            ))}
          </Popover.Root>
        </>
      );
    }
    render(<Grid />);
    const surface = screen.getByTestId('surface');
    await frames(2);
    const top = (name: string) => screen.getByRole('button', { name }).getBoundingClientRect().top;
    const left = (name: string) => screen.getByRole('button', { name }).getBoundingClientRect().left;
    expect(top('A')).toBeCloseTo(top('B'), 0);
    expect(left('A')).toBeLessThan(left('B'));
    expect(shownEdges(surface)).toEqual([]);
  });

  it('are hidden from assistive technology and never take focus', async () => {
    render(
      <ScrollArea.Root arrows data-testid="area" style={{ blockSize: 80 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <button key={i} type="button" style={{ display: 'block' }}>
            Button {i + 1}
          </button>
        ))}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-end']));
    expect(area.querySelector('[data-edge]')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(getTabbables(area).every((node) => node.tagName === 'BUTTON')).toBe(true);
  });

  describe('in a menu', () => {
    function Long() {
      return (
        <Menu.Root>
          <Menu.Trigger variant="secondary">Fonts</Menu.Trigger>
          <Menu.Content data-testid="menu" style={{ maxBlockSize: 160 }}>
            {Array.from({ length: 18 }, (_, i) => (
              <Menu.Item key={i}>Font {i + 1}</Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>
      );
    }
    const settled = () => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));

    it('show on by default, take no room from the items, and keep a focused item clear of the arrow', async () => {
      render(<Long />);
      await userEvent.click(screen.getByRole('button', { name: 'Fonts' }));
      const menu = screen.getByTestId('menu');
      await waitFor(() => expect(shownEdges(menu)).toEqual(['block-end']));
      await settled();
      const items = screen.getAllByRole('menuitem');
      // The first item sits where it would with nothing before it.
      const pad = Number.parseFloat(getComputedStyle(menu).paddingTop);
      expect(items[0]!.getBoundingClientRect().top - menu.getBoundingClientRect().top - menu.clientTop).toBeCloseTo(pad, 0);
      const gap = items[1]!.getBoundingClientRect().top - items[0]!.getBoundingClientRect().bottom;
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeCloseTo(Number.parseFloat(getComputedStyle(menu).rowGap) || 0, 0);

      // Arrow keys walk down; each item that takes focus stays clear of the band.
      await userEvent.keyboard('{ArrowDown}');
      for (let i = 1; i < 10; i++) {
        await userEvent.keyboard('{ArrowDown}');
        const band = edge(menu, 'block-end').getBoundingClientRect();
        const focused = (document.activeElement as HTMLElement).getBoundingClientRect();
        expect(focused.bottom).toBeLessThanOrEqual(band.top + 0.5);
      }
    });

    it('scroll the menu without moving focus while the pointer rests on one', async () => {
      render(<Long />);
      await userEvent.click(screen.getByRole('button', { name: 'Fonts' }));
      const menu = screen.getByTestId('menu');
      await waitFor(() => expect(shownEdges(menu)).toEqual(['block-end']));
      await settled();
      const before = document.activeElement;
      await userEvent.hover(edge(menu, 'block-end'));
      await waitFor(() => expect(menu.scrollTop).toBeGreaterThan(40));
      expect(document.activeElement).toBe(before);
      await userEvent.click(edge(menu, 'block-end'));
      expect(menu.matches(':popover-open')).toBe(true);
      expect(document.activeElement).toBe(before);
    });
  });
});
