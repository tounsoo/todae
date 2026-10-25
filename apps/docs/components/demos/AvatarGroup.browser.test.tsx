import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { type CSSProperties, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avatar, Tooltip, useTooltip } from '@tounsoo/todae';
import '@tounsoo/todae/todae.css';
import styles from './AvatarGroupDemo.module.css';

afterEach(cleanup);

function Themed({ children, dir }: { children: ReactNode; dir?: 'ltr' | 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir} style={{ padding: 40 }}>
      {children}
    </div>
  );
}

function Assignees({ children }: { children: ReactNode }) {
  return (
    <div role="group" aria-label="Assignees" className={`${styles.avatarGroup} ${styles.large}`}>
      {children}
    </div>
  );
}

function Three({ dir }: { dir?: 'ltr' | 'rtl' }) {
  return (
    <Themed dir={dir}>
      <Assignees>
        <Avatar.Root className={styles.avatar} label="Ada" data-testid="a">
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
        <Avatar.Root className={styles.avatar} label="Grace" data-testid="b">
          <Avatar.Fallback>GH</Avatar.Fallback>
        </Avatar.Root>
        <Avatar.Root className={styles.avatar} label="Alan" data-testid="c">
          <Avatar.Fallback>AT</Avatar.Fallback>
        </Avatar.Root>
      </Assignees>
    </Themed>
  );
}

function emulateMedia(features: { name: string; value: string }[]) {
  return cdp().send('Emulation.setEmulatedMedia', { features });
}

const STACK_SIZE = 40;
const OVERLAP = STACK_SIZE * 0.25;

describe('Avatar group recipe in a browser', () => {
  it('is a group named by the caller', () => {
    render(<Three />);
    expect(screen.getByRole('group', { name: 'Assignees' })).toBeTruthy();
  });

  it('overlaps the second avatar onto the first by 0.25 times the stack size in ltr', () => {
    render(<Three />);
    const a = screen.getByTestId('a').getBoundingClientRect();
    const b = screen.getByTestId('b').getBoundingClientRect();
    expect(a.width).toBe(STACK_SIZE);
    expect(a.right - b.left).toBeCloseTo(OVERLAP, 0);
  });

  it('mirrors the overlap in rtl', () => {
    render(<Three dir="rtl" />);
    const a = screen.getByTestId('a').getBoundingClientRect();
    const b = screen.getByTestId('b').getBoundingClientRect();
    expect(b.right - a.left).toBeCloseTo(OVERLAP, 0);
    expect(b.left).toBeLessThan(a.left);
  });

  it('paints a later avatar over the earlier one', () => {
    render(<Three />);
    const a = screen.getByTestId('a').getBoundingClientRect();
    const b = screen.getByTestId('b').getBoundingClientRect();
    const hit = document.elementFromPoint((b.left + a.right) / 2, a.top + a.height / 2);
    expect(screen.getByTestId('b').contains(hit)).toBe(true);
  });

  it('overlaps an avatar with its own size by the stack size', () => {
    const small = { '--todae-avatar-size-md': 'var(--todae-avatar-size-sm)' } as CSSProperties;
    render(
      <Themed>
        <Assignees>
          <Avatar.Root className={styles.avatar} label="Ada" data-testid="a">
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <Avatar.Root className={styles.avatar} label="Grace" style={small} data-testid="b">
            <Avatar.Fallback>GH</Avatar.Fallback>
          </Avatar.Root>
        </Assignees>
      </Themed>,
    );
    const a = screen.getByTestId('a').getBoundingClientRect();
    const b = screen.getByTestId('b').getBoundingClientRect();
    expect(b.width).toBe(24);
    expect(a.right - b.left).toBeCloseTo(OVERLAP, 0);
  });

  it('lifts a focused interactive wrapper above the avatar after it', async () => {
    render(
      <Themed>
        <Assignees>
          <button type="button" data-testid="first" aria-label="Ada">
            <Avatar.Root className={styles.avatar}>
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
          </button>
          <Avatar.Root className={styles.avatar} label="Grace" data-testid="second">
            <Avatar.Fallback>GH</Avatar.Fallback>
          </Avatar.Root>
        </Assignees>
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

  it('lifts a wrapper whose descendant has focus', async () => {
    render(
      <Themed>
        <Assignees>
          <span data-testid="first">
            <a href="#ada" aria-label="Ada">
              <Avatar.Root className={styles.avatar}>
                <Avatar.Fallback>AL</Avatar.Fallback>
              </Avatar.Root>
            </a>
          </span>
          <Avatar.Root className={styles.avatar} label="Grace">
            <Avatar.Fallback>GH</Avatar.Fallback>
          </Avatar.Root>
        </Assignees>
      </Themed>,
    );
    const first = screen.getByTestId('first');
    expect(getComputedStyle(first).zIndex).toBe('auto');
    await userEvent.tab();
    await waitFor(() => expect(getComputedStyle(first).zIndex).toBe('1'));
  });

  it('gives an open tooltip sibling no overlap margin', async () => {
    function Harness() {
      const tooltip = useTooltip();
      return (
        <Themed>
          <Assignees>
            <Avatar.Root className={styles.avatar} label="Ada" data-testid="a">
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
            <button type="button" data-testid="trigger" aria-label="Grace" {...tooltip.getTriggerProps()}>
              <Avatar.Root className={styles.avatar}>
                <Avatar.Fallback>GH</Avatar.Fallback>
              </Avatar.Root>
            </button>
            <Tooltip.Root {...tooltip.getTooltipProps()}>Grace Hopper</Tooltip.Root>
          </Assignees>
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
        <Assignees>
          <Avatar.Root className={styles.avatar} label="Ada">
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <div popover="manual" data-testid="panel">
            Details
          </div>
        </Assignees>
      </Themed>,
    );
    const panel = screen.getByTestId('panel');
    panel.showPopover();
    expect(Number.parseFloat(getComputedStyle(panel).marginInlineStart)).toBeGreaterThanOrEqual(0);
  });

  it('leaves focused popover content in the group at its own position', () => {
    render(
      <Themed>
        <Assignees>
          <Avatar.Root className={styles.avatar} label="Ada">
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <div popover="manual" data-testid="panel">
            <button type="button">Details</button>
          </div>
        </Assignees>
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
        <Assignees>
          <Avatar.Root className={styles.avatar} label="Ada">
            <Avatar.Fallback>AL</Avatar.Fallback>
          </Avatar.Root>
          <dialog data-testid="dialog" aria-label="Details">
            <button type="button">Close</button>
          </dialog>
        </Assignees>
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
        <Assignees>
          <button type="button" data-testid="first" aria-label="Ada">
            <Avatar.Root className={styles.avatar}>
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
          </button>
        </Assignees>
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

  describe('in forced colors', () => {
    it('draws a CanvasText border of border width on each avatar', async () => {
      await emulateMedia([{ name: 'forced-colors', value: 'active' }]);
      try {
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        render(<Three />);
        const probe = document.createElement('div');
        probe.style.cssText = 'forced-color-adjust: none; color: CanvasText';
        document.body.append(probe);
        const canvasText = getComputedStyle(probe).color;
        probe.remove();
        const avatar = getComputedStyle(screen.getByTestId('b'));
        expect(avatar.borderTopWidth).toBe('1px');
        expect(avatar.borderTopStyle).toBe('solid');
        expect(avatar.borderTopColor).toBe(canvasText);
      } finally {
        await emulateMedia([]);
      }
    });
  });
});
