import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTabbables } from '../overlay/tabbables.js';
import { Button, Menu, Popover, ScrollArea, Tabs, usePopover } from '../index.js';
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

  it('keep inside the scrollport on a fractional size, so they add no overflow of their own', async () => {
    render(
      <ScrollArea.Root arrows axis="both" data-testid="area" aria-label="Rows" style={{ blockSize: 101, inlineSize: 200.9, padding: 3.3 }}>
        <div style={{ inlineSize: 400 }}>{rows(20)}</div>
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-end', 'inline-end']));
    area.scrollTop = 30;
    area.scrollLeft = 30;
    await waitFor(() => expect(shownEdges(area)).toHaveLength(4));
    // The padding box from the area's own fractional box, less its borders and
    // any scrollbar, where clientWidth and clientHeight round to whole pixels.
    const box = area.getBoundingClientRect();
    const style = getComputedStyle(area);
    const border = (side: 'Top' | 'Right' | 'Bottom' | 'Left') => Number.parseFloat(style[`border${side}Width`]);
    const bar = (offset: number, client: number, a: number, b: number) => Math.max(0, Math.round(offset - a - b - client));
    const port = {
      left: box.left + border('Left'),
      top: box.top + border('Top'),
      right: box.right - border('Right') - bar(area.offsetWidth, area.clientWidth, border('Left'), border('Right')),
      bottom: box.bottom - border('Bottom') - bar(area.offsetHeight, area.clientHeight, border('Top'), border('Bottom')),
    };
    for (const name of ['block-start', 'block-end', 'inline-start', 'inline-end']) {
      const band = edge(area, name).getBoundingClientRect();
      expect(band.left).toBeGreaterThanOrEqual(port.left - 0.02);
      expect(band.top).toBeGreaterThanOrEqual(port.top - 0.02);
      expect(band.right).toBeLessThanOrEqual(port.right + 0.02);
      expect(band.bottom).toBeLessThanOrEqual(port.bottom + 0.02);
    }
  });

  it('show none on a list that fits a fractional size', async () => {
    render(
      <ScrollArea.Root arrows axis="both" data-testid="area" aria-label="Rows" style={{ blockSize: 101, inlineSize: 200.9, padding: 3.3 }}>
        {rows(2)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await frames(3);
    expect(area.scrollHeight).toBe(area.clientHeight);
    expect(area.scrollWidth).toBe(area.clientWidth);
    expect(shownEdges(area)).toEqual([]);
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

  it('start for a pointer whose moves report no movement, going by where it was', async () => {
    render(
      <ScrollArea.Root arrows data-testid="area" aria-label="Rows" style={{ blockSize: 100 }}>
        {rows(60)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['block-end']));
    const end = edge(area, 'block-end');
    const box = end.getBoundingClientRect();
    const at = { clientX: box.left + 10, clientY: box.top + 10 };
    // Some browsers report movementX and movementY as 0 for every move.
    const move = (target: EventTarget, point: { clientX: number; clientY: number }) =>
      target.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true, ...point }));
    // A pointer still at the same place, as when the arrow shows up under it,
    // with a finger moving elsewhere in between.
    move(document.body, at);
    document.body.dispatchEvent(
      new PointerEvent('pointermove', { pointerType: 'touch', pointerId: 7, bubbles: true, clientX: 5, clientY: 5 }),
    );
    move(end, at);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(area.scrollTop).toBe(0);
    // The same pointer moving onto the arrow from elsewhere.
    move(document.body, { clientX: at.clientX, clientY: at.clientY - 60 });
    move(end, at);
    await waitFor(() => expect(area.scrollTop).toBeGreaterThan(20));
    end.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
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

  it('stay on the edges of a right-to-left scroller of fractional size, and after it turns left-to-right', async () => {
    function Rows({ dir }: { dir: 'rtl' | 'ltr' }) {
      return (
        <div dir={dir}>
          <ScrollArea.Root arrows axis="inline" data-testid="area" aria-label="Rows" style={{ inlineSize: 200.5, padding: 3, border: '1.5px solid' }}>
            <div style={{ display: 'flex', gap: 8 }}>{rows(20)}</div>
          </ScrollArea.Root>
        </div>
      );
    }
    const { rerender } = render(<Rows dir="rtl" />);
    const area = screen.getByTestId('area');
    await waitFor(() => expect(shownEdges(area)).toEqual(['inline-end']));
    area.scrollLeft = -120;
    await waitFor(() => expect(shownEdges(area)).toEqual(['inline-start', 'inline-end']));
    // Where sticky holds the rail, a rounded measure must not move it; where
    // WebKit lets it scroll away, it moves back by exactly the scroll.
    const rail = area.querySelector<HTMLElement>('[data-todae-scroll-edges]')!;
    expect([0, area.scrollLeft]).toContain(Number.parseFloat(rail.style.translate || '0'));
    // Within the half pixel the browser's own layout may round to.
    expect(Math.abs(offsets(edge(area, 'inline-start'), area).right)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(offsets(edge(area, 'inline-end'), area).left)).toBeLessThanOrEqual(0.5);
    rerender(<Rows dir="ltr" />);
    area.scrollLeft = 120;
    await waitFor(() => expect(shownEdges(area)).toEqual(['inline-start', 'inline-end']));
    await frames(2);
    expect(Math.abs(offsets(edge(area, 'inline-start'), area).left)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(offsets(edge(area, 'inline-end'), area).right)).toBeLessThanOrEqual(0.5);
    expect(rail.style.translate).toBe('');
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

  describe('in a tab list', () => {
    function Sections({ count = 12, arrows, defaultValue = 's1', dir, inlineSize = 260 }: { count?: number; arrows?: boolean; defaultValue?: string; dir?: 'rtl'; inlineSize?: number }) {
      return (
        <div dir={dir} data-testid="frame" style={{ display: 'flex', inlineSize }}>
          <Tabs.Root defaultValue={defaultValue} data-testid="tabs">
            <Tabs.List aria-label="Sections" arrows={arrows}>
              {Array.from({ length: count }, (_, i) => (
                <Tabs.Tab key={i} value={`s${i + 1}`}>
                  Section {i + 1}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {Array.from({ length: count }, (_, i) => (
              <Tabs.Panel key={i} value={`s${i + 1}`}>
                Panel {i + 1}
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        </div>
      );
    }
    const tab = (n: number) => screen.getByRole('tab', { name: `Section ${n}` });
    /** The list's scroll numbers, for a failure to report what the browser did. */
    function where(list: HTMLElement) {
      const rail = list.querySelector<HTMLElement>('[data-todae-scroll-edges]');
      const first = tab(1).getBoundingClientRect();
      const last = screen.getAllByRole('tab').at(-1)!.getBoundingClientRect();
      const box = list.getBoundingClientRect();
      return [
        `scrollLeft ${list.scrollLeft}`,
        `scrollWidth ${list.scrollWidth}`,
        `clientWidth ${list.clientWidth}`,
        `list ${box.left}..${box.right}`,
        `first tab ${first.left}..${first.right}`,
        `last tab ${last.left}..${last.right}`,
        `rail right ${rail?.getBoundingClientRect().right}`,
        `rail translate '${rail?.style.translate ?? ''}'`,
      ].join(', ');
    }
    /** The list's scrollport, less the band of each arrow that shows. */
    function clear(list: HTMLElement) {
      const box = list.getBoundingClientRect();
      const left = box.left + list.clientLeft;
      const right = left + list.clientWidth;
      const band = (name: string) => (edge(list, name).hasAttribute('data-shown') ? edge(list, name).getBoundingClientRect() : null);
      const rtl = getComputedStyle(list).direction === 'rtl';
      const [atLeft, atRight] = rtl ? [band('inline-end'), band('inline-start')] : [band('inline-start'), band('inline-end')];
      return { left: atLeft?.right ?? left, right: atRight?.left ?? right };
    }
    /**
     * Where the list's indicator is drawn on screen. Its computed insets are
     * from its containing block, the list's scrolled content, whose origin a
     * box at left 0 finds in every engine and direction.
     */
    function indicator(list: HTMLElement) {
      if (list.hasAttribute('data-flat-indicator')) {
        // Each tab's own indicator, placed in the selected tab.
        const selected = screen.getByRole('tab', { selected: true });
        const own = getComputedStyle(selected, '::after');
        expect(own.content).not.toBe('none');
        const left = selected.getBoundingClientRect().left + selected.clientLeft + Number.parseFloat(own.left);
        return { left, right: left + Number.parseFloat(own.width) };
      }
      const style = getComputedStyle(list, '::after');
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
      list.append(probe);
      const origin = probe.getBoundingClientRect().left;
      probe.remove();
      const left = origin + Number.parseFloat(style.left);
      return { left, right: left + Number.parseFloat(style.width) };
    }

    it('scroll sideways inside the room there is, with arrows on by default and the line under the tabs left showing', async () => {
      render(<Sections />);
      const list = screen.getByRole('tablist');
      expect(screen.getByTestId('tabs').getBoundingClientRect().width).toBeLessThanOrEqual(260.5);
      expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
      await waitFor(() => expect(shownEdges(list)).toEqual(['inline-end']));
      // The tabs stay one row.
      expect(tab(12).getBoundingClientRect().top).toBeCloseTo(tab(1).getBoundingClientRect().top, 0);
      // The band stops above the line, which runs the list's whole width.
      const band = edge(list, 'inline-end').getBoundingClientRect();
      const port = list.getBoundingClientRect();
      const rule = Number.parseFloat(getComputedStyle(list).paddingBottom);
      expect(rule).toBeGreaterThan(0);
      // clientTop and clientHeight round, so allow a pixel.
      expect(Math.abs(band.bottom - (port.top + list.clientTop + list.clientHeight - rule))).toBeLessThanOrEqual(1);
      expect(tab(1).getBoundingClientRect().bottom).toBeLessThanOrEqual(band.bottom + 0.5);
    });

    it('show none when asked, and none on a list that fits', async () => {
      const { unmount } = render(<Sections arrows={false} />);
      const list = screen.getByRole('tablist');
      expect(list.querySelector('[data-edge]')).toBeNull();
      expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
      unmount();
      render(<Sections count={2} />);
      await frames(3);
      expect(shownEdges(screen.getByRole('tablist'))).toEqual([]);
    });

    it.each([undefined, 'rtl'] as const)('keep a tab that arrow keys focus in view, clear of the arrows, dir %s', async (dir) => {
      render(<Sections dir={dir} />);
      const list = screen.getByRole('tablist');
      await waitFor(() => expect(shownEdges(list), where(list)).toEqual(['inline-end']));
      tab(1).focus();
      for (let n = 2; n <= 12; n++) {
        await userEvent.keyboard(dir === 'rtl' ? '{ArrowLeft}' : '{ArrowRight}');
        expect(document.activeElement).toBe(tab(n));
        await frames(1);
        const box = tab(n).getBoundingClientRect();
        const room = clear(list);
        expect(box.left).toBeGreaterThanOrEqual(room.left - 1);
        expect(box.right).toBeLessThanOrEqual(room.right + 1);
      }
      await waitFor(() => expect(shownEdges(list), where(list)).toEqual(['inline-start']));
      await userEvent.keyboard('{Home}');
      expect(document.activeElement).toBe(tab(1));
      await waitFor(() => expect(shownEdges(list), where(list)).toEqual(['inline-end']));
    });

    it.each([undefined, 'rtl'] as const)('keep the indicator under the selected tab while the list is scrolled, dir %s', async (dir) => {
      render(<Sections dir={dir} />);
      const list = screen.getByRole('tablist');
      await waitFor(() => expect(shownEdges(list)).toEqual(['inline-end']));
      list.scrollLeft = dir === 'rtl' ? -200 : 200;
      await frames(2);
      await userEvent.click(tab(5));
      await Promise.all(list.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)));
      await frames(1);
      // Right to left, an overflowing list draws each tab's own indicator.
      expect(list.hasAttribute('data-flat-indicator')).toBe(dir === 'rtl');
      const box = tab(5).getBoundingClientRect();
      const line = indicator(list);
      expect(line.left).toBeCloseTo(box.left, 0);
      expect(line.right).toBeCloseTo(box.right, 0);
    });

    it.each([undefined, 'rtl'] as const)('scroll a selected tab past the edge into view on the first render, and not the page, dir %s', async (dir) => {
      const top = window.scrollY;
      render(<Sections dir={dir} defaultValue="s10" />);
      const list = screen.getByRole('tablist');
      await frames(2);
      const box = tab(10).getBoundingClientRect();
      const room = clear(list);
      expect(box.left).toBeGreaterThanOrEqual(room.left - 1);
      expect(box.right).toBeLessThanOrEqual(room.right + 1);
      expect(window.scrollY).toBe(top);
    });

    it('scroll a selected tab into view once a list that mounted hidden shows', async () => {
      function Later({ open }: { open: boolean }) {
        return (
          <div hidden={!open}>
            <Sections defaultValue="s10" />
          </div>
        );
      }
      const { rerender } = render(<Later open={false} />);
      await frames(2);
      rerender(<Later open />);
      const list = screen.getByRole('tablist');
      await waitFor(() => {
        const box = tab(10).getBoundingClientRect();
        const room = clear(list);
        expect(box.left).toBeGreaterThanOrEqual(room.left - 1);
        expect(box.right).toBeLessThanOrEqual(room.right + 1);
      });
    });

    it('scroll a selected tab into view once tabs that arrive late hold it', async () => {
      const { rerender } = render(<Sections count={0} defaultValue="s10" />);
      await frames(2);
      rerender(<Sections defaultValue="s10" />);
      const list = screen.getByRole('tablist');
      await waitFor(() => {
        const box = tab(10).getBoundingClientRect();
        const room = clear(list);
        expect(box.left).toBeGreaterThanOrEqual(room.left - 1);
        expect(box.right).toBeLessThanOrEqual(room.right + 1);
      });
    });

    it('scroll a selected tab into view once tabs that arrive later push it past the edge', async () => {
      function Arriving({ all }: { all: boolean }) {
        const values = all ? Array.from({ length: 12 }, (_, i) => i + 1) : [10];
        return (
          <div style={{ display: 'flex', inlineSize: 260 }}>
            <Tabs.Root defaultValue="s10">
              <Tabs.List aria-label="Sections">
                {values.map((n) => (
                  <Tabs.Tab key={n} value={`s${n}`}>
                    Section {n}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.Root>
          </div>
        );
      }
      const { rerender } = render(<Arriving all={false} />);
      await frames(2);
      rerender(<Arriving all />);
      const list = screen.getByRole('tablist');
      await waitFor(() => {
        const box = tab(10).getBoundingClientRect();
        const room = clear(list);
        expect(box.left).toBeGreaterThanOrEqual(room.left - 1);
        expect(box.right).toBeLessThanOrEqual(room.right + 1);
      });
    });

    it('leave a list the user scrolled where it is when another control joins it', async () => {
      function Growing({ extra }: { extra: boolean }) {
        return (
          <div style={{ display: 'flex', inlineSize: 260 }}>
            <Tabs.Root defaultValue="s10">
              <Tabs.List aria-label="Sections">
                {Array.from({ length: 12 }, (_, i) => (
                  <Tabs.Tab key={i} value={`s${i + 1}`}>
                    Section {i + 1}
                  </Tabs.Tab>
                ))}
                {extra && <Button.Root>Add</Button.Root>}
              </Tabs.List>
            </Tabs.Root>
          </div>
        );
      }
      const { rerender } = render(<Growing extra={false} />);
      const list = screen.getByRole('tablist');
      await waitFor(() => expect(shownEdges(list)).toContain('inline-start'));
      await frames(2);
      list.scrollLeft = 0;
      await frames(2);
      rerender(<Growing extra />);
      await frames(3);
      expect(list.scrollLeft).toBe(0);
    });

    it('keep the whole ring of another control in the list, such as an add button', async () => {
      render(
        <div style={{ display: 'flex', inlineSize: 260 }}>
          <Tabs.Root defaultValue="s1">
            <Tabs.List aria-label="Sections">
              {Array.from({ length: 8 }, (_, i) => (
                <Tabs.Tab key={i} value={`s${i + 1}`}>
                  Section {i + 1}
                </Tabs.Tab>
              ))}
              <Button.Root>Add</Button.Root>
            </Tabs.List>
          </Tabs.Root>
        </div>,
      );
      const list = screen.getByRole('tablist');
      tab(1).focus();
      await userEvent.keyboard('{End}');
      await userEvent.tab();
      const add = screen.getByRole('button', { name: 'Add' });
      expect(document.activeElement).toBe(add);
      await frames(2);
      const style = getComputedStyle(add);
      const reach = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
      const box = add.getBoundingClientRect();
      const port = list.getBoundingClientRect();
      const top = port.top + list.clientTop;
      const left = port.left + list.clientLeft;
      expect(box.top - reach).toBeGreaterThanOrEqual(top - 0.5);
      expect(box.bottom + reach).toBeLessThanOrEqual(top + list.clientHeight + 0.5);
      expect(box.left - reach).toBeGreaterThanOrEqual(left - 0.5);
      expect(box.right + reach).toBeLessThanOrEqual(left + list.clientWidth + 0.5);
    });

    it('scroll a selected tab into view in a popover that grows in', async () => {
      function InPopover() {
        const popover = usePopover();
        return (
          <>
            <Button.Root {...popover.getTriggerProps()}>Sections</Button.Root>
            <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Sections" style={{ inlineSize: 260 }}>
              <Sections defaultValue="s10" inlineSize={240} />
            </Popover.Root>
          </>
        );
      }
      render(<InPopover />);
      await userEvent.click(screen.getByRole('button', { name: 'Sections' }));
      await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
      await frames(2);
      const list = screen.getByRole('tablist');
      const box = tab(10).getBoundingClientRect();
      const room = clear(list);
      expect(box.left).toBeGreaterThanOrEqual(room.left - 1);
      expect(box.right).toBeLessThanOrEqual(room.right + 1);
    });

    it('show none on a vertical list', async () => {
      render(
        <Tabs.Root defaultValue="a" orientation="vertical">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">Alpha</Tabs.Tab>
            <Tabs.Tab value="b">Beta</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
          <Tabs.Panel value="b">Beta panel</Tabs.Panel>
        </Tabs.Root>,
      );
      expect(screen.getByRole('tablist').querySelector('[data-edge]')).toBeNull();
    });

    it('draw the line as a border in forced colors, with the indicator whole above it', async () => {
      await emulateMedia([{ name: 'forced-colors', value: 'active' }]);
      render(<Sections />);
      const list = screen.getByRole('tablist');
      const style = getComputedStyle(list);
      expect(Number.parseFloat(style.borderBottomWidth)).toBeGreaterThan(0);
      expect(style.backgroundImage).toBe('none');
      const line = getComputedStyle(list, '::after');
      const box = list.getBoundingClientRect();
      const top = box.top + list.clientTop + Number.parseFloat(line.top);
      expect(Number.parseFloat(line.height)).toBeGreaterThan(0);
      expect(top + Number.parseFloat(line.height)).toBeLessThanOrEqual(box.top + list.clientTop + list.clientHeight + 0.5);
      // The bands reach down to the border.
      await waitFor(() => expect(shownEdges(list)).toEqual(['inline-end']));
      expect(Math.abs(edge(list, 'inline-end').getBoundingClientRect().bottom - (box.top + list.clientTop + list.clientHeight))).toBeLessThanOrEqual(1);
    });

    it('show the start of a selected tab wider than the room, clear of the start arrow', async () => {
      render(
        <div style={{ display: 'flex', inlineSize: 200 }}>
          <Tabs.Root defaultValue="wide">
            <Tabs.List aria-label="Sections">
              {['One', 'Two', 'Three', 'Four'].map((name) => (
                <Tabs.Tab key={name} value={name}>
                  {name}
                </Tabs.Tab>
              ))}
              <Tabs.Tab value="wide">A selected tab whose name runs far past the list</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        </div>,
      );
      const list = screen.getByRole('tablist');
      const wide = screen.getByRole('tab', { name: /far past/ });
      await waitFor(() => expect(shownEdges(list)).toContain('inline-start'));
      await frames(2);
      expect(wide.getBoundingClientRect().left).toBeGreaterThanOrEqual(edge(list, 'inline-start').getBoundingClientRect().right - 1);
    });
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

    it('move a row that takes keyboard focus under an arrow clear of it, even where the browser leaves it', async () => {
      render(<Long />);
      await userEvent.click(screen.getByRole('button', { name: 'Fonts' }));
      const menu = screen.getByTestId('menu');
      await waitFor(() => expect(shownEdges(menu)).toEqual(['block-end']));
      await settled();
      await userEvent.keyboard('{ArrowDown}');
      const band = edge(menu, 'block-end').getBoundingClientRect();
      // The first row whose bottom sits under the band, though inside the scrollport.
      const port = menu.getBoundingClientRect().top + menu.clientTop + menu.clientHeight;
      const under = screen.getAllByRole('menuitem').find((item) => {
        const box = item.getBoundingClientRect();
        return box.bottom > band.top + 0.5 && box.bottom <= port;
      });
      expect(under).toBeDefined();
      // Focus that doesn't scroll, as Firefox's own reveal leaves such a row.
      under!.focus({ preventScroll: true });
      expect(under!.matches(':focus-visible')).toBe(true);
      expect(under!.getBoundingClientRect().bottom).toBeLessThanOrEqual(edge(menu, 'block-end').getBoundingClientRect().top + 0.5);
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
