import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import type { CSSProperties } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox, ScrollArea, Splitter, type SplitterRootProps } from '../index.js';
import { getTabbables } from '../overlay/tabbables.js';

const probes: HTMLElement[] = [];

afterEach(() => {
  cleanup();
  for (const probe of probes.splice(0)) probe.remove();
});

/** A 2px square centered on a page point, for a real drag to end on. */
function probeAt(x: number, y: number): HTMLElement {
  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;inset-inline-start:${x - 1}px;inset-block-start:${y - 1}px;inline-size:2px;block-size:2px`;
  document.body.append(probe);
  probes.push(probe);
  return probe;
}

type LayoutProps = SplitterRootProps & {
  width?: number | string;
  height?: number | string;
  dir?: 'rtl';
};

function Layout({ width = 600, height = 200, dir, style, ...props }: LayoutProps) {
  return (
    <div data-testid="host" dir={dir} style={{ inlineSize: width, blockSize: height }}>
      <Splitter.Root data-testid="root" {...props} style={{ blockSize: '100%', ...style }}>
        <Splitter.Panel data-testid="first">
          <h2 id="nav">Navigation</h2>
          <button type="button">Inside</button>
        </Splitter.Panel>
        <Splitter.Handle aria-labelledby="nav" />
        <Splitter.Panel data-testid="second">Main</Splitter.Panel>
      </Splitter.Root>
    </div>
  );
}

const handle = () => screen.getByRole('separator');
const now = () => Number(handle().getAttribute('aria-valuenow'));
const box = (id: string) => screen.getByTestId(id).getBoundingClientRect();
// A 20px track, so the press at its center lands 10px past the panel's edge.
const WIDE = { '--todae-splitter-handle-target': '20px' } as CSSProperties;

describe('Splitter with one panel shown', () => {
  it('lays the shown panel across the root and keeps both panels mounted', async () => {
    const { rerender } = render(<Layout defaultValue={200} />);
    const [first, second] = [screen.getByTestId('first'), screen.getByTestId('second')];
    rerender(<Layout defaultValue={200} show="end" />);
    const host = box('host');
    expect(box('second').left).toBe(host.left);
    expect(box('second').width).toBe(host.width);
    expect(box('second').height).toBe(host.height);
    expect(getComputedStyle(screen.getByTestId('first')).display).toBe('none');
    expect(screen.queryByRole('separator')).toBeNull();
    expect(getTabbables(document.body)).toEqual([]);

    rerender(<Layout defaultValue={200} show="start" />);
    expect(box('first').width).toBe(host.width);
    expect(getComputedStyle(screen.getByTestId('second')).display).toBe('none');
    expect(getTabbables(document.body).map((el) => el.textContent)).toEqual(['Inside']);

    rerender(<Layout defaultValue={200} />);
    await waitFor(() => expect(box('first').width).toBe(200));
    expect(now()).toBe(200);
    expect([screen.getByTestId('first'), screen.getByTestId('second')]).toEqual([first, second]);
  });

  it('keeps the shown panel\'s scroll position', async () => {
    const Tall = ({ show }: { show?: 'start' | 'end' }) => (
      <div style={{ inlineSize: 600, blockSize: 200 }}>
        <Splitter.Root show={show} defaultValue={200} style={{ blockSize: '100%' }}>
          <Splitter.Panel data-testid="first">
            <div style={{ blockSize: 1000 }} />
          </Splitter.Panel>
          <Splitter.Handle aria-label="Resize" />
          <Splitter.Panel data-testid="second">
            <div style={{ blockSize: 1000 }} />
          </Splitter.Panel>
        </Splitter.Root>
      </div>
    );
    const { rerender } = render(<Tall />);
    const [first, second] = [screen.getByTestId('first'), screen.getByTestId('second')];
    second.scrollTop = 100;
    rerender(<Tall show="end" />);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(getComputedStyle(first).display).toBe('none');
    expect(second.scrollTop).toBe(100);
    rerender(<Tall />);
    await waitFor(() => expect(first.getBoundingClientRect().width).toBe(200));
    expect(second.scrollTop).toBe(100);
  });

  it('shows a stacked root\'s panel down its whole height', () => {
    render(<Layout orientation="vertical" defaultValue={60} primary="end" show="start" />);
    expect(box('first').height).toBe(box('host').height);
  });
});

describe('Splitter dragging', () => {
  it('keeps the handle under the pointer inside a scaled ancestor', async () => {
    render(
      <div style={{ transform: 'scale(0.5)', transformOrigin: '0 0' }}>
        <Layout defaultValue={200} style={WIDE} />
      </div>,
    );
    const host = screen.getByTestId('host').getBoundingClientRect();
    // The handle's middle is at 210 layout pixels, 105 on screen; 70 more on screen is 140 in layout.
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 175, host.top + 50));
    expect(now()).toBe(340);
  });

  it('follows the pointer and keeps where the handle was pressed', async () => {
    render(<Layout defaultValue={200} style={WIDE} />);
    const host = screen.getByTestId('host').getBoundingClientRect();
    // The press lands in the middle of the 20px handle, 10px past the panel's edge.
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 350, host.top + 100));
    expect(now()).toBe(340);
    expect(box('first').width).toBe(340);
    expect(box('second').left).toBeCloseTo(host.left + 340 + 20, 0);
    expect(screen.getByTestId('root').hasAttribute('data-dragging')).toBe(false);
  });

  it('marks the root while the pointer is down and focuses the handle', async () => {
    render(<Layout defaultValue={200} />);
    const root = screen.getByTestId('root');
    let sawDragging = false;
    const watch = new MutationObserver(() => {
      sawDragging ||= root.hasAttribute('data-dragging');
    });
    watch.observe(root, {
      attributes: true,
      attributeFilter: ['data-dragging'],
    });
    const host = screen.getByTestId('host').getBoundingClientRect();
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 300, host.top + 100));
    watch.disconnect();
    expect(sawDragging).toBe(true);
    expect(root.hasAttribute('data-dragging')).toBe(false);
    expect(document.activeElement).toBe(handle());
  });

  it('reports each move and stops inside min and max', async () => {
    const seen: number[] = [];
    render(<Layout defaultValue={200} min={150} max={400} onValueChange={(v) => seen.push(v)} />);
    const host = screen.getByTestId('host').getBoundingClientRect();
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 590, host.top + 100));
    expect(now()).toBe(400);
    expect(Math.max(...seen)).toBe(400);
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 20, host.top + 100));
    expect(now()).toBe(150);
    expect(Math.min(...seen)).toBe(150);
  });

  it('snaps a collapsible panel shut below half of min and opens it to min', async () => {
    render(<Layout defaultValue={200} min={150} collapsible />);
    const host = screen.getByTestId('host').getBoundingClientRect();
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 60, host.top + 100));
    expect(now()).toBe(0);
    expect(screen.getByTestId('root').getAttribute('data-empty')).toBe('start');
    expect(getComputedStyle(screen.getByTestId('first')).visibility).toBe('hidden');
    expect(box('first').width).toBe(0);
    expect(box('second').width).toBeGreaterThan(570);
    // Between half of min and min the panel holds at min.
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 100, host.top + 100));
    expect(now()).toBe(150);
    expect(screen.getByTestId('root').hasAttribute('data-empty')).toBe(false);
    expect(getComputedStyle(screen.getByTestId('first')).visibility).toBe('visible');
  });

  it('resizes a panel at the end from the far edge', async () => {
    render(<Layout defaultValue={200} primary="end" style={WIDE} />);
    const host = screen.getByTestId('host').getBoundingClientRect();
    // Pressed 10px into the 20px handle, so the panel ends 10px short of the pointer.
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 300, host.top + 100));
    expect(now()).toBe(290);
    expect(box('second').width).toBe(290);
  });

  it('grows a first panel on the right when the pointer moves left in right-to-left text', async () => {
    render(<Layout defaultValue={200} dir="rtl" style={WIDE} />);
    const host = screen.getByTestId('host').getBoundingClientRect();
    expect(box('first').right).toBeCloseTo(host.right, 0);
    await userEvent.dragAndDrop(handle(), probeAt(host.right - 300, host.top + 100));
    expect(now()).toBe(290);
    expect(box('first').width).toBe(290);
  });

  it('resizes stacked panels along the vertical axis', async () => {
    render(<Layout orientation="vertical" defaultValue={100} width={300} height={400} style={WIDE} />);
    const host = screen.getByTestId('host').getBoundingClientRect();
    expect(handle().getAttribute('aria-orientation')).toBe('horizontal');
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 150, host.top + 250));
    expect(now()).toBe(240);
    expect(box('first').height).toBe(240);
    expect(box('first').width).toBe(300);
    expect(box('second').height).toBeCloseTo(400 - 240 - 20, 0);
  });
});

describe('Splitter layout', () => {
  it('keeps both panels inside a container narrower than the size', async () => {
    const { rerender } = render(<Layout value={400} width={150} />);
    const host = screen.getByTestId('host').getBoundingClientRect();
    expect(box('first').right).toBeLessThanOrEqual(host.right + 0.5);
    expect(box('second').right).toBeLessThanOrEqual(host.right + 0.5);
    expect(box('first').width).toBeLessThanOrEqual(150);
    await waitFor(() => expect(now()).toBeLessThanOrEqual(150));
    // The size is pixels: a roomy container shows it again.
    rerender(<Layout value={400} width={800} />);
    await waitFor(() => expect(box('first').width).toBe(400));
    expect(box('second').width).toBeGreaterThan(370);
  });

  it('shows the width it draws when the container is narrower than min', async () => {
    render(<Layout defaultValue={200} min={100} width={60} />);
    await waitFor(() => expect(now()).toBe(36));
    expect(box('first').width).toBeCloseTo(36, 0);
    expect(handle().getAttribute('aria-valuemin')).toBe('36');
    expect(handle().getAttribute('aria-valuemax')).toBe('36');
  });

  it('keeps both panels inside a root with padding', async () => {
    render(<Layout defaultValue={200} style={{ padding: 20 }} />);
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('536'));
    await userEvent.click(handle());
    await userEvent.keyboard('{End}');
    const root = screen.getByTestId('root').getBoundingClientRect();
    expect(box('second').right).toBeLessThanOrEqual(root.right - 20 + 0.5);
    expect(box('first').width + handle().getBoundingClientRect().width + box('second').width).toBeCloseTo(560, 0);
  });

  it('does not widen the page when the handle sits at the edge of the viewport', () => {
    render(<Layout value={0} collapsible width="100vw" primary="end" />);
    const page = document.scrollingElement!;
    expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
  });

  it('gives the container as the largest size', async () => {
    render(<Layout defaultValue={200} width={500} />);
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('476'));
    await userEvent.click(handle());
    await userEvent.keyboard('{End}');
    expect(now()).toBe(476);
    expect(box('first').width + box('second').width + handle().getBoundingClientRect().width).toBeCloseTo(500, 0);
  });

  it('measures the room in fractions, as the sheet draws it', async () => {
    const { rerender } = render(<Layout value={900} width={500.6} />);
    // 500.6 less the 24px track: a rounded client width would say 477.
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('476'));
    // Whole pixels: the 0.6px left of the other panel counts as none.
    expect(box('first').width).toBe(476);
    expect(getComputedStyle(screen.getByTestId('second')).visibility).toBe('hidden');
    // Under a pixel of the other panel is none.
    rerender(<Layout value={476.2} width={500.6} />);
    await waitFor(() => expect(getComputedStyle(screen.getByTestId('second')).visibility).toBe('hidden'));
    expect(box('second').width).toBeLessThan(1);
    expect(screen.getByTestId('root').getAttribute('data-empty')).toBe('end');
    rerender(<Layout value={470} width={500.6} />);
    await waitFor(() => expect(getComputedStyle(screen.getByTestId('second')).visibility).toBe('visible'));
  });

  it('measures the room again when the handle track changes size on its own', async () => {
    const { rerender } = render(<Layout defaultValue={200} width={500} />);
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('476'));
    rerender(
      <Layout defaultValue={200} width={500} style={{ '--todae-splitter-handle-target': '40px' } as CSSProperties} />,
    );
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('460'));
  });

  it('measures a handle that remounts', async () => {
    function Remount({ handleKey, width }: { handleKey: string; width: number }) {
      return (
        <div style={{ inlineSize: width, blockSize: 200 }}>
          <Splitter.Root defaultValue={200} style={{ blockSize: '100%' }}>
            <Splitter.Panel>Navigation</Splitter.Panel>
            <Splitter.Handle key={handleKey} aria-label="Resize" />
            <Splitter.Panel>Main</Splitter.Panel>
          </Splitter.Root>
        </div>
      );
    }
    const { rerender } = render(<Remount handleKey="a" width={600} />);
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('576'));
    rerender(<Remount handleKey="b" width={600} />);
    rerender(<Remount handleKey="b" width={500} />);
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('476'));
  });

  it('measures the room in layout pixels under a scaled ancestor', async () => {
    render(
      <div style={{ transform: 'scale(0.5)', transformOrigin: '0 0' }}>
        <Layout defaultValue={200} width={600} />
      </div>,
    );
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('576'));
  });

  it('gives whole pixels on End in a fractional room and hides the sliver left', async () => {
    const sizes: number[] = [];
    render(<Layout defaultValue={200} width={500.6} onValueChange={(next) => sizes.push(next)} />);
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('476'));
    await userEvent.click(handle());
    await userEvent.keyboard('{End}');
    expect(sizes).toEqual([476]);
    await waitFor(() => expect(getComputedStyle(screen.getByTestId('second')).visibility).toBe('hidden'));
  });

  it('keeps the other panel flexible when the container resizes', async () => {
    const { rerender } = render(<Layout defaultValue={200} width={600} />);
    expect(box('first').width).toBe(200);
    rerender(<Layout defaultValue={200} width={900} />);
    await waitFor(() => expect(box('second').width).toBeGreaterThan(670));
    expect(box('first').width).toBe(200);
  });
});

describe('Splitter panels', () => {
  it('scroll their own overflow, and hold a ScrollArea that fills them', () => {
    render(
      <div style={{ inlineSize: 600, blockSize: 200 }}>
        <Splitter.Root defaultValue={200} style={{ blockSize: '100%' }}>
          <Splitter.Panel data-testid="plain">
            <div style={{ blockSize: 600 }}>Tall</div>
          </Splitter.Panel>
          <Splitter.Handle aria-label="Resize" />
          <Splitter.Panel data-testid="scrolled">
            <ScrollArea.Root data-testid="area" style={{ blockSize: '100%' }}>
              <div style={{ blockSize: 600 }}>Tall</div>
            </ScrollArea.Root>
          </Splitter.Panel>
        </Splitter.Root>
      </div>,
    );
    const plain = screen.getByTestId('plain');
    expect(plain.getBoundingClientRect().height).toBe(200);
    expect(plain.scrollHeight).toBeGreaterThan(plain.clientHeight);
    const panel = screen.getByTestId('scrolled');
    const area = screen.getByTestId('area');
    expect(panel.getBoundingClientRect().height).toBe(200);
    expect(area.getBoundingClientRect().height).toBe(200);
    expect(area.scrollHeight).toBeGreaterThan(area.clientHeight);
    expect(panel.scrollHeight).toBe(panel.clientHeight);
  });
});

describe('Splitter focus', () => {
  it('is one tab stop between the controls around it, and keys move it', async () => {
    render(
      <>
        <button type="button">Before</button>
        <Layout defaultValue={200} min={100} />
        <button type="button">After</button>
      </>,
    );
    const root = screen.getByTestId('root');
    const inside = screen.getByRole('button', { name: 'Inside' });
    expect(getTabbables(root)).toEqual([inside, handle()]);
    screen.getByRole('button', { name: 'Before' }).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(inside);
    await userEvent.tab();
    expect(document.activeElement).toBe(handle());
    await userEvent.keyboard('{ArrowRight}');
    expect(now()).toBe(216);
    expect(box('first').width).toBe(216);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
  });

  it('takes the controls of a collapsed panel out of the tab order and the accessibility tree', async () => {
    render(
      <>
        <Layout defaultValue={200} min={100} collapsible />
        <button type="button">After</button>
      </>,
    );
    const root = screen.getByTestId('root');
    handle().focus();
    await userEvent.keyboard('{Enter}');
    expect(now()).toBe(0);
    expect(getTabbables(root)).toEqual([handle()]);
    expect(screen.queryByRole('button', { name: 'Inside' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Navigation' })).toBeNull();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    // Restored, the panel's controls come back.
    handle().focus();
    await userEvent.keyboard('{Enter}');
    expect(now()).toBe(200);
    expect(getTabbables(root)).toEqual([screen.getByRole('button', { name: 'Inside' }), handle()]);
    screen.getByRole('button', { name: 'After' }).focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(handle());
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inside' }));
  });

  it('names the handle from the heading it points at', () => {
    render(<Layout defaultValue={200} />);
    expect(screen.getByRole('separator', { name: 'Navigation' })).toBeTruthy();
  });

  it('uses the arrow keys by physical direction in right-to-left text', async () => {
    render(<Layout defaultValue={200} dir="rtl" />);
    handle().focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(now()).toBe(216);
    expect(box('first').width).toBe(216);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(now()).toBe(184);
  });

  it('shows a ring around the whole track when the keyboard focuses the handle', async () => {
    render(<Layout defaultValue={200} />);
    expect(getComputedStyle(handle()).outlineStyle).toBe('none');
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(handle());
    const ring = getComputedStyle(handle());
    expect(ring.outlineStyle).toBe('solid');
    expect(Number.parseFloat(ring.outlineWidth)).toBeGreaterThan(0);
    // Inside the track, so nothing clips it.
    expect(Number.parseFloat(ring.outlineOffset)).toBeLessThan(0);
  });

  it.each([
    ['at the start edge', '{Home}', 0],
    ['at the room', '{End}', 376],
    ['at room - 16', '{End}{ArrowLeft}', 360],
  ])('keeps the focus ring whole %s', async (_name, keys, size) => {
    render(<Layout defaultValue={200} width={400} />);
    handle().focus();
    await userEvent.keyboard(keys);
    await waitFor(() => expect(now()).toBe(size));
    const root = screen.getByTestId('root').getBoundingClientRect();
    const track = handle().getBoundingClientRect();
    const ring = getComputedStyle(handle());
    expect(ring.outlineStyle).toBe('solid');
    // Drawn inside the track, which lies inside the root.
    expect(Number.parseFloat(ring.outlineOffset)).toBeLessThanOrEqual(-Number.parseFloat(ring.outlineWidth));
    expect(track.left).toBeGreaterThanOrEqual(root.left - 0.5);
    expect(track.right).toBeLessThanOrEqual(root.right + 0.5);
  });

  it('has a track as wide as its token by default, with a thin line drawn in its middle', () => {
    render(<Layout defaultValue={200} />);
    const probe = document.createElement('div');
    probe.style.inlineSize = 'var(--todae-splitter-handle-target)';
    document.body.append(probe);
    probes.push(probe);
    const target = probe.getBoundingClientRect().width;
    expect(target).toBeGreaterThanOrEqual(24);
    const track = handle().getBoundingClientRect();
    expect(track.width).toBe(target);
    expect(box('second').left).toBeCloseTo(track.right, 0);
    expect(box('first').right).toBeCloseTo(track.left, 0);
    const line = getComputedStyle(handle(), '::before');
    expect(Number.parseFloat(line.width)).toBe(1);
    expect(line.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(handle()).touchAction).toBe('none');
  });

  it.each([
    ['the first panel at 0, not collapsible', { value: 0 }, 'first', 'second'],
    ['the first panel at 0, collapsible', { value: 0, collapsible: true }, 'first', 'second'],
    ['the last panel at 0, collapsible', { value: 0, collapsible: true, primary: 'end' as const }, 'second', 'first'],
    ['the last panel at 0, not collapsible', { value: 0, primary: 'end' as const }, 'second', 'first'],
    ['the other panel when the first fills the room', { value: 900, width: 400 }, 'second', 'first'],
    [
      'the first panel when the last fills the room',
      { value: 900, width: 400, primary: 'end' as const },
      'first',
      'second',
    ],
  ])('hides %s, and only that one', async (_name, props, hidden, shown) => {
    render(<Layout {...props} />);
    await waitFor(() => expect(getComputedStyle(screen.getByTestId(hidden)).visibility).toBe('hidden'));
    expect(getComputedStyle(screen.getByTestId(shown)).visibility).toBe('visible');
    expect(box(hidden).width).toBe(0);
  });

  it('takes the controls of a panel at the full room out of the tab order', async () => {
    render(
      <Splitter.Root data-testid="root" value={900} style={{ inlineSize: 400 }}>
        <Splitter.Panel>Main</Splitter.Panel>
        <Splitter.Handle aria-label="Resize" />
        <Splitter.Panel>
          <button type="button">Hidden</button>
        </Splitter.Panel>
      </Splitter.Root>,
    );
    await waitFor(() => expect(getTabbables(screen.getByTestId('root'))).toEqual([handle()]));
  });

  it('moves focus from a panel that empties to the handle, also the last one, without scrolling the page', () => {
    const last = (value: number) => (
      <Splitter.Root data-testid="root" value={value} primary="end" style={{ inlineSize: 400 }}>
        <Splitter.Panel>Main</Splitter.Panel>
        <Splitter.Handle aria-label="Resize" />
        <Splitter.Panel>
          <button type="button">Late</button>
        </Splitter.Panel>
      </Splitter.Root>
    );
    const { rerender } = render(last(200));
    screen.getByRole('button', { name: 'Late' }).focus();
    rerender(last(0));
    expect(document.activeElement).toBe(handle());
    expect(document.scrollingElement?.scrollTop).toBe(0);
  });

  it('moves focus from a panel that collapses to the handle, without scrolling the page', async () => {
    const { rerender } = render(<Layout value={200} collapsible />);
    screen.getByRole('button', { name: 'Inside' }).focus();
    rerender(<Layout value={0} collapsible />);
    expect(document.activeElement).toBe(handle());
    expect(document.scrollingElement?.scrollTop).toBe(0);
  });
});

describe('Splitter hit area', () => {
  /** What a press `offset` px past the track's start edge reaches (negative: the panel before it), and whether it starts a drag. */
  async function pressAt(offset: number, vertical = false) {
    const track = handle().getBoundingClientRect();
    const x = vertical ? track.left + track.width / 2 : track.left + offset;
    const y = vertical ? track.top + offset : track.top + track.height / 2;
    const target = document.elementFromPoint(x, y);
    let dragging = false;
    if (target === handle()) {
      // A made-up pointer id has nothing to capture.
      handle().setPointerCapture = () => undefined;
      handle().dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          isPrimary: true,
          pointerId: 7,
          clientX: x,
          clientY: y,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve));
      dragging = screen.getByTestId('root').hasAttribute('data-dragging');
      handle().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    }
    return { target, dragging };
  }

  it('is the handle track: a press 2px into either panel next to it does not start a drag', async () => {
    render(<Layout defaultValue={200} />);
    const before = await pressAt(-2);
    expect(screen.getByTestId('first').contains(before.target)).toBe(true);
    expect(before.dragging).toBe(false);
    const after = await pressAt(26);
    expect(screen.getByTestId('second').contains(after.target)).toBe(true);
    expect(after.dragging).toBe(false);
  });

  it('is the whole track, from its first pixel to its last', async () => {
    render(<Layout defaultValue={200} />);
    for (const offset of [0.5, 1, 12, 23, 23.5]) expect((await pressAt(offset)).dragging).toBe(true);
  });

  it('lays the panels out against the track, so nothing of it covers a panel', () => {
    render(
      <Splitter.Root data-testid="root" defaultValue={200} style={{ inlineSize: 600, blockSize: 200 }}>
        <Splitter.Panel data-testid="first">
          <div style={{ blockSize: 600 }}>Tall</div>
        </Splitter.Panel>
        <Splitter.Handle aria-label="Resize" />
        <Splitter.Panel data-testid="second">
          <button type="button" style={{ inlineSize: '100%' }}>
            Edge
          </button>
        </Splitter.Panel>
      </Splitter.Root>,
    );
    const track = handle().getBoundingClientRect();
    expect(box('first').right).toBeCloseTo(track.left, 0);
    expect(screen.getByTestId('first').contains(document.elementFromPoint(track.left - 1, track.top + 40))).toBe(true);
    const edge = screen.getByRole('button', { name: 'Edge' });
    expect(edge.getBoundingClientRect().left).toBeCloseTo(track.right, 0);
    const at = edge.getBoundingClientRect();
    expect(document.elementFromPoint(track.right + 1, at.top + at.height / 2)).toBe(edge);
  });

  it('is the same in right-to-left text, vertical, and for a panel at the end', async () => {
    const { rerender } = render(<Layout defaultValue={200} dir="rtl" />);
    expect((await pressAt(12)).dragging).toBe(true);
    expect((await pressAt(-2)).dragging).toBe(false);
    rerender(<Layout defaultValue={200} primary="end" />);
    expect((await pressAt(12)).dragging).toBe(true);
    expect((await pressAt(26)).dragging).toBe(false);
    rerender(<Layout orientation="vertical" defaultValue={100} width={300} height={300} />);
    expect((await pressAt(12, true)).dragging).toBe(true);
    expect((await pressAt(-2, true)).dragging).toBe(false);
    expect((await pressAt(26, true)).dragging).toBe(false);
  });

  it('stays inside the root when the panel fills the room or is empty', async () => {
    const { rerender } = render(<Layout value={900} width={400} />);
    await waitFor(() => expect(box('second').width).toBe(0));
    const root = () => screen.getByTestId('root').getBoundingClientRect();
    expect(handle().getBoundingClientRect().right).toBeLessThanOrEqual(root().right + 0.5);
    rerender(<Layout value={0} primary="end" width={400} />);
    expect(handle().getBoundingClientRect().left).toBeGreaterThanOrEqual(root().left - 0.5);
    expect(handle().getBoundingClientRect().right).toBeLessThanOrEqual(root().right + 0.5);
  });
});

describe('Splitter panels with controls', () => {
  it('scroll a focused control into view with its ring whole, also when the ring is on another element', async () => {
    render(
      <>
        <div style={{ inlineSize: 400, blockSize: 120 }}>
          <Splitter.Root defaultValue={200} style={{ blockSize: '100%' }}>
            <Splitter.Panel data-testid="scrolled">
              <div style={{ blockSize: 400 }}>Tall</div>
              <Checkbox.Root>Archived</Checkbox.Root>
              <div style={{ blockSize: 200 }} />
            </Splitter.Panel>
            <Splitter.Handle aria-label="Resize" />
            <Splitter.Panel>Main</Splitter.Panel>
          </Splitter.Root>
        </div>
      </>,
    );
    const panel = screen.getByTestId('scrolled');
    const box = screen.getByRole('checkbox', { name: 'Archived' });
    // The checkbox's own box ends a pixel inside the bottom edge: wholly in view, so the browser's own
    // scroll-into-view leaves the panel alone and only the ring reveal can bring the ring in.
    const view = panel.getBoundingClientRect();
    panel.scrollTop += box.getBoundingClientRect().bottom - (view.top + panel.clientHeight - 1);
    const before = panel.scrollTop;
    // The browser's own scroll is held back, as revealRing's tests do, so only the panel's reveal can move it.
    await userEvent.keyboard('{Shift}');
    box.focus({ preventScroll: true });
    expect(document.activeElement).toBe(box);
    const indicator = box.nextElementSibling as HTMLElement;
    const ring = getComputedStyle(indicator);
    expect(ring.outlineStyle).not.toBe('none');
    const room = Number.parseFloat(ring.outlineWidth) + Number.parseFloat(ring.outlineOffset);
    expect(room).toBeGreaterThan(0);
    expect(panel.scrollTop).toBeGreaterThan(before);
    expect(indicator.getBoundingClientRect().bottom + room).toBeLessThanOrEqual(view.top + panel.clientHeight + 1);
    expect(Number.parseFloat(getComputedStyle(panel).scrollPaddingBottom)).toBeGreaterThanOrEqual(room);
  });
});
