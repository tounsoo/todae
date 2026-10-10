import { render, screen } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { usePopover } from '../hooks/usePopover';
import { useTooltip } from '../hooks/useTooltip';
import { Button, Chip, Disclosure, Menu, Popover, Progress, Switch, Tabs, ToggleGroup, Tooltip } from '../index';

function Themed({ children, dir }: { children: ReactNode; dir?: 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      {children}
    </div>
  );
}

/** vitest types the session without its methods; Playwright's session has `send`. */
function emulateMedia(features: { name: string; value: string }[]) {
  return (cdp() as unknown as { send(method: string, params: object): Promise<unknown> }).send('Emulation.setEmulatedMedia', {
    features,
  });
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** `read()` on every frame until it holds still for a few frames. */
async function sample(read: () => number): Promise<number[]> {
  const values: number[] = [];
  const start = performance.now();
  let still = 0;
  while (performance.now() - start < 2000) {
    await frame();
    const value = read();
    still = values.length > 0 && Math.abs(value - values[values.length - 1]!) < 0.01 ? still + 1 : 0;
    values.push(value);
    if (still > 4) break;
  }
  return values;
}

/** Some sampled value sits strictly between `from` and `to`, away from both ends. */
function expectBetween(values: number[], from: number, to: number) {
  const [low, high] = from < to ? [from, to] : [to, from];
  const margin = (high - low) * 0.1;
  expect(values.some((v) => v > low + margin && v < high - margin), `${values.join(', ')} between ${from} and ${to}`).toBe(true);
  expect(Math.abs(values[values.length - 1]! - to)).toBeLessThanOrEqual(margin);
}

const translateX = (el: Element, pseudo?: string) => new DOMMatrixReadOnly(getComputedStyle(el, pseudo).transform).m41;
const opacity = (el: Element) => parseFloat(getComputedStyle(el).opacity);

function SwitchHarness() {
  return (
    <Themed>
      <Switch>Wi-Fi</Switch>
    </Themed>
  );
}

function PopoverHarness() {
  const [open, setOpen] = useState(false);
  const popover = usePopover({ open, onOpenChange: setOpen });
  return (
    <Themed>
      <div style={{ padding: 40 }}>
        <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
      </div>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters panel">
        Panel
      </Popover.Root>
    </Themed>
  );
}

function PanelTip({ open }: { open: boolean }) {
  const tooltip = useTooltip({ open, interactive: true });
  return (
    <Themed>
      <div style={{ padding: 60 }}>
        <button type="button" {...tooltip.getTriggerProps()}>
          Hint
        </button>
      </div>
      <Tooltip.Root {...tooltip.getTooltipProps()} aria-label="Policy">
        Short prose. <a href="/policy">Read the policy</a>
      </Tooltip.Root>
    </Themed>
  );
}

function Toggles({ variant }: { variant?: 'primary' }) {
  return (
    <Themed>
      <ToggleGroup.Root aria-label="Align" defaultValue="left">
        <ToggleGroup.Item value="left" variant={variant}>
          Left
        </ToggleGroup.Item>
        <ToggleGroup.Item value="center" variant={variant}>
          Center
        </ToggleGroup.Item>
        <ToggleGroup.Item value="right" variant={variant}>
          Right
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </Themed>
  );
}

/** The group's sliding ring, in viewport pixels, or null when there is none. */
function ringOf(group: HTMLElement): DOMRect | null {
  const style = getComputedStyle(group, '::after');
  if (style.content === 'none' || style.display === 'none') return null;
  const box = group.getBoundingClientRect();
  return new DOMRect(box.left + parseFloat(style.left), box.top + parseFloat(style.top), parseFloat(style.width), parseFloat(style.height));
}

describe('Motion', () => {
  it('slides the Switch thumb and fades its track', async () => {
    render(<SwitchHarness />);
    const input = screen.getByRole('switch');
    const track = input.nextElementSibling!;
    const end = parseFloat(getComputedStyle(track).width) - parseFloat(getComputedStyle(track, '::after').width);
    input.click();
    const values = await sample(() => translateX(track, '::after'));
    expectBetween(values, 0, end - 4);
    expect(getComputedStyle(track).transitionProperty).toContain('background-color');
  });

  it('fades a Popover in, and out while it stays displayed', async () => {
    render(<PopoverHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const panel = screen.getByRole('dialog', { name: 'Filters panel' });
    expectBetween(await sample(() => opacity(panel)), 0, 1);
    await userEvent.keyboard('{Escape}');
    expect(panel.matches(':popover-open')).toBe(false);
    // Hidden, it is still drawn while it fades.
    const fading: number[] = [];
    for (let i = 0; i < 3; i++) {
      await frame();
      if (getComputedStyle(panel).display !== 'none') fading.push(opacity(panel));
    }
    expect(fading.some((v) => v > 0 && v < 1)).toBe(true);
    await sample(() => (getComputedStyle(panel).display === 'none' ? 0 : 1));
    expect(getComputedStyle(panel).display).toBe('none');
  });

  it('fades a Menu in', async () => {
    render(
      <Themed>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Content>
            <Menu.Item onSelect={() => undefined}>Rename</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Themed>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = screen.getByRole('menu');
    expectBetween(await sample(() => opacity(menu)), 0, 1);
    expect(getComputedStyle(menu).display).toBe('flex');
  });

  it('fades an interactive Tooltip panel in and out', async () => {
    const { rerender } = render(<PanelTip open={false} />);
    rerender(<PanelTip open />);
    const panel = screen.getByRole('dialog', { name: 'Policy' });
    expectBetween(await sample(() => opacity(panel)), 0, 1);
    rerender(<PanelTip open={false} />);
    await frame();
    expect(getComputedStyle(panel).display).not.toBe('none');
    await sample(() => (getComputedStyle(panel).display === 'none' ? 0 : opacity(panel)));
    expect(getComputedStyle(panel).display).toBe('none');
  });

  it.each([['ltr'], ['rtl']] as const)('slides the ToggleGroup pressed ring to the next item, %s', async (dir) => {
    render(
      <Themed dir={dir === 'rtl' ? 'rtl' : undefined}>
        <ToggleGroup.Root aria-label="Align" defaultValue="left">
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
      </Themed>,
    );
    const group = screen.getByRole('group', { name: 'Align' });
    const left = screen.getByRole('button', { name: 'Left' });
    const right = screen.getByRole('button', { name: 'Right' });
    // The ring sits inside the pressed item's border, where its own ring was.
    const inside = (item: HTMLElement) => {
      const box = item.getBoundingClientRect();
      return new DOMRect(box.left + 1, box.top + 1, box.width - 2, box.height - 2);
    };
    const expectOn = (item: HTMLElement) => {
      const ring = ringOf(group)!;
      const target = inside(item);
      expect(Math.abs(ring.left - target.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(ring.right - target.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(ring.height - target.height)).toBeLessThanOrEqual(1);
    };
    expectOn(left);
    expect(getComputedStyle(left).boxShadow).toBe('none');
    right.click();
    expectBetween(
      await sample(() => ringOf(group)!.left),
      inside(left).left,
      inside(right).left,
    );
    expectOn(right);
    // Pressing the pressed item clears the group, and the ring goes.
    right.click();
    await frame();
    expect(ringOf(group)).toBeNull();
  });

  it('keeps a ring on the item itself for other variants', () => {
    render(<Toggles variant="primary" />);
    const group = screen.getByRole('group', { name: 'Align' });
    expect(ringOf(group)).toBeNull();
    expect(getComputedStyle(screen.getByRole('button', { name: 'Left' })).boxShadow).not.toBe('none');
  });

  it('grows an opening Disclosure to its content height', async () => {
    render(
      <Themed>
        <Disclosure.Root>
          <Disclosure.Summary>Details</Disclosure.Summary>
          <div style={{ height: 120 }}>Content</div>
        </Disclosure.Root>
      </Themed>,
    );
    const details = screen.getByRole('group') as HTMLDetailsElement;
    const closed = details.getBoundingClientRect().height;
    details.open = true;
    const values = await sample(() => details.getBoundingClientRect().height);
    expectBetween(values, closed, values[values.length - 1]!);
    expect(values[values.length - 1]! - closed).toBeGreaterThanOrEqual(120);
  });

  it('eases a Progress fill to a new value', async () => {
    const { rerender } = render(
      <Themed>
        <Progress.Root aria-label="Upload" value={10} max={100} style={{ inlineSize: 400 }} />
      </Themed>,
    );
    const bar = screen.getByRole('progressbar');
    const fill = () => parseFloat(getComputedStyle(bar).backgroundSize);
    const from = fill();
    expect(from).toBe(10);
    rerender(
      <Themed>
        <Progress.Root aria-label="Upload" value={90} max={100} style={{ inlineSize: 400 }} />
      </Themed>,
    );
    expectBetween(await sample(fill), from, 90);
  });

  it('fades hover and press colors', () => {
    render(
      <Themed>
        <Button.Root>Save</Button.Root>
        <Chip.Root data-testid="chip">Tag</Chip.Root>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab value="a">Alpha</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      </Themed>,
    );
    for (const el of [screen.getByRole('button', { name: 'Save' }), screen.getByTestId('chip'), screen.getByRole('tab')]) {
      const style = getComputedStyle(el);
      expect(style.transitionProperty).toContain('background-color');
      expect(parseFloat(style.transitionDuration)).toBeGreaterThan(0);
    }
  });

  it('turns every one of these off when the user prefers reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    try {
      expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
      render(
        <Themed>
          <Switch>Wi-Fi</Switch>
          <Button.Root>Save</Button.Root>
          <Toggles />
          <Disclosure.Root>
            <Disclosure.Summary>Details</Disclosure.Summary>
            Content
          </Disclosure.Root>
          <Progress.Root aria-label="Upload" value={10} max={100} />
        </Themed>,
      );
      const track = screen.getByRole('switch').nextElementSibling!;
      const durations = [
        getComputedStyle(track).transitionDuration,
        getComputedStyle(track, '::after').transitionDuration,
        getComputedStyle(screen.getByRole('button', { name: 'Save' })).transitionDuration,
        getComputedStyle(screen.getByRole('group', { name: 'Align' }), '::after').transitionDuration,
        getComputedStyle(screen.getByRole('progressbar')).transitionDuration,
      ];
      for (const duration of durations) expect(duration.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    } finally {
      await emulateMedia([]);
    }
  });
});
