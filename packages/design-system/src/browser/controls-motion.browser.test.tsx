import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from '../components/Checkbox.js';
import { RadioGroup } from '../components/Radio.js';
import { Switch } from '../components/Switch.js';
import { Tabs } from '../components/Tabs.js';
import { emulateMedia } from '../test/drilldown.js';

afterEach(async () => {
  cleanup();
  await emulateMedia([]);
});

// A one-second linear move leaves a frame or two after the click well inside it.
const slow = {
  ['--_todae-selection-motion-duration' as string]: '1s',
  ['--_todae-selection-motion-easing' as string]: 'linear',
  ['--_todae-tabs-motion-duration' as string]: '1s',
  ['--_todae-tabs-motion-easing' as string]: 'linear',
} satisfies CSSProperties;

function Themed({ children, dir }: { children: ReactNode; dir?: 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir} style={slow}>
      {children}
    </div>
  );
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** The CSS properties now transitioning on the element or its ::before and ::after. */
function moving(el: Element): string[] {
  return el
    .getAnimations({ subtree: true })
    .filter((a): a is CSSTransition => a instanceof CSSTransition && a.playState === 'running')
    .map((a) => a.transitionProperty);
}

async function settle(el: Element) {
  await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
}

function SectionTabs({ orientation }: { orientation?: 'vertical' }) {
  return (
    <Tabs.Root defaultValue="a" orientation={orientation}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab value="a">Alpha</Tabs.Tab>
        <Tabs.Tab value="b">A much longer tab</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
      <Tabs.Panel value="b">Beta panel</Tabs.Panel>
    </Tabs.Root>
  );
}

/** The indicator's box and the selected tab's, in viewport pixels. */
function boxes() {
  const list = screen.getByRole('tablist');
  const tab = screen.getByRole('tab', { selected: true });
  const style = getComputedStyle(list, '::after');
  const l = list.getBoundingClientRect();
  const left = l.left + list.clientLeft + parseFloat(style.left);
  const top = l.top + list.clientTop + parseFloat(style.top);
  return {
    indicator: { left, top, width: parseFloat(style.width), height: parseFloat(style.height) },
    tab: tab.getBoundingClientRect(),
  };
}

describe('Tabs indicator motion', () => {
  it.each([undefined, 'rtl'] as const)('slides from the old tab to the new one, dir %s', async (dir) => {
    render(
      <Themed dir={dir}>
        <SectionTabs />
      </Themed>,
    );
    const start = boxes();
    expect(start.indicator.left).toBeCloseTo(start.tab.left, 0);
    expect(start.indicator.width).toBeCloseTo(start.tab.width, 0);

    await userEvent.click(screen.getByRole('tab', { name: 'A much longer tab' }));
    await frame();
    await frame();
    const list = screen.getByRole('tablist');
    expect(moving(list).length).toBeGreaterThan(0);
    const mid = boxes();
    const [from, to] = [start.tab.left, mid.tab.left].sort((a, b) => a - b) as [number, number];
    expect(mid.indicator.left).toBeGreaterThan(from + 1);
    expect(mid.indicator.left).toBeLessThan(to - 1);

    await settle(list);
    const end = boxes();
    expect(end.indicator.left).toBeCloseTo(end.tab.left, 0);
    expect(end.indicator.width).toBeCloseTo(end.tab.width, 0);
    // It sits on the list's border, under the tab.
    expect(end.indicator.top + end.indicator.height).toBeGreaterThan(end.tab.bottom);
  });

  it('runs along the inline end of a vertical list', async () => {
    render(
      <Themed>
        <SectionTabs orientation="vertical" />
      </Themed>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'A much longer tab' }));
    await settle(screen.getByRole('tablist'));
    const end = boxes();
    expect(end.indicator.top).toBeCloseTo(end.tab.top, 0);
    expect(end.indicator.height).toBeCloseTo(end.tab.height, 0);
    expect(end.indicator.left + end.indicator.width).toBeGreaterThan(end.tab.right);
  });

  it('moves at once under reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    render(
      <Themed>
        <SectionTabs />
      </Themed>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'A much longer tab' }));
    await frame();
    expect(moving(screen.getByRole('tablist'))).toEqual([]);
    const now = boxes();
    expect(now.indicator.left).toBeCloseTo(now.tab.left, 0);
  });
});

function thumbX(input: HTMLElement): number {
  return new DOMMatrix(getComputedStyle(input.nextElementSibling!, '::after').transform).m41;
}

describe('Switch, Checkbox and Radio motion', () => {
  it('slides the switch thumb and fades the track', async () => {
    render(
      <Themed>
        <Switch.Root>Sound</Switch.Root>
      </Themed>,
    );
    const input = screen.getByRole('switch');
    await userEvent.click(input);
    await frame();
    await frame();
    expect(moving(input.nextElementSibling!)).toEqual(expect.arrayContaining(['transform', 'background-color']));
    const mid = thumbX(input);
    await settle(input.nextElementSibling!);
    const end = thumbX(input);
    expect(end).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(end);
  });

  it('jumps the switch thumb but still fades the track under reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    render(
      <Themed>
        <Switch.Root>Sound</Switch.Root>
      </Themed>,
    );
    const input = screen.getByRole('switch');
    await userEvent.click(input);
    await frame();
    const now = moving(input.nextElementSibling!);
    expect(now).toContain('background-color');
    expect(now).not.toContain('transform');
  });

  it('grows the check in, and only fades it under reduced motion', async () => {
    render(
      <Themed>
        <Checkbox.Root>Updates</Checkbox.Root>
      </Themed>,
    );
    const box = screen.getByRole('checkbox');
    await userEvent.click(box);
    await frame();
    expect(moving(box.nextElementSibling!)).toEqual(expect.arrayContaining(['opacity', 'scale']));
    await settle(box.nextElementSibling!);
    const glyph = box.nextElementSibling!.querySelector('[data-todae-glyph]')!;
    expect(getComputedStyle(glyph).opacity).toBe('1');
    expect(getComputedStyle(glyph).visibility).toBe('visible');

    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await userEvent.click(box);
    await frame();
    expect(moving(box.nextElementSibling!)).not.toContain('scale');
    await settle(box.nextElementSibling!);
    expect(getComputedStyle(glyph).visibility).toBe('hidden');
  });

  it('grows the radio dot in, and only fades it under reduced motion', async () => {
    render(
      <Themed>
        <RadioGroup.Root aria-label="Plan">
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>
      </Themed>,
    );
    const free = screen.getByRole('radio', { name: 'Free' });
    await userEvent.click(free);
    await frame();
    expect(moving(free.nextElementSibling!)).toEqual(expect.arrayContaining(['opacity', 'scale']));
    await settle(free.nextElementSibling!);
    expect(getComputedStyle(free.nextElementSibling!, '::after').scale).toBe('1');

    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const pro = screen.getByRole('radio', { name: 'Pro' });
    await userEvent.click(pro);
    await frame();
    const now = moving(pro.nextElementSibling!);
    expect(now).toContain('opacity');
    expect(now).not.toContain('scale');
  });
});
