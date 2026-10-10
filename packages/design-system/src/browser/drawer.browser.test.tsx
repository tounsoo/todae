import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from '../components/Dialog';
import { Drawer, type DrawerSide } from '../components/Drawer';

afterEach(cleanup);

function Open({ side, dir, open = true }: { side?: DrawerSide; dir?: 'rtl'; open?: boolean }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      <Drawer.Root open={open} onOpenChange={() => undefined} side={side}>
        <Dialog.Title>Filters</Dialog.Title>
        <Dialog.Body data-testid="body">Body</Dialog.Body>
        <Dialog.Footer data-testid="footer">Footer</Dialog.Footer>
      </Drawer.Root>
    </div>
  );
}

// The panel, once its enter motion has settled.
async function settledPanel() {
  const drawer = screen.getByRole('dialog', { name: 'Filters' });
  await waitFor(() => expect(drawer.hasAttribute('data-entered')).toBe(true));
  const panel = screen.getByTestId('body').parentElement!;
  await waitFor(() => expect(getComputedStyle(panel).insetInlineStart).toBe('0px'));
  return { panel: panel.getBoundingClientRect(), scrim: drawer.getBoundingClientRect() };
}

describe('Drawer in a browser', () => {
  it('keeps the panel opaque while it slides out', async () => {
    const { rerender } = render(<Open />);
    await settledPanel();
    rerender(<Open open={false} />);
    const drawer = screen.getByRole('dialog', { name: 'Filters' });
    expect(drawer.hasAttribute('data-todae-exiting')).toBe(true);
    expect(getComputedStyle(drawer).opacity).toBe('1');
    expect(getComputedStyle(screen.getByTestId('body').parentElement!).opacity).toBe('1');
    expect(getComputedStyle(drawer).transitionProperty).toBe('background-color');
    // Not a scroll container, so the panel sliding off-screen adds no scrolling.
    expect(getComputedStyle(drawer).overflowX).toBe('clip');
    await waitFor(() => expect(drawer.hasAttribute('open')).toBe(false));
  });

  it('fills the height at the end edge, narrower than the viewport', async () => {
    render(<Open />);
    const { panel, scrim } = await settledPanel();
    expect(Math.round(panel.right)).toBe(Math.round(scrim.right));
    expect(Math.round(panel.top)).toBe(Math.round(scrim.top));
    expect(Math.round(panel.height)).toBe(Math.round(scrim.height));
    expect(panel.width).toBeLessThan(scrim.width);
  });

  it('pins start to the left, and swaps sides in right-to-left text', async () => {
    const edges = async () => {
      const { panel, scrim } = await settledPanel();
      return { left: Math.round(panel.left - scrim.left), right: Math.round(scrim.right - panel.right) };
    };
    render(<Open side="start" />);
    expect((await edges()).left).toBe(0);
    cleanup();
    render(<Open side="start" dir="rtl" />);
    expect((await edges()).right).toBe(0);
    cleanup();
    render(<Open dir="rtl" />);
    expect((await edges()).left).toBe(0);
  });

  it('turns off every transition under reduced motion, the open state included', async () => {
    // Applies the reduced-motion rules as if the media query matched, in the
    // same layer and after the rules they override.
    const reduced = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .flatMap((rule) => (rule instanceof CSSLayerBlockRule ? [...rule.cssRules] : [rule]))
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion'))
      .flatMap((rule) => [...rule.cssRules].map((inner) => inner.cssText));
    const style = document.createElement('style');
    style.textContent = `@layer todae.components { ${reduced.join('\n')} }`;
    document.head.append(style);
    try {
      render(<Open />);
      const drawer = screen.getByRole('dialog', { name: 'Filters' });
      render(
        <div data-appearance="light" data-density="comfortable">
          <Dialog.Root open onOpenChange={() => undefined} aria-label="Plain">
            <p>x</p>
          </Dialog.Root>
        </div>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Plain' });
      for (const el of [drawer, drawer.firstElementChild!, dialog, dialog.firstElementChild!]) {
        expect(getComputedStyle(el).transitionProperty).toBe('none');
      }
    } finally {
      style.remove();
    }
  });
});
