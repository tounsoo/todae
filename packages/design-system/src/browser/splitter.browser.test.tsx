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
    expect(screen.getByTestId('first').hasAttribute('data-collapsed')).toBe(true);
    expect(box('first').width).toBe(0);
    expect(box('second').width).toBeGreaterThan(590);
    // Between half of min and min the panel holds at min.
    await userEvent.dragAndDrop(handle(), probeAt(host.left + 100, host.top + 100));
    expect(now()).toBe(150);
    expect(screen.getByTestId('first').hasAttribute('data-collapsed')).toBe(false);
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
    expect(handle().style.touchAction === '' && getComputedStyle(handle()).touchAction).toBe('none');
  });
});
