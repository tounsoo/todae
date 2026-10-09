import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type CSSProperties } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index';
import { useTooltip, type TooltipOpenReason, type UseTooltipOptions } from '../hooks/useTooltip';
import { resetMatchMedia, setMatchMedia } from '../test/setup';
import { Chip } from './Chip';
import { Tooltip, type TooltipContentName, type TooltipRootProps } from './Tooltip';

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

function DefaultTip(
  props: UseTooltipOptions & {
    label?: string;
    tip?: string;
  },
) {
  const { label, tip, ...options } = props;
  const tooltip = useTooltip(options);
  return (
    <>
      <button type="button" {...tooltip.getTriggerProps()}>
        {label ?? 'Hint'}
      </button>
      <Tooltip.Root {...tooltip.getTooltipProps()}>{tip ?? 'Archive'}</Tooltip.Root>
    </>
  );
}

function InteractiveTip({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...options
}: Omit<UseTooltipOptions<true>, 'interactive'> & Partial<TooltipContentName>) {
  const tooltip = useTooltip({ ...options, interactive: true });
  const name =
    ariaLabelledby !== undefined
      ? { 'aria-labelledby': ariaLabelledby }
      : { 'aria-label': ariaLabel ?? 'Policy' };
  return (
    <>
      <button type="button" {...tooltip.getTriggerProps()}>
        Hint
      </button>
      <Tooltip.Root {...tooltip.getTooltipProps()} {...name}>
        Short prose. <a href="/tooltip">Read the policy</a>
      </Tooltip.Root>
    </>
  );
}

describe('Tooltip exports', () => {
  it('exports the surface and hard-cuts Trigger and Content', () => {
    expect(api.Tooltip).toBe(Tooltip);
    expect(api.useTooltip).toBeDefined();
    expect(Tooltip).not.toHaveProperty('Trigger');
    expect(Tooltip).not.toHaveProperty('Content');
    expectTypeOf<TooltipRootProps>().toHaveProperty('id');
    expectTypeOf<TooltipRootProps>().toHaveProperty('open');
    expectTypeOf<TooltipRootProps>().toHaveProperty('interactive');
    expectTypeOf<TooltipRootProps>().toHaveProperty('ref');
    expectTypeOf<TooltipRootProps>().toHaveProperty('style');
    expectTypeOf<TooltipRootProps>().not.toHaveProperty('showDelay');
    expectTypeOf<TooltipRootProps>().not.toHaveProperty('hideDelay');
    expectTypeOf<TooltipRootProps>().not.toHaveProperty('onOpenChange');
    expectTypeOf<TooltipRootProps>().not.toHaveProperty('enabled');
    expectTypeOf<TooltipRootProps>().not.toHaveProperty('onClick');
    expectTypeOf<TooltipOpenReason>().toEqualTypeOf<'hover' | 'focus' | 'escape' | 'hover-bridge'>();
  });

  it('accepts exactly one accessible name when interactive', () => {
    const labelled: TooltipRootProps = {
      id: 'p',
      open: true,
      interactive: true,
      ref: () => {},
      style: {},
      onPointerEnter: () => {},
      onPointerLeave: () => {},
      'aria-label': 'Policy',
    };
    const captioned: TooltipRootProps = {
      id: 'p',
      open: true,
      interactive: true,
      ref: () => {},
      style: {},
      onPointerEnter: () => {},
      onPointerLeave: () => {},
      'aria-labelledby': 'policy-caption',
    };
    expect(labelled['aria-label']).toBe('Policy');
    expect(captioned['aria-labelledby']).toBe('policy-caption');
    expectTypeOf<{ 'aria-label': string }>().toMatchTypeOf<TooltipContentName>();
    expectTypeOf<{ 'aria-labelledby': string }>().toMatchTypeOf<TooltipContentName>();
    expectTypeOf<{ 'aria-label': string; 'aria-labelledby': string }>().not.toMatchTypeOf<TooltipContentName>();
    expectTypeOf<Record<string, never>>().not.toMatchTypeOf<TooltipContentName>();
    expectTypeOf<{ interactive: true; id: string; open: boolean }>().not.toMatchTypeOf<TooltipRootProps>();
    expectTypeOf<{
      interactive: true;
      id: string;
      open: boolean;
      ref: (node: HTMLElement | null) => void;
      style: CSSProperties;
      onPointerEnter: () => void;
      onPointerLeave: () => void;
      'aria-label': string;
    }>().toMatchTypeOf<TooltipRootProps>();
    expectTypeOf<{
      interactive: true;
      id: string;
      open: boolean;
      ref: (node: HTMLElement | null) => void;
      style: CSSProperties;
      onPointerEnter: () => void;
      onPointerLeave: () => void;
      'aria-labelledby': string;
    }>().toMatchTypeOf<TooltipRootProps>();
    expectTypeOf<{
      interactive: true;
      id: string;
      open: boolean;
      ref: (node: HTMLElement | null) => void;
      style: CSSProperties;
      onPointerEnter: () => void;
      onPointerLeave: () => void;
      'aria-label': string;
      'aria-labelledby': string;
    }>().not.toMatchTypeOf<TooltipRootProps>();
    expectTypeOf<{ id: string; open: boolean }>().not.toMatchTypeOf<TooltipRootProps>();
  });
});

describe('Tooltip', () => {
  it('defaults to role=tooltip in a manual popover, with no name of its own', () => {
    render(<DefaultTip defaultOpen />);
    const tip = screen.getByRole('tooltip');
    expect(tip.getAttribute('data-surface')).toBe('tip');
    expect(tip.getAttribute('popover')).toBe('manual');
    expect(tip.hasAttribute('aria-label')).toBe(false);
    expect(tip.hasAttribute('aria-labelledby')).toBe(false);
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

  it('shows on hover after 300ms and hides after 100ms', () => {
    render(<DefaultTip />);
    const trigger = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(299);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip').textContent).toBe('Archive');
    fireEvent.pointerLeave(trigger, { relatedTarget: document.body });
    advance(99);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    advance(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on focus without advancing the hover delay', () => {
    render(<DefaultTip />);
    fireEvent.focus(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Archive');
  });

  it('ignores hover on coarse pointers and still opens on focus', () => {
    setMatchMedia('(pointer: coarse)', true);
    render(<DefaultTip />);
    const button = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(button);
    advance(300);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('describes a Chip.Overflow wrap the author marks tabbable', () => {
    function OverflowTip() {
      const tooltip = useTooltip({ defaultOpen: true });
      return (
        <>
          <span {...tooltip.getTriggerProps({ tabIndex: 0 })}>
            <Chip.Overflow overflowCount={2} />
          </span>
          <Tooltip.Root {...tooltip.getTooltipProps()}>Schema, Docs</Tooltip.Root>
        </>
      );
    }
    render(<OverflowTip />);
    const wrap = document.querySelector('[data-overflow]')?.parentElement;
    const tip = screen.getByRole('tooltip');
    expect(wrap?.tabIndex).toBe(0);
    expect(wrap?.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('sets aria-describedby on the trigger while open and clears it when closed', () => {
    render(<DefaultTip />);
    const button = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(button);
    advance(300);
    const tip = screen.getByRole('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(tip.id);
    fireEvent.pointerLeave(button, { relatedTarget: document.body });
    advance(100);
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('supports controlled open, defaultOpen, and veto', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<DefaultTip open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(trigger);
    advance(300);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true, 'hover');
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerEnter(trigger);
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
    fireEvent.focus(trigger);
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

    fireEvent.pointerEnter(trigger);
    advance(300);
    expect(panel.getAttribute('data-open')).toBe('');
    fireEvent.pointerLeave(trigger, { relatedTarget: panel });
    fireEvent.pointerEnter(panel);
    advance(100);
    expect(panel.getAttribute('data-open')).toBe('');

    link.focus();
    fireEvent.focusIn(link);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
    expect(panel.getAttribute('data-open')).toBeNull();
    fireEvent.focus(trigger);
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

  it('does not own a machine and keeps CSS anchors plus tip pointer-events', () => {
    expect(source).not.toContain('useTooltip');
    expect(source).not.toContain('createIntent');
    expect(source).not.toContain('./Popover');
    expect(source).not.toContain('useControlledOpen');
    expect(source).not.toContain('useFocusRestore');
    expect(source).not.toContain('useInitialFocus');
    expect(source).not.toContain('useFocusTrap');
    expect(source).not.toContain('useInertOutside');
    expect(source).not.toContain('Tooltip.Trigger');
    expect(source).not.toContain('Tooltip.Content');
    const froms = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(new Set(froms)).toEqual(
      new Set([
        'react',
        '../overlay/usePopoverSync',
        './Tooltip.surface',
        './Tooltip.wire',
        './Tooltip.module.css',
        './props',
      ]),
    );
    expect(css).not.toContain('.trigger');
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
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Hint' }));
    advance(300);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });
});
