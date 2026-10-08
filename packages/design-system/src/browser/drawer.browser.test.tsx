import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from '../components/Dialog';
import { Drawer, type DrawerSide } from '../components/Drawer';

afterEach(cleanup);

function Open({ side, dir }: { side?: DrawerSide; dir?: 'rtl' }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      <Drawer.Root open onOpenChange={() => undefined} side={side}>
        <Dialog.Title>Filters</Dialog.Title>
        <Dialog.Body data-testid="body">Body</Dialog.Body>
      </Drawer.Root>
    </div>
  );
}

// The panel, once its enter motion has settled.
async function settledPanel() {
  const drawer = screen.getByRole('dialog', { name: 'Filters' });
  await waitFor(() => expect(drawer.hasAttribute('data-entered')).toBe(true));
  const panel = screen.getByTestId('body').parentElement!;
  await waitFor(() => expect(getComputedStyle(panel).transform).toBe('none'));
  return { panel: panel.getBoundingClientRect(), scrim: drawer.getBoundingClientRect() };
}

describe('Drawer in a browser', () => {
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
});
