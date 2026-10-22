import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import type { CSSProperties } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScrollArea, Splitter, type SplitterRootProps } from '../index.js';
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

type LayoutProps = SplitterRootProps & { width?: number | string; height?: number | string; dir?: 'rtl' };

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
// A wide handle so a press lands well inside it, away from its near edge.
const WIDE = { '--todae-splitter-handle-size': '20px' } as CSSProperties;

describe('Splitter dragging', () => {
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
    watch.observe(root, { attributes: true, attributeFilter: ['data-dragging'] });
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
    expect(screen.getByTestId('root').hasAttribute('data-collapsed')).toBe(true);
    expect(getComputedStyle(screen.getByTestId('first')).visibility).toBe('hidden');
    expect(box('first').width).toBe(0);
    expect(box('second').width).toBeGreaterThan(590);
    // Between half of min and min the panel holds at min.
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 100, host.top + 100));
    expect(now()).toBe(150);
    expect(screen.getByTestId('root').hasAttribute('data-collapsed')).toBe(false);
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
    expect(box('second').width).toBeGreaterThan(390);
  });

  it('shows the width it draws when the container is narrower than min', async () => {
    render(<Layout defaultValue={200} min={100} width={60} />);
    await waitFor(() => expect(now()).toBe(59));
    expect(box('first').width).toBeCloseTo(59, 0);
    expect(handle().getAttribute('aria-valuemin')).toBe('59');
    expect(handle().getAttribute('aria-valuemax')).toBe('59');
  });

  it('keeps both panels inside a root with padding', async () => {
    render(<Layout defaultValue={200} style={{ padding: 20 }} />);
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('559'));
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
    await waitFor(() => expect(handle().getAttribute('aria-valuemax')).toBe('499'));
    await userEvent.click(handle());
    await userEvent.keyboard('{End}');
    expect(now()).toBe(499);
    expect(box('first').width + box('second').width + handle().getBoundingClientRect().width).toBeCloseTo(500, 0);
  });

  it('keeps the other panel flexible when the container resizes', async () => {
    const { rerender } = render(<Layout defaultValue={200} width={600} />);
    expect(box('first').width).toBe(200);
    rerender(<Layout defaultValue={200} width={900} />);
    await waitFor(() => expect(box('second').width).toBeGreaterThan(690));
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

  it('shows a ring when the keyboard focuses the handle, also with the panel collapsed at the edge', async () => {
    render(<Layout value={0} collapsible />);
    const ring = () => getComputedStyle(handle(), '::before').outlineStyle;
    expect(ring()).toBe('none');
    await userEvent.tab();
    expect(document.activeElement).toBe(handle());
    expect(ring()).toBe('solid');
    expect(Number.parseFloat(getComputedStyle(handle(), '::before').outlineWidth)).toBeGreaterThan(0);
  });

  it('has a hit area at least 24px across around a thin line', () => {
    render(<Layout defaultValue={200} />);
    const line = handle().getBoundingClientRect();
    expect(line.width).toBeLessThan(4);
    const target = getComputedStyle(handle(), '::before');
    expect(Number.parseFloat(target.width)).toBeGreaterThanOrEqual(24);
    expect(getComputedStyle(handle()).touchAction).toBe('none');
  });

  it('hides the collapsed panel at the end, and not the one beside it', () => {
    render(<Layout value={0} collapsible primary="end" />);
    expect(getComputedStyle(screen.getByTestId('second')).visibility).toBe('hidden');
    expect(getComputedStyle(screen.getByTestId('first')).visibility).toBe('visible');
  });

  it('does not hide a panel at size 0 that is not collapsible', () => {
    render(<Layout value={0} />);
    expect(getComputedStyle(screen.getByTestId('first')).visibility).toBe('visible');
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
  /** What a pointer at `offset` px past the handle's line reaches, along the axis. */
  const hit = (offset: number, vertical = false) => {
    const line = handle().getBoundingClientRect();
    return vertical
      ? document.elementFromPoint(line.left + line.width / 2, line.top + offset)
      : document.elementFromPoint(line.left + offset, line.top + line.height / 2);
  };

  it('reaches over the panel after the line and leaves the scrollbar of the panel before it alone', () => {
    render(<Layout defaultValue={200} />);
    expect(hit(10)).toBe(handle());
    expect(hit(-6)).not.toBe(handle());
    expect(screen.getByTestId('first').contains(hit(-6))).toBe(true);
  });

  it('is the same in right-to-left text, where the end side is on the left', () => {
    render(<Layout defaultValue={200} dir="rtl" />);
    expect(hit(-10)).toBe(handle());
    expect(hit(6)).not.toBe(handle());
  });

  it('reaches toward the start where a panel at the end is collapsed at the edge', () => {
    render(<Layout value={0} collapsible primary="end" width={300} />);
    expect(hit(-10)).toBe(handle());
  });

  it('reaches toward the start where the first panel fills the room', async () => {
    render(<Layout value={900} width={400} />);
    await waitFor(() => expect(box('second').width).toBe(0));
    expect(hit(-10)).toBe(handle());
  });

  it('reaches toward the end below a stacked first panel, and toward the start when it fills the room', async () => {
    const { rerender } = render(<Layout orientation="vertical" defaultValue={100} width={300} height={300} />);
    expect(hit(10, true)).toBe(handle());
    expect(hit(-6, true)).not.toBe(handle());
    rerender(<Layout orientation="vertical" value={900} width={300} height={300} />);
    await waitFor(() => expect(box('second').height).toBe(0));
    expect(hit(-10, true)).toBe(handle());
  });
});

describe('Splitter panels with controls', () => {
  it('scroll a focused control into view with its ring whole', async () => {
    render(
      <>
        <button type="button">Before</button>
        <div style={{ inlineSize: 400, blockSize: 120 }}>
          <Splitter.Root defaultValue={200} style={{ blockSize: '100%' }}>
            <Splitter.Panel data-testid="scrolled">
              <div style={{ blockSize: 400 }}>Tall</div>
              <button type="button">Deep</button>
            </Splitter.Panel>
            <Splitter.Handle aria-label="Resize" />
            <Splitter.Panel>Main</Splitter.Panel>
          </Splitter.Root>
        </div>
      </>,
    );
    screen.getByRole('button', { name: 'Before' }).focus();
    await userEvent.tab();
    const deep = screen.getByRole('button', { name: 'Deep' });
    expect(document.activeElement).toBe(deep);
    const panel = screen.getByTestId('scrolled');
    const ring = getComputedStyle(deep);
    const room = Number.parseFloat(ring.outlineWidth) + Number.parseFloat(ring.outlineOffset);
    expect(room).toBeGreaterThan(0);
    const view = panel.getBoundingClientRect();
    expect(panel.scrollTop).toBeGreaterThan(0);
    expect(deep.getBoundingClientRect().bottom + room).toBeLessThanOrEqual(view.top + panel.clientHeight + 1);
    expect(Number.parseFloat(getComputedStyle(panel).scrollPaddingBottom)).toBeGreaterThanOrEqual(room);
  });
});
