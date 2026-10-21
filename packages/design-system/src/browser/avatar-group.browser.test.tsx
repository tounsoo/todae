import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../components/Avatar.js';
import { Tooltip } from '../components/Tooltip.js';
import { useTooltip } from '../hooks/useTooltip.js';

function Themed({ children, dir }: { children: ReactNode; dir?: 'ltr' | 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir} style={{ padding: 40 }}>
      {children}
    </div>
  );
}

function Three({ dir }: { dir?: 'ltr' | 'rtl' }) {
  return (
    <Themed dir={dir}>
      <Avatar.Group aria-label="Assignees" size="lg">
        <Avatar.Root label="Ada" data-testid="a">
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
        <Avatar.Root label="Grace" data-testid="b">
          <Avatar.Fallback>GH</Avatar.Fallback>
        </Avatar.Root>
        <Avatar.Root label="Alan" data-testid="c">
          <Avatar.Fallback>AT</Avatar.Fallback>
        </Avatar.Root>
      </Avatar.Group>
    </Themed>
  );
}

function overlapToken(): number {
  const group = screen.getByRole('group');
  const overlap = Number.parseFloat(getComputedStyle(group).getPropertyValue('--todae-avatar-group-overlap'));
  expect(overlap).toBeGreaterThan(0);
  return overlap;
}

describe('Avatar.Group in a browser', () => {
  it('overlaps the second avatar onto the first by overlap times size in ltr', () => {
    render(<Three />);
    const a = screen.getByTestId('a').getBoundingClientRect();
    const b = screen.getByTestId('b').getBoundingClientRect();
    expect(a.width).toBeGreaterThan(0);
    const expected = a.width * overlapToken();
    expect(a.right - b.left).toBeCloseTo(expected, 0);
    expect(b.left).toBeLessThan(a.right);
  });

  it('mirrors the overlap in rtl', () => {
    render(<Three dir="rtl" />);
    const a = screen.getByTestId('a').getBoundingClientRect();
    const b = screen.getByTestId('b').getBoundingClientRect();
    expect(b.right - a.left).toBeCloseTo(a.width * overlapToken(), 0);
    expect(b.right).toBeGreaterThan(a.left);
    expect(b.left).toBeLessThan(a.left);
  });

  it('paints a later avatar over the earlier one', () => {
    render(<Three />);
    const a = screen.getByTestId('a');
    const b = screen.getByTestId('b');
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const x = (br.left + ar.right) / 2;
    const y = ar.top + ar.height / 2;
    const hit = document.elementFromPoint(x, y);
    expect(b.contains(hit)).toBe(true);
  });

  it('lifts a focused interactive wrapper above the avatar after it', async () => {
    render(
      <Themed>
        <Avatar.Group aria-label="Assignees" size="lg">
          <button type="button" data-testid="first" aria-label="Ada">
            <Avatar.Root>
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
          </button>
          <Avatar.Root label="Grace" data-testid="second">
            <Avatar.Fallback>GH</Avatar.Fallback>
          </Avatar.Root>
        </Avatar.Group>
      </Themed>,
    );
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    const fr = first.getBoundingClientRect();
    const sr = second.getBoundingClientRect();
    const point = { x: (sr.left + fr.right) / 2, y: fr.top + fr.height / 2 };
    expect(second.contains(document.elementFromPoint(point.x, point.y))).toBe(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    await waitFor(() => expect(first.contains(document.elementFromPoint(point.x, point.y))).toBe(true));
  });

  it('gives an open tooltip sibling no overlap margin', async () => {
    function Harness() {
      const tooltip = useTooltip();
      return (
        <Themed>
          <Avatar.Group aria-label="Assignees" size="lg">
            <Avatar.Root label="Ada" data-testid="a">
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
            <button type="button" data-testid="trigger" aria-label="Grace" {...tooltip.getTriggerProps()}>
              <Avatar.Root>
                <Avatar.Fallback>GH</Avatar.Fallback>
              </Avatar.Root>
            </button>
            <Tooltip.Root {...tooltip.getTooltipProps()}>
              Grace Hopper
            </Tooltip.Root>
          </Avatar.Group>
        </Themed>
      );
    }
    render(<Harness />);
    await userEvent.hover(screen.getByTestId('trigger'));
    const tip = await screen.findByRole('tooltip');
    await waitFor(() => expect(tip.matches(':popover-open')).toBe(true));
    expect(getComputedStyle(tip).marginInlineStart).toBe('0px');
    expect(Number.parseFloat(getComputedStyle(screen.getByTestId('trigger')).marginInlineStart)).toBeLessThan(0);
  });

  it('leaves popover content in the group out of the overlap rule', () => {
    render(
      <Themed>
        <Avatar.Group aria-label="Assignees" size="lg">
          <Avatar.Root label="Ada">
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <div popover="manual" data-testid="panel">
            Details
          </div>
        </Avatar.Group>
      </Themed>,
    );
    const panel = screen.getByTestId('panel');
    panel.showPopover();
    expect(Number.parseFloat(getComputedStyle(panel).marginInlineStart)).toBeGreaterThanOrEqual(0);
  });

  it('leaves focused popover content in the group at its own position', () => {
    render(
      <Themed>
        <Avatar.Group aria-label="Assignees" size="lg">
          <Avatar.Root label="Ada">
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <div popover="manual" data-testid="panel">
            <button type="button">Details</button>
          </div>
        </Avatar.Group>
      </Themed>,
    );
    const panel = screen.getByTestId('panel');
    panel.showPopover();
    screen.getByRole('button', { name: 'Details' }).focus({ focusVisible: true } as FocusOptions);
    expect(panel.matches(':has(:focus-visible)')).toBe(true);
    expect(getComputedStyle(panel).position).toBe('fixed');
  });

  it('leaves a focused modal dialog in the group fixed and centered', () => {
    render(
      <Themed>
        <Avatar.Group aria-label="Assignees" size="lg">
          <Avatar.Root label="Ada">
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <dialog data-testid="dialog" aria-label="Details">
            <button type="button">Close</button>
          </dialog>
        </Avatar.Group>
      </Themed>,
    );
    const dialog = screen.getByTestId('dialog') as HTMLDialogElement;
    dialog.showModal();
    try {
      screen.getByRole('button', { name: 'Close' }).focus({ focusVisible: true } as FocusOptions);
      expect(dialog.matches(':has(:focus-visible)')).toBe(true);
      expect(getComputedStyle(dialog).position).toBe('fixed');
      const { marginInlineStart, marginInlineEnd } = getComputedStyle(dialog);
      expect(Number.parseFloat(marginInlineStart)).toBeCloseTo(Number.parseFloat(marginInlineEnd), 0);
    } finally {
      dialog.close();
    }
  });

  it('keeps page content above a focused wrapper', async () => {
    render(
      <Themed>
        <Avatar.Group aria-label="Assignees" size="lg">
          <button type="button" data-testid="first" aria-label="Ada">
            <Avatar.Root>
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
          </button>
        </Avatar.Group>
        <div data-testid="cover" style={{ position: 'relative', zIndex: 0, marginBlockStart: '-2.5rem', blockSize: '2.5rem', background: 'white' }} />
      </Themed>,
    );
    const first = screen.getByTestId('first');
    const box = first.getBoundingClientRect();
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    expect(screen.getByTestId('cover').contains(hit)).toBe(true);
  });

  it('lifts a wrapper whose descendant has focus', async () => {
    render(
      <Themed>
        <Avatar.Group aria-label="Assignees" size="lg">
          <span data-testid="first">
            <a href="#ada" aria-label="Ada">
              <Avatar.Root>
                <Avatar.Fallback>AL</Avatar.Fallback>
              </Avatar.Root>
            </a>
          </span>
          <Avatar.Root label="Grace">
            <Avatar.Fallback>GH</Avatar.Fallback>
          </Avatar.Root>
        </Avatar.Group>
      </Themed>,
    );
    const first = screen.getByTestId('first');
    expect(getComputedStyle(first).zIndex).toBe('auto');
    await userEvent.tab();
    await waitFor(() => expect(getComputedStyle(first).zIndex).toBe('1'));
  });
});
