/// <reference types="@vitest/browser-playwright" />
import { cleanup, render, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { BottomSheet, Dialog, Drawer, useModalLayer } from '@tounsoo/todae';

const MARK = 'data-todae-no-page-scrollbar';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  document.documentElement.removeAttribute(MARK);
});

const roots = [
  ['Dialog', Dialog.Root],
  ['Drawer', Drawer.Root],
  ['BottomSheet', BottomSheet.Root],
] as const;

const pages = [
  ['short', 20],
  ['long', 4000],
] as const;

const widths = [390, 1280] as const;

const pageBox = () => document.querySelector('[data-testid="page"]')!.getBoundingClientRect();
const markerBox = () => document.querySelector('[data-testid="marker"]')!.getBoundingClientRect();

describe.each(roots)('%s', (name, Root) => {
  describe.each(pages)('%s page', (_length, height) => {
    it.each(widths)('keeps the page width when it opens and closes at %ipx', async (width) => {
      await page.viewport(width, 800);
      document.body.style.margin = '0';
      function Harness({ open }: { open: boolean }) {
        return (
          <>
            <div data-testid="page" style={{ height }} />
            <div data-testid="marker" style={{ width: 100, marginInline: 'auto' }} />
            <Root open={open} onOpenChange={() => undefined} aria-label="Panel">
              <p>Body</p>
            </Root>
          </>
        );
      }
      const { rerender } = render(<Harness open={false} />);
      if (height > 800) expect(document.documentElement.scrollHeight).toBeGreaterThan(window.innerHeight);
      const bar = window.innerWidth - document.documentElement.clientWidth;
      expect(bar).toBe(height > 800 ? 15 : 0);
      const before = pageBox();
      const beforeMarker = markerBox().left;

      rerender(<Harness open />);
      expect(pageBox().width).toBe(before.width);
      expect(markerBox().left).toBe(beforeMarker);
      if (name === 'Dialog') {
        const box = document.querySelector('dialog')!.getBoundingClientRect();
        expect(Math.round(box.left)).toBe(0);
        expect(Math.round(box.width)).toBe(Math.round(before.width));
      }

      rerender(<Harness open={false} />);
      await waitFor(() => {
        expect(document.querySelector('dialog')?.open ?? false).toBe(false);
      });
      expect(pageBox().width).toBe(before.width);
      expect(markerBox().left).toBe(beforeMarker);
      expect(document.documentElement.hasAttribute(MARK)).toBe(false);
    });
  });
});

function OwnDialog({ open }: { open: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModalLayer(ref, open);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label="Own">
      <p>Own</p>
    </dialog>
  );
}

describe('useModalLayer', () => {
  describe.each(pages)('%s page', (_length, height) => {
    it.each(widths)('keeps the page width when it opens and closes at %ipx', async (width) => {
      await page.viewport(width, 800);
      document.body.style.margin = '0';
      function Harness({ open }: { open: boolean }) {
        return (
          <>
            <div data-testid="page" style={{ height }} />
            <div data-testid="marker" style={{ width: 100, marginInline: 'auto' }} />
            <OwnDialog open={open} />
          </>
        );
      }
      const { rerender, unmount } = render(<Harness open={false} />);
      const bar = window.innerWidth - document.documentElement.clientWidth;
      expect(bar).toBe(height > 800 ? 15 : 0);
      const before = pageBox();
      const beforeMarker = markerBox().left;

      rerender(<Harness open />);
      await waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));
      expect(pageBox().width).toBe(before.width);
      expect(markerBox().left).toBe(beforeMarker);

      rerender(<Harness open={false} />);
      await waitFor(() => expect(document.querySelector('dialog')?.open ?? false).toBe(false));
      expect(pageBox().width).toBe(before.width);
      expect(markerBox().left).toBe(beforeMarker);
      expect(document.documentElement.hasAttribute(MARK)).toBe(false);
      unmount();
    });
  });

  it.each(widths)('keeps the page width when a Dialog opens over it at %ipx', async (width) => {
    await page.viewport(width, 800);
    document.body.style.margin = '0';
    function Harness({ dialog }: { dialog: boolean }) {
      return (
        <>
          <div data-testid="page" style={{ height: 20 }} />
          <div data-testid="marker" style={{ width: 100, marginInline: 'auto' }} />
          <OwnDialog open />
          <Dialog.Root open={dialog} onOpenChange={() => undefined} aria-label="Panel">
            <p>Body</p>
          </Dialog.Root>
        </>
      );
    }
    const { rerender } = render(<Harness dialog={false} />);
    await waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));
    expect(window.innerWidth - document.documentElement.clientWidth).toBe(0);
    const before = pageBox();
    const beforeMarker = markerBox().left;

    rerender(<Harness dialog />);
    await waitFor(() => expect(document.querySelectorAll('dialog').length).toBe(2));
    expect(pageBox().width).toBe(before.width);
    expect(markerBox().left).toBe(beforeMarker);
  });

  it('clears the marker when a dialog unmounts while open, then a long page keeps its scrollbar', async () => {
    await page.viewport(390, 800);
    document.body.style.margin = '0';
    const { unmount } = render(
      <>
        <div data-testid="page" style={{ height: 20 }} />
        <div data-testid="marker" style={{ width: 100, marginInline: 'auto' }} />
        <OwnDialog open />
      </>,
    );
    await waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));
    unmount();
    await waitFor(() => expect(document.documentElement.hasAttribute(MARK)).toBe(false));

    function Long({ open }: { open: boolean }) {
      return (
        <>
          <div data-testid="page" style={{ height: 4000 }} />
          <div data-testid="marker" style={{ width: 100, marginInline: 'auto' }} />
          <OwnDialog open={open} />
        </>
      );
    }
    const next = render(<Long open={false} />);
    expect(window.innerWidth - document.documentElement.clientWidth).toBe(15);
    const before = pageBox();
    const beforeMarker = markerBox().left;
    next.rerender(<Long open />);
    await waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));
    expect(pageBox().width).toBe(before.width);
    expect(markerBox().left).toBe(beforeMarker);
    next.unmount();
  });
});
