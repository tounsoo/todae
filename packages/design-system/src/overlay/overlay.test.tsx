import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { getTabbables } from './tabbables';
import { useFocusRestore } from './useFocusRestore';
import { useScrollLock } from './useScrollLock';
import { isExitTransition, transitionMs } from './useOverlayPresence';
import { dragHeight, dragOrigin, resolveRelease } from './useSnapDrag';

afterEach(cleanup);

function Lock({ active }: { active: boolean }) {
  useScrollLock(active);
  return null;
}

function Restore({
  active,
  restore,
  nativeReturn,
}: {
  active: boolean;
  restore?: { current: HTMLElement | null };
  nativeReturn?: boolean;
}) {
  useFocusRestore(active, { restoreTo: restore, nativeReturn });
  return active ? <button type="button">inside</button> : null;
}


describe('useScrollLock', () => {
  it('locks html overflow and restores prior inline values', () => {
    document.documentElement.style.overflow = 'scroll';
    const { rerender, unmount } = render(<Lock active />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    rerender(<Lock active={false} />);
    expect(document.documentElement.style.overflow).toBe('scroll');
    rerender(<Lock active />);
    const extra = render(<Lock active />);
    extra.unmount();
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('scroll');
    document.documentElement.style.overflow = '';
  });
});

describe('useFocusRestore', () => {
  it('returns focus to the trigger after close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(<Restore active />);
    screen.getByText('inside').focus();
    rerender(<Restore active={false} />);
    await Promise.resolve();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('keeps focus the person put on the opener, unless a closing dialog put it there', async () => {
    const opener = document.createElement('button');
    const restore = { current: document.createElement('button') };
    document.body.append(opener, restore.current);
    for (const nativeReturn of [false, true]) {
      opener.focus();
      const { rerender, unmount } = render(<Restore active restore={restore} nativeReturn={nativeReturn} />);
      screen.getByText('inside').focus();
      opener.focus();
      rerender(<Restore active={false} restore={restore} nativeReturn={nativeReturn} />);
      await Promise.resolve();
      expect(document.activeElement).toBe(nativeReturn ? restore.current : opener);
      unmount();
    }
    opener.remove();
    restore.current.remove();
  });

  it('does not move focus when it mounts closed', async () => {
    const restore = { current: document.createElement('button') };
    document.body.appendChild(restore.current);
    const { rerender } = render(<Restore active={false} restore={restore} />);
    rerender(<Restore active={false} restore={restore} />);
    await Promise.resolve();
    expect(document.activeElement).toBe(document.body);
    restore.current.remove();
  });
});

describe('getTabbables', () => {
  it('lists tabbable elements in order and skips disabled ones', () => {
    render(
      <div data-testid="box">
        <button type="button">one</button>
        <button type="button" disabled>
          skip
        </button>
        <button type="button">two</button>
      </div>,
    );
    expect(getTabbables(screen.getByTestId('box')).map((el) => el.textContent)).toEqual(['one', 'two']);
  });
});

describe('exit transition', () => {
  it('ignores bubbled child events', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.append(child);
    expect(isExitTransition({ target: parent, currentTarget: parent, propertyName: 'opacity' }, 'opacity')).toBe(true);
    expect(isExitTransition({ target: child, currentTarget: parent, propertyName: 'opacity' }, 'opacity')).toBe(false);
    expect(isExitTransition({ target: parent, currentTarget: parent, propertyName: 'transform' }, 'opacity')).toBe(false);
    expect(isExitTransition({ target: parent, currentTarget: parent, propertyName: '' }, 'opacity')).toBe(true);
    expect(isExitTransition({ target: parent, currentTarget: null, propertyName: 'opacity' }, 'opacity')).toBe(true);
  });
});

describe('useSnapDrag math', () => {
  it('grows height when the pointer moves up', () => {
    expect(dragHeight(400, -200, 736)).toBe(600);
    expect(dragHeight(736, 200, 736)).toBe(536);
    expect(dragHeight(400, 400, 736)).toBe(0);
  });

  it('resolves dismiss and nearest snap from a table', () => {
    const heights = { mid: 400, full: 800 };
    expect(
      resolveRelease({
        height: 150,
        velocity: 0,
        heights,
        snapPoints: ['mid', 'full'],
        dismissOnDrag: true,
      }),
    ).toBe('dismiss');
    expect(
      resolveRelease({
        height: 270,
        velocity: 0.4,
        heights,
        snapPoints: ['mid', 'full'],
        dismissOnDrag: true,
      }),
    ).toBe('dismiss');
    expect(
      resolveRelease({
        height: 700,
        velocity: -0.2,
        heights,
        snapPoints: ['mid', 'full'],
        dismissOnDrag: true,
      }),
    ).toBe('full');
    expect(
      resolveRelease({
        height: 150,
        velocity: 0,
        heights,
        snapPoints: ['full'],
        dismissOnDrag: false,
      }),
    ).toBe('full');
  });

  it('allows handle or unscrolled body only', () => {
    expect(dragOrigin({ fromHandle: true, inBody: false, scrollTop: 40 })).toBe('handle');
    expect(dragOrigin({ fromHandle: false, inBody: true, scrollTop: 0 })).toBe('body');
    expect(dragOrigin({ fromHandle: false, inBody: true, scrollTop: 12 })).toBeNull();
    expect(dragOrigin({ fromHandle: false, inBody: false, scrollTop: 0 })).toBeNull();
  });
});

describe('transitionMs', () => {
  it('reads the named property, falling back to all, and adds the delay', () => {
    const el = document.createElement('div');
    el.style.transitionProperty = 'height, transform';
    el.style.transitionDuration = '300ms, 0.28s';
    el.style.transitionDelay = '0s, 20ms';
    document.body.append(el);
    expect(transitionMs(el, 'transform')).toBe(300);
    expect(transitionMs(el, 'height')).toBe(300);
    expect(transitionMs(el, 'opacity')).toBeNull();
    el.style.transitionProperty = 'all';
    el.style.transitionDuration = '160ms';
    el.style.transitionDelay = '';
    expect(transitionMs(el, 'opacity')).toBe(160);
    el.remove();
  });
});

