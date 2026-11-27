import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { server, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../components/Button.js';
import { Menu } from '../components/Menu.js';
import { OptionList } from '../components/OptionList.js';
import { Popover } from '../components/Popover.js';
import { Skeleton } from '../components/Skeleton.js';
import { Steps, type StepsStatus } from '../components/Steps.js';
import { Tabs } from '../components/Tabs.js';
import { Tooltip } from '../components/Tooltip.js';
import { usePopover } from '../hooks/usePopover.js';
import { useTooltip } from '../hooks/useTooltip.js';
import { emulateMedia } from '../test/media.js';

// The motion Ben approved on 2026-11-27: each new token starts at 0 so
// Graphite looks and moves as before, and a brand opts in.

afterEach(async () => {
  cleanup();
  await emulateMedia([]);
});

const reduce = () => emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

function Themed({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div data-appearance="light" data-density="comfortable" style={{ paddingBlockStart: 64, paddingInline: 48, ...style }}>
      {children}
    </div>
  );
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function transitions(el: Element, { subtree = false } = {}): CSSTransition[] {
  return el.getAnimations({ subtree }).filter((a): a is CSSTransition => a instanceof CSSTransition);
}

const props = (el: Element, options?: { subtree?: boolean }) => transitions(el, options).map((a) => a.transitionProperty);

const MOVES = ['transform', 'translate', 'scale', 'rotate'];

/** Samples `read` every frame until nothing has run for a few frames, or two seconds pass. */
async function sample<T>(read: () => T): Promise<T[]> {
  const out: T[] = [];
  const start = performance.now();
  let started = false;
  let quiet = 0;
  while (performance.now() - start < 2000) {
    await frame();
    out.push(read());
    const running = document.getAnimations().length > 0;
    started ||= running;
    quiet = started && !running ? quiet + 1 : 0;
    if (quiet > 2) break;
  }
  return out;
}

describe('Popover slide-in offset (popover.motion.offset)', () => {
  function Slide({ style, above = false }: { style?: CSSProperties; above?: boolean }) {
    const popover = usePopover({ defaultOpen: true });
    const trigger = popover.getTriggerProps();
    return (
      <Themed style={style}>
        <Button.Root {...trigger} style={above ? { ...trigger.style, position: 'fixed', insetBlockEnd: 16, insetInlineStart: 48 } : trigger.style}>
          Open
        </Button.Root>
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Slide">
          <div style={{ inlineSize: 160, blockSize: 80 }}>Body</div>
        </Popover.Root>
      </Themed>
    );
  }

  const slow = {
    ['--_todae-popover-motion-duration-enter' as string]: '600ms',
    ['--_todae-popover-motion-easing-enter' as string]: 'linear',
  };

  /** How far the popover's near edge sits from its trigger. */
  function gap(above: boolean) {
    const t = screen.getByRole('button', { name: 'Open' }).getBoundingClientRect();
    const p = screen.getByRole('dialog', { name: 'Slide' }).getBoundingClientRect();
    return above ? t.top - p.bottom : p.top - t.bottom;
  }

  it('is 0 by default, so the popover opens where it rests and only fades and grows', async () => {
    render(<Slide style={slow} />);
    const content = screen.getByRole('dialog', { name: 'Slide' });
    const gaps = await sample(() => gap(false));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.5);
    expect(getComputedStyle(content).marginBlockStart).toBe('0px');
    expect(getComputedStyle(content).translate).toBe('none');
  });

  it.each([false, true])('slides from its trigger by the offset, by layout, above %s', async (above) => {
    // Motion only has to work in Chrome (ARCHITECTURE "Motion").
    if (server.browser !== 'chromium') return;
    render(<Slide above={above} style={{ ...slow, ['--_todae-popover-motion-offset' as string]: '12px' }} />);
    const content = screen.getByRole('dialog', { name: 'Slide' });
    const gaps = await sample(() => gap(above));
    await waitFor(() => expect(content.hasAttribute('data-todae-settled')).toBe(true));
    const rest = gap(above);
    // It starts closer to its trigger, by up to the offset, and ends at rest.
    expect(Math.min(...gaps)).toBeLessThan(rest - 4);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(rest - 12.5);
    expect(gaps.at(-1)).toBeCloseTo(rest, 0);
    // No transform: a tip inside stays by its trigger's laid-out box.
    expect(getComputedStyle(content).translate).toBe('none');
    expect(getComputedStyle(content).transform).toBe('none');
  });

  it('slides back toward its trigger as it closes, staying inert', async () => {
    if (server.browser !== 'chromium') return;
    function Closing() {
      const [open, setOpen] = useState(true);
      const popover = usePopover({ open, onOpenChange: setOpen });
      return (
        <Themed style={{ ...slow, ['--_todae-popover-motion-duration-exit' as string]: '600ms', ['--_todae-popover-motion-offset' as string]: '12px' }}>
          <Button.Root {...popover.getTriggerProps()}>Open</Button.Root>
          <Button.Root onClick={() => setOpen(false)}>Close it</Button.Root>
          <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Slide">
            <div style={{ inlineSize: 160, blockSize: 80 }}>Body</div>
          </Popover.Root>
        </Themed>
      );
    }
    render(<Closing />);
    const content = screen.getByRole('dialog', { name: 'Slide' });
    await waitFor(() => expect(content.hasAttribute('data-todae-settled')).toBe(true), { timeout: 3000 });
    const rest = gap(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close it' }));
    await waitFor(() => expect(content.hasAttribute('data-todae-exiting')).toBe(true));
    const gaps: number[] = [];
    while (content.hasAttribute('data-todae-exiting')) {
      // It takes no press or focus while it leaves.
      expect(content.inert).toBe(true);
      await frame();
      if (content.matches(':popover-open')) gaps.push(gap(false));
    }
    expect(Math.min(...gaps)).toBeLessThan(rest - 2);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(rest - 12.5);
  });

  it('holds still under reduced motion, and still fades', async () => {
    await reduce();
    render(<Slide style={{ ...slow, ['--_todae-popover-motion-offset' as string]: '12px' }} />);
    const content = screen.getByRole('dialog', { name: 'Slide' });
    const running: string[] = [];
    const gaps = await sample(() => {
      running.push(...props(content));
      return gap(false);
    });
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.5);
    // The slide is the registered --_popover-slide length; under reduce it never changes.
    expect(running.some((p) => p.includes('slide') || p.startsWith('margin'))).toBe(false);
    if (server.browser === 'chromium') expect(running).toContain('opacity');
  });
});

describe('Tooltip slide-in offset (tooltip.motion.offset)', () => {
  function Tip({ style }: { style?: CSSProperties }) {
    const a = useTooltip();
    const b = useTooltip();
    return (
      <Themed style={{ display: 'flex', gap: 8, ...style }}>
        <Button.Root tooltip={false} {...a.getTriggerProps()}>
          A
        </Button.Root>
        <Tooltip.Root {...a.getTooltipProps()}>Tip A</Tooltip.Root>
        <Button.Root tooltip={false} {...b.getTriggerProps()}>
          B
        </Button.Root>
        <Tooltip.Root {...b.getTooltipProps()}>Tip B</Tooltip.Root>
      </Themed>
    );
  }

  const slow = {
    ['--_todae-tooltip-motion-duration-enter' as string]: '600ms',
    ['--_todae-tooltip-motion-easing-enter' as string]: 'linear',
  };

  /** The tip sits above its trigger: how far its bottom is from the trigger's top. */
  function gap(name: 'A' | 'B') {
    const t = screen.getByRole('button', { name }).getBoundingClientRect();
    const tip = screen.queryByRole('tooltip', { name: `Tip ${name}` });
    return tip ? t.top - tip.getBoundingClientRect().bottom : Number.NaN;
  }

  async function openCold(style: CSSProperties) {
    render(<Tip style={style} />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'A' }));
    await screen.findByRole('tooltip', { name: 'Tip A' }, { timeout: 2000 });
  }

  it('is 0 by default, so a cold tip fades in where it rests', async () => {
    await openCold(slow);
    const gaps = (await sample(() => gap('A'))).filter((g) => !Number.isNaN(g));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.5);
  });

  it('slides a cold tip in from its trigger by the offset', async () => {
    if (server.browser !== 'chromium') return;
    await openCold({ ...slow, ['--_todae-tooltip-motion-offset' as string]: '8px' });
    const tip = screen.getByRole('tooltip', { name: 'Tip A' });
    const gaps = (await sample(() => gap('A'))).filter((g) => !Number.isNaN(g));
    await waitFor(() => expect(tip.hasAttribute('data-todae-settled')).toBe(true));
    const rest = gap('A');
    expect(Math.min(...gaps)).toBeLessThan(rest - 2);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(rest - 8.5);
    expect(gap('A')).toBeCloseTo(rest, 0);
    expect(getComputedStyle(tip).translate).toBe('none');
  });

  it('shows a warm tip at rest at once, with no slide', async () => {
    render(<Tip style={{ ...slow, ['--_todae-tooltip-motion-offset' as string]: '8px' }} />);
    const a = screen.getByRole('button', { name: 'A' });
    fireEvent.pointerEnter(a);
    await screen.findByRole('tooltip', { name: 'Tip A' }, { timeout: 2000 });
    fireEvent.pointerLeave(a);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    const tip = await screen.findByRole('tooltip', { name: 'Tip B' }, { timeout: 100 });
    expect(tip.hasAttribute('data-todae-warm')).toBe(true);
    await frame();
    expect(props(tip)).toEqual([]);
    expect(getComputedStyle(tip).marginBlockEnd).toBe('0px');
  });

  it('holds still under reduced motion', async () => {
    await reduce();
    await openCold({ ...slow, ['--_todae-tooltip-motion-offset' as string]: '8px' });
    const tip = screen.getByRole('tooltip', { name: 'Tip A' });
    const running: string[] = [];
    const gaps = (
      await sample(() => {
        running.push(...props(tip));
        return gap('A');
      })
    ).filter((g) => !Number.isNaN(g));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.5);
    expect(running.some((p) => p.includes('slide'))).toBe(false);
  });
});

describe('Skeleton variant', () => {
  const names = (el: Element) =>
    el.getAnimations().filter((a): a is CSSAnimation => a instanceof CSSAnimation).map((a) => a.animationName);

  it('pulses by default, as before', () => {
    render(
      <Themed>
        <Skeleton.Root data-testid="s" />
      </Themed>,
    );
    const el = screen.getByTestId('s');
    expect(el.getAttribute('data-variant')).toBe('pulse');
    expect(names(el).some((n) => n.includes('pulse'))).toBe(true);
  });

  it('sweeps a shimmer with variant="shimmer", by its background, never a transform', () => {
    render(
      <Themed>
        <Skeleton.Root data-testid="s" variant="shimmer" />
      </Themed>,
    );
    const el = screen.getByTestId('s');
    expect(el.getAttribute('data-variant')).toBe('shimmer');
    expect(names(el).some((n) => n.includes('shimmer'))).toBe(true);
    expect(names(el).some((n) => n.includes('pulse'))).toBe(false);
    expect(getComputedStyle(el).backgroundImage).toContain('gradient');
    expect(getComputedStyle(el).transform).toBe('none');
  });

  it.each(['pulse', 'shimmer'] as const)('holds %s still under reduced motion', async (variant) => {
    await reduce();
    render(
      <Themed>
        <Skeleton.Root data-testid="s" variant={variant} />
      </Themed>,
    );
    const el = screen.getByTestId('s');
    expect(el.getAnimations()).toEqual([]);
    expect(getComputedStyle(el).opacity).toBe('1');
    // A held shimmer is the plain block, with no band stopped across it.
    expect(getComputedStyle(el).backgroundImage).toBe('none');
  });
});

describe('Tabs panel fade (tabs.motion.panel.duration)', () => {
  function Sections({ style }: { style?: CSSProperties }) {
    return (
      <Themed style={style}>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">Alpha</Tabs.Tab>
            <Tabs.Tab value="b">Beta</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
          <Tabs.Panel value="b">Beta panel</Tabs.Panel>
        </Tabs.Root>
      </Themed>
    );
  }

  const panel = () => screen.getByRole('tabpanel', { name: 'Beta' });

  it('is 0ms by default, so the panel swaps at once', async () => {
    render(<Sections />);
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(props(panel())).toEqual([]);
    expect(getComputedStyle(panel()).opacity).toBe('1');
  });

  it('never fades the panel the page first shows', async () => {
    render(<Sections style={{ ['--_todae-tabs-motion-panel-duration' as string]: '600ms' }} />);
    await frame();
    const first = screen.getByRole('tabpanel', { name: 'Alpha' });
    expect(props(first)).toEqual([]);
    expect(getComputedStyle(first).opacity).toBe('1');
  });

  it.each(['no-preference', 'reduce'] as const)('fades the new panel in by opacity alone when a brand sets it, %s', async (motion) => {
    // @starting-style runs in Chrome; motion only has to work there.
    if (server.browser !== 'chromium') return;
    await emulateMedia([{ name: 'prefers-reduced-motion', value: motion }]);
    render(<Sections style={{ ['--_todae-tabs-motion-panel-duration' as string]: '600ms' }} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    await frame();
    // A fade moves nothing, so it keeps running under reduced motion.
    expect(props(panel())).toEqual(['opacity']);
    // The old panel goes at once, so the two never overlap.
    expect(document.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
  });
});

describe('Steps status color fade (steps.motion.duration)', () => {
  function Plan({ style }: { style?: CSSProperties }) {
    const [status, setStatus] = useState<StepsStatus>('pending');
    return (
      <Themed style={style}>
        <Button.Root onClick={() => setStatus('done')}>Finish</Button.Root>
        <Steps.Root aria-label="Plan">
          <Steps.Item status={status}>Run the tests</Steps.Item>
        </Steps.Root>
      </Themed>
    );
  }

  it('is 0ms by default, so a status changes its colors at once', async () => {
    render(<Plan />);
    const item = screen.getByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await frame();
    expect(props(item, { subtree: true })).toEqual([]);
    expect(item.getAttribute('data-status')).toBe('done');
  });

  it.each(['no-preference', 'reduce'] as const)('fades the step and its marker colors when a brand sets it, and moves nothing, %s', async (motion) => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: motion }]);
    render(<Plan style={{ ['--_todae-steps-motion-duration' as string]: '600ms' }} />);
    const item = screen.getByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await frame();
    // A color fade moves nothing, so it keeps running under reduced motion.
    const running = props(item, { subtree: true });
    expect(running).toEqual(expect.arrayContaining(['color', 'background-color', 'border-top-color']));
    for (const p of running) expect(MOVES).not.toContain(p);
  });
});

describe('Menu checkmarks (menu.item.check.motion.duration)', () => {
  const optIn = { ['--_todae-menu-item-check-motion-duration' as string]: '600ms' };

  function Options({ style }: { style?: CSSProperties }) {
    return (
      <Themed style={style}>
        <Menu.Root defaultOpen>
          <Menu.Trigger variant="secondary">View</Menu.Trigger>
          <Menu.Content>
            <Menu.CheckboxItem closeOnSelect={false}>Grid</Menu.CheckboxItem>
            <Menu.RadioGroup aria-label="Sort" defaultValue="name">
              <Menu.RadioItem value="name">By name</Menu.RadioItem>
              <Menu.RadioItem value="date">By date</Menu.RadioItem>
            </Menu.RadioGroup>
          </Menu.Content>
        </Menu.Root>
      </Themed>
    );
  }

  const indicator = (name: string) => screen.getByRole(name === 'Grid' ? 'menuitemcheckbox' : 'menuitemradio', { name }).firstElementChild!;

  async function settledMenu(style?: CSSProperties) {
    render(<Options style={style} />);
    const menu = screen.getByRole('menu');
    await waitFor(() => expect(menu.hasAttribute('data-todae-settled')).toBe(true), { timeout: 2000 });
  }

  it('is 0ms by default, so a check and a dot show at once', async () => {
    await settledMenu();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Grid' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'By date' }));
    await frame();
    expect(props(screen.getByRole('menu'), { subtree: true })).toEqual([]);
    expect(getComputedStyle(indicator('Grid')).opacity).toBe('1');
    expect(getComputedStyle(indicator('By date'), '::before').opacity).toBe('1');
  });

  it('grows the check in when a brand sets it, and hides it at once', async () => {
    await settledMenu(optIn);
    const item = screen.getByRole('menuitemcheckbox', { name: 'Grid' });
    await userEvent.click(item);
    await frame();
    expect(props(indicator('Grid'))).toEqual(expect.arrayContaining(['opacity', 'scale']));
    await Promise.all(indicator('Grid').getAnimations().map((a) => a.finished));
    expect(getComputedStyle(indicator('Grid')).opacity).toBe('1');
    await userEvent.click(item);
    await frame();
    expect(props(indicator('Grid'))).toEqual([]);
    expect(getComputedStyle(indicator('Grid')).visibility).toBe('hidden');
  });

  it('grows the radio dot in when a brand sets it', async () => {
    await settledMenu(optIn);
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'By date' }));
    await frame();
    const dot = indicator('By date');
    const running = dot.getAnimations({ subtree: true }).filter((a) => a instanceof CSSTransition && (a.effect as KeyframeEffect | null)?.pseudoElement === '::before');
    expect(running.map((a) => (a as CSSTransition).transitionProperty)).toEqual(expect.arrayContaining(['opacity', 'scale']));
  });

  it('only fades a brand\'s check under reduced motion', async () => {
    await reduce();
    await settledMenu(optIn);
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Grid' }));
    await frame();
    expect(props(indicator('Grid'))).toEqual(['opacity']);
    expect(getComputedStyle(indicator('Grid')).scale).toBe('none');
    // The radio dot only fades too.
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'By date' }));
    await frame();
    const dot = indicator('By date')
      .getAnimations({ subtree: true })
      .filter((a): a is CSSTransition => a instanceof CSSTransition && (a.effect as KeyframeEffect | null)?.pseudoElement === '::before');
    expect(dot.map((a) => a.transitionProperty)).toEqual(['opacity']);
    expect(getComputedStyle(indicator('By date'), '::before').scale).toBe('none');
  });

  it('moves the keyboard highlight at once', async () => {
    await settledMenu(optIn);
    await userEvent.keyboard('{ArrowDown}');
    await frame();
    // Nothing on any item itself transitions, only a check or dot inside.
    for (const item of screen.getByRole('menu').querySelectorAll('[role^="menuitem"]')) expect(props(item)).toEqual([]);
    expect(props(screen.getByRole('menu'), { subtree: true })).toEqual([]);
  });
});

describe('OptionList checkmarks (option.check.motion.duration)', () => {
  const optIn = { ['--_todae-option-check-motion-duration' as string]: '600ms' };

  function Fruit({ style }: { style?: CSSProperties }) {
    const [fruit, setFruit] = useState<string | null>(null);
    return (
      <Themed style={style}>
        <OptionList.Root value={fruit} onValueChange={setFruit} aria-label="Fruit">
          <OptionList.Option value="apple">Apple</OptionList.Option>
          <OptionList.Option value="pear">Pear</OptionList.Option>
        </OptionList.Root>
      </Themed>
    );
  }

  const check = (name: string) => screen.getByRole('option', { name }).querySelector('[data-todae-glyph]');

  it('is 0ms by default, so the check shows at once', async () => {
    render(<Fruit />);
    await userEvent.click(screen.getByRole('option', { name: 'Pear' }));
    await frame();
    expect(props(check('Pear')!)).toEqual([]);
    expect(getComputedStyle(check('Pear')!).opacity).toBe('1');
  });

  it('grows the check in as an option is picked, when a brand sets it', async () => {
    render(<Fruit style={optIn} />);
    await userEvent.click(screen.getByRole('option', { name: 'Pear' }));
    await frame();
    expect(props(check('Pear')!)).toEqual(expect.arrayContaining(['opacity', 'scale']));
  });

  it('only fades a brand\'s check in under reduced motion', async () => {
    await reduce();
    render(<Fruit style={optIn} />);
    await userEvent.click(screen.getByRole('option', { name: 'Pear' }));
    await frame();
    expect(props(check('Pear')!)).toEqual(['opacity']);
  });

  it('hides the check at once as the pick moves on', async () => {
    render(<Fruit style={optIn} />);
    await userEvent.click(screen.getByRole('option', { name: 'Pear' }));
    await Promise.all(check('Pear')!.getAnimations().map((a) => a.finished));
    await userEvent.click(screen.getByRole('option', { name: 'Apple' }));
    await frame();
    expect(props(check('Pear')!)).toEqual([]);
    expect(getComputedStyle(check('Pear')!).visibility).toBe('hidden');
  });

  it('draws a picked check at rest when the list shows again, as a popover opens', async () => {
    render(<Fruit style={optIn} />);
    await userEvent.click(screen.getByRole('option', { name: 'Pear' }));
    await Promise.all(check('Pear')!.getAnimations().map((a) => a.finished));
    const list = screen.getByRole('listbox');
    list.style.display = 'none';
    await frame();
    list.style.display = '';
    await frame();
    expect(props(check('Pear')!)).toEqual([]);
    expect(getComputedStyle(check('Pear')!).opacity).toBe('1');
  });

  it('moves the highlight at once', async () => {
    render(<Fruit style={optIn} />);
    const list = screen.getByRole('listbox');
    list.focus();
    await userEvent.keyboard('{ArrowDown}');
    await frame();
    expect(props(list, { subtree: true })).toEqual([]);
  });
});
