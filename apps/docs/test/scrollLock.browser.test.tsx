/// <reference types="@vitest/browser-playwright" />
import { cleanup, render, waitFor } from '@testing-library/react';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { BottomSheet, Dialog, Drawer } from '@tounsoo/todae';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
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
        const dialog = document.querySelector('dialog');
        expect(dialog == null || dialog.open).toBe(false);
      });
      expect(pageBox().width).toBe(before.width);
      expect(markerBox().left).toBe(beforeMarker);
    });
  });
});
