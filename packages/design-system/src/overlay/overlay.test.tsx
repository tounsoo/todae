import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { DensityProvider } from '../providers/DensityProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import { OverlayPortal } from './OverlayPortal';
import { getTabbables } from './tabbables';
import { useFocusRestore } from './useFocusRestore';
import { useFocusTrap } from './useFocusTrap';
import { useInertOutside } from './useInertOutside';
import { useScrollLock } from './useScrollLock';
import { isExitTransition, transitionMs } from './useOverlayPresence';
import { dragHeight, dragOrigin, resolveRelease } from './useSnapDrag';

afterEach(cleanup);

function Lock({ active }: { active: boolean }) {
  useScrollLock(active);
  return null;
}

function Restore({ active, restore }: { active: boolean; restore?: { current: HTMLElement | null } }) {
  useFocusRestore(active, { restoreTo: restore });
  return active ? <button type="button">inside</button> : null;
}

function Trap() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useFocusTrap(node, true);
  return (
    <div ref={setNode} tabIndex={-1} data-testid="trap">
      <button type="button">one</button>
      <button type="button" disabled>
        skip
      </button>
      <button type="button">two</button>
    </div>
  );
}

function InertHost({ active }: { active: boolean }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useInertOutside(el, active);
  return <div ref={setEl} data-testid="portal-root" />;
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
});

describe('tabbables and trap', () => {
  it('wraps Tab and skips disabled', () => {
    render(<Trap />);
    const trap = screen.getByTestId('trap');
    const one = screen.getByRole('button', { name: 'one' });
    const two = screen.getByRole('button', { name: 'two' });
    expect(getTabbables(trap).map((el) => el.textContent)).toEqual(['one', 'two']);
    two.focus();
    fireEvent.keyDown(trap, { key: 'Tab' });
    expect(document.activeElement).toBe(one);
    fireEvent.keyDown(trap, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(two);
  });

  it('pulls focus back from outside', () => {
    render(
      <>
        <button type="button">outside</button>
        <Trap />
      </>,
    );
    screen.getByRole('button', { name: 'outside' }).focus();
    fireEvent.focusIn(screen.getByRole('button', { name: 'outside' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'one' }));
  });
});

describe('useInertOutside', () => {
  it('marks siblings inert and restores prior values', () => {
    const sibling = document.createElement('div');
    sibling.id = 'sib';
    document.body.appendChild(sibling);
    const { rerender, unmount } = render(<InertHost active />);
    expect(sibling.inert).toBe(true);
    expect(screen.getByTestId('portal-root').inert).toBe(false);
    rerender(<InertHost active={false} />);
    expect(sibling.inert).toBe(false);
    sibling.inert = true;
    rerender(<InertHost active />);
    unmount();
    expect(sibling.inert).toBe(true);
    sibling.remove();
  });
});

function mockMatchMedia(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? dark : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

describe('OverlayPortal', () => {
  it('emits nothing on the server', () => {
    expect(
      renderToString(
        <ThemeProvider appearance="dark">
          <DensityProvider density="compact">
            <OverlayPortal>sheet</OverlayPortal>
          </DensityProvider>
        </ThemeProvider>,
      ),
    ).not.toContain('sheet');
  });

  it('mirrors appearance, density, and override vars on the body node', async () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider
        appearance="dark"
        overrides={{ 'dialog.bg': { colorSpace: 'oklch', components: [0.2, 0.02, 260] } }}
      >
        <DensityProvider density="compact">
          <OverlayPortal>sheet</OverlayPortal>
        </DensityProvider>
      </ThemeProvider>,
    );
    const portal = await waitFor(() => {
      const node = document.querySelector('[data-todae-portal]');
      expect(node).toBeInstanceOf(HTMLElement);
      return node as HTMLElement;
    });
    expect(portal.getAttribute('data-appearance')).toBe('dark');
    expect(portal.getAttribute('data-density')).toBe('compact');
    expect(portal.style.getPropertyValue('--todae-dialog-bg')).toBe('oklch(0.2 0.02 260)');
    expect(portal.textContent).toBe('sheet');
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

