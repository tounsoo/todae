import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index';
import { resetMatchMedia, setMatchMedia } from '../test/setup';
import { Chip } from './Chip';
import {
  Tooltip,
  type TooltipContentName,
  type TooltipContentProps,
  type TooltipOpenReason,
  type TooltipProps,
  type TooltipTriggerProps,
} from './Tooltip';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'Tooltip.tsx'), 'utf8');
const css = readFileSync(join(here, 'Tooltip.module.css'), 'utf8');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetMatchMedia();
});

beforeEach(() => {
  vi.useFakeTimers();
});

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function wrapOf(el: HTMLElement) {
  return el.parentElement as HTMLElement;
}

function DefaultTip(
  props: Omit<Extract<TooltipProps, { interactive?: false }>, 'children'> & {
    label?: string;
    tip?: string;
  },
) {
  const { label, tip, ...tooltipProps } = props;
  return (
    <Tooltip {...tooltipProps}>
      <Tooltip.Trigger>
        <button type="button">{label ?? 'Hint'}</button>
      </Tooltip.Trigger>
      <Tooltip.Content>{tip ?? 'Archive'}</Tooltip.Content>
    </Tooltip>
  );
}

function InteractiveTip({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: Omit<TooltipProps, 'children' | 'interactive'> & Partial<TooltipContentName>) {
  const name =
    ariaLabelledby !== undefined
      ? { 'aria-labelledby': ariaLabelledby }
      : { 'aria-label': ariaLabel ?? 'Policy' };
  return (
    <Tooltip interactive {...props} {...name}>
      <Tooltip.Trigger>
        <button type="button">Hint</button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        Short prose. <a href="/tooltip">Read the policy</a>
      </Tooltip.Content>
    </Tooltip>
  );
}

describe('Tooltip exports', () => {
  it('exports the public compound and reason union', () => {
    expect(api.Tooltip).toBe(Tooltip);
    expectTypeOf<TooltipProps>().toHaveProperty('interactive');
    expectTypeOf<TooltipTriggerProps>().toHaveProperty('children');
    expectTypeOf<TooltipContentProps>().not.toHaveProperty('role');
    expectTypeOf<TooltipContentProps>().not.toHaveProperty('popover');
    expectTypeOf<TooltipContentProps>().not.toHaveProperty('tabIndex');
    expectTypeOf<TooltipContentProps>().not.toHaveProperty('id');
    expectTypeOf<TooltipOpenReason>().toEqualTypeOf<'hover' | 'focus' | 'escape' | 'hover-bridge'>();
  });

  it('accepts exactly one accessible name on interactive content', () => {
    const labelled: TooltipContentProps = { 'aria-label': 'Policy' };
    const captioned: TooltipContentProps = { 'aria-labelledby': 'policy-caption' };
    expect(labelled['aria-label']).toBe('Policy');
    expect(captioned['aria-labelledby']).toBe('policy-caption');
    expectTypeOf<{ 'aria-label': string }>().toMatchTypeOf<TooltipContentName>();
    expectTypeOf<{ 'aria-labelledby': string }>().toMatchTypeOf<TooltipContentName>();
    expectTypeOf<{ 'aria-label': string; 'aria-labelledby': string }>().not.toMatchTypeOf<TooltipContentName>();
    expectTypeOf<Record<string, never>>().not.toMatchTypeOf<TooltipContentName>();
    expectTypeOf<{ interactive: true; children: null }>().not.toMatchTypeOf<TooltipProps>();
    expectTypeOf<{
      interactive: true;
      children: null;
      'aria-label': string;
    }>().toMatchTypeOf<TooltipProps>();
    expectTypeOf<{
      interactive: true;
      children: null;
      'aria-labelledby': string;
    }>().toMatchTypeOf<TooltipProps>();
    expectTypeOf<{ children: null }>().toMatchTypeOf<TooltipProps>();
  });
});

describe('Tooltip', () => {
  it('defaults to role=tooltip and no popover', () => {
    render(<DefaultTip defaultOpen />);
    const tip = screen.getByRole('tooltip');
    expect(tip.getAttribute('data-surface')).toBe('tip');
    expect(tip.hasAttribute('popover')).toBe(false);
    expect(tip.hasAttribute('aria-label')).toBe(false);
    expect(tip.hasAttribute('aria-labelledby')).toBe(false);
    expect(document.querySelector('[popover]')).toBeNull();
  });

  it('uses popover=manual and role=dialog with a name when interactive', () => {
    render(<InteractiveTip />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    const panel = document.querySelector('[popover="manual"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-label')).toBe('Policy');
    expect(panel?.getAttribute('data-surface')).toBe('panel');
    expect(screen.getByRole('dialog', { name: 'Policy', hidden: true })).toBe(panel);
  });

  it('names the dialog from aria-labelledby', () => {
    render(
      <>
        <span id="policy-caption">Policy</span>
        <InteractiveTip aria-labelledby="policy-caption" />
      </>,
    );
    const panel = document.querySelector('[popover="manual"]');
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-labelledby')).toBe('policy-caption');
    expect(panel?.hasAttribute('aria-label')).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Policy', hidden: true })).toBe(panel);
  });

  it('lets Content replace the Tooltip name', () => {
    render(
      <>
        <span id="policy-caption">Policy</span>
        <Tooltip interactive aria-label="Root">
          <Tooltip.Trigger>
            <button type="button">Hint</button>
          </Tooltip.Trigger>
          <Tooltip.Content aria-labelledby="policy-caption">
            Short prose. <a href="/tooltip">Read the policy</a>
          </Tooltip.Content>
        </Tooltip>
      </>,
    );
    const panel = document.querySelector('[popover="manual"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe('policy-caption');
    expect(panel?.hasAttribute('aria-label')).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Policy', hidden: true })).toBe(panel);
  });

  it('shows on hover after 300ms and hides after 100ms', () => {
    render(<DefaultTip />);
    const wrap = wrapOf(screen.getByRole('button', { name: 'Hint' }));
    fireEvent.pointerEnter(wrap);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(299);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip').textContent).toBe('Archive');
    fireEvent.pointerLeave(wrap, { relatedTarget: document.body });
    advance(99);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    advance(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on focus without advancing the hover delay', () => {
    render(<DefaultTip />);
    fireEvent.focusIn(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Archive');
  });

  it('ignores hover on coarse pointers and still opens on focus', () => {
    setMatchMedia('(pointer: coarse)', true);
    render(<DefaultTip />);
    const button = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(wrapOf(button));
    advance(300);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focusIn(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('opens from the wrap when the child is disabled', () => {
    render(
      <Tooltip>
        <Tooltip.Trigger>
          <button type="button" disabled>
            Hint
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Archive</Tooltip.Content>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(wrapOf(button));
    advance(300);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('makes a ChipOverflow wrap tabbable', () => {
    render(
      <Tooltip>
        <Tooltip.Trigger>
          <Chip.Overflow overflowCount={2} />
        </Tooltip.Trigger>
        <Tooltip.Content>Schema, Docs</Tooltip.Content>
      </Tooltip>,
    );
    const overflow = document.querySelector('[data-overflow]');
    expect(overflow).not.toBeNull();
    expect(overflow?.parentElement?.tabIndex).toBe(0);
  });

  it('sets aria-describedby on the tabbable child while open and clears it when closed', () => {
    render(<DefaultTip />);
    const button = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(wrapOf(button));
    advance(300);
    const tip = screen.getByRole('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(tip.id);
    fireEvent.pointerLeave(wrapOf(button), { relatedTarget: document.body });
    advance(100);
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('sets aria-describedby on the wrap when no descendant is tabbable', () => {
    render(
      <Tooltip defaultOpen>
        <Tooltip.Trigger>
          <Chip.Overflow overflowCount={2} />
        </Tooltip.Trigger>
        <Tooltip.Content>Schema, Docs</Tooltip.Content>
      </Tooltip>,
    );
    const wrap = document.querySelector('[data-overflow]')?.parentElement;
    const tip = screen.getByRole('tooltip');
    expect(wrap?.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('supports controlled open, defaultOpen, and veto', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<DefaultTip open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    const wrap = wrapOf(screen.getByRole('button', { name: 'Hint' }));
    fireEvent.pointerEnter(wrap);
    advance(300);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true, 'hover');
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerEnter(wrap);
    expect(onOpenChange).toHaveBeenCalledTimes(1);

    rerender(<DefaultTip open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    const { unmount } = render(<DefaultTip defaultOpen />);
    expect(screen.getAllByRole('tooltip')).toHaveLength(2);
    unmount();
  });

  it('lets Tab reach a link, closes after Tab past the last link, keeps hover on the panel, and Escape focuses the trigger without reopen', () => {
    render(
      <>
        <InteractiveTip />
        <button type="button">After</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Hint' });
    const panel = document.querySelector('[data-surface="panel"]') as HTMLElement;
    const link = screen.getByRole('link', { name: 'Read the policy' });
    const after = screen.getByRole('button', { name: 'After' });

    expect(link.getAttribute('href')).toBe('/tooltip');
    fireEvent.focusIn(trigger);
    expect(panel.getAttribute('data-open')).toBe('');
    expect(panel.hasAttribute('data-popover-open')).toBe(true);

    link.focus();
    fireEvent.focusIn(link);
    expect(panel.getAttribute('data-open')).toBe('');

    after.focus();
    fireEvent.focusIn(after);
    advance(100);
    expect(panel.getAttribute('data-open')).toBeNull();
    expect(panel.hasAttribute('data-popover-open')).toBe(false);

    const wrap = wrapOf(trigger);
    fireEvent.pointerEnter(wrap);
    advance(300);
    expect(panel.getAttribute('data-open')).toBe('');
    fireEvent.pointerLeave(wrap, { relatedTarget: panel });
    fireEvent.pointerEnter(panel);
    advance(100);
    expect(panel.getAttribute('data-open')).toBe('');

    link.focus();
    fireEvent.focusIn(link);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
    expect(panel.getAttribute('data-open')).toBeNull();
    fireEvent.focusIn(trigger);
    expect(panel.getAttribute('data-open')).toBeNull();
  });

  it('leaves focus on the link when Escape is vetoed', () => {
    const onOpenChange = vi.fn();
    render(<InteractiveTip open onOpenChange={onOpenChange} />);
    const link = screen.getByRole('link', { name: 'Read the policy' });
    const panel = document.querySelector('[data-surface="panel"]') as HTMLElement;
    link.focus();
    fireEvent.focusIn(link);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    expect(document.activeElement).toBe(link);
    expect(panel.getAttribute('data-open')).toBe('');
  });

  it('does not import Popover and keeps CSS anchors plus tip pointer-events', () => {
    expect(source).not.toContain('./Popover');
    expect(source).not.toContain('useControlledOpen');
    expect(source).not.toContain('useFocusRestore');
    expect(source).not.toContain('useInitialFocus');
    expect(source).not.toContain('useFocusTrap');
    expect(source).not.toContain('useInertOutside');
    expect(source).not.toContain('useScrollLock');
    const froms = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(new Set(froms)).toEqual(
      new Set([
        'react',
        '../hooks/useControlledState',
        '../overlay/tabbables',
        '../overlay/useEscapeKey',
        '../overlay/usePopoverSync',
        './Tooltip.intent',
        './Tooltip.surface',
        './Tooltip.module.css',
      ]),
    );
    expect(css).toContain('anchor(');
    expect(css).toContain(".content[data-surface='tip']");
    expect(css).toContain('.content:not([data-open])');
  });
});

describe('Tooltip controlled harness', () => {
  it('updates from onOpenChange when the consumer writes open', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <DefaultTip open={open} onOpenChange={(next) => setOpen(next)} />;
    }
    render(<Harness />);
    fireEvent.pointerEnter(wrapOf(screen.getByRole('button', { name: 'Hint' })));
    advance(300);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });
});
