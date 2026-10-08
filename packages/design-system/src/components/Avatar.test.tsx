import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Avatar } from './Avatar';

afterEach(cleanup);

describe('Avatar', () => {
  it('is one image named by label, whichever part shows', () => {
    render(
      <Avatar.Root label="Ada Lovelace" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    const root = screen.getByTestId('a');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(root.hasAttribute('aria-hidden')).toBe(false);
    expect(screen.getByTestId('img').getAttribute('alt')).toBe('');
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBe(root);
  });

  it('is hidden from assistive technology without a label', () => {
    render(
      <Avatar.Root data-testid="a">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    const root = screen.getByTestId('a');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('role')).toBeNull();
  });

  it('shows the fallback until the image loads, then drops it', () => {
    render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loading');
    expect(screen.getByText('AL')).toBeTruthy();
    fireEvent.load(screen.getByTestId('img'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loaded');
    expect(screen.queryByText('AL')).toBeNull();
  });

  it('keeps the fallback when the image fails or has no src', () => {
    const { rerender } = render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="broken.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    fireEvent.error(screen.getByTestId('img'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('error');
    expect(screen.getByText('AL')).toBeTruthy();
    rerender(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('error');
    expect(screen.getByTestId('img').hasAttribute('src')).toBe(false);
  });

  it('starts over when src changes', () => {
    const tree = (src: string) => (
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src={src} data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const { rerender } = render(tree('one.png'));
    fireEvent.load(screen.getByTestId('img'));
    expect(screen.queryByText('AL')).toBeNull();
    rerender(tree('two.png'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loading');
    expect(screen.getByText('AL')).toBeTruthy();
  });

  it('shows only the fallback with no image, and goes back to it when the image is removed', () => {
    const { rerender } = render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    fireEvent.load(screen.getByTestId('img'));
    rerender(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('idle');
    expect(screen.getByText('AL')).toBeTruthy();
  });

  it('calls the caller handlers too, and takes a size', () => {
    let loaded = 0;
    render(
      <Avatar.Root size="lg" data-testid="a">
        <Avatar.Image src="ada.png" data-testid="img" onLoad={() => loaded++} />
      </Avatar.Root>,
    );
    fireEvent.load(screen.getByTestId('img'));
    expect(loaded).toBe(1);
    expect(screen.getByTestId('a').getAttribute('data-size')).toBe('lg');
  });

  describe('an image already complete when its effect runs', () => {
    // The probe request Avatar.Image makes for an image with no width.
    let probes: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
    const resolve = () => probes.at(-1)!.onload!();
    const reject = () => probes.at(-1)!.onerror!();
    function stub(naturalWidth: number) {
      probes = [];
      vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
      vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(naturalWidth);
      vi.stubGlobal(
        'Image',
        class {
          src = '';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor() {
            probes.push(this);
          }
        },
      );
    }
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });
    const tree = (src = 'ada.svg') => (
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image src={src} data-testid="img" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const status = () => screen.getByTestId('a').getAttribute('data-status');

    it('is loaded at once with a natural width, without a probe', () => {
      stub(64);
      render(tree());
      expect(status()).toBe('loaded');
      expect(probes).toHaveLength(0);
    });

    it('probes one with no width: an SVG with no intrinsic size loads', () => {
      stub(0);
      render(tree());
      expect(status()).toBe('loading');
      expect(probes.at(-1)!.src).toContain('ada.svg');
      act(() => resolve());
      expect(status()).toBe('loaded');
    });

    it('probes one with no width: a broken image keeps the fallback', () => {
      stub(0);
      render(tree());
      act(() => reject());
      expect(status()).toBe('error');
      expect(screen.getByText('AL')).toBeTruthy();
    });

    it('lets a load or error event on the image win over a later probe result', () => {
      stub(0);
      render(tree());
      fireEvent.load(screen.getByTestId('img'));
      act(() => reject());
      expect(status()).toBe('loaded');
      cleanup();
      render(tree());
      fireEvent.error(screen.getByTestId('img'));
      act(() => resolve());
      expect(status()).toBe('error');
    });

    it('decides again from the element when src changes after an event', () => {
      stub(0);
      const { rerender } = render(tree('one.svg'));
      fireEvent.load(screen.getByTestId('img'));
      rerender(tree('two.svg'));
      expect(status()).toBe('loading');
      act(() => resolve());
      expect(status()).toBe('loaded');
    });
  });

  it('loads from srcSet alone, and does not throw where images cannot load', () => {
    // jsdom calls an image with no src complete with no width, and never loads the probe.
    render(
      <Avatar.Root label="Ada" data-testid="a">
        <Avatar.Image srcSet="ada.png 1x, ada@2x.png 2x" data-testid="img" />
      </Avatar.Root>,
    );
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loading');
    fireEvent.load(screen.getByTestId('img'));
    expect(screen.getByTestId('a').getAttribute('data-status')).toBe('loaded');
  });

  it('throws outside Avatar.Root', () => {
    expect(() => render(<Avatar.Fallback>AL</Avatar.Fallback>)).toThrow(/inside Avatar.Root/);
  });
});
