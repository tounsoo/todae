import { act, render, screen, waitFor } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Disclosure } from '../components/Disclosure.js';
import { Nav } from '../components/Nav.js';
import { Toast } from '../components/Toast.js';
import { createToaster } from '../components/toaster.js';
import { emulateMedia } from '../test/media.js';

// Chrome sizes to and from auto; the other engines keep showing and hiding
// the content at once, so these tests check them for that.
const sizesToAuto = CSS.supports('block-size', 'calc-size(auto, size)');

/** Slow, even motion, so a frame partway through lands well inside it. */
function slow(component: string, phases: ('enter' | 'exit')[] = ['enter', 'exit']): CSSProperties {
  const style: Record<string, string> = {};
  for (const phase of phases) {
    style[`--_todae-${component}-motion-duration-${phase}`] = '4s';
    style[`--_todae-${component}-motion-easing-${phase}`] = 'linear';
  }
  return style as CSSProperties;
}

function Themed({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div data-appearance="light" data-density="comfortable" style={style}>
      {children}
    </div>
  );
}

const frames = async (count: number) => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const height = (el: Element) => el.getBoundingClientRect().height;

/** A disclosure, and twins that show the heights it opens and closes to. */
function Disclosures({ style, open }: { style?: CSSProperties; open?: boolean }) {
  return (
    <Themed style={style}>
      <Disclosure.Root data-testid="closed">
        <Disclosure.Summary>What is Todae?</Disclosure.Summary>
        <p>A base for company design systems.</p>
      </Disclosure.Root>
      <Disclosure.Root data-testid="moving" open={open}>
        <Disclosure.Summary>What is Todae?</Disclosure.Summary>
        <p>A base for company design systems.</p>
        <p style={{ position: 'relative' }}>
          It ships no icons.
          {/* Sticks out below the content, as a product's own dropdown might. */}
          <span data-testid="sticks-out" style={{ position: 'absolute', insetBlockStart: '100%', insetInlineStart: 0, inlineSize: 40, blockSize: 40, background: 'red' }} />
        </p>
      </Disclosure.Root>
      <Disclosure.Root data-testid="reference" open>
        <Disclosure.Summary>What is Todae?</Disclosure.Summary>
        <p>A base for company design systems.</p>
        <p>It ships no icons.</p>
      </Disclosure.Root>
      <div style={{ blockSize: 200 }} />
    </Themed>
  );
}

/** Whether a press at the middle of `el` lands on it. */
function hits(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
}

afterEach(async () => {
  await emulateMedia([]);
});

describe('Disclosure content height', () => {
  it.runIf(sizesToAuto)('grows from nothing to the content height as it opens, clipped until it has grown', async () => {
    render(<Disclosures style={slow('disclosure')} />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    const closed = height(moving);
    const open = height(screen.getByTestId('reference'));
    moving.open = true;
    await frames(2);
    // No margin arrives at once: it starts from where it was.
    expect(height(moving) - closed).toBeLessThan(3);
    await wait(400);
    const partway = height(moving);
    expect(partway).toBeGreaterThan(closed + 0.5);
    expect(partway).toBeLessThan(open - 1);
    // Clipped while it grows: what sticks out of the content isn't drawn.
    expect(hits(screen.getByTestId('sticks-out'))).toBe(false);
  });

  it.runIf(sizesToAuto)('ends at the height of one that was always open, and stops clipping', async () => {
    render(<Disclosures />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    // Read closed first, so the browser has a style to move from.
    expect(height(moving)).toBeLessThan(height(screen.getByTestId('reference')));
    moving.open = true;
    // Its children's margins are inside from the first frame, so it ends where the twin sits.
    await waitFor(() => {
      expect(height(moving)).toBeCloseTo(height(screen.getByTestId('reference')), 0);
      expect(hits(screen.getByTestId('sticks-out'))).toBe(true);
    });
  });

  it.runIf(sizesToAuto)('shrinks to nothing as it closes, clipped at once', async () => {
    render(<Disclosures style={slow('disclosure')} open />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    const closed = height(screen.getByTestId('closed'));
    const open = height(moving);
    expect(open).toBeCloseTo(height(screen.getByTestId('reference')), 0);
    moving.open = false;
    await frames(2);
    // No margin leaves at once: it starts from where it was.
    expect(open - height(moving)).toBeLessThan(3);
    await wait(400);
    const partway = height(moving);
    expect(partway).toBeLessThan(open - 0.5);
    expect(partway).toBeGreaterThan(closed + 1);
    expect(hits(screen.getByTestId('sticks-out'))).toBe(false);
  });

  it('takes its full height at once under reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    render(<Disclosures style={slow('disclosure')} />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    expect(height(moving)).toBeLessThan(height(screen.getByTestId('reference')));
    moving.open = true;
    await frames(2);
    expect(height(moving)).toBeCloseTo(height(screen.getByTestId('reference')), 0);
  });

  it.skipIf(sizesToAuto)('opens to its full height at once where the engine cannot size to auto', async () => {
    render(<Disclosures style={slow('disclosure')} />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    expect(height(moving)).toBeLessThan(height(screen.getByTestId('reference')));
    moving.open = true;
    await frames(2);
    expect(height(moving)).toBeCloseTo(height(screen.getByTestId('reference')), 0);
  });
});

describe('Nav branch height', () => {
  function Branches({ style, open }: { style?: CSSProperties; open?: boolean }) {
    const links = (
      <>
        <Nav.Item>
          <Nav.Link href="#usage">Usage</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link href="#billing">Billing</Nav.Link>
        </Nav.Item>
      </>
    );
    return (
      <Themed style={style}>
        <Nav.Root aria-label="Docs">
          <Nav.Item>
            <Nav.Branch label="Reports" data-testid="moving" open={open}>
              {links}
            </Nav.Branch>
          </Nav.Item>
          <Nav.Item>
            <Nav.Branch label="Reports" data-testid="reference" open>
              {links}
            </Nav.Branch>
          </Nav.Item>
          <Nav.Item>
            <Nav.Branch label="Reports" data-testid="closed">
              {links}
            </Nav.Branch>
          </Nav.Item>
        </Nav.Root>
      </Themed>
    );
  }

  it.runIf(sizesToAuto)('grows from nothing to its links as it opens', async () => {
    render(<Branches style={slow('nav')} />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    const closed = height(moving);
    const open = height(screen.getByTestId('reference'));
    moving.open = true;
    await frames(2);
    // No margin arrives at once: it starts from where it was.
    expect(height(moving) - closed).toBeLessThan(3);
    await wait(400);
    const partway = height(moving);
    expect(partway).toBeGreaterThan(closed + 0.5);
    expect(partway).toBeLessThan(open - 1);
  });

  it.runIf(sizesToAuto)('shrinks to nothing as it closes', async () => {
    render(<Branches style={slow('nav')} open />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    const closed = height(screen.getByTestId('closed'));
    const open = height(moving);
    moving.open = false;
    await frames(2);
    // No margin leaves at once: it starts from where it was.
    expect(open - height(moving)).toBeLessThan(3);
    await wait(400);
    const partway = height(moving);
    expect(partway).toBeLessThan(open - 0.5);
    expect(partway).toBeGreaterThan(closed + 1);
  });

  it('shows its links at once under reduced motion, and where the engine cannot size to auto', async () => {
    if (sizesToAuto) await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    render(<Branches style={slow('nav')} />);
    const moving = screen.getByTestId('moving') as HTMLDetailsElement;
    expect(height(moving)).toBeLessThan(height(screen.getByTestId('reference')));
    moving.open = true;
    await frames(2);
    expect(height(moving)).toBeCloseTo(height(screen.getByTestId('reference')), 0);
  });
});

describe('Toast list gap', () => {
  function Region({ style, toaster }: { style?: CSSProperties; toaster: ReturnType<typeof createToaster> }) {
    return (
      <Themed style={style}>
        <Toast.Region toaster={toaster}>
          {(toast) => (
            <Toast.Root>
              <Toast.Title>{toast.title}</Toast.Title>
            </Toast.Root>
          )}
        </Toast.Region>
      </Themed>
    );
  }

  /** Bottom placement: adds three, and returns the oldest's top, with the newest's height and the gap above it. */
  async function three(style?: CSSProperties) {
    const toaster = createToaster({ duration: Infinity });
    render(<Region toaster={toaster} style={style} />);
    // Toasts enter at the usual speed, so they have settled before one leaves.
    let newest = '';
    act(() => {
      toaster.add({ title: 'Oldest' });
      toaster.add({ title: 'Middle' });
      newest = toaster.add({ title: 'Newest' });
    });
    await screen.findByText('Newest', { selector: 'p' });
    await wait(500);
    const item = (title: string) => screen.getByText(title, { selector: 'p' }).closest('li')!;
    const top = item('Oldest').getBoundingClientRect().top;
    const gone = item('Newest').getBoundingClientRect();
    const step = gone.bottom - item('Middle').getBoundingClientRect().bottom;
    return { toaster, newest, item, top, step, start: gone.height };
  }

  it.runIf(sizesToAuto)('slides the others into the gap a leaving toast gives back', async () => {
    const { toaster, newest, item, top, step, start } = await three(slow('toast', ['exit']));
    act(() => toaster.dismiss(newest));
    await frames(2);
    await wait(400);
    // The leaving toast itself shrinks, not only the gap after it.
    expect(height(item('Newest'))).toBeLessThan(start * 0.95);
    const moved = item('Oldest').getBoundingClientRect().top - top;
    expect(moved).toBeGreaterThan(0.5);
    expect(moved).toBeLessThan(step - 1);
  });

  it('never leaves the others partway under reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const { toaster, newest, item, top, step } = await three(slow('toast', ['exit']));
    act(() => toaster.dismiss(newest));
    await frames(2);
    await wait(400);
    // In place while the leaving toast is there, or where it left them once it
    // is gone; never partway. Today the exit is instant there, so this mostly
    // guards that the height rules stay out of reduced motion.
    const moved = item('Oldest').getBoundingClientRect().top - top;
    expect(Math.min(Math.abs(moved), Math.abs(moved - step))).toBeLessThan(0.5);
  });
});
